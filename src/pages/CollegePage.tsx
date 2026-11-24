import React, { useMemo, useState } from 'react';
import { LuArrowLeft, LuCalendarPlus, LuCheck, LuGitCompare, LuMapPin, LuPlus, LuStar } from 'react-icons/lu';
import { navigate } from '../App';
import { Badge, Button, Card, CardHeader, EmptyState, ExtLink, Notice, PageHeader, SourceTag, Tabs, Textarea, bucketTone, compTone, cx, useToast } from '../components/ui';
import { ChartCard, RangeChart, StackedBars } from '../components/charts';
import { COLLEGES, DATA_META, NPC_CENTER, cdsSearchUrl, navigatorUrl, npcSearchUrl, scorecardUrl, type College } from '../data/colleges';
import { store, uid, useStore } from '../lib/store';
import { assess, fit } from '../lib/analysis';
import { distanceFromHome } from '../lib/geo';
import { cycleDate, fmtDate, num, pct, prov, range, usd } from '../lib/format';
import { Term } from '../components/term';

function Row({ label, value, p }: { label: React.ReactNode; value: React.ReactNode; p?: ReturnType<typeof prov> }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="flex items-center gap-2 text-right text-sm font-medium tabular-nums text-ink">{value}{p && <SourceTag {...p} />}</dd>
    </div>
  );
}

function themesFor(c: College, exps: ReturnType<typeof store.get>['experiences']) { return exps.filter((e) => e.collegeId === c.id); }

export default function CollegePage({ id }: { id: string }) {
  const c = COLLEGES.find((x) => x.id === id);
  const s = useStore((x) => x);
  const toast = useToast();
  const [tab, setTab] = useState<'overview' | 'admissions' | 'costs' | 'outcomes' | 'analysis' | 'experiences'>('overview');
  const a = useMemo(() => (c ? assess(c, s) : null), [c, s]);
  const f = useMemo(() => (c ? fit(c, s) : null), [c, s]);
  if (!c || !a || !f) return <Card><EmptyState title="College not found" body="This college isn't in AdmitIQ's dataset." action={<Button onClick={() => navigate('colleges')}>Back to search</Button>} /></Card>;
  const item = s.list.find((l) => l.collegeId === c.id);
  const inCompare = s.compare.includes(c.id);
  const app = s.apps.find((x) => x.collegeId === c.id);
  const inState = s.profile.state === c.state;
  const dist = s.profile.state ? distanceFromHome(s.profile.state, c) : null;
  const exps = themesFor(c, s.experiences);
  const isUS = c.country === 'USA';
  const other = c.coaIn !== null && c.tuitionIn !== null && c.housingMeals !== null ? Math.max(0, c.coaIn - c.tuitionIn - c.housingMeals) : null;

  function addToList() {
    store.set((st) => { if (item) st.list = st.list.filter((l) => l.collegeId !== c!.id); else st.list.push({ collegeId: c!.id, category: a!.bucket, favorite: false, notes: '', addedAt: new Date().toISOString() }); });
    toast(item ? `Removed ${c!.short}` : `Added ${c!.short} as ${a!.bucket}`);
  }
  function track() {
    if (app) return navigate('tracker');
    const round = c!.rounds.includes('EA') ? 'EA' : c!.rounds.includes('RD') ? 'RD' : c!.rounds[0] || 'RD';
    const mmdd = c!.deadlines[round];
    store.set((st) => {
      st.apps.push({ id: uid(), collegeId: c!.id, round, deadline: mmdd ? cycleDate(mmdd, st.profile.gradYear) : '', status: 'Planned', items: { essays: 'Not started', recommendations: 'Not started', transcript: 'Not started', testing: c!.tests === 'Test-free' ? 'N/A' : 'Not started', financialAid: 'Not started', scholarships: 'Not started', interview: 'N/A' }, submitted: '', decisionDate: '', result: '', notes: '' });
      if (!st.list.some((l) => l.collegeId === c!.id)) st.list.push({ collegeId: c!.id, category: a!.bucket, favorite: false, notes: '', addedAt: new Date().toISOString() });
    });
    toast(`Added ${c!.short} to your tracker${mmdd ? ` (typical ${round} deadline ${mmdd}, verify)` : ''}`);
  }

  return (
    <>
      <button onClick={() => history.length > 1 ? history.back() : navigate('colleges')} className="mb-4 inline-flex h-9 items-center gap-1.5 text-sm text-muted hover:text-ink"><LuArrowLeft /> Back</button>
      <PageHeader title={c.name}
        desc={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="inline-flex items-center gap-1"><LuMapPin />{c.city}, {c.state}{c.country !== 'USA' ? `, ${c.country}` : ''}</span>{dist !== null && isUS && <span>~{dist.toLocaleString()} mi from home (rough)</span>}<span>{c.kind} · {c.setting}</span></span>}
        actions={<>
          <Button variant={item ? 'soft' : 'primary'} icon={item ? <LuCheck /> : <LuPlus />} onClick={addToList}>{item ? 'On my list' : 'Add to list'}</Button>
          <Button icon={<LuGitCompare />} variant={inCompare ? 'soft' : 'secondary'} onClick={() => store.set((st) => { st.compare = inCompare ? st.compare.filter((x) => x !== c.id) : [...st.compare, c.id].slice(0, 10); })}>{inCompare ? 'In compare' : 'Compare'}</Button>
          <Button icon={<LuCalendarPlus />} onClick={track}>{app ? 'View in tracker' : 'Track application'}</Button>
        </>} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={bucketTone(a.bucket)}>Estimated {a.bucket}</Badge><Badge tone={compTone(a.competitiveness)}>{a.competitiveness}</Badge><Badge>Fit {f.score}/100</Badge>
        {item && <button onClick={() => store.set((st) => { const l = st.list.find((x) => x.collegeId === c.id); if (l) l.favorite = !l.favorite; })} className={cx('inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium', item.favorite ? 'border-amber-400 bg-amber-400/15 text-amber-700 dark:text-amber-300' : 'border-line text-muted')}><LuStar className={item.favorite ? 'fill-current' : ''} />{item.favorite ? 'Favorite' : 'Mark favorite'}</button>}
      </div>

      <Tabs value={tab} onChange={setTab} className="mb-5" tabs={[{ id: 'overview', label: 'Overview' }, { id: 'admissions', label: 'Admissions' }, { id: 'costs', label: 'Costs & aid' }, { id: 'outcomes', label: 'Outcomes' }, { id: 'analysis', label: 'Your analysis' }, { id: 'experiences', label: 'Student experiences', count: exps.length }]} />

      <div key={tab} className="fade-up">
        {tab === 'overview' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Card className="p-5">
              <CardHeader flush title="At a glance" desc="Tap a status tag to see source, reporting year and confidence." />
              <dl className="mt-3">
                <Row label="Undergraduates" value={num(c.undergrad)} p={prov(c, 'undergrad', c.undergrad)} />
                <Row label={<Term t="acceptance rate">Admit rate</Term>} value={c.kind === 'Community college' ? 'Open admission' : pct(c.admit)} p={prov(c, 'admit', c.admit)} />
                <Row label="Student-to-faculty ratio" value={c.sfr ? `${c.sfr}:1` : 'Unavailable'} p={prov(c, 'sfr', c.sfr)} />
                <Row label={<Term t={c.tests === 'Test-free' ? 'test-free' : 'test-optional'}>Testing policy</Term>} value={c.tests} p={{ ...prov(c, 'tests', c.tests), source: 'Official admissions website (policies change yearly)' }} />
                <Row label={<Term t="early action">Application rounds</Term>} value={c.rounds.join(' · ') || '—'} p={{ ...prov(c, 'deadlines', c.rounds), source: 'Official admissions website' }} />
                <Row label="6-year graduation rate" value={pct(c.grad)} p={prov(c, 'grad', c.grad)} />
                <Row label={<Term t="net price">Average net price</Term>} value={usd(c.netPrice)} p={prov(c, 'netPrice', c.netPrice)} />
              </dl>
            </Card>
            <div className="space-y-4">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-ink">Programs & features</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">{c.features.map((x) => <Badge key={x} tone="blue">{x}</Badge>)}</div>
                <h4 className="mt-4 text-xs font-medium text-muted">Majors in AdmitIQ's taxonomy ({c.majors.length})</h4>
                <div className="mt-2 flex flex-wrap gap-1.5">{c.majors.map((m) => <Badge key={m} tone={m === s.profile.intendedMajor ? 'teal' : 'neutral'}>{m}</Badge>)}</div>
                <p className="mt-3 text-xs text-muted">Broad categories, not the official program list.</p>
              </Card>
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-ink">Official sources</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  <li><ExtLink href={c.web}>Admissions website</ExtLink></li>
                  {isUS && <li><ExtLink href={scorecardUrl(c)}>College Scorecard (U.S. Dept. of Education)</ExtLink></li>}
                  {isUS && <li><ExtLink href={navigatorUrl(c)}>College Navigator (IPEDS)</ExtLink></li>}
                  {isUS && <li><ExtLink href={cdsSearchUrl(c)}>Find the Common Data Set</ExtLink></li>}
                  <li><ExtLink href={npcSearchUrl(c)}>Find the official net price calculator</ExtLink></li>
                </ul>
              </Card>
              {c.notes && <Notice tone="warn">{c.notes}</Notice>}
            </div>
          </div>
        )}

        {tab === 'admissions' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <CardHeader flush title="Admissions statistics" />
              <dl className="mt-3">
                <Row label="Overall admit rate" value={pct(c.admit)} p={prov(c, 'admit', c.admit)} />
                <Row label="Early Decision admit rate" value="Unavailable" p={prov(c, 'admit', null)} />
                <Row label="Early Action admit rate" value="Unavailable" p={prov(c, 'admit', null)} />
                <Row label={<Term t="middle 50%">SAT middle 50%</Term>} value={range(c.sat)} p={prov(c, 'sat', c.sat)} />
                <Row label="ACT middle 50%" value={range(c.act)} p={prov(c, 'act', c.act)} />
                <Row label="Average HS GPA (as published)" value={c.gpaAvg ?? 'Unavailable'} p={prov(c, 'sat', c.gpaAvg)} />
                <Row label="Class rank distribution" value="Unavailable" />
                <Row label="Applications / yield" value="Unavailable" />
              </dl>
              <p className="mt-3 text-xs text-muted">Round-specific rates, rank distributions, application volume and yield are published in each school's Common Data Set (sections C1–C2, C10–C11, C21–C22). AdmitIQ doesn't have verified copies, so they're shown as unavailable.</p>
            </Card>
            <div className="space-y-4">
              <ChartCard title="Your scores vs. the middle 50%" source={`${DATA_META.sources} (${DATA_META.label})`}>
                {c.sat || c.act ? (
                  <div className="space-y-6">
                    {c.sat && <RangeChart rows={[{ label: 'SAT', lo: c.sat[0], hi: c.sat[1] }]} min={900} max={1600} you={s.profile.sat.total} youLabel="You" />}
                    {c.act && <RangeChart rows={[{ label: 'ACT', lo: c.act[0], hi: c.act[1] }]} min={15} max={36} you={s.profile.act.composite} youLabel="You" />}
                  </div>
                ) : <p className="py-6 text-center text-sm text-muted">{c.tests === 'Test-free' ? `${c.short} does not consider test scores.` : 'Score ranges unavailable.'}</p>}
              </ChartCard>
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-ink">Typical deadlines</h3>
                {Object.keys(c.deadlines).length ? (
                  <ul className="mt-3 space-y-2 text-sm">{Object.entries(c.deadlines).map(([r, d]) => <li key={r} className="flex justify-between"><span className="text-muted">{r}</span><span className="font-medium tabular-nums text-ink">{fmtDate(cycleDate(d, s.profile.gradYear))}</span></li>)}</ul>
                ) : <p className="mt-2 text-sm text-muted">Open enrollment — no fixed application deadline.</p>}
                <p className="mt-3 text-xs text-muted">Projected from recent cycles for your graduation year. Always confirm on the official site.</p>
              </Card>
            </div>
          </div>
        )}

        {tab === 'costs' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <CardHeader flush title="Cost of attendance (per year)" desc={c.kind === 'Public' ? (inState ? 'In-state rates apply to you.' : 'Out-of-state rates apply based on your home state.') : undefined} />
              <dl className="mt-3">
                <Row label="Tuition & fees (in-state)" value={usd(c.tuitionIn)} p={prov(c, 'tuition', c.tuitionIn)} />
                {c.kind === 'Public' && <Row label="Tuition & fees (out-of-state)" value={usd(c.tuitionOut)} p={prov(c, 'tuition', c.tuitionOut)} />}
                <Row label="Housing & meals" value={usd(c.housingMeals)} p={prov(c, 'coa', c.housingMeals)} />
                <Row label={<Term t="cost of attendance">Total cost of attendance</Term>} value={usd(c.kind === 'Public' && !inState ? c.coaOut : c.coaIn)} p={prov(c, 'coa', c.coaIn)} />
                <Row label="Average net price" value={usd(c.netPrice)} p={prov(c, 'netPrice', c.netPrice)} />
                <Row label="Net price by income" value="Unavailable" p={prov(c, 'netPrice', null)} />
                <Row label="Median federal debt" value={usd(c.debt)} p={prov(c, 'debt', c.debt)} />
              </dl>
            </Card>
            <div className="space-y-4">
              <ChartCard title="Sticker cost breakdown" source={`${DATA_META.sources} (${DATA_META.label})`} legend={[{ label: 'Tuition & fees', color: 'var(--c1)' }, { label: 'Housing & meals', color: 'var(--c2)' }, { label: 'Books, travel, personal', color: 'var(--c3)' }]}>
                {c.tuitionIn !== null ? <StackedBars format={usd} keys={[{ key: 't', label: 'Tuition & fees', color: 'var(--c1)' }, { key: 'h', label: 'Housing & meals', color: 'var(--c2)' }, { key: 'o', label: 'Other', color: 'var(--c3)' }]}
                  rows={[{ label: c.kind === 'Public' ? 'In-state' : 'All students', parts: { t: c.tuitionIn, h: c.housingMeals ?? 0, o: other ?? 0 }, total: c.coaIn }, ...(c.kind === 'Public' && c.tuitionOut !== null ? [{ label: 'Out-of-state', parts: { t: c.tuitionOut, h: c.housingMeals ?? 0, o: c.coaOut !== null && c.housingMeals !== null ? Math.max(0, c.coaOut - c.tuitionOut - c.housingMeals) : 0 }, total: c.coaOut }] : [])]} /> : <p className="py-6 text-center text-sm text-muted">Cost data unavailable. Check the official site.</p>}
              </ChartCard>
              <Notice>Average net price is what aided students paid on average — yours could be much higher or lower. Use the <ExtLink href={npcSearchUrl(c)}>{c.short} net price calculator</ExtLink> or the <ExtLink href={NPC_CENTER}>federal net price center</ExtLink>. <a href="#costs" className="font-medium text-accent hover:underline">Model scenarios →</a></Notice>
            </div>
          </div>
        )}

        {tab === 'outcomes' && (
          <Card className="p-5">
            <CardHeader flush title="Outcomes" />
            <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
              <Row label="6-year graduation rate" value={pct(c.grad)} p={prov(c, 'grad', c.grad)} />
              <Row label="First-year retention" value={pct(c.retention)} p={prov(c, 'retention', c.retention)} />
              <Row label="Median earnings (~10 yrs after entry)" value={usd(c.earnings)} p={prov(c, 'earnings', c.earnings)} />
              <Row label="Median federal debt" value={usd(c.debt)} p={prov(c, 'debt', c.debt)} />
              <Row label="Employment rate" value="Unavailable" />
              <Row label="Graduate school rate" value="Unavailable" />
              <Row label="Major-specific outcomes" value="Unavailable" />
              <Row label="Career services" value={c.features.some((x) => /co-op|internship/i.test(x)) ? 'Co-op / internship program' : 'Unavailable'} />
            </dl>
            <p className="mt-4 text-sm text-muted">Earnings figures are institution-wide and only cover federally aided students. College Scorecard also publishes earnings by field of study: <ExtLink href={scorecardUrl(c)}>view on College Scorecard</ExtLink>. Many schools publish "first destination" reports with employment and grad-school rates.</p>
          </Card>
        )}

        {tab === 'analysis' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <CardHeader flush title={`${a.competitiveness} · estimated ${a.bucket}`} desc="Rule-based estimate from your entered data vs. published ranges. Not a probability." />
              <ul className="mt-4 space-y-3 text-sm">{a.academic.map((x) => <li key={x.label}><span className="font-medium text-ink">{x.label}: </span><span className="text-muted">{x.detail}</span></li>)}</ul>
              <h4 className="mt-5 text-sm font-semibold text-ink">Testing</h4><p className="mt-1 text-sm text-muted">{a.testing}</p>
              <h4 className="mt-5 text-sm font-semibold text-ink">Suggested round</h4><p className="mt-1 text-sm text-muted">{a.round}</p>
              {a.major.length > 0 && <><h4 className="mt-5 text-sm font-semibold text-ink">Major considerations</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{a.major.map((m) => <li key={m}>{m}</li>)}</ul></>}
            </Card>
            <div className="space-y-4">
              {[['Strengths', a.strengths, 'teal'], ['Weaknesses', a.weaknesses, 'rose'], ['Missing information', a.missing, 'amber'], ['Potential improvements', a.improvements, 'blue'], ['Application strategy (opinion)', a.strategy, 'violet']].map(([t, items, tone]) => (items as string[]).length ? (
                <Card key={t as string} className="p-5"><h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Badge tone={tone as string}>{(items as string[]).length}</Badge>{t as string}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{(items as string[]).map((x) => <li key={x}>{x}</li>)}</ul></Card>
              ) : null)}
              <Card className="p-5"><h3 className="text-sm font-semibold text-ink">Fit {f.score}/100</h3><p className="mt-1 text-sm text-muted">{f.reasons.length ? `Matches: ${f.reasons.join(', ')}.` : 'Add preferences to your profile for a fit score.'}{f.concerns.length ? ` Concerns: ${f.concerns.join(', ')}.` : ''}</p></Card>
            </div>
          </div>
        )}

        {tab === 'experiences' && (
          <Card className="p-5">
            {exps.length < 3 ? <EmptyState title="Not enough student experiences" body={`AdmitIQ has ${exps.length} anonymous submission${exps.length === 1 ? '' : 's'} for ${c.short} on this device — too few to summarize themes reliably (minimum 3).`} action={<Button onClick={() => navigate('community')}>Share or view experiences</Button>} /> : (
              <ul className="space-y-3">{exps.map((e) => <li key={e.id} className="rounded-xl border border-line p-4 text-sm"><div className="text-xs text-muted">{e.relation} · {e.year} · anonymous</div>{e.positives && <p className="mt-1 text-ink">+ {e.positives}</p>}{e.concerns && <p className="mt-1 text-muted">– {e.concerns}</p>}</li>)}</ul>
            )}
          </Card>
        )}
      </div>

      {item && (
        <Card className="mt-4 p-5">
          <label htmlFor="col-notes" className="text-sm font-semibold text-ink">Your notes</label>
          <Textarea id="col-notes" rows={3} className="mt-2" value={item.notes} placeholder="Visit impressions, questions for admissions, programs to mention in your essay…" onChange={(e) => store.set((st) => { const l = st.list.find((x) => x.collegeId === c.id); if (l) l.notes = e.target.value; })} />
        </Card>
      )}
    </>
  );
}
