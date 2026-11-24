import React, { useMemo, useRef, useState } from 'react';
import { LuSearch, LuFilter, LuPlus, LuCheck, LuGitCompare, LuBookmark, LuX, LuMapPin, LuTrash2 } from 'react-icons/lu';
import { navigate } from '../App';
import { Badge, Button, Card, Chips, EmptyState, Field, Input, Modal, NumberInput, PageHeader, Portal, Select, Toggle, bucketTone, cx, useToast } from '../components/ui';
import { COLLEGES, MAJORS, type College } from '../data/colleges';
import { store, uid, useStore } from '../lib/store';
import { assess } from '../lib/analysis';
import { distanceFromHome } from '../lib/geo';
import { STATES } from '../lib/geo';
import { pct, range, usd } from '../lib/format';

export interface Filters {
  q: string; states: string[]; countries: string[]; kinds: string[]; settings: string[]; major: string; tests: string[];
  admitMin: number | null; admitMax: number | null; satFits: boolean; actFits: boolean; satMax: number | null; gpaMin: number | null;
  tuitionMax: number | null; costMax: number | null; netMax: number | null; debtMax: number | null; gradMin: number | null; retentionMin: number | null;
  sizeMin: number | null; sizeMax: number | null; distMax: number | null; earnMin: number | null; sfrMax: number | null;
  research: boolean; coop: boolean; housing: boolean; merit: boolean; fullNeed: boolean;
  sort: string;
}
export const EMPTY_FILTERS: Filters = { q: '', states: [], countries: [], kinds: [], settings: [], major: '', tests: [], admitMin: null, admitMax: null, satFits: false, actFits: false, satMax: null, gpaMin: null, tuitionMax: null, costMax: null, netMax: null, debtMax: null, gradMin: null, retentionMin: null, sizeMin: null, sizeMax: null, distMax: null, earnMin: null, sfrMax: null, research: false, coop: false, housing: false, merit: false, fullNeed: false, sort: 'name' };

const SORTS = [
  { value: 'name', label: 'Name (A–Z)' }, { value: 'admit-asc', label: 'Most selective' }, { value: 'admit-desc', label: 'Least selective' },
  { value: 'net-asc', label: 'Lowest avg net price' }, { value: 'cost-asc', label: 'Lowest sticker cost' }, { value: 'grad-desc', label: 'Highest graduation rate' },
  { value: 'earn-desc', label: 'Highest median earnings' }, { value: 'size-asc', label: 'Smallest' }, { value: 'size-desc', label: 'Largest' }, { value: 'dist-asc', label: 'Closest to home' },
];

function cost(c: College, home: string) { return c.kind === 'Public' || c.kind === 'Community college' ? (home === c.state ? c.coaIn : c.coaOut) : c.coaIn; }
function tuition(c: College, home: string) { return c.kind === 'Public' || c.kind === 'Community college' ? (home === c.state ? c.tuitionIn : c.tuitionOut) : c.tuitionIn; }

export function applyFilters(f: Filters, home: string, sat: number | null, act: number | null) {
  const q = f.q.trim().toLowerCase();
  const pass = (v: number | null, test: (x: number) => boolean) => v !== null && test(v);
  let out = COLLEGES.filter((c) => {
    if (q && !(`${c.name} ${c.short} ${c.city} ${c.state} ${c.country}`.toLowerCase().includes(q))) return false;
    if (f.states.length && !f.states.includes(c.state)) return false;
    if (f.countries.length && !f.countries.includes(c.country)) return false;
    if (f.kinds.length && !f.kinds.includes(c.kind)) return false;
    if (f.settings.length && !f.settings.includes(c.setting)) return false;
    if (f.major && !c.majors.includes(f.major)) return false;
    if (f.tests.length && !f.tests.includes(c.tests)) return false;
    if (f.admitMin !== null && !pass(c.admit, (a) => a * 100 >= f.admitMin!)) return false;
    if (f.admitMax !== null && !pass(c.admit, (a) => a * 100 <= f.admitMax!)) return false;
    if (f.satFits && sat !== null && !(c.sat && sat >= c.sat[0])) return false;
    if (f.actFits && act !== null && !(c.act && act >= c.act[0])) return false;
    if (f.satMax !== null && !(c.sat && c.sat[0] <= f.satMax)) return false;
    if (f.gpaMin !== null && !pass(c.gpaAvg, (g) => g >= f.gpaMin!)) return false;
    if (f.tuitionMax !== null && !pass(tuition(c, home), (t) => t <= f.tuitionMax!)) return false;
    if (f.costMax !== null && !pass(cost(c, home), (t) => t <= f.costMax!)) return false;
    if (f.netMax !== null && !pass(c.netPrice, (t) => t <= f.netMax!)) return false;
    if (f.debtMax !== null && !pass(c.debt, (t) => t <= f.debtMax!)) return false;
    if (f.gradMin !== null && !pass(c.grad, (g) => g * 100 >= f.gradMin!)) return false;
    if (f.retentionMin !== null && !pass(c.retention, (g) => g * 100 >= f.retentionMin!)) return false;
    if (f.sizeMin !== null && !pass(c.undergrad, (n) => n >= f.sizeMin!)) return false;
    if (f.sizeMax !== null && !pass(c.undergrad, (n) => n <= f.sizeMax!)) return false;
    if (f.distMax !== null && !pass(distanceFromHome(home, c), (d) => d <= f.distMax!)) return false;
    if (f.earnMin !== null && !pass(c.earnings, (e) => e >= f.earnMin!)) return false;
    if (f.sfrMax !== null && !pass(c.sfr, (r) => r <= f.sfrMax!)) return false;
    if (f.research && !c.features.some((x) => /research|urop|urap/i.test(x))) return false;
    if (f.coop && !c.features.some((x) => /co-op|internship/i.test(x))) return false;
    if (f.housing && c.housingMeals === null) return false;
    if (f.merit && !c.features.some((x) => /merit/i.test(x))) return false;
    if (f.fullNeed && !c.features.some((x) => /full need/i.test(x))) return false;
    return true;
  });
  const nz = (v: number | null, dflt: number) => (v === null ? dflt : v);
  const sorters: Record<string, (a: College, b: College) => number> = {
    name: (a, b) => a.name.localeCompare(b.name), 'admit-asc': (a, b) => nz(a.admit, 9) - nz(b.admit, 9), 'admit-desc': (a, b) => nz(b.admit, -1) - nz(a.admit, -1),
    'net-asc': (a, b) => nz(a.netPrice, 1e9) - nz(b.netPrice, 1e9), 'cost-asc': (a, b) => nz(cost(a, home), 1e9) - nz(cost(b, home), 1e9), 'grad-desc': (a, b) => nz(b.grad, -1) - nz(a.grad, -1),
    'earn-desc': (a, b) => nz(b.earnings, -1) - nz(a.earnings, -1), 'size-asc': (a, b) => nz(a.undergrad, 1e9) - nz(b.undergrad, 1e9), 'size-desc': (a, b) => nz(b.undergrad, -1) - nz(a.undergrad, -1),
    'dist-asc': (a, b) => nz(distanceFromHome(home, a), 1e9) - nz(distanceFromHome(home, b), 1e9),
  };
  out = out.sort(sorters[f.sort] || sorters.name);
  return out;
}

// Turns spoken/typed searches like "engineering schools in California" into filters.
function smartQuery(q: string): Partial<Filters> {
  const out: Partial<Filters> = {}; let rest = q.toLowerCase();
  const major = MAJORS.find((m) => rest.includes(m.toLowerCase()) || (m === 'Computer Science' && /\bcs\b|computer/.test(rest)));
  if (major) { out.major = major; rest = rest.replace(major.toLowerCase(), ''); }
  const st = Object.entries(STATES).find(([, v]) => rest.includes(v.name.toLowerCase()));
  if (st) { out.states = [st[0]]; rest = rest.replace(st[1].name.toLowerCase(), ''); }
  if (/liberal arts/.test(rest)) out.kinds = ['Liberal arts']; else if (/\bpublic\b/.test(rest)) out.kinds = ['Public']; else if (/\bprivate\b/.test(rest)) out.kinds = ['Private']; else if (/community college/.test(rest)) out.kinds = ['Community college'];
  if (/test.?optional/.test(rest)) out.tests = ['Optional'];
  if (/cheap|affordable|low cost/.test(rest)) out.sort = 'net-asc';
  const leftover = rest.replace(/\b(schools?|colleges?|universit(y|ies)|in|for|with|good|best|the|and|liberal arts|public|private|community|test.?optional|cheap|affordable|low cost)\b/g, '').trim();
  if (leftover && !major && !st) out.q = q;
  return out;
}

function activeCount(f: Filters) { return Object.entries(f).filter(([k, v]) => k !== 'q' && k !== 'sort' && (Array.isArray(v) ? v.length : typeof v === 'boolean' ? v : v !== null && v !== '')).length; }

function FilterPanel({ f, set, home, sat, act }: { f: Filters; set: (p: Partial<Filters>) => void; home: string; sat: number | null; act: number | null }) {
  const usStates = Array.from(new Set(COLLEGES.filter((c) => c.country === 'USA').map((c) => c.state))).sort();
  return (
    <div className="space-y-5">
      <Field label="Major / program"><Select aria-label="Major" value={f.major} onChange={(e) => set({ major: e.target.value })} options={[{ value: '', label: 'Any major' }, ...MAJORS]} /></Field>
      <Field label="Type"><Chips options={['Public', 'Private', 'Liberal arts', 'Community college', 'International']} value={f.kinds} onChange={(v) => set({ kinds: v })} /></Field>
      <Field label="Setting"><Chips options={['Urban', 'Suburban', 'Small city', 'Rural']} value={f.settings} onChange={(v) => set({ settings: v })} /></Field>
      <Field label="Country"><Chips options={['USA', 'Canada', 'United Kingdom']} value={f.countries} onChange={(v) => set({ countries: v })} /></Field>
      <Field label="State"><Chips options={usStates} value={f.states} onChange={(v) => set({ states: v })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Admit rate min %"><NumberInput value={f.admitMin} onChange={(v) => set({ admitMin: v })} placeholder="0" /></Field>
        <Field label="Admit rate max %"><NumberInput value={f.admitMax} onChange={(v) => set({ admitMax: v })} placeholder="100" /></Field>
        <Field label="SAT 25th pct ≤"><NumberInput value={f.satMax} onChange={(v) => set({ satMax: v })} placeholder="1600" /></Field>
        <Field label="Avg HS GPA ≥" hint="Where published"><NumberInput value={f.gpaMin} onChange={(v) => set({ gpaMin: v })} /></Field>
        <Field label="Tuition ≤ $"><NumberInput value={f.tuitionMax} onChange={(v) => set({ tuitionMax: v })} /></Field>
        <Field label="Total cost ≤ $"><NumberInput value={f.costMax} onChange={(v) => set({ costMax: v })} /></Field>
        <Field label="Avg net price ≤ $"><NumberInput value={f.netMax} onChange={(v) => set({ netMax: v })} /></Field>
        <Field label="Median debt ≤ $"><NumberInput value={f.debtMax} onChange={(v) => set({ debtMax: v })} /></Field>
        <Field label="Grad rate ≥ %"><NumberInput value={f.gradMin} onChange={(v) => set({ gradMin: v })} /></Field>
        <Field label="Retention ≥ %"><NumberInput value={f.retentionMin} onChange={(v) => set({ retentionMin: v })} /></Field>
        <Field label="Undergrads ≥"><NumberInput value={f.sizeMin} onChange={(v) => set({ sizeMin: v })} /></Field>
        <Field label="Undergrads ≤"><NumberInput value={f.sizeMax} onChange={(v) => set({ sizeMax: v })} /></Field>
        <Field label="Distance ≤ mi" hint={home ? `From ${STATES[home]?.name || home}` : 'Set home state'}><NumberInput value={f.distMax} onChange={(v) => set({ distMax: v })} /></Field>
        <Field label="Median earnings ≥ $"><NumberInput value={f.earnMin} onChange={(v) => set({ earnMin: v })} /></Field>
        <Field label="Student:faculty ≤"><NumberInput value={f.sfrMax} onChange={(v) => set({ sfrMax: v })} /></Field>
      </div>
      <Field label="Testing policy"><Chips options={['Required', 'Optional', 'Test-free', 'Varies by program']} value={f.tests} onChange={(v) => set({ tests: v })} /></Field>
      <div className="space-y-1">
        {sat !== null && <Toggle label="My SAT is at/above the 25th percentile" checked={f.satFits} onChange={(v) => set({ satFits: v })} />}
        {act !== null && <Toggle label="My ACT is at/above the 25th percentile" checked={f.actFits} onChange={(v) => set({ actFits: v })} />}
        <Toggle label="Undergraduate research program" checked={f.research} onChange={(v) => set({ research: v })} />
        <Toggle label="Co-op / internship program" checked={f.coop} onChange={(v) => set({ coop: v })} />
        <Toggle label="On-campus housing cost listed" checked={f.housing} onChange={(v) => set({ housing: v })} />
        <Toggle label="Merit scholarships" checked={f.merit} onChange={(v) => set({ merit: v })} />
        <Toggle label="Meets full demonstrated need" checked={f.fullNeed} onChange={(v) => set({ fullNeed: v })} />
      </div>
      <p className="text-xs text-muted">Filters on numeric data exclude schools where the value is unavailable.</p>
    </div>
  );
}

export function CollegeCard({ c, compact }: { c: College; compact?: boolean }) {
  const s = useStore((x) => x);
  const toast = useToast();
  const inList = s.list.some((l) => l.collegeId === c.id);
  const inCompare = s.compare.includes(c.id);
  const a = useMemo(() => assess(c, s), [c, s]);
  const d = s.profile.state ? distanceFromHome(s.profile.state, c) : null;
  return (
    <Card hover className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <a href={`#college-${c.id}`} className="min-w-0 group">
          <h3 className="font-semibold leading-snug text-ink group-hover:text-accent">{c.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted"><LuMapPin className="shrink-0" />{c.city}, {c.state}{c.country !== 'USA' ? ` · ${c.country}` : ''}{d !== null && c.country === 'USA' ? ` · ~${d.toLocaleString()} mi` : ''}</p>
        </a>
        <Badge tone={bucketTone(a.bucket)} title="AdmitIQ estimate, not a guarantee">{a.bucket}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5"><Badge>{c.kind}</Badge><Badge>{c.setting}</Badge><Badge>{c.tests === 'Test-free' ? 'Test-free' : `Tests ${c.tests.toLowerCase()}`}</Badge></div>
      {!compact && (
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-xs text-muted">Admit rate</dt><dd className="font-semibold tabular-nums text-ink">{c.kind === 'Community college' ? 'Open' : pct(c.admit)}</dd></div>
          <div><dt className="text-xs text-muted">SAT mid-50%</dt><dd className="font-semibold tabular-nums text-ink">{range(c.sat)}</dd></div>
          <div><dt className="text-xs text-muted">Avg net price</dt><dd className="font-semibold tabular-nums text-ink">{usd(c.netPrice)}</dd></div>
        </dl>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button size="sm" variant={inList ? 'soft' : 'primary'} icon={inList ? <LuCheck /> : <LuPlus />} onClick={() => {
          store.set((st) => { if (inList) st.list = st.list.filter((l) => l.collegeId !== c.id); else st.list.push({ collegeId: c.id, category: a.bucket, favorite: false, notes: '', addedAt: new Date().toISOString() }); });
          toast(inList ? `Removed ${c.short} from your list` : `Added ${c.short} as ${a.bucket}`);
        }}>{inList ? 'On my list' : 'Add to list'}</Button>
        <Button size="sm" variant={inCompare ? 'soft' : 'secondary'} icon={<LuGitCompare />} onClick={() => {
          if (!inCompare && s.compare.length >= 10) return toast('You can compare up to 10 colleges', 'error');
          store.set((st) => { st.compare = inCompare ? st.compare.filter((x) => x !== c.id) : [...st.compare, c.id]; });
        }}>{inCompare ? 'Comparing' : 'Compare'}</Button>
      </div>
    </Card>
  );
}

export default function Colleges() {
  const s = useStore((x) => x);
  const toast = useToast();
  const [f, setF] = useState<Filters>(() => { try { const q = sessionStorage.getItem('admitiq:searchQ'); if (q) { sessionStorage.removeItem('admitiq:searchQ'); return { ...EMPTY_FILTERS, ...smartQuery(q) }; } } catch { /* ignore */ } return EMPTY_FILTERS; });
  const [sheet, setSheet] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [ac, setAc] = useState(-1);
  const [focus, setFocus] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Filters>) => setF((x) => ({ ...x, ...p }));
  const results = useMemo(() => applyFilters(f, s.profile.state, s.profile.sat.total, s.profile.act.composite), [f, s.profile.state, s.profile.sat.total, s.profile.act.composite]);
  const suggestions = f.q.trim().length ? COLLEGES.filter((c) => `${c.name} ${c.short}`.toLowerCase().includes(f.q.trim().toLowerCase())).slice(0, 6) : [];
  const n = activeCount(f);
  return (
    <>
      <PageHeader title="College search" desc={`${COLLEGES.length} institutions — public, private, liberal arts, community colleges and international universities. Every figure links to its source.`} />
      <div className="sticky top-14 z-30 -mx-4 mb-5 bg-canvas/85 px-4 py-3 backdrop-blur lg:top-0 lg:mx-0 lg:px-0">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <LuSearch className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
            <Input ref={inputRef} aria-label="Search colleges" role="combobox" aria-expanded={focus && suggestions.length > 0} aria-controls="ac-list" aria-autocomplete="list" placeholder="Search by name, city or state" className="pl-10" value={f.q}
              onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
              onChange={(e) => { set({ q: e.target.value }); setAc(-1); }}
              onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setAc((i) => Math.min(suggestions.length - 1, i + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setAc((i) => Math.max(-1, i - 1)); } else if (e.key === 'Enter' && ac >= 0) { navigate(`college-${suggestions[ac].id}`); } else if (e.key === 'Escape') setFocus(false); }} />
            {focus && suggestions.length > 0 && (
              <ul id="ac-list" role="listbox" className="pop-in absolute inset-x-0 top-12 z-40 overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
                {suggestions.map((c, i) => <li key={c.id} role="option" aria-selected={ac === i}><a href={`#college-${c.id}`} className={cx('flex items-center justify-between gap-2 px-4 py-2.5 text-sm', ac === i ? 'bg-raised' : 'hover:bg-raised')}><span className="truncate text-ink">{c.name}</span><span className="shrink-0 text-xs text-muted">{c.city}, {c.state}</span></a></li>)}
              </ul>
            )}
          </div>
          <Select aria-label="Sort" value={f.sort} onChange={(e) => set({ sort: e.target.value })} options={SORTS} className="w-auto min-w-[170px]" />
          <Button className="lg:hidden" icon={<LuFilter />} onClick={() => setSheet(true)}>Filters{n ? ` (${n})` : ''}</Button>
          <Button icon={<LuBookmark />} onClick={() => setSaveOpen(true)}>Save search</Button>
        </div>
        {s.savedSearches.length > 0 && (
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {s.savedSearches.map((ss) => (
              <span key={ss.id} className="flex shrink-0 items-center rounded-full border border-line bg-surface text-sm">
                <button className="h-8 pl-3 pr-1 text-ink" onClick={() => { setF({ ...EMPTY_FILTERS, ...(ss.filters as Partial<Filters>) }); toast(`Applied "${ss.name}"`, 'info'); }}>{ss.name}</button>
                <button aria-label={`Delete saved search ${ss.name}`} className="grid h-8 w-8 place-items-center text-muted hover:text-rose-600" onClick={() => store.set((st) => { st.savedSearches = st.savedSearches.filter((x) => x.id !== ss.id); })}><LuX /></button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <Card className="sticky top-24 max-h-[calc(100dvh-120px)] overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-ink">Filters{n ? ` · ${n}` : ''}</h2>{n > 0 && <button className="text-sm text-accent hover:underline" onClick={() => setF({ ...EMPTY_FILTERS, q: f.q, sort: f.sort })}>Reset</button>}</div>
            <FilterPanel f={f} set={set} home={s.profile.state} sat={s.profile.sat.total} act={s.profile.act.composite} />
          </Card>
        </aside>
        <div>
          <p className="mb-3 text-sm text-muted" aria-live="polite">{results.length} result{results.length === 1 ? '' : 's'}</p>
          {results.length ? (
            <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{results.map((c) => <CollegeCard key={c.id} c={c} />)}</div>
          ) : <Card><EmptyState icon={<LuSearch />} title="No colleges match" body="Try removing a filter. Numeric filters hide schools whose data is unavailable." action={<Button onClick={() => setF(EMPTY_FILTERS)}>Clear all filters</Button>} /></Card>}
        </div>
      </div>
      {s.compare.length > 0 && (
        <Portal><div className="fade-up glass fixed left-3 right-20 bottom-[calc(80px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-line px-4 py-3 shadow-lift lg:bottom-6 lg:left-[calc(264px+1.5rem)] lg:right-24">
          <LuGitCompare className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{s.compare.length} selected: {s.compare.map((id) => COLLEGES.find((c) => c.id === id)?.short).join(', ')}</span>
          <Button size="sm" variant="ghost" onClick={() => store.set((st) => { st.compare = []; })}>Clear</Button>
          <Button size="sm" variant="primary" disabled={s.compare.length < 2} onClick={() => navigate('compare')}>Compare{s.compare.length < 2 ? ' (2+)' : ''}</Button>
        </div></Portal>
      )}
      <Modal open={sheet} onClose={() => setSheet(false)} title={`Filters${n ? ` · ${n}` : ''}`} footer={<><Button variant="ghost" onClick={() => setF({ ...EMPTY_FILTERS, q: f.q, sort: f.sort })}>Reset</Button><Button variant="primary" onClick={() => setSheet(false)}>Show {results.length} results</Button></>}>
        <FilterPanel f={f} set={set} home={s.profile.state} sat={s.profile.sat.total} act={s.profile.act.composite} />
      </Modal>
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Save this search" footer={<><Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button><Button variant="primary" disabled={!saveName.trim()} onClick={() => { store.set((st) => { st.savedSearches.push({ id: uid(), name: saveName.trim().slice(0, 40), filters: f as unknown as Record<string, unknown> }); }); setSaveOpen(false); setSaveName(''); toast('Search saved'); }}>Save</Button></>}>
        <Field label="Name" htmlFor="ss-name" hint={`${n} filter${n === 1 ? '' : 's'}${f.q ? ` + "${f.q}"` : ''} · ${results.length} results`}><Input id="ss-name" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. Affordable CS schools" maxLength={40} /></Field>
      </Modal>
    </>
  );
}
