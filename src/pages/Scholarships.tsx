import React, { useMemo, useState } from 'react';
import { LuBookmark, LuBookmarkCheck, LuPlus, LuSearch, LuShieldAlert, LuTrash2 } from 'react-icons/lu';
import { Badge, Button, Card, Chips, EmptyState, ExtLink, Field, Input, Modal, Notice, NumberInput, PageHeader, Select, Tabs, Textarea, useToast } from '../components/ui';
import { SCAM_SIGNS, SCHOLARSHIPS, type Scholarship } from '../data/scholarships';
import { store, uid, useStore } from '../lib/store';
import { studentAcademics } from '../lib/analysis';
import { daysUntil, fmtDate } from '../lib/format';
import type { AppState } from '../lib/types';

const TAGS: Record<string, string> = { need: 'Financial need', merit: 'Academic merit', stem: 'STEM', research: 'Research', leadership: 'Leadership', service: 'Community service', 'first-gen': 'First-generation', hispanic: 'Hispanic heritage', black: 'Black / African American', 'any-major': 'Any major' };

function match(sc: Scholarship, s: AppState) {
  const reasons: string[] = []; let score = 0;
  const ac = studentAcademics(s);
  const stateTag = sc.tags.find((t) => t.startsWith('state:'));
  if (stateTag) { if (stateTag.slice(6) === s.profile.state) { score += 3; reasons.push('Your state'); } else score -= 10; }
  if (sc.tags.includes('merit') && ((ac.gpa4 ?? 0) >= 3.7 || (s.profile.sat.total ?? 0) >= 1400)) { score += 2; reasons.push('Strong academics'); }
  if (sc.tags.includes('need') && ['$0–30k', '$30–48k', '$48–75k'].includes(s.financial.incomeBracket)) { score += 2; reasons.push('Income range'); }
  if (sc.tags.includes('stem') && /Computer|Engineering|Math|Physics|Chem|Bio|Data|Neuro/.test(s.profile.intendedMajor)) { score += 2; reasons.push('STEM major'); }
  if (sc.tags.includes('research') && s.activities.some((a) => a.category === 'Research' || /research/i.test(a.description))) { score += 2; reasons.push('Research activity'); }
  if (sc.tags.includes('leadership') && s.activities.some((a) => /president|captain|lead|founder|chair|editor/i.test(`${a.position} ${a.leadership}`))) { score += 1; reasons.push('Leadership'); }
  if (sc.tags.includes('service') && s.activities.some((a) => a.category === 'Community service')) { score += 1; reasons.push('Service activity'); }
  const gy = s.profile.gradYear; const now = new Date(); const senior = gy ? gy === now.getFullYear() + (now.getMonth() >= 6 ? 1 : 0) : null;
  if (sc.grade === 'senior' && senior === false) reasons.push('Senior-year program — plan ahead');
  return { score, reasons };
}

export default function Scholarships() {
  const s = useStore((x) => x);
  const toast = useToast();
  const [tab, setTab] = useState<'find' | 'saved'>('find');
  const [q, setQ] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [minAmt, setMinAmt] = useState<number | null>(null);
  const [sort, setSort] = useState('match');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', deadline: '', url: '', notes: '' });
  const [err, setErr] = useState('');
  const rows = useMemo(() => SCHOLARSHIPS.map((sc) => ({ sc, m: match(sc, s) }))
    .filter(({ sc }) => (!q || `${sc.name} ${sc.sponsor} ${sc.eligibility.join(' ')}`.toLowerCase().includes(q.toLowerCase())) && (!tags.length || tags.every((t) => sc.tags.includes(t))) && (minAmt === null || (sc.amountMax ?? 0) >= minAmt))
    .sort((a, b) => (sort === 'amount' ? (b.sc.amountMax ?? 0) - (a.sc.amountMax ?? 0) : sort === 'name' ? a.sc.name.localeCompare(b.sc.name) : b.m.score - a.m.score)), [q, tags, minAmt, sort, s]);
  const toggleSave = (id: string) => store.set((st) => { st.savedScholarships = st.savedScholarships.includes(id) ? st.savedScholarships.filter((x) => x !== id) : [...st.savedScholarships, id]; });

  function addCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setErr('Name is required');
    if (form.url && !/^https:\/\/[^\s]+\.[^\s]+/.test(form.url)) return setErr('Use a full https:// link to the official site');
    store.set((st) => { st.customScholarships.push({ id: uid(), ...form, name: form.name.trim() }); });
    setForm({ name: '', amount: '', deadline: '', url: '', notes: '' }); setErr(''); setAddOpen(false); setTab('saved'); toast('Scholarship added');
  }
  const saved = SCHOLARSHIPS.filter((x) => s.savedScholarships.includes(x.id));

  return (
    <>
      <PageHeader title="Scholarship finder" desc="Established national and state programs with official links. Matches are based on your profile, but eligibility is decided by each program."
        actions={<Button icon={<LuPlus />} variant="primary" onClick={() => setAddOpen(true)}>Track a scholarship</Button>} />
      <Notice className="mb-5">AdmitIQ lists a curated set of long-running programs and never invents scholarships or deadlines. Because amounts and dates change every year, each listing shows the <b>typical</b> cycle — confirm everything on the official site. To search thousands more, use the U.S. Department of Labor's free <ExtLink href="https://www.careeronestop.org/Toolkit/Training/find-scholarships.aspx">CareerOneStop Scholarship Finder</ExtLink>, your school counselor, and your state's higher-education agency.</Notice>

      <Tabs tabs={[{ id: 'find', label: 'Find', count: rows.length }, { id: 'saved', label: 'Saved & tracked', count: saved.length + s.customScholarships.length }]} value={tab} onChange={setTab} className="mb-5" />

      {tab === 'find' && (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="h-fit space-y-4 p-5">
            <div className="relative"><LuSearch className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" /><Input aria-label="Search scholarships" placeholder="Search" className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Field label="Must match"><Chips options={Object.keys(TAGS)} value={tags} onChange={setTags} /></Field>
            <p className="-mt-2 text-xs text-muted">{tags.map((t) => TAGS[t]).join(', ')}</p>
            <Field label="Award at least ($)"><NumberInput value={minAmt} onChange={setMinAmt} /></Field>
            <Field label="Sort"><Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} options={[{ value: 'match', label: 'Best match for you' }, { value: 'amount', label: 'Largest award' }, { value: 'name', label: 'Name' }]} /></Field>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold text-ink"><LuShieldAlert className="text-amber-600" />Scam warning signs</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">{SCAM_SIGNS.map((x) => <li key={x}>{x}</li>)}</ul>
              <p className="mt-2 text-muted">Report scams at <ExtLink href="https://reportfraud.ftc.gov">ReportFraud.ftc.gov</ExtLink>.</p>
            </div>
          </Card>
          <div className="space-y-3">
            {rows.length ? rows.map(({ sc, m }) => (
              <Card key={sc.id} hover className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="font-semibold text-ink">{sc.name}</h3><p className="text-sm text-muted">{sc.sponsor}</p></div>
                  <div className="flex items-center gap-2">{m.score >= 3 && <Badge tone="teal">Strong match</Badge>}<Button size="sm" variant={s.savedScholarships.includes(sc.id) ? 'soft' : 'secondary'} icon={s.savedScholarships.includes(sc.id) ? <LuBookmarkCheck /> : <LuBookmark />} onClick={() => toggleSave(sc.id)}>{s.savedScholarships.includes(sc.id) ? 'Saved' : 'Save'}</Button></div>
                </div>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted">Amount</dt><dd className="text-ink">{sc.amount}</dd></div>
                  <div><dt className="text-xs text-muted">Typical timing (verify)</dt><dd className="text-ink">{sc.cycle}</dd></div>
                  <div><dt className="text-xs text-muted">Eligibility</dt><dd><ul className="list-disc pl-4 text-ink">{sc.eligibility.map((x) => <li key={x}>{x}</li>)}</ul></dd></div>
                  <div><dt className="text-xs text-muted">Requirements</dt><dd className="text-ink">{sc.requirements.join(' · ')}</dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="amber">{sc.verification}</Badge>
                  {m.reasons.map((r) => <Badge key={r} tone="blue">{r}</Badge>)}
                  <ExtLink href={sc.url} className="ml-auto text-sm">Official website</ExtLink>
                </div>
              </Card>
            )) : <Card><EmptyState title="No matches" body="Remove a filter to see more programs." /></Card>}
          </div>
        </div>
      )}

      {tab === 'saved' && (
        <div className="space-y-3">
          {!saved.length && !s.customScholarships.length && <Card><EmptyState title="Nothing saved yet" body="Save programs from Find, or track one you found elsewhere with its official link and deadline." /></Card>}
          {saved.map((sc) => <Card key={sc.id} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><div className="font-medium text-ink">{sc.name}</div><div className="text-sm text-muted">{sc.amount} · {sc.cycle}</div></div><ExtLink href={sc.url}>Official site</ExtLink><Button size="sm" variant="ghost" onClick={() => toggleSave(sc.id)}>Unsave</Button></Card>)}
          {s.customScholarships.map((c) => { const d = c.deadline ? daysUntil(c.deadline) : null; return (
            <Card key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2 font-medium text-ink">{c.name}<Badge tone="violet">User added</Badge></div><div className="text-sm text-muted">{c.amount || 'Amount not entered'}{c.deadline ? ` · due ${fmtDate(c.deadline)}${d !== null ? (d < 0 ? ' (passed)' : ` (${d} days)`) : ''}` : ''}{c.notes ? ` · ${c.notes}` : ''}</div></div>
              {c.url && <ExtLink href={c.url}>Website</ExtLink>}
              <Button size="sm" variant="ghost" aria-label={`Delete ${c.name}`} icon={<LuTrash2 />} onClick={() => store.set((st) => { st.customScholarships = st.customScholarships.filter((x) => x.id !== c.id); })} />
            </Card>
          ); })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Track a scholarship" footer={<><Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button><Button variant="primary" onClick={addCustom as never}>Add</Button></>}>
        <form onSubmit={addCustom} className="grid gap-4" noValidate>
          <Field label="Name" htmlFor="cs-name" error={err && !form.name.trim() ? err : null}><Input id="cs-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Amount" htmlFor="cs-amt"><Input id="cs-amt" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="$2,500" /></Field><Field label="Deadline" htmlFor="cs-dl"><Input id="cs-dl" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field></div>
          <Field label="Official website" htmlFor="cs-url" error={err && form.name.trim() ? err : null} hint="Only track scholarships with a verifiable official site."><Input id="cs-url" type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" /></Field>
          <Field label="Notes" htmlFor="cs-notes"><Textarea id="cs-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </form>
      </Modal>
    </>
  );
}
