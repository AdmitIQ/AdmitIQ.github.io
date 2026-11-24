import type { AppState } from './types';
import { COLLEGES } from '../data/colleges';
import { ITEM_LABELS } from './apps';
import { daysUntil, fmtDate } from './format';

export interface PlanItem { id: string; title: string; detail: string; to: string; urgency: number; due?: string; taskId?: string }
const short = (id: string) => COLLEGES.find((c) => c.id === id)?.short || id;
const DONE = ['Submitted', 'Accepted', 'Rejected', 'Waitlisted', 'Deferred'];

/** A prioritized, explainable plan for the next week, built only from the student's own data. */
export function weeklyPlan(s: AppState, today = new Date()): PlanItem[] {
  const out: PlanItem[] = [];
  for (const a of s.apps) {
    if (!a.deadline || DONE.includes(a.status)) continue;
    const d = daysUntil(a.deadline, today);
    if (d < 0) { out.push({ id: `late-${a.id}`, title: `${short(a.collegeId)} ${a.round} deadline has passed`, detail: `It was due ${fmtDate(a.deadline)}. If you submitted, update its status; if not, check whether a later round is open.`, to: 'tracker', urgency: 3 }); continue; }
    if (d > 21) continue;
    const open = (Object.keys(a.items) as (keyof typeof a.items)[]).filter((k) => a.items[k] !== 'Done' && a.items[k] !== 'N/A');
    if (a.status === 'Ready to submit' || !open.length) out.push({ id: `submit-${a.id}`, title: `Submit ${short(a.collegeId)} ${a.round}`, detail: `Everything is checked off — due ${fmtDate(a.deadline)} (${d} days). Submit a few days early to avoid portal crashes.`, to: 'tracker', urgency: d <= 7 ? 3 : 2, due: a.deadline });
    else out.push({ id: `items-${a.id}`, title: `${short(a.collegeId)}: finish ${open.map((k) => ITEM_LABELS[k].toLowerCase()).slice(0, 3).join(', ')}${open.length > 3 ? '…' : ''}`, detail: `${a.round} due ${fmtDate(a.deadline)} — ${d === 0 ? 'today' : `${d} days left`}. ${open.length} item${open.length > 1 ? 's' : ''} open.`, to: 'tracker', urgency: d <= 3 ? 3 : d <= 10 ? 2 : 1, due: a.deadline });
    if (a.items.essays !== 'Done' && a.items.essays !== 'N/A' && !s.essays.some((e) => e.collegeId === a.collegeId) && d <= 21)
      out.push({ id: `essay-${a.id}`, title: `Start the ${short(a.collegeId)} supplement`, detail: 'No essay for this school in the Essay Lab yet. Drafting early leaves time for two rounds of revision.', to: 'essays', urgency: d <= 7 ? 3 : 2, due: a.deadline });
    if (a.items.interview === 'Not started' || a.items.interview === 'In progress')
      out.push({ id: `iv-${a.id}`, title: `Practice for your ${short(a.collegeId)} interview`, detail: 'Run a 5-question mock interview with voice feedback.', to: 'interview', urgency: 1 });
  }
  for (const t of s.tasks) {
    if (t.done || !t.due) continue;
    const d = daysUntil(t.due, today);
    if (d <= 7) out.push({ id: `task-${t.id}`, taskId: t.id, title: t.title, detail: d < 0 ? `Overdue by ${-d} day${d === -1 ? '' : 's'}` : d === 0 ? 'Due today' : `Due ${fmtDate(t.due)}`, to: 'tracker', urgency: d < 0 ? 3 : t.priority === 'High' ? 2 + (d <= 2 ? 1 : 0) : d <= 2 ? 2 : 1, due: t.due });
  }
  for (const a of s.apps) if (a.decisionDate && !a.result) { const d = daysUntil(a.decisionDate, today); if (d >= 0 && d <= 7) out.push({ id: `dec-${a.id}`, title: `${short(a.collegeId)} decision expected ${d === 0 ? 'today' : `in ${d} days`}`, detail: 'Log the result in your tracker when it arrives.', to: 'tracker', urgency: 1, due: a.decisionDate }); }
  for (const a of s.apps) if (a.status === 'Accepted' && !s.offers.some((o) => o.collegeId === a.collegeId)) out.push({ id: `offer-${a.id}`, title: `Enter ${short(a.collegeId)}'s financial aid offer`, detail: 'Compare free money vs. loans across your acceptances before May 1.', to: 'costs', urgency: 1 });
  if (!s.profile.intendedMajor) out.push({ id: 'major', title: 'Add an intended major (or "Undecided")', detail: 'Unlocks major-specific notes, like programs with separate, lower admit rates.', to: 'profile', urgency: 0 });
  if (!s.activities.length) out.push({ id: 'acts', title: 'Add your activities', detail: 'Needed for strength analysis and Common App description help.', to: 'profile-activities', urgency: 0 });
  if (s.list.length && !s.list.some((l) => l.category === 'Likely')) out.push({ id: 'likely', title: 'Add a Likely school you\'d be happy to attend', detail: 'A balanced list includes schools where admission is very likely and that you can afford.', to: 'list', urgency: 1 });
  if (s.essays.length && s.essays.every((e) => e.drafts.length === 0)) out.push({ id: 'draft', title: 'Save a first essay draft', detail: 'Drafts let you compare versions and track improvement.', to: 'essays', urgency: 0 });
  return out.sort((a, b) => b.urgency - a.urgency || (a.due || '9').localeCompare(b.due || '9')).slice(0, 8);
}
