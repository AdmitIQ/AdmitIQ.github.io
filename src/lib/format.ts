import { COLLEGES, DATA_META, scorecardUrl, type College } from '../data/colleges';
import type { Provenance } from '../components/ui';

export const byId = (id: string): College | undefined => COLLEGES.find((c) => c.id === id);
export const pct = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? 'Unavailable' : `${(v * 100).toFixed(d)}%`);
export const usd = (v: number | null | undefined) => (v === null || v === undefined ? 'Unavailable' : v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }));
export const usdK = (v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`);
export const range = (r: [number, number] | null) => (r ? `${r[0]}–${r[1]}` : 'Unavailable');
export const num = (v: number | null | undefined) => (v === null || v === undefined ? 'Unavailable' : v.toLocaleString('en-US'));

const FIELD_KEYS: Record<string, string[]> = { admit: ['admit'], sat: ['sat'], act: ['act'], tuition: ['tuitionIn', 'tuitionOut'], coa: ['coaIn', 'coaOut'], netPrice: ['netPrice'], grad: ['grad'], retention: ['retention'], earnings: ['earnings'], debt: ['debt'], undergrad: ['undergrad'] };

export function prov(c: College & { verified?: Record<string, { retrieved: string; url: string; source: string }> }, field: keyof typeof DATA_META.confidence, value: unknown) {
  const unavailable = value === null || value === undefined;
  const v = (FIELD_KEYS[field] || []).map((k) => c.verified?.[k]).find(Boolean);
  if (v && !unavailable) return { kind: 'Verified' as Provenance, source: v.source, url: v.url, year: 'Latest College Scorecard release', confidence: 'High', retrieved: v.retrieved, multi: false };
  return {
    kind: (unavailable ? 'Unavailable' : 'Unverified (recall)') as Provenance,
    source: unavailable ? 'Not in AdmitIQ dataset — check the official site' : DATA_META.sources,
    url: field === 'tests' || field === 'deadlines' ? c.web : c.country === 'USA' ? scorecardUrl(c) : c.web,
    year: unavailable ? undefined : DATA_META.reportingYears,
    confidence: unavailable ? undefined : DATA_META.confidence[field],
    retrieved: DATA_META.collected,
    multi: false,
  };
}

export const daysUntil = (iso: string, today = new Date()) => Math.ceil((new Date(iso + 'T23:59:59').getTime() - today.getTime()) / 86400000);
export const fmtDate = (iso: string) => { if (!iso) return '—'; const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };

// Deadline for the upcoming cycle (MM-DD -> YYYY-MM-DD), based on the student's grad year.
export function cycleDate(mmdd: string, gradYear: number | null) {
  const gy = gradYear || new Date().getFullYear() + 1;
  const [m] = mmdd.split('-').map(Number);
  return `${m >= 7 ? gy - 1 : gy}-${mmdd}`;
}

export function toCSV(rows: (string | number | null)[][]) {
  return rows.map((r) => r.map((v) => { const s = v === null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
}
