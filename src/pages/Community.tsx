import React, { useEffect, useMemo, useState } from 'react';
import { useCaps } from '../App';
import { auth } from '../lib/services';
import { LuShieldCheck, LuUsers, LuTrash2 } from 'react-icons/lu';
import { Badge, Button, Card, CardHeader, EmptyState, ExtLink, Field, Notice, PageHeader, Select, Textarea, cx, useToast } from '../components/ui';
import { HBars } from '../components/charts';
import { COLLEGES } from '../data/colleges';
import { store, uid, useStore } from '../lib/store';
import type { Experience } from '../lib/types';
import { fmtDate } from '../lib/format';

const THEMES = ['Campus culture', 'Academics', 'Social life', 'Housing', 'Food', 'Career services', 'Internships', 'Professors', 'Workload', 'Overall satisfaction'];
const KEYWORDS: Record<string, RegExp> = {
  'Campus culture': /culture|community|vibe|friendly|inclusive|competitive|collaborative/i, Academics: /class|course|academic|major|curriculum|rigor/i, 'Social life': /social|party|friends|clubs|greek|events/i,
  Housing: /dorm|housing|room|apartment/i, Food: /food|dining|meal/i, 'Career services': /career|recruit|resume|job/i, Internships: /intern|co-op|coop/i,
  Professors: /professor|faculty|teacher|office hours|ta\b/i, Workload: /workload|stress|busy|hard|homework|grind/i, 'Overall satisfaction': /love|happy|regret|glad|worth/i,
};
// Remove contact details and handles so submissions can't identify anyone.
export function scrub(t: string) {
  return t.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email removed]').replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[number removed]').replace(/(^|\s)@\w{2,}/g, '$1[handle removed]').replace(/https?:\/\/\S+/g, '[link removed]').slice(0, 800);
}

export default function Community() {
  const s = useStore((x) => x);
  const toast = useToast();
  const [cid, setCid] = useState(s.list[0]?.collegeId || 'umich');
  const [form, setForm] = useState({ collegeId: s.list[0]?.collegeId || '', relation: 'Visitor' as Experience['relation'], year: String(new Date().getFullYear()), ratings: {} as Record<string, number>, positives: '', concerns: '', consent: false });
  const [err, setErr] = useState('');
  const { caps } = useCaps();
  const [cloud, setCloud] = useState<Experience[]>([]);
  useEffect(() => {
    if (!caps?.supabase) return;
    let live = true;
    auth.approvedExperiences(caps.supabase, cid).then((rows) => { if (live) setCloud(rows.map((r) => ({ id: `c-${r.id}`, collegeId: cid, relation: r.relation as Experience['relation'], year: String(r.year ?? ''), ratings: r.ratings || {}, positives: r.positives || '', concerns: r.concerns || '', createdAt: r.created_at }))); }).catch(() => setCloud([]));
    return () => { live = false; };
  }, [caps, cid]);
  const exps = [...s.experiences.filter((e) => e.collegeId === cid), ...cloud];
  const summary = useMemo(() => {
    const avg = THEMES.map((t) => { const v = exps.map((e) => e.ratings[t]).filter((x): x is number => !!x); return { t, n: v.length, avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }; });
    const count = (field: 'positives' | 'concerns') => THEMES.map((t) => ({ t, n: exps.filter((e) => KEYWORDS[t].test(e[field])).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
    const dates = exps.map((e) => e.createdAt).sort();
    return { avg, pos: count('positives'), neg: count('concerns'), range: dates.length ? `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}` : '—' };
  }, [exps]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.collegeId) return setErr('Choose the college');
    if (!form.consent) return setErr('Please confirm consent to submit');
    if (!form.positives.trim() && !form.concerns.trim() && !Object.keys(form.ratings).length) return setErr('Add at least a rating or a comment');
    const entry = { collegeId: form.collegeId, relation: form.relation, year: form.year, ratings: form.ratings, positives: scrub(form.positives), concerns: scrub(form.concerns) };
    store.set((st) => { st.experiences.push({ id: uid(), ...entry, createdAt: new Date().toISOString() }); });
    if (caps?.supabase && auth.current()) auth.submitExperience(caps.supabase, entry).then(() => toast('Also sent for moderation — it appears publicly once approved', 'info')).catch((e2) => toast((e2 as Error).message, 'error'));
    setForm({ ...form, ratings: {}, positives: '', concerns: '', consent: false }); setErr(''); setCid(form.collegeId); toast('Thanks — saved anonymously');
  }

  return (
    <>
      <PageHeader title="Student experiences" desc="Recurring themes from voluntary, anonymous submissions. Anecdotes describe individual experiences — they are not verified facts." />
      <Notice className="mb-5"><b>About this data.</b> AdmitIQ does not scrape forums or review sites. Themes here come only from submissions made through this form{' '}(stored on this device unless your deployment syncs them with consent). For broader perspectives, read official student surveys and browse public discussions yourself, e.g. <ExtLink href="https://www.reddit.com/r/ApplyingToCollege/">r/ApplyingToCollege</ExtLink> or each college's own subreddit — remember they're anecdotal and self-selected.</Notice>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-ink">Themes for</h2><Select aria-label="College" value={cid} onChange={(e) => setCid(e.target.value)} options={COLLEGES.map((c) => ({ value: c.id, label: c.short }))} className="w-auto" /></div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs"><Badge>Sample size: {exps.length}</Badge><Badge>Date range: {summary.range}</Badge><Badge tone="violet">Self-reported</Badge></div>
            {exps.length < 3 ? <EmptyState icon={<LuUsers />} title="Insufficient data" body={`${exps.length} submission${exps.length === 1 ? '' : 's'} so far. AdmitIQ needs at least 3 before summarizing themes, to avoid treating one person's view as a trend.`} /> : (
              <div className="mt-4 space-y-5">
                <div><h3 className="mb-2 text-sm font-semibold text-ink">Average ratings (1–5)</h3><HBars data={summary.avg.filter((a) => a.n).map((a) => ({ label: `${a.t} (n=${a.n})`, value: a.avg, color: (a.avg ?? 0) >= 4 ? 'var(--c3)' : (a.avg ?? 0) >= 3 ? 'var(--c1)' : 'var(--c5)' }))} max={5} format={(v) => v.toFixed(1)} /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><h3 className="mb-2 text-sm font-semibold text-ink">Common positive themes</h3><ul className="space-y-1 text-sm">{summary.pos.length ? summary.pos.map((x) => <li key={x.t} className="flex justify-between"><span className="text-ink">{x.t}</span><span className="text-muted tabular-nums">{x.n} mention{x.n > 1 ? 's' : ''}</span></li>) : <li className="text-muted">None recurring</li>}</ul></div>
                  <div><h3 className="mb-2 text-sm font-semibold text-ink">Common criticisms</h3><ul className="space-y-1 text-sm">{summary.neg.length ? summary.neg.map((x) => <li key={x.t} className="flex justify-between"><span className="text-ink">{x.t}</span><span className="text-muted tabular-nums">{x.n} mention{x.n > 1 ? 's' : ''}</span></li>) : <li className="text-muted">None recurring</li>}</ul></div>
                </div>
              </div>
            )}
          </Card>
          {exps.length > 0 && (
            <Card className="p-5">
              <CardHeader flush title="Submissions" desc="Shown without names or contact details." />
              <ul className="mt-3 space-y-3">{exps.map((e) => (
                <li key={e.id} className="rounded-xl border border-line p-4 text-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted"><span>{e.relation} · {e.year} · Anonymous</span>{e.id.startsWith('c-') ? <span>Moderated</span> : <button title="Delete from this device" aria-label="Delete submission" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-raised hover:text-rose-600" onClick={() => store.set((st) => { st.experiences = st.experiences.filter((x) => x.id !== e.id); })}><LuTrash2 /></button>}</div>
                  {e.positives && <p className="mt-1 text-ink"><b className="text-teal">+</b> {e.positives}</p>}
                  {e.concerns && <p className="mt-1 text-ink"><b className="text-rose-600">–</b> {e.concerns}</p>}
                </li>
              ))}</ul>
            </Card>
          )}
        </div>
        <Card className="h-fit p-5">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><LuShieldCheck className="text-teal" />Share an experience</h2>
          <p className="mt-1 text-sm text-muted">Anonymous by default: no name, email or account is attached. Emails, phone numbers, links and @handles are removed automatically.</p>
          <form onSubmit={submit} className="mt-4 grid gap-4" noValidate>
            <Field label="College" htmlFor="ex-col"><Select id="ex-col" value={form.collegeId} onChange={(e) => setForm({ ...form, collegeId: e.target.value })} options={[{ value: '', label: 'Choose' }, ...COLLEGES.map((c) => ({ value: c.id, label: c.short }))]} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your connection" htmlFor="ex-rel"><Select id="ex-rel" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value as Experience['relation'] })} options={['Current student', 'Recent graduate', 'Admitted student', 'Visitor']} /></Field>
              <Field label="Year" htmlFor="ex-yr"><Select id="ex-yr" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} options={Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i))} /></Field>
            </div>
            <fieldset><legend className="text-sm font-medium text-ink">Ratings (optional)</legend>
              <div className="mt-2 space-y-2">{THEMES.map((t) => (
                <div key={t} className="flex items-center justify-between gap-2"><span className="text-sm text-muted">{t}</span><div className="flex gap-1" role="radiogroup" aria-label={t}>{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={form.ratings[t] === n} aria-label={`${t} ${n}`} onClick={() => setForm({ ...form, ratings: { ...form.ratings, [t]: form.ratings[t] === n ? 0 : n } })} className={cx('h-8 w-8 rounded-lg border text-xs tabular-nums', (form.ratings[t] || 0) >= n ? 'border-accent bg-accent text-white' : 'border-line text-muted hover:border-ink/30')}>{n}</button>)}</div></div>
              ))}</div>
            </fieldset>
            <Field label="What's good?" htmlFor="ex-pos"><Textarea id="ex-pos" rows={3} value={form.positives} onChange={(e) => setForm({ ...form, positives: e.target.value })} maxLength={800} /></Field>
            <Field label="What could be better?" htmlFor="ex-neg"><Textarea id="ex-neg" rows={3} value={form.concerns} onChange={(e) => setForm({ ...form, concerns: e.target.value })} maxLength={800} /></Field>
            <label className="flex items-start gap-3 text-sm text-ink"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-1 h-5 w-5 accent-[var(--accent)]" /><span>I consent to my answers being stored and shown anonymously in AdmitIQ's experience summaries. I haven't included anyone's personal information.</span></label>
            {err && <p role="alert" className="text-sm text-rose-600">{err}</p>}
            <Button type="submit" variant="primary">Submit anonymously</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
