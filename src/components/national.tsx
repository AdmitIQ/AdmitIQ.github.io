import React, { useEffect, useRef, useState } from 'react';
import { LuGlobe, LuPlus, LuCheck, LuLoaderCircle, LuSearch, LuMessagesSquare, LuExternalLink } from 'react-icons/lu';
import { navigate, useCaps } from '../App';
import { Badge, Button, Card, CardHeader, ExtLink, Input, Notice, Select, Skeleton, cx, useDebounced, useToast } from './ui';
import { Pennant } from './art';
import { directory, type DirCollege, type HighSchool, type WebReviews } from '../lib/services';
import { toCollege } from '../lib/directory';
import { registerColleges } from '../data/colleges';
import { store, useStore } from '../lib/store';
import { STATES } from '../lib/geo';

/** Search all ~6,000 degree-granting U.S. colleges (IPEDS) and add any of them to AdmitIQ. */
export function NationalCollegeSearch() {
  const { caps } = useCaps();
  const s = useStore((x) => x);
  const toast = useToast();
  const [q, setQ] = useState('');
  const [st, setSt] = useState('');
  const dq = useDebounced(q, 300);
  const [res, setRes] = useState<{ rows: DirCollege[]; total: number; year: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  useEffect(() => {
    if (!caps?.directory || (dq.trim().length < 2 && !st)) { setRes(null); return; }
    let live = true; setLoading(true); setErr('');
    directory.searchColleges(dq, st).then((r) => { if (live) setRes({ rows: r.results, total: r.total, year: r.year }); }).catch((e) => live && setErr(e.message)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [dq, st, caps]);
  if (!caps?.directory) return null;
  async function add(d: DirCollege) {
    setAdding(d.unitid);
    try {
      const det = await directory.collegeDetail(d.unitid);
      const c = toCollege(det.directory || d, det.stats, det.retrieved);
      registerColleges([c]);
      store.set((x) => { if (!x.customColleges.some((y) => y.id === c.id)) x.customColleges.push(c); if (!x.list.some((l) => l.collegeId === c.id)) x.list.push({ collegeId: c.id, category: 'Target', favorite: false, notes: '', addedAt: new Date().toISOString() }); });
      toast(`Added ${d.name}${det.stats ? ' with official statistics' : ''}`);
      navigate(`college-${c.id}`);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setAdding(null); }
  }
  const have = new Set(s.customColleges.map((c) => c.scorecardId));
  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader title={<span className="flex items-center gap-2"><LuGlobe />Every U.S. college</span>} desc={`Search the federal directory of degree-granting colleges${res ? ` (${res.total.toLocaleString()} institutions, ${res.year} data)` : ''} and add any school to your list.${caps.directory.stats ? ' Official statistics load from College Scorecard.' : ''}`} />
      <div className="grid gap-2 p-5 pb-3 sm:grid-cols-[1fr_220px]">
        <div className="relative"><LuSearch className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" /><Input aria-label="Search all U.S. colleges" className="pl-10" placeholder="Any college, e.g. 'Spelman' or 'Cal Poly'" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="State" value={st} onChange={(e) => setSt(e.target.value)} options={[{ value: '', label: 'All states' }, ...Object.entries(STATES).map(([k, v]) => ({ value: k, label: v.name }))]} />
      </div>
      {err && <Notice tone="warn" className="mx-5 mb-4">{err}</Notice>}
      {loading && !res && <div className="space-y-2 px-5 pb-5"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>}
      {res && (
        <ul className="max-h-[420px] divide-y divide-line overflow-y-auto border-t border-line">
          {res.rows.length ? res.rows.map((d) => (
            <li key={d.unitid} className="flex items-center gap-3 px-5 py-2.5">
              <Pennant id={`ipeds-${d.unitid}`} name={d.name} size={22} className="shrink-0" />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium text-ink">{d.name}</span><span className="text-xs text-muted">{d.city}, {d.state} · {d.control}{d.level ? ` · ${d.level}` : ''}</span></span>
              {have.has(d.unitid) ? <Button size="sm" variant="soft" icon={<LuCheck />} onClick={() => navigate(`college-ipeds-${d.unitid}`)}>Added</Button>
                : <Button size="sm" icon={adding === d.unitid ? <LuLoaderCircle className="animate-spin" /> : <LuPlus />} disabled={!!adding} onClick={() => add(d)}>Add</Button>}
            </li>
          )) : <li className="px-5 py-6 text-sm text-muted">No colleges match. Try fewer words.</li>}
        </ul>
      )}
      <p className="border-t border-line px-5 py-2.5 text-[11.5px] text-muted">Source: NCES IPEDS directory via the Urban Institute Education Data Portal (ODC-By){caps.directory.stats ? ' · statistics: College Scorecard' : ''}.</p>
    </Card>
  );
}

/** High-school autocomplete from the NCES Common Core of Data (public schools); private schools can be typed freely. */
export function HighSchoolInput({ id, value, state, onPick, onChange }: { id: string; value: string; state: string; onPick: (h: HighSchool) => void; onChange: (v: string) => void }) {
  const { caps } = useCaps();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HighSchool[]>([]);
  const [hint, setHint] = useState('');
  const dv = useDebounced(value, 250);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!caps?.directory || !state || state === 'INTL' || dv.trim().length < 2 || !open) { setRows([]); return; }
    let live = true;
    directory.highSchools(state, dv).then((r) => { if (live) { setRows(r.results); setHint(`${r.total.toLocaleString()} public high schools in ${STATES[state]?.name || state} (${r.year})`); } }).catch(() => live && setRows([]));
    return () => { live = false; };
  }, [dv, state, caps, open]);
  return (
    <div ref={box} className="relative" onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <Input id={id} value={value} autoComplete="off" onFocus={() => setOpen(true)} onChange={(e) => { onChange(e.target.value); setOpen(true); }} maxLength={120} role="combobox" aria-expanded={open && rows.length > 0} />
      {open && rows.length > 0 && (
        <ul role="listbox" className="pop-in absolute inset-x-0 top-12 z-40 max-h-72 overflow-y-auto rounded-lg border-[1.5px] border-ink bg-surface shadow-lift">
          {rows.map((h) => <li key={h.id || h.name} role="option" aria-selected={false}><button type="button" className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-raised" onClick={() => { onPick(h); setOpen(false); }}><span className="truncate text-ink">{h.name}</span><span className="shrink-0 text-xs text-muted">{h.city}{h.charter ? ' · charter' : ''}</span></button></li>)}
          <li className="border-t border-line px-3.5 py-2 text-[11px] text-muted">{hint} · NCES Common Core of Data. Private school? Just type its name.</li>
        </ul>
      )}
    </div>
  );
}

/** "What students say online": cited themes from public reviews and discussions. */
export function WebReviewsCard({ name }: { name: string }) {
  const { caps } = useCaps();
  const [data, setData] = useState<WebReviews | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  if (!caps?.reviews) return (
    <Card className="p-5"><CardHeader flush title={<span className="flex items-center gap-2"><LuMessagesSquare />What students say online</span>} desc="Summaries of public student reviews and discussions, with every source linked." />
      <Notice className="mt-4">This needs the AdmitIQ server with a search API key (Tavily or Brave free tier) — see the README. AdmitIQ never scrapes review sites.</Notice></Card>
  );
  const TONE = { positive: 'green', mixed: 'amber', negative: 'orange' } as const;
  return (
    <Card className="p-5">
      <CardHeader flush title={<span className="flex items-center gap-2"><LuMessagesSquare />What students say online</span>} desc="Themes from public reviews and discussions found by web search. Anecdotes — not verified facts." action={!data && <Button size="sm" variant="primary" disabled={loading} icon={loading ? <LuLoaderCircle className="animate-spin" /> : undefined} onClick={async () => { setLoading(true); setErr(''); try { setData(await directory.reviews(name)); } catch (e) { setErr((e as Error).message); } finally { setLoading(false); } }}>{loading ? 'Reading reviews…' : 'Summarize reviews'}</Button>} />
      {err && <Notice tone="warn" className="mt-4">{err}</Notice>}
      {loading && <div className="mt-4 space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
      {data && (
        <div className="mt-4 space-y-4">
          {data.summary && <p className="text-[15px] leading-relaxed text-ink">{data.summary}</p>}
          {data.themes.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.themes.map((t) => (
                <li key={t.label} className="rounded-md border border-line p-3.5">
                  <div className="flex items-center justify-between gap-2"><b className="text-sm text-ink">{t.label}</b><Badge tone={TONE[t.tone] || 'neutral'}>{t.tone}</Badge></div>
                  <p className="mt-1 text-sm text-muted">{t.summary}</p>
                  <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs">{t.sources.map((i) => data.sources[i - 1] && <a key={i} href={data.sources[i - 1].url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">[{i}] {data.sources[i - 1].domain}</a>)}</p>
                </li>
              ))}
            </ul>
          )}
          <details className={cx('rounded-md border border-line', !data.themes.length && 'open')} open={!data.themes.length}>
            <summary className="cursor-pointer px-3.5 py-2.5 text-sm text-ink">Sources ({data.sources.length})</summary>
            <ol className="space-y-2 px-3.5 pb-3.5 text-sm">{data.sources.map((x, i) => <li key={x.url}><span className="text-muted">[{i + 1}]</span> <ExtLink href={x.url}>{x.title || x.domain}</ExtLink><span className="block text-xs text-muted">{x.domain}</span></li>)}</ol>
          </details>
          <p className="text-xs text-muted">{data.note}{data.retrieved ? ` Retrieved ${data.retrieved}.` : ''} Personal details and usernames are not shown.</p>
        </div>
      )}
      {void LuExternalLink}
    </Card>
  );
}
