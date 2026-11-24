// Browser notifications for upcoming deadlines and tasks (opt-in, works where the browser allows
// notifications — not inside sandboxed previews). Each reminder fires at most once per day.
import { store } from './store';
import { COLLEGES } from '../data/colleges';

const KEY = 'admitiq:notified';
const short = (id: string) => COLLEGES.find((c) => c.id === id)?.short || id;
const days = (iso: string) => Math.ceil((new Date(iso + 'T23:59:59').getTime() - Date.now()) / 86400000);

export function notificationsSupported() {
  try { return typeof Notification !== 'undefined' && window.isSecureContext; } catch { return false; }
}
export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}

export function dueReminders(today = new Date()) {
  const s = store.get(); const out: { id: string; title: string; body: string }[] = [];
  const stamp = today.toISOString().slice(0, 10);
  for (const a of s.apps) {
    if (!a.deadline || ['Submitted', 'Accepted', 'Rejected', 'Waitlisted', 'Deferred'].includes(a.status)) continue;
    const d = days(a.deadline);
    if ([14, 7, 3, 1, 0].includes(d)) out.push({ id: `app-${a.id}-${stamp}`, title: `${short(a.collegeId)} ${a.round} deadline ${d === 0 ? 'is today' : `in ${d} day${d === 1 ? '' : 's'}`}`, body: `Status: ${a.status}. Open AdmitIQ to finish your checklist.` });
  }
  for (const t of s.tasks) {
    if (t.done || !t.due || !t.reminder) continue;
    const d = days(t.due);
    if (d <= 1 && d >= -1) out.push({ id: `task-${t.id}-${stamp}`, title: d < 0 ? `Overdue: ${t.title}` : `Due ${d === 0 ? 'today' : 'tomorrow'}: ${t.title}`, body: t.priority === 'High' ? 'High priority task' : 'AdmitIQ reminder' });
  }
  return out;
}

function check() {
  if (!store.get().prefs.notifications || !notificationsSupported() || Notification.permission !== 'granted') return;
  let sent: string[] = [];
  try { sent = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* ignore */ }
  for (const r of dueReminders()) {
    if (sent.includes(r.id)) continue;
    try { new Notification(r.title, { body: r.body, tag: r.id }); sent.push(r.id); } catch { /* ignore */ }
  }
  try { localStorage.setItem(KEY, JSON.stringify(sent.slice(-200))); } catch { /* ignore */ }
}

export function startReminders() {
  check();
  const t = setInterval(check, 30 * 60 * 1000);
  const onVis = () => { if (document.visibilityState === 'visible') check(); };
  document.addEventListener('visibilitychange', onVis);
  return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
}
