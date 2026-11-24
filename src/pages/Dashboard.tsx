import React, { useMemo } from 'react';
import { LuArrowRight, LuCalendarDays, LuCircleCheck, LuCircle, LuGraduationCap, LuListChecks, LuTarget, LuFileText, LuClock } from 'react-icons/lu';
import { navigate } from '../App';
import { Badge, Button, Card, CardHeader, Counter, EmptyState, PageHeader, Progress, Ring, Stat, bucketTone, cx } from '../components/ui';
import { ChartCard, Columns, Donut, HBars, LineChart, RangeChart } from '../components/charts';
import { profileCompleteness } from '../components/forms';
import { useStore } from '../lib/store';
import type { AppState } from '../lib/types';
import { assess, studentAcademics } from '../lib/analysis';
import { appCompletion, overallCompletion } from '../lib/apps';
import { activityScore } from '../lib/activities';
import { analyzeEssay } from '../lib/essay';
import { byTerm } from '../lib/gpa';
import { byId, daysUntil, fmtDate, pct, usd, usdK } from '../lib/format';
import { DATA_META } from '../data/colleges';
import { demoState } from '../data/demo';
import { store } from '../lib/store';
import { weeklyPlan } from '../lib/plan';
import { openAssistant } from '../components/assistant';
import { LuMic, LuChevronRight } from 'react-icons/lu';

const SRC = `${DATA_META.sources} (${DATA_META.label}, ${DATA_META.reportingYears})`;

const URG = ['bg-line-strong', 'bg-accent', 'bg-amber-500', 'bg-rose-500'];
function PlanCard({ s }: { s: AppState }) {
  const plan = useMemo(() => weeklyPlan(s), [s]);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div><h2 className="text-[15px] font-semibold text-ink">Your next 7 days</h2><p className="text-sm text-muted">Prioritized from your deadlines, checklists and tasks.</p></div>
        <Button size="sm" variant="soft" icon={<LuMic />} onClick={() => openAssistant(true)}>Ask by voice</Button>
      </div>
      {plan.length ? (
        <ul className="divide-y divide-line">
          {plan.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-3">
              {p.taskId ? <button aria-label={`Mark "${p.title}" done`} onClick={() => store.set((st) => { const t = st.tasks.find((x) => x.id === p.taskId); if (t) t.done = true; })} className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-line-strong text-transparent hover:border-teal hover:text-teal"><LuCircleCheck /></button>
                : <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', URG[p.urgency])} aria-label={['Low', 'Normal', 'Soon', 'Urgent'][p.urgency] + ' priority'} />}
              <a href={`#${p.to}`} className="group flex min-w-0 flex-1 items-center gap-3">
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-ink group-hover:text-accent">{p.title}</span><span className="block text-xs text-muted">{p.detail}</span></span>
                <LuChevronRight className="shrink-0 text-muted group-hover:text-accent" />
              </a>
            </li>
          ))}
        </ul>
      ) : <p className="px-5 py-6 text-sm text-muted">Nothing urgent this week. Add applications and deadlines in the tracker to see a plan here.</p>}
    </Card>
  );
}

export default function Dashboard() {
  const s = useStore((x) => x) as AppState;
  const ac = useMemo(() => studentAcademics(s), [s]);
  const comp = profileCompleteness(s);
  const list = s.list.map((l) => ({ l, c: byId(l.collegeId)! })).filter((x) => x.c);
  const assessments = useMemo(() => list.map(({ c }) => assess(c, s)), [s]);
  const buckets = { Reach: 0, Target: 0, Likely: 0 } as Record<string, number>;
  list.forEach(({ l }) => { buckets[l.category] = (buckets[l.category] || 0) + 1; });
  const upcoming = s.apps.filter((a) => a.deadline && daysUntil(a.deadline) >= 0 && !['Submitted', 'Accepted', 'Rejected', 'Waitlisted', 'Deferred'].includes(a.status)).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const next = upcoming[0];
  const tasks = s.tasks.filter((t) => !t.done).sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority]) || (a.due || '9').localeCompare(b.due || '9')).slice(0, 5);
  const terms = byTerm(s.courses);
  const essayScores = s.essays.flatMap((e) => e.drafts.map((d) => ({ label: `${e.title.slice(0, 14)} · ${d.label}`, value: analyzeEssay(d.text, { prompt: e.prompt, limit: e.limit, type: e.type, collegeId: e.collegeId }).overall })));
  const sat = s.profile.sat.total;

  if (!s.meta.onboarded && !s.list.length && !s.courses.length) {
    return (
      <>
        <PageHeader title="Welcome to AdmitIQ" desc="Set up your profile to unlock your dashboard, or explore with a fictional demo student." />
        <Card><EmptyState icon={<LuGraduationCap />} title="Your dashboard is empty" body="Answer a few questions (about 5 minutes, all optional) and AdmitIQ will analyze your profile, suggest a balanced list and set up your tracker." action={<div className="flex flex-wrap justify-center gap-2"><Button variant="primary" onClick={() => navigate('onboarding')}>Start setup</Button><Button onClick={() => store.replace(demoState())}>Load demo student</Button></div>} /></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`${s.profile.name ? `Hi, ${s.profile.name.split(' ')[0]}` : 'Your dashboard'}`} desc={next ? <>Next deadline: <b className="text-ink">{byId(next.collegeId)?.short} {next.round}</b> on {fmtDate(next.deadline)} — {daysUntil(next.deadline)} days away.</> : 'Your college strategy at a glance.'}
        actions={<><Button onClick={() => navigate('strategist')}>Ask the strategist</Button><Button variant="primary" onClick={() => navigate('colleges')}>Find colleges</Button></>} />

      <PlanCard s={s} />

      <div className="stagger mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Unweighted GPA" icon={<LuGraduationCap />} value={<Counter value={ac.gpa4} decimals={2} />} sub={ac.weighted ? `Weighted ${ac.weighted.toFixed(2)} · ${ac.rigor.advanced} AP/IB/DE` : 'Add a transcript for more detail'} />
        <Stat label="Best test score" icon={<LuTarget />} value={sat ? <Counter value={sat} group={false} /> : s.profile.act.composite ? <Counter value={s.profile.act.composite} /> : '—'} sub={sat ? 'SAT' : s.profile.act.composite ? 'ACT' : s.profile.testingStatus} />
        <Stat label="Colleges on list" icon={<LuListChecks />} value={<Counter value={list.length} />} sub={<span className="flex flex-wrap gap-1.5">{(['Reach', 'Target', 'Likely'] as const).map((b) => <Badge key={b} tone={bucketTone(b)}>{buckets[b] || 0} {b}</Badge>)}</span>} />
        <Stat label="Applications complete" icon={<LuCalendarDays />} value={<Counter value={overallCompletion(s.apps)} suffix="%" />} sub={`${s.apps.filter((a) => ['Submitted', 'Accepted', 'Deferred', 'Waitlisted', 'Rejected'].includes(a.status)).length} of ${s.apps.length} submitted`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard title="SAT vs. your colleges' middle 50%" desc={sat ? 'Bands show the 25th–75th percentile of admitted/enrolled students. Teal = you are at/above the 75th; violet = below the 25th.' : 'Add an SAT score to see where you fall.'} source={SRC} legend={[{ label: 'Middle 50% range', color: 'var(--c1)' }, { label: 'Your score', color: 'var(--ink)', dashed: true }]}>
          {list.length ? <RangeChart rows={list.slice(0, 10).map(({ c }) => ({ label: c.short, lo: c.sat?.[0] ?? null, hi: c.sat?.[1] ?? null, note: c.tests === 'Test-free' ? 'Test-free — scores not considered' : 'Range unavailable' }))} min={1000} max={1600} you={sat} youLabel="You" /> : <EmptyState title="No colleges yet" body="Add colleges to your list to compare." />}
        </ChartCard>
        <Card className="p-5">
          <CardHeader flush title="Profile strength" desc="What's filled in — not a prediction." />
          <div className="mt-4 flex items-center gap-5"><Ring value={comp.pct} size={88} stroke={9} tone="var(--teal)" /><p className="text-sm text-muted">The more you add, the more specific your analysis, list and strategist answers become.</p></div>
          <ul className="mt-4 space-y-1">
            {comp.checks.map(([label, ok, to]) => (
              <li key={label}><a href={`#${to}`} className="flex h-9 items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-raised">{ok ? <LuCircleCheck className="text-teal" /> : <LuCircle className="text-muted" />}<span className={ok ? 'text-muted line-through decoration-line-strong' : 'text-ink'}>{label}</span>{!ok && <LuArrowRight className="ml-auto text-muted" />}</a></li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Acceptance rates" desc="Overall admit rate — rates for your major may be lower." source={SRC}>
          <HBars data={list.slice(0, 10).map(({ c }) => ({ label: c.short, value: c.admit, color: c.admit !== null && c.admit < 0.15 ? 'var(--c2)' : 'var(--c1)' }))} max={1} format={(v) => pct(v)} empty="Add colleges to see admit rates." />
        </ChartCard>
        <ChartCard title="Average net price vs. budget" desc={s.financial.maxAnnualCost ? `Your max: ${usd(s.financial.maxAnnualCost)}/yr. Teal = at or under budget.` : 'Set a budget in your profile to compare.'} source={`${SRC}. Average for aided students; your price will differ.`}>
          <HBars data={list.slice(0, 10).map(({ c }) => ({ label: c.short, value: c.netPrice, color: s.financial.maxAnnualCost && c.netPrice !== null && c.netPrice <= s.financial.maxAnnualCost ? 'var(--c3)' : 'var(--c4)' }))} format={(v) => usdK(v)} empty="Add colleges to compare costs." />
        </ChartCard>
        <ChartCard title="List balance" desc="Categories you assigned. Counselors often suggest a mix of all three." source="Your college list (self-reported categories)">
          <Donut parts={[{ label: 'Reach', value: buckets.Reach || 0, color: 'var(--c2)' }, { label: 'Target', value: buckets.Target || 0, color: 'var(--c1)' }, { label: 'Likely', value: buckets.Likely || 0, color: 'var(--c3)' }, ...Object.entries(buckets).filter(([k]) => !['Reach', 'Target', 'Likely'].includes(k)).map(([k, v], i) => ({ label: k, value: v, color: `var(--c${5 + i})` }))]} center={<div><div className="text-2xl font-semibold text-ink tabular-nums">{list.length}</div><div className="text-[11px] text-muted">colleges</div></div>} />
          {list.length > 0 && !buckets.Likely && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">No Likely schools yet — consider adding at least one or two you'd be happy to attend.</p>}
        </ChartCard>
        <ChartCard title="Activity strength" desc="AdmitIQ heuristic: depth, leadership, impact, recognition." source="Your activities (self-reported) · AdmitIQ heuristic">
          <HBars data={s.activities.map((a) => ({ label: a.org, value: activityScore(a).total, color: 'var(--c2)' }))} max={100} format={(v) => String(v)} empty="Add activities in your profile." />
        </ChartCard>
        <ChartCard title="Application completion" desc="Checklist progress for each application." source="Your application tracker">
          <HBars data={s.apps.map((a) => ({ label: byId(a.collegeId)?.short || '—', value: appCompletion(a), color: appCompletion(a) === 100 ? 'var(--c3)' : 'var(--c1)' }))} max={100} format={(v) => `${v}%`} empty="Add applications in the tracker." />
        </ChartCard>
        <ChartCard title="Your admissions picture" desc="AdmitIQ's estimated category per school (not a probability)." source={`${SRC} · AdmitIQ rules — see Admissions analysis`}>
          {assessments.length ? (
            <ul className="space-y-2 text-sm">
              {assessments.slice(0, 8).map((a) => <li key={a.college.id} className="flex items-center justify-between gap-2"><a href={`#college-${a.college.id}`} className="truncate text-ink hover:text-accent">{a.college.short}</a><span className="flex gap-1.5"><Badge tone={bucketTone(a.bucket)}>{a.bucket}</Badge></span></li>)}
            </ul>
          ) : <p className="py-6 text-center text-sm text-muted">Add colleges to see estimates.</p>}
          <Button size="sm" variant="soft" className="mt-4" onClick={() => navigate('analysis')}>Full analysis <LuArrowRight /></Button>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Academic trend" desc="GPA per semester from your transcript." source="Your transcript (self-reported)" legend={[{ label: 'Unweighted', color: 'var(--c1)' }, { label: 'Weighted', color: 'var(--c2)' }]}>
          {terms.length > 1 ? <LineChart labels={terms.map((t) => t.label)} series={[{ name: 'Unweighted', color: 'var(--c1)', values: terms.map((t) => t.unweighted) }, { name: 'Weighted', color: 'var(--c2)', values: terms.map((t) => t.weighted) }]} yMin={2.5} yMax={5} /> : <EmptyState title="Not enough transcript data" body="Add courses from at least two semesters." action={<Button size="sm" onClick={() => navigate('profile-transcript')}>Add courses</Button>} />}
        </ChartCard>
        <ChartCard title="Essay scores over drafts" desc="Average of 12 heuristic rubric scores (1–10). Feedback, not an admissions score." source="Essay Lab heuristic analysis of your drafts">
          {essayScores.length ? <Columns data={essayScores.slice(-8).map((e, i) => ({ ...e, color: i === essayScores.length - 1 ? 'var(--c3)' : 'var(--c1)' }))} max={10} format={(v) => v.toFixed(1)} /> : <EmptyState title="No drafts yet" body="Paste a draft in the Essay Lab." action={<Button size="sm" onClick={() => navigate('essays')}>Open Essay Lab</Button>} />}
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <CardHeader flush title="Deadline timeline" desc="Upcoming deadlines from your tracker." action={<Button size="sm" variant="ghost" onClick={() => navigate('tracker')}>Tracker <LuArrowRight /></Button>} />
          {upcoming.length ? (
            <ol className="relative mt-5 space-y-4 border-l border-line pl-5">
              {upcoming.slice(0, 6).map((a) => { const d = daysUntil(a.deadline); return (
                <li key={a.id} className="relative">
                  <span className={cx('absolute -left-[26.5px] top-1 h-3 w-3 rounded-full border-2 border-surface', d <= 7 ? 'bg-rose-500' : d <= 21 ? 'bg-amber-500' : 'bg-accent')} />
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-ink">{byId(a.collegeId)?.short} · {a.round}</span><span className={cx('text-sm tabular-nums', d <= 7 ? 'font-semibold text-rose-600' : 'text-muted')}>{fmtDate(a.deadline)} · {d === 0 ? 'today' : `${d}d`}</span></div>
                  <Progress value={appCompletion(a)} className="mt-2 h-1.5" label={`${byId(a.collegeId)?.short} completion`} />
                </li>
              ); })}
            </ol>
          ) : <p className="py-8 text-center text-sm text-muted">No upcoming deadlines. Add applications in the tracker.</p>}
        </Card>
        <Card className="p-5">
          <CardHeader flush title="Next tasks" action={<Button size="sm" variant="ghost" onClick={() => navigate('tracker')}>All tasks</Button>} />
          {tasks.length ? (
            <ul className="mt-3 space-y-1">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-lg px-1 py-2">
                  <button aria-label={`Mark "${t.title}" done`} onClick={() => store.set((st) => { const x = st.tasks.find((y) => y.id === t.id); if (x) x.done = true; })} className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-line-strong text-transparent transition-colors hover:border-teal hover:text-teal"><LuCircleCheck /></button>
                  <span className="min-w-0 flex-1 text-sm text-ink">{t.title}</span>
                  {t.due && <span className={cx('flex items-center gap-1 text-xs tabular-nums', daysUntil(t.due) < 0 ? 'text-rose-600' : 'text-muted')}><LuClock />{fmtDate(t.due)}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="py-8 text-center text-sm text-muted">No open tasks. </p>}
          <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="soft" icon={<LuFileText />} onClick={() => navigate('essays')}>Essays</Button><Button size="sm" variant="soft" onClick={() => navigate('costs')}>Costs</Button><Button size="sm" variant="soft" onClick={() => navigate('scholarships')}>Scholarships</Button></div>
        </Card>
      </div>
    </>
  );
}
