import React, { useMemo, useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';
import { navigate } from '../App';
import { Badge, Button, Card, EmptyState, Notice, PageHeader, Select, bucketTone, compTone, cx } from '../components/ui';
import { COLLEGES } from '../data/colleges';
import { useStore } from '../lib/store';
import { assess, studentAcademics, type Assessment } from '../lib/analysis';
import { WhatIf } from '../components/whatif';
import { Term } from '../components/term';

function Detail({ a }: { a: Assessment }) {
  const sec = (t: string, items: string[], tone: string) => items.length ? <div><h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink"><Badge tone={tone}>{items.length}</Badge>{t}</h4><ul className="list-disc space-y-1 pl-5 text-sm text-muted">{items.map((x) => <li key={x}>{x}</li>)}</ul></div> : null;
  return (
    <div className="grid gap-5 border-t border-line px-5 py-5 md:grid-cols-2">
      <div className="space-y-4">
        <div><h4 className="mb-1 text-sm font-semibold text-ink">Academic competitiveness</h4><ul className="space-y-1.5 text-sm">{a.academic.map((x) => <li key={x.label}><b className="font-medium text-ink">{x.label}:</b> <span className="text-muted">{x.detail}</span></li>)}</ul></div>
        <div><h4 className="mb-1 text-sm font-semibold text-ink">Testing recommendation</h4><p className="text-sm text-muted">{a.testing}</p></div>
        <div><h4 className="mb-1 text-sm font-semibold text-ink">Suggested round</h4><p className="text-sm text-muted">{a.round}</p></div>
        {a.major.length > 0 && <div><h4 className="mb-1 text-sm font-semibold text-ink">Major-specific considerations</h4><ul className="list-disc space-y-1 pl-5 text-sm text-muted">{a.major.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      </div>
      <div className="space-y-4">
        {sec('Strengths', a.strengths, 'teal')}{sec('Weaknesses', a.weaknesses, 'rose')}{sec('Missing information', a.missing, 'amber')}{sec('Potential improvements', a.improvements, 'blue')}{sec('Application strategy (opinion)', a.strategy, 'violet')}
        <Button size="sm" variant="soft" onClick={() => navigate(`college-${a.college.id}`)}>Open {a.college.short}</Button>
      </div>
    </div>
  );
}

export default function Analysis() {
  const s = useStore((x) => x);
  const [open, setOpen] = useState<string | null>(null);
  const [extra, setExtra] = useState('');
  const ac = studentAcademics(s);
  const ids = Array.from(new Set([...s.list.map((l) => l.collegeId), ...(extra ? [extra] : [])]));
  const rows = useMemo(() => ids.map((id) => assess(COLLEGES.find((c) => c.id === id)!, s)), [s, extra]);
  return (
    <>
      <PageHeader title="Admissions analysis" desc="A school-by-school read of where your profile stands, what's missing, and how to apply." />
      <Notice tone="warn" className="mb-5"><b>These are estimates, not predictions.</b> AdmitIQ compares what you entered to published admissions ranges using transparent rules. It does not show admission percentages: no public dataset links individual applicant profiles to outcomes, and admissions weighs essays, recommendations, context and institutional needs that no model here can see. A "Likely" school is not a guarantee.</Notice>
      <WhatIf s={s} />
      <Card className="mb-5 grid gap-4 p-5 sm:grid-cols-4">
        <div><div className="text-sm text-muted">GPA (4.0 unweighted)</div><div className="text-xl font-semibold tabular-nums text-ink">{ac.gpa4?.toFixed(2) ?? '—'}</div></div>
        <div><div className="text-sm text-muted">SAT / ACT</div><div className="text-xl font-semibold tabular-nums text-ink">{s.profile.sat.total ?? '—'} / {s.profile.act.composite ?? '—'}</div></div>
        <div><div className="text-sm text-muted">Advanced courses</div><div className="text-xl font-semibold tabular-nums text-ink">{ac.rigor.advanced}</div></div>
        <div><div className="text-sm text-muted">Intended major</div><div className="truncate text-xl font-semibold text-ink">{s.profile.intendedMajor || '—'}</div></div>
      </Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Analyze another college:</span>
        <Select aria-label="Analyze another college" value={extra} onChange={(e) => { setExtra(e.target.value); setOpen(e.target.value); }} options={[{ value: '', label: 'Choose…' }, ...COLLEGES.filter((c) => !s.list.some((l) => l.collegeId === c.id)).map((c) => ({ value: c.id, label: c.name }))]} className="w-auto min-w-[240px]" />
      </div>
      {!rows.length ? <Card><EmptyState title="No colleges to analyze" body="Add colleges to your list, or choose one above." action={<Button onClick={() => navigate('colleges')}>Search colleges</Button>} /></Card> : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.college.id}>
              <Card className="overflow-hidden">
                <button onClick={() => setOpen(open === a.college.id ? null : a.college.id)} aria-expanded={open === a.college.id} className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left hover:bg-raised/40">
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{a.college.name}</span><span className="text-sm text-muted">{a.testing.split(':')[0]} · {a.round}</span></span>
                  <Badge tone={compTone(a.competitiveness)}>{a.competitiveness}</Badge>
                  <Badge tone={bucketTone(a.bucket)}>Est. {a.bucket}</Badge>
                  {a.missing.length > 0 && <Badge tone="amber">{a.missing.length} missing</Badge>}
                  <LuChevronDown className={cx('text-muted transition-transform', open === a.college.id && 'rotate-180')} />
                </button>
                {open === a.college.id && <div className="fade-in"><Detail a={a} /></div>}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Card className="mt-6 p-5">
        <h2 className="text-sm font-semibold text-ink">How the estimate works</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Tests (if submitting and considered): above 75th percentile, upper half, lower half, or below 25th of the published <Term t="middle 50%">middle 50%</Term>.</li>
          <li>Grades: your unweighted GPA (from transcript when available), adjusted for how selective the school is — near-perfect grades are typical at schools admitting under 15%.</li>
          <li><Term t="course rigor">Rigor</Term>: number of AP/IB/dual-enrollment courses, used at schools admitting under 30%.</li>
          <li>Any school admitting under 15% is "Highly competitive" and a Reach for everyone. Open-admission community colleges are Likely.</li>
          <li>Everything else maps the combined academic position and the admit rate to Reach / Target / Likely.</li>
        </ol>
        <p className="mt-3 text-sm text-muted"><b className="text-ink">Not considered:</b> essays, recommendations, demonstrated interest, legacy/athletic/institutional priorities, school context, and major-specific capacity (flagged in notes when known). Data is historical ({'≈'}2022–25) and unverified.</p>
      </Card>
    </>
  );
}
