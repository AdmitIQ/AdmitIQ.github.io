import React, { useMemo, useState } from 'react';
import { LuStar, LuTrash2, LuPlus, LuSparkles, LuDownload, LuCopy, LuGitCompare, LuX, LuCalendarDays } from 'react-icons/lu';
import { navigate } from '../App';
import { Badge, Button, Card, EmptyState, Input, Modal, Notice, PageHeader, Select, Textarea, bucketTone, copyText, cx, downloadFile, statusTone, useConfirm, useToast } from '../components/ui';
import { Donut } from '../components/charts';
import { COLLEGES } from '../data/colleges';
import { store, useStore } from '../lib/store';
import { assess, recommendList } from '../lib/analysis';
import { byId, cycleDate, fmtDate, pct, toCSV, usd } from '../lib/format';
import { Pennant } from '../components/art';

const BASE = ['Reach', 'Target', 'Likely'];

export default function CollegeList() {
  const s = useStore((x) => x);
  const toast = useToast();
  const confirm = useConfirm();
  const [recOpen, setRecOpen] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [filter, setFilter] = useState<'all' | 'fav'>('all');
  const cats = [...BASE, ...s.customCategories];
  const items = s.list.filter((l) => filter === 'all' || l.favorite);
  const recs = useMemo(() => (recOpen ? recommendList(COLLEGES, s, 5) : null), [recOpen, s]);
  const counts = Object.fromEntries(cats.map((c) => [c, s.list.filter((l) => l.category === c).length]));
  const avgNet = (() => { const v = s.list.map((l) => byId(l.collegeId)?.netPrice).filter((x): x is number => typeof x === 'number'); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; })();

  function exportList(kind: 'csv' | 'copy') {
    const rows = [['College', 'Category', 'Favorite', 'AdmitIQ estimate', 'Admit rate', 'Avg net price', 'Status', 'Deadline', 'Notes'], ...s.list.map((l) => { const c = byId(l.collegeId)!; const a = s.apps.find((x) => x.collegeId === l.collegeId); return [c.name, l.category, l.favorite ? 'Yes' : '', assess(c, s).bucket, pct(c.admit), usd(c.netPrice), a?.status || '', a?.deadline || '', l.notes]; })];
    const csv = toCSV(rows);
    if (kind === 'csv' && downloadFile('admitiq-college-list.csv', csv, 'text/csv')) toast('List exported');
    else copyText(csv).then((ok) => toast(ok ? 'List copied as CSV' : 'Copy failed', 'info'));
  }

  return (
    <>
      <PageHeader title="My college list" desc="Reach, Target and Likely are estimates to help balance your list — not guarantees. You decide each school's category."
        actions={<><Button icon={<LuSparkles />} variant="primary" onClick={() => setRecOpen(true)}>Suggest colleges</Button><Button icon={<LuGitCompare />} disabled={s.list.length < 2} onClick={() => { store.set((st) => { st.compare = st.list.slice(0, 10).map((l) => l.collegeId); }); navigate('compare'); }}>Compare list</Button><Button icon={<LuDownload />} disabled={!s.list.length} onClick={() => exportList('csv')}>Export</Button><Button icon={<LuCopy />} variant="ghost" disabled={!s.list.length} onClick={() => exportList('copy')}>Copy</Button></>} />

      {!s.list.length ? (
        <Card><EmptyState title="Your list is empty" body="Get personalized suggestions based on your profile, or search for colleges and add them." action={<div className="flex flex-wrap justify-center gap-2"><Button variant="primary" icon={<LuSparkles />} onClick={() => setRecOpen(true)}>Suggest colleges</Button><Button onClick={() => navigate('colleges')}>Search colleges</Button></div>} /></Card>
      ) : (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Card className="p-5"><Donut parts={cats.map((c, i) => ({ label: c, value: counts[c] || 0, color: i < 3 ? ['var(--c2)', 'var(--c1)', 'var(--c3)'][i] : `var(--c${4 + i})` })).filter((p) => p.value || BASE.includes(p.label))} center={<div><div className="text-2xl font-semibold tabular-nums text-ink">{s.list.length}</div><div className="text-[11px] text-muted">colleges</div></div>} /></Card>
            <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              <div><div className="text-sm text-muted">Favorites</div><div className="text-2xl font-semibold tabular-nums text-ink">{s.list.filter((l) => l.favorite).length}</div></div>
              <div><div className="text-sm text-muted">In tracker</div><div className="text-2xl font-semibold tabular-nums text-ink">{s.list.filter((l) => s.apps.some((a) => a.collegeId === l.collegeId)).length}</div></div>
              <div><div className="text-sm text-muted">Avg net price</div><div className="text-2xl font-semibold tabular-nums text-ink">{avgNet ? `$${Math.round(avgNet / 1000)}k` : '—'}</div></div>
              <div><div className="text-sm text-muted">Estimate mismatches</div><div className="text-2xl font-semibold tabular-nums text-ink">{s.list.filter((l) => BASE.includes(l.category) && assess(byId(l.collegeId)!, s).bucket !== l.category).length}</div></div>
              {!counts.Likely && <Notice tone="warn" className="col-span-full">No Likely schools. Most counselors recommend at least two you'd be happy to attend and can afford.</Notice>}
            </Card>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button size="sm" variant={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')}>All</Button>
            <Button size="sm" variant={filter === 'fav' ? 'primary' : 'secondary'} icon={<LuStar />} onClick={() => setFilter('fav')}>Favorites</Button>
            <form className="ml-auto flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = newCat.trim(); if (!n || cats.includes(n)) return; store.set((st) => { st.customCategories.push(n.slice(0, 24)); }); setNewCat(''); }}>
              <Input aria-label="New category name" placeholder="New category (e.g. Dream)" value={newCat} onChange={(e) => setNewCat(e.target.value)} className="h-9 w-48 text-sm" />
              <Button size="sm" type="submit" icon={<LuPlus />} disabled={!newCat.trim()}>Category</Button>
            </form>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {cats.map((cat) => {
              const its = items.filter((l) => l.category === cat);
              return (
                <section key={cat} aria-label={cat} className="rounded-2xl bg-raised/50 p-3">
                  <header className="mb-2 flex items-center justify-between px-2 py-1"><h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Badge tone={bucketTone(cat)}>{cat}</Badge><span className="tabular-nums text-muted">{its.length}</span></h2>
                    {!BASE.includes(cat) && <button aria-label={`Delete category ${cat}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-rose-600" onClick={async () => { if (await confirm({ title: `Delete "${cat}"?`, body: 'Colleges in it will move to Target.', action: 'Delete' })) store.set((st) => { st.customCategories = st.customCategories.filter((x) => x !== cat); st.list.forEach((l) => { if (l.category === cat) l.category = 'Target'; }); }); }}><LuX /></button>}
                  </header>
                  <ul className="space-y-2.5">
                    {its.map((l) => {
                      const c = byId(l.collegeId)!; const a = assess(c, s); const app = s.apps.find((x) => x.collegeId === c.id);
                      const deadline = app?.deadline || (c.deadlines.RD ? cycleDate(c.deadlines.RD, s.profile.gradYear) : '');
                      return (
                        <li key={l.collegeId}>
                          <Card hover className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <a href={`#college-${c.id}`} className="flex min-w-0 items-center gap-2 font-semibold leading-snug text-ink hover:text-accent"><Pennant id={c.id} name={c.name} size={22} className="shrink-0" />{c.short}</a>
                              <div className="flex shrink-0">
                                <button aria-label={l.favorite ? 'Unfavorite' : 'Favorite'} aria-pressed={l.favorite} onClick={() => store.set((st) => { const x = st.list.find((y) => y.collegeId === c.id); if (x) x.favorite = !x.favorite; })} className={cx('grid h-8 w-8 place-items-center rounded-lg hover:bg-raised', l.favorite ? 'text-amber-500' : 'text-muted')}><LuStar className={l.favorite ? 'fill-current' : ''} /></button>
                                <button aria-label={`Remove ${c.short}`} onClick={async () => { if (await confirm({ title: `Remove ${c.short}?`, body: 'Notes for this college will be deleted. Tracker entries are kept.', action: 'Remove', danger: true })) store.set((st) => { st.list = st.list.filter((y) => y.collegeId !== c.id); }); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-rose-600"><LuTrash2 /></button>
                              </div>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                              <span>{pct(c.admit)} admit</span><span>·</span><span>{usd(c.netPrice)} avg net</span>
                              {BASE.includes(l.category) && a.bucket !== l.category && <Badge tone="amber" title="AdmitIQ's estimate differs from your category">Est. {a.bucket}</Badge>}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Select aria-label={`Category for ${c.short}`} value={l.category} onChange={(e) => store.set((st) => { const x = st.list.find((y) => y.collegeId === c.id); if (x) x.category = e.target.value; })} options={cats} className="h-9 w-auto text-sm" />
                              {app ? <Badge tone={statusTone(app.status)}>{app.status}</Badge> : <Button size="sm" variant="ghost" icon={<LuCalendarDays />} onClick={() => navigate(`college-${c.id}`)}>Track</Button>}
                              {deadline && <span className="text-xs text-muted tabular-nums">Due {fmtDate(deadline)}</span>}
                            </div>
                            <Textarea aria-label={`Notes for ${c.short}`} rows={1} value={l.notes} onChange={(e) => store.set((st) => { const x = st.list.find((y) => y.collegeId === c.id); if (x) x.notes = e.target.value; })} placeholder="Add a note…" className="mt-3 min-h-10 py-2 text-sm" />
                          </Card>
                        </li>
                      );
                    })}
                    {!its.length && <li className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">No colleges here</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}

      <Modal open={recOpen} onClose={() => setRecOpen(false)} title="Suggested colleges" wide footer={<Button variant="primary" onClick={() => setRecOpen(false)}>Done</Button>}>
        <Notice className="mb-4">Suggestions combine your academics vs. published ranges, major availability, location, size, setting, budget and research/internship preferences. Categories are estimates, not guarantees. <a href="#profile-personal" onClick={() => setRecOpen(false)} className="font-medium text-accent hover:underline">Refine preferences</a></Notice>
        {recs && (['Reach', 'Target', 'Likely'] as const).map((b) => (
          <div key={b} className="mb-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><Badge tone={bucketTone(b)}>{b}</Badge>{recs[b].length ? '' : <span className="font-normal text-muted">No strong matches — try loosening preferences.</span>}</h3>
            <ul className="space-y-2">
              {recs[b].map((f) => {
                const on = s.list.some((l) => l.collegeId === f.college.id);
                return (
                  <li key={f.college.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
                    <div className="min-w-0 flex-1"><a href={`#college-${f.college.id}`} onClick={() => setRecOpen(false)} className="font-medium text-ink hover:text-accent">{f.college.name}</a><p className="text-xs text-muted">Fit {f.score}/100{f.reasons.length ? ` · ${f.reasons.slice(0, 4).join(' · ')}` : ''}{f.concerns.length ? ` · ⚠ ${f.concerns.join(', ')}` : ''}</p></div>
                    <Button size="sm" variant={on ? 'soft' : 'primary'} disabled={on} onClick={() => { store.set((st) => { st.list.push({ collegeId: f.college.id, category: b, favorite: false, notes: '', addedAt: new Date().toISOString() }); }); toast(`Added ${f.college.short}`); }}>{on ? 'Added' : 'Add'}</Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Modal>
    </>
  );
}
