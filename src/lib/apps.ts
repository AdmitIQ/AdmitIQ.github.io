import type { Application } from './types';

const STATUS_WEIGHT: Record<string, number> = { Researching: 0, Planned: 5, 'In progress': 30, 'Ready to submit': 90, Submitted: 100, Accepted: 100, Deferred: 100, Waitlisted: 100, Rejected: 100 };

export function appCompletion(a: Application) {
  if (STATUS_WEIGHT[a.status] === 100) return 100;
  const items = Object.values(a.items).filter((v) => v !== 'N/A');
  if (!items.length) return STATUS_WEIGHT[a.status];
  const itemPct = items.reduce((s, v) => s + (v === 'Done' ? 1 : v === 'In progress' ? 0.5 : 0), 0) / items.length;
  return Math.round(Math.min(95, Math.max(STATUS_WEIGHT[a.status], itemPct * 90)));
}

export function overallCompletion(apps: Application[]) {
  const active = apps.filter((a) => a.status !== 'Researching');
  if (!active.length) return 0;
  return Math.round(active.reduce((s, a) => s + appCompletion(a), 0) / active.length);
}

export const ITEM_LABELS: Record<keyof Application['items'], string> = { essays: 'Essays', recommendations: 'Recommendations', transcript: 'Transcript', testing: 'Test scores', financialAid: 'Financial aid forms', scholarships: 'Scholarships', interview: 'Interview' };
export const isDecided = (s: string) => ['Accepted', 'Deferred', 'Waitlisted', 'Rejected'].includes(s);
