import React, { useMemo, useState } from 'react';
import { LuPlus, LuTrash2, LuPencil, LuArrowUp, LuArrowDown, LuWandSparkles, LuCopy } from 'react-icons/lu';
import { Badge, Button, Card, CardHeader, Chips, EmptyState, Field, Input, Modal, Notice, NumberInput, Select, Textarea, Toggle, copyText, cx, useConfirm, useToast } from './ui';
import { LineChart } from './charts';
import { store, uid, useStore } from '../lib/store';
import { ACTIVITY_CATEGORIES, ActivitySchema, CourseSchema, GRADES, LEVELS, SUBJECTS, type Activity, type Course } from '../lib/types';
import { METHODOLOGY, byTerm, rigor, ucCapped, unweighted, weighted } from '../lib/gpa';
import { activityScore, compressDescription, descriptionTips, portfolio } from '../lib/activities';
import { MAJORS } from '../data/colleges';
import { REGIONS, STATES } from '../lib/geo';

const STATE_OPTS = [{ value: '', label: 'Select state' }, ...Object.entries(STATES).map(([k, v]) => ({ value: k, label: v.name })), { value: 'INTL', label: 'Outside the U.S.' }];
const YEARS = [9, 10, 11, 12];

function errFor(cond: boolean, msg: string) { return cond ? msg : null; }

export function BasicsForm() {
  const p = useStore((s) => s.profile);
  const set = (patch: Partial<typeof p>) => store.set((s) => { s.profile = { ...s.profile, ...patch }; });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name or nickname" htmlFor="b-name" hint="Only shown to you."><Input id="b-name" value={p.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} /></Field>
      <Field label="High school" htmlFor="b-hs"><Input id="b-hs" value={p.highSchool} onChange={(e) => set({ highSchool: e.target.value })} maxLength={120} /></Field>
      <Field label="City" htmlFor="b-city"><Input id="b-city" value={p.city} onChange={(e) => set({ city: e.target.value })} /></Field>
      <Field label="State" htmlFor="b-state" hint="Used for in-state tuition and distance estimates."><Select id="b-state" value={p.state} onChange={(e) => set({ state: e.target.value })} options={STATE_OPTS} /></Field>
      <Field label="Graduation year" htmlFor="b-gy" error={errFor(p.gradYear !== null && (p.gradYear < 2024 || p.gradYear > 2035), 'Enter a year between 2024 and 2035')}><NumberInput id="b-gy" value={p.gradYear} onChange={(v) => set({ gradYear: v })} placeholder="2027" /></Field>
      <Field label="Intended major" htmlFor="b-major"><Select id="b-major" value={p.intendedMajor} onChange={(e) => set({ intendedMajor: e.target.value })} options={[{ value: '', label: 'Undecided' }, ...MAJORS]} /></Field>
      <div className="sm:col-span-2"><Field label="Alternate majors"><Chips options={MAJORS.filter((m) => m !== p.intendedMajor)} value={p.altMajors} onChange={(v) => set({ altMajors: v.slice(0, 4) })} /></Field></div>
    </div>
  );
}

export function AcademicsForm() {
  const p = useStore((s) => s.profile);
  const courses = useStore((s) => s.courses);
  const set = (patch: Partial<typeof p>) => store.set((s) => { s.profile = { ...s.profile, ...patch }; });
  const scaleMax = p.gpaScale === '100' ? 100 : p.gpaScale === '5.0' ? 5 : p.gpaScale === '4.3' ? 4.3 : 5;
  const satErr = p.sat.total !== null && (p.sat.total < 400 || p.sat.total > 1600 || p.sat.total % 10 !== 0) ? 'SAT totals range 400–1600 in steps of 10' : p.sat.rw && p.sat.math && p.sat.total && p.sat.rw + p.sat.math !== p.sat.total ? `Sections add to ${p.sat.rw + p.sat.math}, not ${p.sat.total}` : null;
  const actErr = p.act.composite !== null && (p.act.composite < 1 || p.act.composite > 36 || !Number.isInteger(p.act.composite)) ? 'ACT composite is a whole number from 1 to 36' : null;
  const [award, setAward] = useState({ title: '', level: 'School' as const, grade: 11 });
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">Grades</h3>
        {courses.length > 0 && <Notice className="mb-4">Your transcript has {courses.length} course{courses.length === 1 ? '' : 's'} (unweighted {unweighted(courses).value?.toFixed(2)}). {courses.length >= 6 ? 'AdmitIQ uses the transcript calculation for analysis; the numbers below are what your school reports.' : 'Once it has 6+ courses AdmitIQ will use it; until then the GPA you enter below is used.'}</Notice>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="GPA scale" htmlFor="a-scale"><Select id="a-scale" value={p.gpaScale} onChange={(e) => set({ gpaScale: e.target.value as typeof p.gpaScale })} options={['4.0', '4.3', '5.0', '100', 'Other']} /></Field>
          <Field label="Unweighted GPA" htmlFor="a-uw" error={errFor(p.gpaUnweighted !== null && p.gpaUnweighted > (p.gpaScale === '100' ? 100 : p.gpaScale === '4.3' ? 4.3 : p.gpaScale === '5.0' ? 5 : 4), 'Higher than the selected scale allows')}><NumberInput id="a-uw" value={p.gpaUnweighted} onChange={(v) => set({ gpaUnweighted: v })} placeholder="3.85" /></Field>
          <Field label="Weighted GPA" htmlFor="a-w" hint="As reported by your school." error={errFor(p.gpaWeighted !== null && p.gpaWeighted > (p.gpaScale === '100' ? 110 : 6), 'That looks too high')}><NumberInput id="a-w" value={p.gpaWeighted} onChange={(v) => set({ gpaWeighted: v })} placeholder="4.40" /></Field>
          <Field label="Class rank" htmlFor="a-rank" hint="Optional. Many schools don't rank." error={errFor(p.classRank !== null && p.classSize !== null && p.classRank > p.classSize, 'Rank can\'t exceed class size')}><NumberInput id="a-rank" value={p.classRank} onChange={(v) => set({ classRank: v })} /></Field>
          <Field label="Class size" htmlFor="a-size"><NumberInput id="a-size" value={p.classSize} onChange={(v) => set({ classSize: v })} /></Field>
          <Field label="Grade trend" htmlFor="a-trend"><Select id="a-trend" value={p.trend} onChange={(e) => set({ trend: e.target.value as typeof p.trend })} options={[{ value: '', label: 'Not specified' }, 'Upward', 'Steady', 'Downward', 'Mixed']} /></Field>
        </div>
        {void scaleMax}
      </section>
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">Testing</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Testing status" htmlFor="t-status" className="sm:col-span-3"><Select id="t-status" value={p.testingStatus} onChange={(e) => set({ testingStatus: e.target.value as typeof p.testingStatus })} options={['Not yet tested', 'Planning to test', 'Tested', 'Not submitting scores']} /></Field>
          <Field label="SAT total" htmlFor="t-sat" error={satErr}><NumberInput id="t-sat" value={p.sat.total} invalid={!!satErr} onChange={(v) => set({ sat: { ...p.sat, total: v } })} placeholder="1450" /></Field>
          <Field label="SAT Reading & Writing" htmlFor="t-rw" error={errFor(p.sat.rw !== null && (p.sat.rw < 200 || p.sat.rw > 800), '200–800')}><NumberInput id="t-rw" value={p.sat.rw} onChange={(v) => set({ sat: { ...p.sat, rw: v } })} /></Field>
          <Field label="SAT Math" htmlFor="t-m" error={errFor(p.sat.math !== null && (p.sat.math < 200 || p.sat.math > 800), '200–800')}><NumberInput id="t-m" value={p.sat.math} onChange={(v) => set({ sat: { ...p.sat, math: v } })} /></Field>
          <Field label="SAT test date" htmlFor="t-sd"><Input id="t-sd" type="date" value={p.sat.date} onChange={(e) => set({ sat: { ...p.sat, date: e.target.value } })} /></Field>
          <Field label="ACT composite" htmlFor="t-act" error={actErr}><NumberInput id="t-act" value={p.act.composite} invalid={!!actErr} onChange={(v) => set({ act: { ...p.act, composite: v } })} placeholder="32" /></Field>
          <Field label="ACT test date" htmlFor="t-ad"><Input id="t-ad" type="date" value={p.act.date} onChange={(e) => set({ act: { ...p.act, date: e.target.value } })} /></Field>
          {(['english', 'math', 'reading', 'science'] as const).map((k) => <Field key={k} label={`ACT ${k[0].toUpperCase() + k.slice(1)}`} htmlFor={`t-act-${k}`} error={errFor(p.act[k] !== null && (p.act[k]! < 1 || p.act[k]! > 36), '1–36')}><NumberInput id={`t-act-${k}`} value={p.act[k]} onChange={(v) => set({ act: { ...p.act, [k]: v } })} /></Field>)}
          <Field label="Planned future tests" htmlFor="t-plan" className="sm:col-span-3" hint="e.g. SAT in March, AP Biology exam in May"><Input id="t-plan" value={p.plannedTests} onChange={(e) => set({ plannedTests: e.target.value })} maxLength={200} /></Field>
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink">Academic awards</h3>
        <ul className="mb-3 space-y-2">
          {p.awards.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
              <span className="min-w-0"><span className="font-medium text-ink">{a.title}</span> <span className="text-muted">· {a.level} · grade {a.grades.join(', ')}</span></span>
              <Button size="sm" variant="ghost" aria-label={`Remove ${a.title}`} onClick={() => set({ awards: p.awards.filter((x) => x.id !== a.id) })} icon={<LuTrash2 />} />
            </li>
          ))}
        </ul>
        <form className="grid gap-3 sm:grid-cols-[1fr_10rem_7rem_auto]" onSubmit={(e) => { e.preventDefault(); if (!award.title.trim()) return; set({ awards: [...p.awards, { id: uid(), title: award.title.trim().slice(0, 100), level: award.level, grades: [award.grade] }] }); setAward({ ...award, title: '' }); }}>
          <Input aria-label="Award title" placeholder="Award title" value={award.title} onChange={(e) => setAward({ ...award, title: e.target.value })} />
          <Select aria-label="Award level" value={award.level} onChange={(e) => setAward({ ...award, level: e.target.value as typeof award.level })} options={['School', 'Regional', 'State', 'National', 'International']} />
          <Select aria-label="Grade" value={String(award.grade)} onChange={(e) => setAward({ ...award, grade: Number(e.target.value) })} options={YEARS.map((y) => ({ value: String(y), label: `Grade ${y}` }))} />
          <Button type="submit" icon={<LuPlus />} disabled={!award.title.trim()}>Add</Button>
        </form>
      </section>
    </div>
  );
}

const emptyCourse = (year = 9): Course => ({ id: uid(), name: '', year, term: 'Full year', level: 'Regular', subject: 'English', grade: 'A', credits: 1 });

export function TranscriptEditor() {
  const courses = useStore((s) => s.courses);
  const [draft, setDraft] = useState<Course>(emptyCourse());
  const [editing, setEditing] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const uw = unweighted(courses), w = weighted(courses), uc = ucCapped(courses), r = rigor(courses);
  const terms = byTerm(courses);
  function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = CourseSchema.safeParse({ ...draft, name: draft.name.trim(), credits: draft.term === 'Full year' ? Math.max(draft.credits, 1) : draft.credits });
    if (!parsed.success) { setErr(parsed.error.issues[0].message); return; }
    setErr('');
    store.set((s) => { if (editing) s.courses = s.courses.map((c) => (c.id === editing ? parsed.data : c)); else s.courses.push(parsed.data); });
    setEditing(null); setDraft({ ...emptyCourse(draft.year), subject: draft.subject, level: draft.level });
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        {[['Unweighted', uw.value, '4.0 scale'], ['Weighted', w.value, '5.0 cap'], ['UC-style (est.)', uc.value, '10th–11th only'], ['Advanced courses', r.advanced, `${r.honors} honors`]].map(([l, v, sub]) => (
          <Card key={l as string} className="p-4"><div className="text-sm text-muted">{l as string}</div><div className="mt-1 text-2xl font-semibold tabular-nums text-ink">{v === null ? '—' : typeof v === 'number' && l !== 'Advanced courses' ? v.toFixed(2) : v as number}</div><div className="text-xs text-muted">{sub as string}</div></Card>
        ))}
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-ink">{editing ? 'Edit course' : 'Add a course'}</h3>
        <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(5,minmax(0,1fr))_auto]" noValidate>
          <Input aria-label="Course name" placeholder="Course name (e.g. AP Biology)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, level: /^AP\b/i.test(e.target.value) ? 'AP' : /^IB\b/i.test(e.target.value) ? 'IB' : /honors/i.test(e.target.value) ? 'Honors' : draft.level })} invalid={!!err} />
          <Select aria-label="Grade level" value={String(draft.year)} onChange={(e) => setDraft({ ...draft, year: Number(e.target.value) })} options={YEARS.map((y) => ({ value: String(y), label: `${y}th grade` }))} />
          <Select aria-label="Term" value={draft.term} onChange={(e) => setDraft({ ...draft, term: e.target.value as Course['term'], credits: e.target.value === 'Full year' ? 1 : 0.5 })} options={['Full year', 'Semester 1', 'Semester 2']} />
          <Select aria-label="Level" value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value as Course['level'] })} options={[...LEVELS]} />
          <Select aria-label="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value as Course['subject'] })} options={[...SUBJECTS]} />
          <Select aria-label="Grade" value={draft.grade} onChange={(e) => setDraft({ ...draft, grade: e.target.value as Course['grade'] })} options={[...GRADES]} />
          <div className="flex gap-2"><Button type="submit" variant="primary" icon={editing ? undefined : <LuPlus />}>{editing ? 'Save' : 'Add'}</Button>{editing && <Button type="button" variant="ghost" onClick={() => { setEditing(null); setDraft(emptyCourse(draft.year)); }}>Cancel</Button>}</div>
        </form>
        {err && <p role="alert" className="mt-2 text-xs text-rose-600">{err}</p>}
      </Card>
      {!courses.length ? (
        <Card><EmptyState title="No courses yet" body="Add your classes year by year. AdmitIQ calculates unweighted, weighted and UC-style GPAs and charts your trend." /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {YEARS.map((y) => {
            const cs = courses.filter((c) => c.year === y);
            if (!cs.length) return null;
            return (
              <Card key={y} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-5 py-3"><h3 className="text-sm font-semibold text-ink">{y}th grade</h3><span className="text-xs text-muted tabular-nums">UW {unweighted(cs).value?.toFixed(2) ?? '—'} · W {weighted(cs).value?.toFixed(2) ?? '—'}</span></div>
                <ul className="divide-y divide-line">
                  {cs.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <span className="min-w-0 flex-1"><span className="block truncate text-ink">{c.name}</span><span className="text-xs text-muted">{c.subject} · {c.term}</span></span>
                      {c.level !== 'Regular' && <Badge tone={c.level === 'Honors' ? 'blue' : 'violet'}>{c.level === 'Dual enrollment' ? 'DE' : c.level}</Badge>}
                      <span className="w-8 text-right font-semibold tabular-nums text-ink">{c.grade}</span>
                      <button className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink" aria-label={`Edit ${c.name}`} onClick={() => { setEditing(c.id); setDraft(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><LuPencil /></button>
                      <button className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-raised hover:text-rose-600" aria-label={`Delete ${c.name}`} onClick={() => store.set((s) => { s.courses = s.courses.filter((x) => x.id !== c.id); })}><LuTrash2 /></button>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
      {terms.length > 1 && (
        <Card className="p-5">
          <CardHeader flush title="GPA by term" desc="Each point is the GPA for courses in that semester (full-year courses count in both)." />
          <div className="mt-4"><LineChart labels={terms.map((t) => t.label)} series={[{ name: 'Unweighted', color: 'var(--c1)', values: terms.map((t) => t.unweighted) }, { name: 'Weighted', color: 'var(--c2)', values: terms.map((t) => t.weighted) }]} yMin={Math.max(0, Math.floor(Math.min(...terms.map((t) => t.unweighted ?? 4)) * 2) / 2 - 0.5)} yMax={5} /></div>
          <p className="mt-3 text-xs text-muted">Source: your transcript entries (self-reported).</p>
        </Card>
      )}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-ink">How these GPAs are calculated</h3>
        <dl className="mt-3 space-y-3 text-sm">{METHODOLOGY.map((m) => <div key={m.name}><dt className="font-medium text-ink">{m.name}</dt><dd className="text-muted">{m.text}</dd></div>)}</dl>
      </Card>
    </div>
  );
}

const emptyActivity = (): Activity => ({ id: uid(), category: 'Other', org: '', position: '', description: '', grades: [], hrsWeek: 0, wksYear: 0, achievements: '', awards: '', leadership: '', impact: '', reach: null, significance: '', skills: '', draft: '' });

export function ActivitiesEditor() {
  const acts = useStore((s) => s.activities);
  const [edit, setEdit] = useState<Activity | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const confirm = useConfirm();
  const toast = useToast();
  const pf = useMemo(() => portfolio(acts), [acts]);
  function save() {
    if (!edit) return;
    const parsed = ActivitySchema.safeParse(edit);
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
    store.set((s) => { const i = s.activities.findIndex((a) => a.id === edit.id); if (i >= 0) s.activities[i] = parsed.data; else s.activities.push(parsed.data); });
    setEdit(null); setErrors({}); toast('Activity saved');
  }
  const move = (i: number, d: number) => store.set((s) => { const j = i + d; if (j < 0 || j >= s.activities.length) return; [s.activities[i], s.activities[j]] = [s.activities[j], s.activities[i]]; });
  const set = (patch: Partial<Activity>) => setEdit((e) => (e ? { ...e, ...patch } : e));
  const comp = edit ? compressDescription(edit.description) : null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{acts.length} activit{acts.length === 1 ? 'y' : 'ies'} · listed in order of importance (Common App shows up to 10).</p>
        <Button variant="primary" icon={<LuPlus />} onClick={() => setEdit(emptyActivity())}>Add activity</Button>
      </div>
      {acts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="p-4"><div className="text-sm text-muted">Profile style</div><div className="mt-1 text-lg font-semibold text-ink">{pf.style}</div></Card>
          <Card className="p-4"><div className="text-sm text-muted">Total hours</div><div className="mt-1 text-lg font-semibold tabular-nums text-ink">{pf.totalHours.toLocaleString()}</div></Card>
          <Card className="p-4"><div className="text-sm text-muted">Leadership roles</div><div className="mt-1 text-lg font-semibold tabular-nums text-ink">{pf.leadershipCount}</div></Card>
          <Card className="p-4"><div className="text-sm text-muted">Avg. years per activity</div><div className="mt-1 text-lg font-semibold tabular-nums text-ink">{pf.avgYears.toFixed(1)}</div></Card>
        </div>
      )}
      {pf.suggestions.length > 0 && <Notice>{pf.suggestions.map((s) => <p key={s}>{s}</p>)}</Notice>}
      {!acts.length ? <Card><EmptyState title="No activities yet" body="Clubs, sports, jobs, family responsibilities, independent projects, research, volunteering — they all count." action={<Button variant="primary" icon={<LuPlus />} onClick={() => setEdit(emptyActivity())}>Add your first activity</Button>} /></Card> : (
        <ol className="space-y-3">
          {acts.map((a, i) => {
            const sc = activityScore(a);
            return (
              <li key={a.id}>
                <Card hover className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="flex flex-col gap-1">
                      <button className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-raised disabled:opacity-30" disabled={i === 0} aria-label="Move up" onClick={() => move(i, -1)}><LuArrowUp /></button>
                      <button className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-raised disabled:opacity-30" disabled={i === acts.length - 1} aria-label="Move down" onClick={() => move(i, 1)}><LuArrowDown /></button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-muted">#{i + 1}</span><Badge>{a.category}</Badge>{a.grades.length > 0 && <span className="text-xs text-muted">Grades {a.grades.join(', ')} · {a.hrsWeek} hr/wk · {a.wksYear} wk/yr</span>}</div>
                      <h4 className="mt-1 font-semibold text-ink">{a.position ? `${a.position}, ` : ''}{a.org}</h4>
                      <p className="mt-1 text-sm text-muted">{a.draft || a.description}</p>
                      <p className="mt-2 text-xs text-muted">{sc.notes.join(' ')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted tabular-nums">
                        <span>Depth <b className="text-ink">{sc.depth}</b></span><span>Lead <b className="text-ink">{sc.leadership}</b></span>
                        <span>Impact <b className="text-ink">{sc.impact}</b></span><span>Recog. <b className="text-ink">{sc.recognition}</b></span>
                      </div>
                      <div className="text-center"><div className="text-2xl font-semibold tabular-nums text-ink">{sc.total}</div><div className="text-[11px] text-muted">strength</div></div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" aria-label="Edit activity" icon={<LuPencil />} onClick={() => setEdit(a)} />
                        <Button size="sm" variant="ghost" aria-label="Delete activity" icon={<LuTrash2 />} onClick={async () => { if (await confirm({ title: 'Delete activity?', body: `Remove "${a.org}" from your profile? This can't be undone.`, action: 'Delete', danger: true })) store.set((s) => { s.activities = s.activities.filter((x) => x.id !== a.id); }); }} />
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs text-muted">Strength scores use AdmitIQ's own heuristic (depth 35%, leadership 30%, impact 25%, recognition 10%) to organize feedback. Colleges don't use this score.</p>

      <Modal open={!!edit} onClose={() => { setEdit(null); setErrors({}); }} title={edit && acts.some((a) => a.id === edit.id) ? 'Edit activity' : 'New activity'} wide footer={<><Button variant="ghost" onClick={() => { setEdit(null); setErrors({}); }}>Cancel</Button><Button variant="primary" onClick={save}>Save activity</Button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="ac-cat"><Select id="ac-cat" value={edit.category} onChange={(e) => set({ category: e.target.value as Activity['category'] })} options={[...ACTIVITY_CATEGORIES]} /></Field>
            <Field label={`Organization (${edit.org.length}/100)`} htmlFor="ac-org" error={errors.org}><Input id="ac-org" value={edit.org} onChange={(e) => set({ org: e.target.value })} maxLength={100} invalid={!!errors.org} /></Field>
            <Field label={`Position / title (${edit.position.length}/50)`} htmlFor="ac-pos" error={edit.position.length > 50 ? 'Common App limit is 50 characters' : errors.position}><Input id="ac-pos" value={edit.position} onChange={(e) => set({ position: e.target.value })} /></Field>
            <Field label="Grades participated"><Chips options={['9', '10', '11', '12']} value={edit.grades.map(String)} onChange={(v) => set({ grades: v.map(Number).sort() })} /></Field>
            <Field label="Hours per week" htmlFor="ac-h" error={errors.hrsWeek}><NumberInput id="ac-h" value={edit.hrsWeek} onChange={(v) => set({ hrsWeek: v ?? 0 })} /></Field>
            <Field label="Weeks per year" htmlFor="ac-w" error={errors.wksYear}><NumberInput id="ac-w" value={edit.wksYear} onChange={(v) => set({ wksYear: v ?? 0 })} /></Field>
            <Field label="What you do" htmlFor="ac-desc" className="sm:col-span-2" hint="Write it plainly first — you can tighten it below."><Textarea id="ac-desc" rows={3} value={edit.description} onChange={(e) => set({ description: e.target.value })} /></Field>
            <Field label="Achievements" htmlFor="ac-ach"><Textarea id="ac-ach" rows={2} value={edit.achievements} onChange={(e) => set({ achievements: e.target.value })} /></Field>
            <Field label="Awards" htmlFor="ac-aw"><Textarea id="ac-aw" rows={2} value={edit.awards} onChange={(e) => set({ awards: e.target.value })} /></Field>
            <Field label="Leadership" htmlFor="ac-lead"><Input id="ac-lead" value={edit.leadership} onChange={(e) => set({ leadership: e.target.value })} /></Field>
            <Field label="People reached (if known)" htmlFor="ac-reach" hint="Only enter a number you can stand behind."><NumberInput id="ac-reach" value={edit.reach} onChange={(v) => set({ reach: v })} /></Field>
            <Field label="Impact" htmlFor="ac-imp" className="sm:col-span-2"><Textarea id="ac-imp" rows={2} value={edit.impact} onChange={(e) => set({ impact: e.target.value })} /></Field>
            <Field label="Personal significance" htmlFor="ac-sig"><Textarea id="ac-sig" rows={2} value={edit.significance} onChange={(e) => set({ significance: e.target.value })} /></Field>
            <Field label="Skills gained" htmlFor="ac-sk"><Textarea id="ac-sk" rows={2} value={edit.skills} onChange={(e) => set({ skills: e.target.value })} /></Field>
            <div className="sm:col-span-2 rounded-2xl border border-line bg-raised/50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink"><LuWandSparkles className="text-accent" /> Common App description helper</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{descriptionTips(edit).map((t) => <li key={t}>{t}</li>)}</ul>
              {comp && edit.description.length > 0 && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div><div className="mb-1 text-xs font-medium text-muted">Before · {edit.description.length} chars</div><div className="rounded-xl border border-line bg-surface p-3 text-sm text-ink">{edit.description}</div></div>
                  <div><div className={cx('mb-1 text-xs font-medium', comp.fits ? 'text-teal' : 'text-amber-600')}>Tightened · {comp.text.length}/150 chars{comp.fits ? '' : ' — still over; cut further yourself'}</div><div className="rounded-xl border border-line bg-surface p-3 text-sm text-ink">{comp.text}</div></div>
                </div>
              )}
              <p className="mt-2 text-xs text-muted">The helper only removes filler and wordy phrases from your own text. It never adds facts or numbers.</p>
              <Field label={`Final description (${edit.draft.length}/150)`} htmlFor="ac-draft" className="mt-3" error={edit.draft.length > 150 ? 'Over 150 characters' : null}>
                <Textarea id="ac-draft" rows={2} value={edit.draft} onChange={(e) => set({ draft: e.target.value })} />
              </Field>
              <div className="mt-2 flex flex-wrap gap-2">
                {comp && <Button size="sm" onClick={() => set({ draft: comp.text.slice(0, 150) })}>Use tightened version</Button>}
                {edit.draft && <Button size="sm" variant="ghost" icon={<LuCopy />} onClick={async () => toast((await copyText(edit.draft)) ? 'Copied' : 'Copy failed', 'info')}>Copy</Button>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function PersonalForm() {
  const p = useStore((s) => s.personal);
  const set = (patch: Partial<typeof p>) => store.set((s) => { s.personal = { ...s.personal, ...patch }; });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Notice className="sm:col-span-2">All fields are optional. AdmitIQ never asks for or infers sensitive characteristics such as race, religion, disability or immigration status.</Notice>
      <Field label="Intended career" htmlFor="p-career"><Input id="p-career" value={p.career} onChange={(e) => set({ career: e.target.value })} /></Field>
      <Field label="Career priorities" htmlFor="p-cp" hint="e.g. high earnings, public service, flexibility"><Input id="p-cp" value={p.careerPriorities} onChange={(e) => set({ careerPriorities: e.target.value })} /></Field>
      <Field label="Academic interests" htmlFor="p-ai"><Textarea id="p-ai" rows={2} value={p.academicInterests} onChange={(e) => set({ academicInterests: e.target.value })} /></Field>
      <Field label="Personal interests" htmlFor="p-pi"><Textarea id="p-pi" rows={2} value={p.personalInterests} onChange={(e) => set({ personalInterests: e.target.value })} /></Field>
      <div className="sm:col-span-2"><Field label="Campus setting"><Chips options={['Urban', 'Suburban', 'Small city', 'Rural']} value={p.settings} onChange={(v) => set({ settings: v as typeof p.settings })} /></Field></div>
      <div className="sm:col-span-2"><Field label="Preferred regions"><Chips options={REGIONS} value={p.regions} onChange={(v) => set({ regions: v })} /></Field></div>
      <div className="sm:col-span-2"><Field label="Types of school"><Chips options={['Public', 'Private', 'Liberal arts', 'Community college', 'International']} value={p.kinds} onChange={(v) => set({ kinds: v })} /></Field></div>
      <Field label="Campus size" htmlFor="p-size"><Select id="p-size" value={p.size} onChange={(e) => set({ size: e.target.value as typeof p.size })} options={['Any', 'Small (<5k)', 'Medium (5k–15k)', 'Large (15k+)']} /></Field>
      <Field label="Max distance from home (miles)" htmlFor="p-dist" hint="Measured roughly from the center of your state."><NumberInput id="p-dist" value={p.maxDistance} onChange={(v) => set({ maxDistance: v })} placeholder="No limit" /></Field>
      <Toggle label="Undergraduate research matters to me" checked={p.wantsResearch} onChange={(v) => set({ wantsResearch: v })} />
      <Toggle label="Internships / co-op matter to me" checked={p.wantsInternships} onChange={(v) => set({ wantsInternships: v })} />
      <Field label="Learning environment" htmlFor="p-le" hint="e.g. small seminars, hands-on, flexible curriculum"><Textarea id="p-le" rows={2} value={p.learning} onChange={(e) => set({ learning: e.target.value })} /></Field>
      <Field label="Cultural / community preferences" htmlFor="p-cu"><Textarea id="p-cu" rows={2} value={p.culture} onChange={(e) => set({ culture: e.target.value })} /></Field>
      <Field label="Accessibility needs or preferences" htmlFor="p-acc" className="sm:col-span-2" hint="Private. Used only to remind you what to ask colleges about."><Textarea id="p-acc" rows={2} value={p.accessibility} onChange={(e) => set({ accessibility: e.target.value })} /></Field>
    </div>
  );
}

export function FinancialForm() {
  const f = useStore((s) => s.financial);
  const home = useStore((s) => s.profile.state);
  const set = (patch: Partial<typeof f>) => store.set((s) => { s.financial = { ...s.financial, ...patch }; });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Notice className="sm:col-span-2">Financial information is optional and stays private. It is only used for cost and affordability estimates on this device{f.shareFinancials ? '' : ' — and is excluded from AI requests unless you allow it below'}.</Notice>
      <Field label="Maximum annual cost your family can pay" htmlFor="f-max" hint="Total per year, including housing."><NumberInput id="f-max" value={f.maxAnnualCost} onChange={(v) => set({ maxAnnualCost: v })} placeholder="$30,000" /></Field>
      <Field label="Expected family contribution (if known)" htmlFor="f-efc" hint="From the FAFSA Student Aid Index or a net price calculator."><NumberInput id="f-efc" value={f.expectedContribution} onChange={(v) => set({ expectedContribution: v })} /></Field>
      <Field label="Household income range" htmlFor="f-inc" hint="Optional. Helps interpret net price by income."><Select id="f-inc" value={f.incomeBracket} onChange={(e) => set({ incomeBracket: e.target.value as typeof f.incomeBracket })} options={['Prefer not to say', '$0–30k', '$30–48k', '$48–75k', '$75–110k', '$110k+']} /></Field>
      <Field label="How important is financial aid?" htmlFor="f-aid"><Select id="f-aid" value={f.aidPriority} onChange={(e) => set({ aidPriority: e.target.value as typeof f.aidPriority })} options={['Not important', 'Somewhat important', 'Very important', 'Essential']} /></Field>
      <Field label="Willingness to take loans" htmlFor="f-loan"><Select id="f-loan" value={f.loanWillingness} onChange={(e) => set({ loanWillingness: e.target.value as typeof f.loanWillingness })} options={['No loans', 'Federal loans only', 'Some loans', 'Comfortable with loans']} /></Field>
      <Field label="In-state for" htmlFor="f-in" hint="Set from your profile's state."><Input id="f-in" value={home ? STATES[home]?.name || home : 'Not set'} disabled /></Field>
      <Toggle label="Prefer schools with merit scholarships" checked={f.meritPreference} onChange={(v) => set({ meritPreference: v })} />
      <Toggle label="Include budget in AI strategist requests" desc="Off by default. When off, AI requests see 'private'." checked={f.shareFinancials} onChange={(v) => set({ shareFinancials: v })} />
      <Field label="Notes (need-based considerations, special circumstances)" htmlFor="f-notes" className="sm:col-span-2"><Textarea id="f-notes" rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
    </div>
  );
}

export function profileCompleteness(s: ReturnType<typeof store.get>) {
  const checks: [string, boolean, string][] = [
    ['Basics', !!(s.profile.state && s.profile.gradYear), 'profile'],
    ['Intended major', !!s.profile.intendedMajor, 'profile'],
    ['GPA or transcript', s.courses.length > 0 || s.profile.gpaUnweighted !== null, 'profile-academics'],
    ['Testing status', s.profile.testingStatus !== 'Not yet tested' || !!s.profile.sat.total || !!s.profile.act.composite, 'profile-academics'],
    ['Activities', s.activities.length > 0, 'profile-activities'],
    ['Preferences', s.personal.settings.length > 0 || s.personal.regions.length > 0, 'profile-personal'],
    ['Budget', s.financial.maxAnnualCost !== null, 'profile-financial'],
    ['College list', s.list.length > 0, 'colleges'],
    ['An essay draft', s.essays.length > 0, 'essays'],
  ];
  return { pct: Math.round((checks.filter((c) => c[1]).length / checks.length) * 100), checks };
}
