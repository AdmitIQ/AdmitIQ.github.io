import React, { useMemo, useState } from 'react';
import { LuPlus, LuTrash2, LuChevronLeft, LuChevronRight, LuBell, LuCalendarPlus, LuCircleCheck, LuCircle, LuPencil, LuTriangleAlert } from 'react-icons/lu';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Notice, PageHeader, Progress, Ring, Select, Tabs, Textarea, Toggle, copyText, cx, downloadFile, statusTone, useConfirm, useToast } from '../components/ui';
import { COLLEGES } from '../data/colleges';
import { store, uid, useStore } from '../lib/store';
import { APP_STATUSES, ITEM_STATUSES, type Application, type Task } from '../lib/types';
import { ITEM_LABELS, appCompletion, overallCompletion } from '../lib/apps';
import { byId, cycleDate, daysUntil, fmtDate } from '../lib/format';

const blankApp = (): Application => ({ id: uid(), collegeId: '', round: 'RD', deadline: '', status: 'Planned', items: { essays: 'Not started', recommendations: 'Not started', transcript: 'Not started', testing: 'Not started', financialAid: 'Not started', scholarships: 'Not started', interview: 'N/A' }, submitted: '', decisionDate: '', result: '', notes: '' });
const blankTask = (): Task => ({ id: uid(), title: '', due: '', done: false, priority: 'Medium', collegeId: '', reminder: true });
const ROUNDS = ['ED', 'ED2', 'EA', 'REA', 'RD', 'Rolling', 'Priority', 'UCAS', 'Open enrollment'];

function ics(s: ReturnType<typeof store.get>) {
  const esc = (t: string) => t.replace(/[,;\\]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const ev = (date: string, title: string, id: string, alarm: boolean) => [`BEGIN:VEVENT`, `UID:${id}@admitiq`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`, `SUMMARY:${esc(title)}`, ...(alarm ? ['BEGIN:VALARM', 'TRIGGER:-P3D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM'] : []), 'END:VEVENT'];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AdmitIQ//EN', 'CALSCALE:GREGORIAN'];
  for (const a of s.apps) { if (a.deadline) lines.push(...ev(a.deadline, `${byId(a.collegeId)?.short} ${a.round} deadline`, `app-${a.id}`, true)); if (a.decisionDate) lines.push(...ev(a.decisionDate, `${byId(a.collegeId)?.short} decision expected`, `dec-${a.id}`, false)); }
  for (const t of s.tasks) if (t.due && !t.done) lines.push(...ev(t.due, t.title, `task-${t.id}`, t.reminder));
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export default function Tracker() {
  const s = useStore((x) => x);
  const toast = useToast();
  const confirm = useConfirm();
  const [view, setView] = useState<'board' | 'calendar' | 'timeline' | 'tasks'>('board');
  const [edit, setEdit] = useState<Application | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [appErr, setAppErr] = useState('');
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const alerts = useMemo(() => [
    ...s.apps.filter((a) => a.deadline && !['Submitted', 'Accepted', 'Rejected', 'Waitlisted', 'Deferred'].includes(a.status)).map((a) => ({ d: daysUntil(a.deadline), text: `${byId(a.collegeId)?.short} ${a.round} deadline`, date: a.deadline, pct: appCompletion(a) })).filter((x) => x.d <= 14),
    ...s.tasks.filter((t) => !t.done && t.due && t.reminder).map((t) => ({ d: daysUntil(t.due), text: t.title, date: t.due, pct: null as number | null })).filter((x) => x.d <= 7),
  ].sort((a, b) => a.d - b.d), [s.apps, s.tasks]);

  function saveApp() {
    if (!edit) return;
    if (!edit.collegeId) return setAppErr('Choose a college');
    if (edit.deadline && Number.isNaN(new Date(edit.deadline).getTime())) return setAppErr('Invalid deadline');
    if (s.apps.some((a) => a.collegeId === edit.collegeId && a.round === edit.round && a.id !== edit.id)) return setAppErr('You already track this college and round');
    store.set((st) => { const i = st.apps.findIndex((a) => a.id === edit.id); if (i >= 0) st.apps[i] = edit; else st.apps.push(edit); if (!st.list.some((l) => l.collegeId === edit.collegeId)) st.list.push({ collegeId: edit.collegeId, category: 'Target', favorite: false, notes: '', addedAt: new Date().toISOString() }); });
    setEdit(null); setAppErr(''); toast('Application saved');
  }
  function saveTask() {
    if (!task || !task.title.trim()) return;
    store.set((st) => { const i = st.tasks.findIndex((t) => t.id === task.id); if (i >= 0) st.tasks[i] = { ...task, title: task.title.trim() }; else st.tasks.push({ ...task, title: task.title.trim() }); });
    setTask(null); toast('Task saved');
  }
  const setItem = (id: string, k: keyof Application['items'], v: Application['items'][typeof k]) => store.set((st) => { const a = st.apps.find((x) => x.id === id); if (a) a.items[k] = v; });
  const sortedApps = [...s.apps].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));

  // calendar
  const days = useMemo(() => {
    const first = new Date(month); const start = new Date(first); start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const eventsOn = (d: string) => [
    ...s.apps.filter((a) => a.deadline === d).map((a) => ({ k: `a${a.id}`, t: `${byId(a.collegeId)?.short} ${a.round}`, tone: 'bg-accent text-white' })),
    ...s.apps.filter((a) => a.decisionDate === d).map((a) => ({ k: `d${a.id}`, t: `${byId(a.collegeId)?.short} decision`, tone: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' })),
    ...s.tasks.filter((t) => t.due === d).map((t) => ({ k: `t${t.id}`, t: t.title, tone: t.done ? 'bg-raised text-muted line-through' : 'bg-amber-500/15 text-amber-800 dark:text-amber-300' })),
  ];

  return (
    <>
      <PageHeader title="Application tracker" desc="Every deadline, checklist item and task in one place."
        actions={<><Button icon={<LuCalendarPlus />} onClick={() => { const c = ics(s); if (downloadFile('admitiq-deadlines.ics', c, 'text/calendar')) toast('Calendar file downloaded — open it to add reminders'); else copyText(c).then(() => toast('Download blocked here — calendar data copied', 'info')); }}>Export to calendar</Button><Button icon={<LuPlus />} onClick={() => setTask(blankTask())}>Task</Button><Button variant="primary" icon={<LuPlus />} onClick={() => setEdit(blankApp())}>Application</Button></>} />

      <div className="mb-5 grid gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
        <Card className="flex items-center gap-4 p-5"><Ring value={overallCompletion(s.apps)} size={84} stroke={8} tone="var(--teal)" /><div><div className="text-sm text-muted">Overall completion</div><div className="text-sm text-ink">{s.apps.filter((a) => ['Submitted', 'Accepted', 'Deferred', 'Waitlisted', 'Rejected'].includes(a.status)).length} submitted · {s.apps.filter((a) => a.status === 'In progress' || a.status === 'Ready to submit').length} in progress · {s.tasks.filter((t) => !t.done).length} open tasks</div></div></Card>
        {alerts.length ? (
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><LuBell className="text-amber-500" />Deadline alerts</h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">{alerts.slice(0, 6).map((x, i) => <li key={i} className={cx('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm', x.d < 0 ? 'border-rose-500/30 bg-rose-500/[0.06]' : x.d <= 3 ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-line')}>{x.d < 0 && <LuTriangleAlert className="shrink-0 text-rose-600" />}<span className="min-w-0 flex-1 truncate text-ink">{x.text}</span><span className="shrink-0 text-xs tabular-nums text-muted">{x.d < 0 ? `${-x.d}d overdue` : x.d === 0 ? 'Today' : `${x.d}d`}{x.pct !== null ? ` · ${x.pct}%` : ''}</span></li>)}</ul>
          </Card>
        ) : <Card className="grid place-items-center p-5 text-sm text-muted">No deadlines in the next two weeks.</Card>}
      </div>

      <Tabs tabs={[{ id: 'board', label: 'Applications', count: s.apps.length }, { id: 'calendar', label: 'Calendar' }, { id: 'timeline', label: 'Timeline' }, { id: 'tasks', label: 'Tasks', count: s.tasks.filter((t) => !t.done).length }]} value={view} onChange={setView} className="mb-5" />

      <div key={view} className="fade-up">
        {view === 'board' && (!s.apps.length ? <Card><EmptyState title="No applications tracked" body="Add the colleges you're applying to with their round and deadline." action={<Button variant="primary" onClick={() => setEdit(blankApp())}>Add application</Button>} /></Card> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedApps.map((a) => { const c = byId(a.collegeId); const d = a.deadline ? daysUntil(a.deadline) : null; const pct = appCompletion(a); return (
              <Card key={a.id} hover className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><a href={`#college-${a.collegeId}`} className="font-semibold text-ink hover:text-accent">{c?.short}</a><div className="text-sm text-muted">{a.round} · {a.deadline ? <>due {fmtDate(a.deadline)} {d !== null && !['Submitted', 'Accepted', 'Rejected', 'Waitlisted', 'Deferred'].includes(a.status) && <span className={cx(d < 0 ? 'text-rose-600' : d <= 7 ? 'text-amber-600' : '')}>({d < 0 ? 'passed' : `${d}d`})</span>}</> : 'no deadline'}</div></div>
                  <div className="flex"><Button size="sm" variant="ghost" aria-label="Edit application" icon={<LuPencil />} onClick={() => setEdit(structuredClone(a))} /><Button size="sm" variant="ghost" aria-label="Delete application" icon={<LuTrash2 />} onClick={async () => { if (await confirm({ title: `Delete ${c?.short} ${a.round}?`, body: 'This removes the application from your tracker.', action: 'Delete', danger: true })) store.set((st) => { st.apps = st.apps.filter((x) => x.id !== a.id); }); }} /></div>
                </div>
                <div className="mt-3 flex items-center gap-2"><Select aria-label="Status" value={a.status} onChange={(e) => store.set((st) => { const x = st.apps.find((y) => y.id === a.id)!; x.status = e.target.value as Application['status']; if (e.target.value === 'Submitted' && !x.submitted) x.submitted = iso(new Date()); })} options={[...APP_STATUSES]} className="h-9 w-auto text-sm" /><Badge tone={statusTone(a.status)}>{pct}%</Badge></div>
                <Progress value={pct} className="mt-3" label={`${c?.short} completion`} />
                <ul className="mt-4 space-y-1.5">
                  {(Object.keys(ITEM_LABELS) as (keyof Application['items'])[]).map((k) => (
                    <li key={k} className="flex items-center justify-between gap-2 text-sm">
                      <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => setItem(a.id, k, a.items[k] === 'Done' ? 'Not started' : 'Done')} aria-label={`Toggle ${ITEM_LABELS[k]}`}>{a.items[k] === 'Done' ? <LuCircleCheck className="shrink-0 text-teal" /> : <LuCircle className={cx('shrink-0', a.items[k] === 'N/A' ? 'text-line' : 'text-muted')} />}<span className={cx('truncate', a.items[k] === 'N/A' ? 'text-muted line-through' : 'text-ink')}>{ITEM_LABELS[k]}</span></button>
                      <select aria-label={`${ITEM_LABELS[k]} status`} value={a.items[k]} onChange={(e) => setItem(a.id, k, e.target.value as never)} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-muted">{ITEM_STATUSES.map((x) => <option key={x}>{x}</option>)}</select>
                    </li>
                  ))}
                </ul>
                {(a.submitted || a.decisionDate || a.result) && <div className="mt-3 border-t border-line pt-3 text-xs text-muted">{a.submitted && <>Submitted {fmtDate(a.submitted)}. </>}{a.decisionDate && <>Decision ~{fmtDate(a.decisionDate)}. </>}{a.result && <b className="text-ink">{a.result}</b>}</div>}
              </Card>
            ); })}
          </div>
        ))}

        {view === 'calendar' && (
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-ink">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
              <div className="flex gap-1"><Button size="sm" variant="ghost" aria-label="Previous month" icon={<LuChevronLeft />} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} /><Button size="sm" variant="ghost" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</Button><Button size="sm" variant="ghost" aria-label="Next month" icon={<LuChevronRight />} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} /></div>
            </div>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line text-xs">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="bg-raised px-2 py-1.5 text-center font-medium text-muted">{d.slice(0, 1)}<span className="hidden sm:inline">{d.slice(1)}</span></div>)}
              {days.map((d) => { const k = iso(d); const evs = eventsOn(k); const inMonth = d.getMonth() === month.getMonth(); const isToday = k === iso(today); return (
                <div key={k} className={cx('min-h-[64px] bg-surface p-1 sm:min-h-[96px] sm:p-1.5', !inMonth && 'bg-surface/50 text-muted/60')}>
                  <div className={cx('mb-1 grid h-6 w-6 place-items-center rounded-full text-[11px] tabular-nums', isToday ? 'bg-ink font-semibold text-canvas' : 'text-muted')}>{d.getDate()}</div>
                  <div className="space-y-0.5">{evs.slice(0, 3).map((e) => <div key={e.k} className={cx('truncate rounded px-1 py-0.5 text-[10px] leading-tight sm:text-[11px]', e.tone)} title={e.t}>{e.t}</div>)}{evs.length > 3 && <div className="text-[10px] text-muted">+{evs.length - 3}</div>}</div>
                </div>
              ); })}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" />Deadline</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-500/40" />Decision</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500/40" />Task</span></div>
          </Card>
        )}

        {view === 'timeline' && (
          <Card className="p-5">
            {(() => {
              const items = [...s.apps.flatMap((a) => [a.deadline && { date: a.deadline, label: `${byId(a.collegeId)?.short} ${a.round} deadline`, kind: 'Deadline', done: ['Submitted', 'Accepted', 'Rejected', 'Waitlisted', 'Deferred'].includes(a.status) }, a.submitted && { date: a.submitted, label: `${byId(a.collegeId)?.short} submitted`, kind: 'Submitted', done: true }, a.decisionDate && { date: a.decisionDate, label: `${byId(a.collegeId)?.short} decision`, kind: 'Decision', done: !!a.result }]), ...s.tasks.map((t) => t.due && { date: t.due, label: t.title, kind: 'Task', done: t.done })].filter(Boolean) as { date: string; label: string; kind: string; done: boolean }[];
              items.sort((a, b) => a.date.localeCompare(b.date));
              const todayIso = iso(today); let placed = false;
              if (!items.length) return <EmptyState title="Nothing on the timeline" body="Add deadlines and tasks to see them here." />;
              return (
                <ol className="relative space-y-3 border-l border-line pl-6">
                  {items.map((x, i) => {
                    const marker = !placed && x.date >= todayIso ? (placed = true) : false;
                    return (
                      <React.Fragment key={i}>
                        {marker && <li className="relative -ml-6 flex items-center gap-2 py-1 text-xs font-semibold text-accent"><span className="h-px flex-1 bg-accent" />Today · {fmtDate(todayIso)}<span className="h-px flex-1 bg-accent" /></li>}
                        <li className="relative">
                          <span className={cx('absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-surface', x.done ? 'bg-teal' : x.kind === 'Deadline' ? 'bg-accent' : x.kind === 'Decision' ? 'bg-violet' : 'bg-amber-500')} />
                          <div className="flex flex-wrap items-center gap-2"><span className="w-28 shrink-0 text-sm tabular-nums text-muted">{fmtDate(x.date)}</span><span className={cx('text-sm', x.done ? 'text-muted line-through' : 'text-ink')}>{x.label}</span><Badge>{x.kind}</Badge></div>
                        </li>
                      </React.Fragment>
                    );
                  })}
                </ol>
              );
            })()}
          </Card>
        )}

        {view === 'tasks' && (
          <Card className="p-5">
            <CardHeader flush title="Tasks" desc="Sorted by priority, then due date. Reminders appear in alerts here and in the calendar export." action={<Button size="sm" variant="primary" icon={<LuPlus />} onClick={() => setTask(blankTask())}>New task</Button>} />
            {s.tasks.length ? (
              <ul className="mt-4 divide-y divide-line">
                {[...s.tasks].sort((a, b) => Number(a.done) - Number(b.done) || ({ High: 0, Medium: 1, Low: 2 }[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority]) || (a.due || '9').localeCompare(b.due || '9')).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <button aria-label={t.done ? 'Mark not done' : 'Mark done'} onClick={() => store.set((st) => { const x = st.tasks.find((y) => y.id === t.id)!; x.done = !x.done; })} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg">{t.done ? <LuCircleCheck className="text-teal" /> : <LuCircle className="text-muted" />}</button>
                    <span className="min-w-0 flex-1"><span className={cx('block text-sm', t.done ? 'text-muted line-through' : 'text-ink')}>{t.title}</span><span className="text-xs text-muted">{t.due ? `Due ${fmtDate(t.due)}` : 'No due date'}{t.collegeId ? ` · ${byId(t.collegeId)?.short}` : ''}{t.reminder ? ' · reminder' : ''}</span></span>
                    <Badge tone={t.priority === 'High' ? 'rose' : t.priority === 'Medium' ? 'amber' : 'neutral'}>{t.priority}</Badge>
                    <Button size="sm" variant="ghost" aria-label="Edit task" icon={<LuPencil />} onClick={() => setTask({ ...t })} />
                    <Button size="sm" variant="ghost" aria-label="Delete task" icon={<LuTrash2 />} onClick={() => store.set((st) => { st.tasks = st.tasks.filter((x) => x.id !== t.id); })} />
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No tasks" body="Break applications into small steps: request recommendations, send scores, finish a supplement." />}
          </Card>
        )}
      </div>

      <Modal open={!!edit} onClose={() => { setEdit(null); setAppErr(''); }} title={edit && s.apps.some((a) => a.id === edit.id) ? 'Edit application' : 'New application'} wide footer={<><Button variant="ghost" onClick={() => { setEdit(null); setAppErr(''); }}>Cancel</Button><Button variant="primary" onClick={saveApp}>Save</Button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            {appErr && <Notice tone="warn" className="sm:col-span-2">{appErr}</Notice>}
            <Field label="College" htmlFor="ap-col"><Select id="ap-col" value={edit.collegeId} onChange={(e) => { const c = COLLEGES.find((x) => x.id === e.target.value); const round = c?.rounds.includes(edit.round) ? edit.round : c?.rounds[0] || 'RD'; setEdit({ ...edit, collegeId: e.target.value, round, deadline: c?.deadlines[round] ? cycleDate(c.deadlines[round], s.profile.gradYear) : edit.deadline }); }} options={[{ value: '', label: 'Choose a college' }, ...COLLEGES.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
            <Field label="Round" htmlFor="ap-round" hint={edit.collegeId ? `Offered: ${byId(edit.collegeId)?.rounds.join(', ')}` : undefined}><Select id="ap-round" value={edit.round} onChange={(e) => { const c = byId(edit.collegeId); setEdit({ ...edit, round: e.target.value, deadline: c?.deadlines[e.target.value] ? cycleDate(c.deadlines[e.target.value], s.profile.gradYear) : edit.deadline }); }} options={ROUNDS} /></Field>
            <Field label="Deadline" htmlFor="ap-dl" hint="Pre-filled from typical dates — verify on the official site."><Input id="ap-dl" type="date" value={edit.deadline} onChange={(e) => setEdit({ ...edit, deadline: e.target.value })} /></Field>
            <Field label="Status" htmlFor="ap-st"><Select id="ap-st" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Application['status'] })} options={[...APP_STATUSES]} /></Field>
            <Field label="Submitted on" htmlFor="ap-sub"><Input id="ap-sub" type="date" value={edit.submitted} onChange={(e) => setEdit({ ...edit, submitted: e.target.value })} /></Field>
            <Field label="Expected decision date" htmlFor="ap-dec"><Input id="ap-dec" type="date" value={edit.decisionDate} onChange={(e) => setEdit({ ...edit, decisionDate: e.target.value })} /></Field>
            <Field label="Final result / notes on decision" htmlFor="ap-res" className="sm:col-span-2"><Input id="ap-res" value={edit.result} onChange={(e) => setEdit({ ...edit, result: e.target.value })} placeholder="e.g. Admitted with $12k merit" /></Field>
            <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">{(Object.keys(ITEM_LABELS) as (keyof Application['items'])[]).map((k) => <Field key={k} label={ITEM_LABELS[k]}><Select value={edit.items[k]} onChange={(e) => setEdit({ ...edit, items: { ...edit.items, [k]: e.target.value } })} options={[...ITEM_STATUSES]} /></Field>)}</div>
            <Field label="Notes" htmlFor="ap-notes" className="sm:col-span-2"><Textarea id="ap-notes" rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Modal open={!!task} onClose={() => setTask(null)} title={task && s.tasks.some((t) => t.id === task.id) ? 'Edit task' : 'New task'} footer={<><Button variant="ghost" onClick={() => setTask(null)}>Cancel</Button><Button variant="primary" disabled={!task?.title.trim()} onClick={saveTask}>Save</Button></>}>
        {task && (
          <div className="grid gap-4">
            <Field label="Task" htmlFor="tk-title"><Input id="tk-title" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="e.g. Ask Ms. Lee for a recommendation" maxLength={140} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Due date" htmlFor="tk-due"><Input id="tk-due" type="date" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} /></Field>
              <Field label="Priority" htmlFor="tk-pri"><Select id="tk-pri" value={task.priority} onChange={(e) => setTask({ ...task, priority: e.target.value as Task['priority'] })} options={['High', 'Medium', 'Low']} /></Field>
            </div>
            <Field label="Related college" htmlFor="tk-col"><Select id="tk-col" value={task.collegeId} onChange={(e) => setTask({ ...task, collegeId: e.target.value })} options={[{ value: '', label: 'None' }, ...s.list.map((l) => ({ value: l.collegeId, label: byId(l.collegeId)?.short || l.collegeId }))]} /></Field>
            <Toggle label="Remind me" desc="Shows in deadline alerts 7 days before, and adds a 3-day alarm in the calendar export." checked={task.reminder} onChange={(v) => setTask({ ...task, reminder: v })} />
          </div>
        )}
      </Modal>
    </>
  );
}
