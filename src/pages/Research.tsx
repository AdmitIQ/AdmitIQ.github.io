import React, { useMemo, useState } from 'react';
import { LuSearch, LuFlaskConical, LuGlobe } from 'react-icons/lu';
import { useCaps } from '../App';
import { Badge, Button, Card, CardHeader, ExtLink, Input, Notice, PageHeader, Select, SourceTag, Tabs } from '../components/ui';
import { ResearchLoader, type StepState } from '../components/loader';
import { COLLEGES, DATA_META, cdsSearchUrl, navigatorUrl, npcSearchUrl, scorecardUrl, type College } from '../data/colleges';
import { research, type ResearchResult } from '../lib/services';
import { num, pct, prov, range, usd } from '../lib/format';

const FIELDS: { key: keyof College; label: string; conf: keyof typeof DATA_META.confidence; fmt: (c: College) => string; kw: RegExp }[] = [
  { key: 'admit', label: 'Admit rate', conf: 'admit', fmt: (c) => pct(c.admit), kw: /accept|admit|selectiv|chance|get in/i },
  { key: 'sat', label: 'SAT middle 50%', conf: 'sat', fmt: (c) => range(c.sat), kw: /sat\b|score|test/i },
  { key: 'act', label: 'ACT middle 50%', conf: 'act', fmt: (c) => range(c.act), kw: /act\b|score|test/i },
  { key: 'tests', label: 'Testing policy', conf: 'tests', fmt: (c) => c.tests, kw: /test|optional|required|sat|act/i },
  { key: 'tuitionIn', label: 'Tuition (in-state / all)', conf: 'tuition', fmt: (c) => usd(c.tuitionIn), kw: /tuition|cost|price|afford|expens/i },
  { key: 'tuitionOut', label: 'Tuition (out-of-state)', conf: 'tuition', fmt: (c) => usd(c.tuitionOut), kw: /tuition|out.of.state|cost/i },
  { key: 'coaIn', label: 'Cost of attendance', conf: 'coa', fmt: (c) => usd(c.coaIn), kw: /cost|price|afford|attendance|expens/i },
  { key: 'netPrice', label: 'Average net price', conf: 'netPrice', fmt: (c) => usd(c.netPrice), kw: /net price|aid|afford|cost/i },
  { key: 'grad', label: '6-year graduation rate', conf: 'grad', fmt: (c) => pct(c.grad), kw: /graduat|finish|complet/i },
  { key: 'retention', label: 'First-year retention', conf: 'retention', fmt: (c) => pct(c.retention), kw: /retention|return|stay/i },
  { key: 'earnings', label: 'Median earnings', conf: 'earnings', fmt: (c) => usd(c.earnings), kw: /earn|salary|income|job|career|outcome/i },
  { key: 'debt', label: 'Median debt', conf: 'debt', fmt: (c) => usd(c.debt), kw: /debt|loan|borrow/i },
  { key: 'sfr', label: 'Student-to-faculty ratio', conf: 'sfr', fmt: (c) => (c.sfr ? `${c.sfr}:1` : 'Unavailable'), kw: /faculty|class size|professor|ratio/i },
  { key: 'undergrad', label: 'Undergraduate enrollment', conf: 'undergrad', fmt: (c) => num(c.undergrad), kw: /size|enroll|students|big|small/i },
  { key: 'deadlines', label: 'Typical deadlines', conf: 'deadlines', fmt: (c) => Object.entries(c.deadlines).map(([r, d]) => `${r} ${d}`).join(', ') || 'Open', kw: /deadline|due|when|ed\b|ea\b|early/i },
];

const PRIORITY = ['Official university admissions websites', 'Official Common Data Sets', 'Official tuition & financial aid pages', 'College Scorecard (U.S. Dept. of Education)', 'IPEDS / College Navigator (NCES)', 'Official university outcome reports', 'Government education databases', 'Reputable college research organizations', 'Publicly available student discussions (anecdotal)', 'Public applicant experiences (anecdotal)'];

export default function Research() {
  const { caps } = useCaps();
  const [tab, setTab] = useState<'ask' | 'registry' | 'method'>('ask');
  const [q, setQ] = useState('');
  const [cid, setCid] = useState('');
  const [steps, setSteps] = useState<StepState[] | null>(null);
  const [remote, setRemote] = useState<ResearchResult | null>(null);
  const [local, setLocal] = useState<{ q: string; colleges: College[]; fields: typeof FIELDS } | null>(null);
  const [regCollege, setRegCollege] = useState('all');
  const registry = useMemo(() => (regCollege === 'all' ? COLLEGES : COLLEGES.filter((c) => c.id === regCollege)).flatMap((c) => FIELDS.map((f) => ({ c, f, v: c[f.key] as unknown }))), [regCollege]);
  const unavailable = registry.filter((r) => r.v === null || r.v === undefined || (typeof r.v === 'object' && !Array.isArray(r.v) && Object.keys(r.v as object).length === 0)).length;

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const question = q.trim(); if (!question) return;
    setRemote(null); setLocal(null);
    const mentioned = cid ? COLLEGES.filter((c) => c.id === cid) : COLLEGES.filter((c) => question.toLowerCase().includes(c.short.toLowerCase()) || question.toLowerCase().includes(c.name.toLowerCase()));
    if (caps?.research.search || caps?.research.scorecard) {
      setSteps([{ label: 'Identifying the question', status: 'active' }, { label: 'Searching official sources on the server', status: 'pending' }]);
      try {
        const r = await research.ask(question, mentioned.map((c) => c.id));
        setSteps(r.steps.map((x) => ({ label: x.label, status: x.status === 'done' ? 'done' : x.status === 'error' ? 'error' : 'done', detail: x.detail })));
        setRemote(r);
      } catch (err) { setSteps([{ label: 'Server research', status: 'error', detail: (err as Error).message }]); }
      return;
    }
    // Offline fallback: real lookups against the bundled dataset only.
    const fields = FIELDS.filter((f) => f.kw.test(question));
    setSteps([
      { label: 'Identifying the question', status: 'done', detail: `${mentioned.length ? mentioned.map((c) => c.short).join(', ') : 'No specific college detected'} · ${fields.length ? fields.map((f) => f.label).join(', ') : 'no matching data fields'}` },
      { label: 'Live web search', status: 'error', detail: 'Unavailable in this deployment (no research server). Falling back to stored data.' },
      { label: 'Looking up stored dataset', status: 'done', detail: `${mentioned.length * Math.max(1, fields.length)} values checked` },
    ]);
    setLocal({ q: question, colleges: mentioned.length ? mentioned : [], fields: fields.length ? fields : FIELDS.slice(0, 6) });
  }

  return (
    <>
      <PageHeader title="Research center" desc="Where AdmitIQ's numbers come from, how confident they are, and a research workflow that cites its sources." />
      <Tabs tabs={[{ id: 'ask', label: 'Ask a research question' }, { id: 'registry', label: 'Source registry' }, { id: 'method', label: 'Methodology' }]} value={tab} onChange={setTab} className="mb-5" />

      {tab === 'ask' && (
        <div className="space-y-4">
          {!(caps?.research.search || caps?.research.scorecard) && <Notice><b>Live web research is off in this deployment.</b> Questions are answered from AdmitIQ's stored dataset, with links to the official sources to verify. Run the AdmitIQ server with a College Scorecard key (free) and optionally a search API to enable live, cited research.</Notice>}
          <Card className="p-5">
            <form onSubmit={run} className="flex flex-wrap gap-2">
              <div className="relative min-w-[240px] flex-1"><LuSearch className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" /><Input aria-label="Research question" className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What is Purdue's graduation rate and average debt?" /></div>
              <Select aria-label="College" value={cid} onChange={(e) => setCid(e.target.value)} options={[{ value: '', label: 'Detect college from question' }, ...COLLEGES.map((c) => ({ value: c.id, label: c.short }))]} className="w-auto" />
              <Button type="submit" variant="primary" icon={<LuFlaskConical />} disabled={!q.trim()}>Research</Button>
            </form>
          </Card>
          {steps && <Card className="p-5"><ResearchLoader steps={steps} title="Research steps" /></Card>}
          {local && (
            <Card className="p-5">
              <CardHeader flush title="Findings from stored data" desc="Values are unverified recall of official sources — use the links to confirm." />
              {!local.colleges.length ? <p className="mt-3 text-sm text-muted">No college detected. Name one (e.g. "UNC") or pick it from the menu.</p> : local.colleges.map((c) => (
                <div key={c.id} className="mt-4">
                  <h3 className="font-semibold text-ink">{c.name}</h3>
                  <dl className="mt-2 divide-y divide-line">{local.fields.map((f) => <div key={String(f.key)} className="flex items-center justify-between gap-3 py-2.5 text-sm"><dt className="text-muted">{f.label}</dt><dd className="flex items-center gap-2 font-medium tabular-nums text-ink">{f.fmt(c)}<SourceTag {...prov(c, f.conf, c[f.key])} /></dd></div>)}</dl>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">{c.country === 'USA' && <ExtLink href={scorecardUrl(c)}>College Scorecard</ExtLink>}{c.country === 'USA' && <ExtLink href={navigatorUrl(c)}>College Navigator</ExtLink>}{c.country === 'USA' && <ExtLink href={cdsSearchUrl(c)}>Common Data Set</ExtLink>}<ExtLink href={c.web}>Official admissions</ExtLink><ExtLink href={npcSearchUrl(c)}>Net price calculator</ExtLink></div>
                  <p className="mt-2 text-xs text-muted">Uncertainty: single-source recall; not cross-checked. Multiple sources: no. Reporting year {DATA_META.reportingYears}.</p>
                </div>
              ))}
            </Card>
          )}
          {remote && (
            <Card className="p-5">
              <CardHeader flush title="Research findings" desc={`Question: ${remote.question}`} />
              {remote.summary && <div className="mt-3 rounded-xl border border-violet-500/25 bg-violet-500/[0.05] p-4"><Badge tone="violet" className="mb-2">AI-generated summary of cited sources</Badge><p className="whitespace-pre-wrap text-sm text-ink">{remote.summary}</p></div>}
              <div className="scroll mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b border-line text-left text-muted"><th className="py-2 pr-3 font-medium">Finding</th><th className="py-2 pr-3 font-medium">Value</th><th className="py-2 pr-3 font-medium">Source</th><th className="py-2 pr-3 font-medium">Retrieved</th><th className="py-2 font-medium">Confidence</th></tr></thead>
                  <tbody>{remote.findings.map((f, i) => <tr key={i} className="border-b border-line last:border-0"><td className="py-2.5 pr-3 text-ink">{f.claim}</td><td className="py-2.5 pr-3 tabular-nums text-ink">{f.value || '—'}</td><td className="py-2.5 pr-3"><ExtLink href={f.url}>{f.source}</ExtLink>{f.official && <Badge tone="green" className="ml-1.5">Official</Badge>}</td><td className="py-2.5 pr-3 text-muted">{f.retrieved}{f.reportingYear ? ` · ${f.reportingYear}` : ''}</td><td className="py-2.5"><Badge tone={f.confidence === 'High' ? 'green' : f.confidence === 'Medium' ? 'blue' : 'amber'}>{f.confidence}</Badge></td></tr>)}</tbody>
                </table>
              </div>
              {!remote.findings.length && <p className="mt-3 text-sm text-muted">No sources returned. AdmitIQ won't fill the gap with guesses.</p>}
              {remote.conflicts.length > 0 && <Notice tone="warn" className="mt-4"><b>Conflicting values</b><ul className="list-disc pl-5">{remote.conflicts.map((x) => <li key={x}>{x}</li>)}</ul></Notice>}
              {remote.uncertainty.length > 0 && <div className="mt-4 text-sm text-muted"><b className="text-ink">Uncertainty:</b> {remote.uncertainty.join(' ')}</div>}
            </Card>
          )}
        </div>
      )}

      {tab === 'registry' && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-5">
            <Select aria-label="Filter registry by college" value={regCollege} onChange={(e) => setRegCollege(e.target.value)} options={[{ value: 'all', label: `All colleges (${COLLEGES.length})` }, ...COLLEGES.map((c) => ({ value: c.id, label: c.short }))]} className="w-auto" />
            <Badge tone="amber">{registry.length - unavailable} unverified (recall)</Badge><Badge>{unavailable} unavailable</Badge><Badge tone="green">0 verified</Badge>
          </div>
          <div className="scroll max-h-[70vh] overflow-auto border-t border-line">
            <table className="stack w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-surface"><tr className="border-b border-line text-left text-muted"><th className="px-5 py-2 font-medium">College</th><th className="px-3 py-2 font-medium">Field</th><th className="px-3 py-2 font-medium">Value</th><th className="px-3 py-2 font-medium">Source</th><th className="px-3 py-2 font-medium">Reporting year</th><th className="px-3 py-2 font-medium">Collected</th><th className="px-3 py-2 font-medium">Confidence</th><th className="px-5 py-2 font-medium">Status</th></tr></thead>
              <tbody>
                {registry.map(({ c, f }) => { const p = prov(c, f.conf, c[f.key]); return (
                  <tr key={c.id + String(f.key)} className="border-b border-line last:border-0">
                    <td className="px-5 py-2 text-ink">{c.short}</td><td className="px-3 py-2 text-muted">{f.label}</td><td className="px-3 py-2 tabular-nums text-ink">{f.fmt(c)}</td>
                    <td className="px-3 py-2">{p.url ? <ExtLink href={p.url}>{c.country === 'USA' && f.conf !== 'tests' && f.conf !== 'deadlines' ? 'College Scorecard' : 'Official site'}</ExtLink> : '—'}</td>
                    <td className="px-3 py-2 text-muted">{p.year || '—'}</td><td className="px-3 py-2 text-muted">{p.retrieved}</td><td className="px-3 py-2 text-muted">{p.confidence || '—'}</td>
                    <td className="px-5 py-2"><Badge tone={p.kind === 'Unavailable' ? 'neutral' : 'amber'}>{p.kind}</Badge></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'method' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Source priority</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">{PRIORITY.map((x) => <li key={x}>{x}</li>)}</ol>
            <p className="mt-3 text-sm text-muted">Official sources always win a conflict. Community sources are only used for experience themes, never for statistics.</p>
          </Card>
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Data labels</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {[['Verified', 'green', 'Retrieved from an official source with a recorded date (e.g. a College Scorecard sync).'], ['Unverified (recall)', 'amber', 'Bundled approximations of official figures; not live-checked.'], ['Estimated', 'blue', 'Calculated by AdmitIQ from other values (e.g. 4-year cost).'], ['Self-reported', 'violet', 'Entered by you.'], ['Historical', 'neutral', 'Older than the latest reporting year.'], ['AI interpretation', 'violet', 'Opinion generated by an AI model; may be wrong.'], ['Unavailable', 'neutral', 'Not in the dataset. Never guessed.']].map(([l, t, d]) => <li key={l} className="flex items-start gap-2"><Badge tone={t}>{l}</Badge><span className="text-muted">{d}</span></li>)}
            </ul>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><LuGlobe />How server-side research works</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
              <li>Identify the question and colleges involved.</li>
              <li>Query College Scorecard's official API for matching institutions (free api.data.gov key).</li>
              <li>Optionally query a search API (Tavily or Brave, bring your own key) restricted to official .edu/.gov domains first.</li>
              <li>Fetch only publicly accessible pages after checking robots.txt, with rate limits; paywalled or restricted sources are skipped.</li>
              <li>Extract facts, record source URL, retrieval date and reporting year, and cross-check values across sources.</li>
              <li>Flag conflicts and uncertainty; summarize only from the cited sources (if an AI provider is configured).</li>
            </ol>
          </Card>
        </div>
      )}
    </>
  );
}
