import React, { useMemo, useState } from 'react';
import { LuPlus, LuTrash2, LuTriangleAlert, LuTrophy } from 'react-icons/lu';
import { Badge, Button, Card, CardHeader, EmptyState, ExtLink, Field, Notice, NumberInput, Select, Textarea, Toggle, cx, useConfirm } from './ui';
import { ChartCard, StackedBars } from './charts';
import { Term } from './term';
import { COLLEGES } from '../data/colleges';
import { store, uid, useStore } from '../lib/store';
import type { AidOffer } from '../lib/types';
import { DEFAULT_COST, computeCost } from '../lib/cost';
import { usd } from '../lib/format';

const blank = (collegeId: string, coa: number | null): AidOffer => ({ id: uid(), collegeId, coa, grants: 0, scholarships: 0, workStudy: 0, subLoans: 0, unsubLoans: 0, parentLoans: 0, privateLoans: 0, renewable: true, notes: '' });
const payment = (p: number, ratePct: number, years = 10) => { const i = ratePct / 100 / 12, n = years * 12; return p <= 0 ? 0 : i === 0 ? p / n : (p * i) / (1 - (1 + i) ** -n); };

export function evaluate(o: AidOffer, rate: number) {
  const coa = o.coa ?? 0;
  const free = o.grants + o.scholarships;
  const net = Math.max(0, coa - free);
  const studentLoans = o.subLoans + o.unsubLoans;
  const allLoans = studentLoans + o.parentLoans + o.privateLoans;
  const youPay = Math.max(0, net - allLoans - o.workStudy);
  const year2plus = o.renewable ? net : Math.min(coa, net + o.scholarships);
  const fourYear = net + year2plus * 3;
  const debt4 = studentLoans * 4, parentDebt4 = o.parentLoans * 4, privateDebt4 = o.privateLoans * 4;
  const flags: string[] = [];
  if (!o.coa) flags.push('Enter the cost of attendance from the award letter.');
  if (allLoans > 0) flags.push(`${usd(allLoans)}/yr of this "aid" is loans that must be repaid.`);
  if (o.parentLoans > 0) flags.push('Includes a Parent PLUS loan — borrowed by your parent, with higher interest and fees.');
  if (o.privateLoans > 0) flags.push('Includes private loans, which lack federal protections like income-driven repayment.');
  if (!o.renewable && o.scholarships > 0) flags.push(`Scholarships aren't renewable — years 2–4 could cost ${usd(o.scholarships)} more each.`);
  if (o.workStudy > 0) flags.push('Work-study is paid as you work during the year; it doesn\'t reduce the bill up front.');
  if (studentLoans > 5500 * 1.5) flags.push('Federal student loans are capped per year (first-year dependent students: $5,500 in recent years) — double-check this amount.');
  return { coa, free, net, studentLoans, allLoans, youPay, fourYear, debt4, parentDebt4, privateDebt4, monthly: payment(debt4 + privateDebt4, rate), flags };
}

export function OfferComparer() {
  const s = useStore((x) => x);
  const confirm = useConfirm();
  const [rate, setRate] = useState<number | null>(6.5);
  const [pick, setPick] = useState('');
  const admitted = s.apps.filter((a) => a.status === 'Accepted').map((a) => a.collegeId);
  const candidates = Array.from(new Set([...admitted, ...s.list.map((l) => l.collegeId)])).filter((id) => !s.offers.some((o) => o.collegeId === id));
  const set = (id: string, patch: Partial<AidOffer>) => store.set((st) => { const o = st.offers.find((x) => x.id === id); if (o) Object.assign(o, patch); });
  const evals = useMemo(() => s.offers.map((o) => ({ o, e: evaluate(o, rate ?? 0), c: COLLEGES.find((c) => c.id === o.collegeId)! })), [s.offers, rate]);
  const ready = evals.filter((x) => x.o.coa);
  const best = (k: 'net' | 'fourYear' | 'debt4') => (ready.length > 1 ? Math.min(...ready.map((x) => x.e[k])) : null);
  const add = (id: string) => { const c = COLLEGES.find((x) => x.id === id)!; const g = computeCost(c, { ...DEFAULT_COST, homeState: s.profile.state }).gross; store.set((st) => { st.offers.push(blank(id, g)); }); setPick(''); };

  return (
    <div className="space-y-4">
      <Notice>Got your award letters? Enter each one exactly as written. AdmitIQ separates <Term t="pell grant">free money</Term> from <Term t="unsubsidized loan">loans</Term> and <Term t="work-study">work-study</Term> — award letters often blur them — so you can compare real costs. Nothing here is a guarantee; confirm with each financial aid office.</Notice>
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Field label="Add an offer from" htmlFor="of-add" className="min-w-[220px] flex-1"><Select id="of-add" value={pick} onChange={(e) => setPick(e.target.value)} options={[{ value: '', label: admitted.length ? 'Choose (admitted schools first)' : 'Choose a college' }, ...candidates.map((id) => ({ value: id, label: `${COLLEGES.find((c) => c.id === id)?.short}${admitted.includes(id) ? ' — admitted' : ''}` })), ...COLLEGES.filter((c) => !candidates.includes(c.id) && !s.offers.some((o) => o.collegeId === c.id)).map((c) => ({ value: c.id, label: c.short }))]} /></Field>
        <Button variant="primary" icon={<LuPlus />} disabled={!pick} onClick={() => add(pick)}>Add offer</Button>
        <Field label="Loan interest rate % (assumption)" htmlFor="of-rate" hint="Check studentaid.gov for current federal rates." className="w-56"><NumberInput id="of-rate" value={rate} onChange={setRate} /></Field>
      </Card>
      {!s.offers.length ? <Card><EmptyState icon={<LuTrophy />} title="No offers yet" body="When admissions decisions arrive (usually March–April), add each financial aid offer here to compare them side by side before May 1." /></Card> : (
        <>
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {evals.map(({ o, e, c }) => (
              <Card key={o.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <a href={`#college-${c.id}`} className="font-semibold text-ink hover:text-accent">{c.name}</a>
                  <Button size="sm" variant="ghost" aria-label={`Remove ${c.short} offer`} icon={<LuTrash2 />} onClick={async () => { if (await confirm({ title: `Remove ${c.short}'s offer?`, body: 'The numbers you entered will be deleted.', action: 'Remove', danger: true })) store.set((st) => { st.offers = st.offers.filter((x) => x.id !== o.id); }); }} />
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">{best('net') === e.net && o.coa ? <Badge tone="teal">Lowest net price</Badge> : null}{best('debt4') === e.debt4 && o.coa && ready.length > 1 ? <Badge tone="blue">Least student debt</Badge> : null}</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Field label="Cost of attendance / yr"><NumberInput value={o.coa} onChange={(v) => set(o.id, { coa: v })} /></Field>
                  <Field label="Grants (need-based)"><NumberInput value={o.grants || null} placeholder="0" onChange={(v) => set(o.id, { grants: v ?? 0 })} /></Field>
                  <Field label="Scholarships (merit)"><NumberInput value={o.scholarships || null} placeholder="0" onChange={(v) => set(o.id, { scholarships: v ?? 0 })} /></Field>
                  <Field label="Work-study"><NumberInput value={o.workStudy || null} placeholder="0" onChange={(v) => set(o.id, { workStudy: v ?? 0 })} /></Field>
                  <Field label="Subsidized loans"><NumberInput value={o.subLoans || null} placeholder="0" onChange={(v) => set(o.id, { subLoans: v ?? 0 })} /></Field>
                  <Field label="Unsubsidized loans"><NumberInput value={o.unsubLoans || null} placeholder="0" onChange={(v) => set(o.id, { unsubLoans: v ?? 0 })} /></Field>
                  <Field label="Parent PLUS loans"><NumberInput value={o.parentLoans || null} placeholder="0" onChange={(v) => set(o.id, { parentLoans: v ?? 0 })} /></Field>
                  <Field label="Private loans"><NumberInput value={o.privateLoans || null} placeholder="0" onChange={(v) => set(o.id, { privateLoans: v ?? 0 })} /></Field>
                </div>
                <div className="mt-3"><Toggle label="Scholarships renew all 4 years" checked={o.renewable} onChange={(v) => set(o.id, { renewable: v })} /></div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
                  <dt className="text-muted"><Term t="net price">Net price</Term> / yr</dt><dd className="text-right font-semibold tabular-nums text-ink">{usd(e.net)}</dd>
                  <dt className="text-muted">Paid from savings/income</dt><dd className="text-right tabular-nums text-ink">{usd(e.youPay)}</dd>
                  <dt className="text-muted">4-year net cost</dt><dd className="text-right font-semibold tabular-nums text-ink">{usd(e.fourYear)}</dd>
                  <dt className="text-muted">Student debt at graduation</dt><dd className="text-right tabular-nums text-ink">{usd(e.debt4 + e.privateDebt4)}</dd>
                  <dt className="text-muted">≈ Monthly payment (10 yrs)</dt><dd className="text-right tabular-nums text-ink">{usd(Math.round(e.monthly))}</dd>
                  {e.parentDebt4 > 0 && <><dt className="text-muted">Parent debt</dt><dd className="text-right tabular-nums text-ink">{usd(e.parentDebt4)}</dd></>}
                </dl>
                {e.flags.length > 0 && <ul className="mt-3 space-y-1.5 text-xs">{e.flags.map((f) => <li key={f} className="flex gap-1.5 text-amber-800 dark:text-amber-300"><LuTriangleAlert className="mt-0.5 shrink-0" />{f}</li>)}</ul>}
                <Textarea aria-label="Notes" rows={1} className="mt-3 min-h-10 py-2 text-sm" placeholder="Notes (appeal sent, deadline to accept…)" value={o.notes} onChange={(ev) => set(o.id, { notes: ev.target.value })} />
              </Card>
            ))}
          </div>
          {ready.length > 0 && (
            <ChartCard title="What each offer is really made of (per year)" desc="Free money vs. money you earn, borrow, or pay." source="Your award letters (self-reported) · AdmitIQ calculation" legend={[{ label: 'Grants & scholarships', color: 'var(--c3)' }, { label: 'Work-study', color: 'var(--c6)' }, { label: 'Loans', color: 'var(--c4)' }, { label: 'Paid from savings/income', color: 'var(--c5)' }]}>
              <StackedBars format={usd} keys={[{ key: 'free', label: 'Grants & scholarships', color: 'var(--c3)' }, { key: 'ws', label: 'Work-study', color: 'var(--c6)' }, { key: 'loan', label: 'Loans', color: 'var(--c4)' }, { key: 'pay', label: 'Paid from savings/income', color: 'var(--c5)' }]}
                rows={ready.map(({ e, c, o }) => ({ label: c.short, total: e.coa, parts: { free: Math.min(e.free, e.coa), ws: o.workStudy, loan: e.allLoans, pay: e.youPay } }))} />
            </ChartCard>
          )}
          <Card className="p-5 text-sm text-muted">
            <CardHeader flush title="If an offer isn't enough" />
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Many colleges accept <b className="text-ink">financial aid appeals</b> when circumstances changed, or with a better offer from a peer school. Ask the aid office how.</li>
              <li>Compare the <b className="text-ink">4-year</b> cost, not just year one — check renewal conditions (minimum GPA, credit load).</li>
              <li>Federal loan limits and rates are set by law; see <ExtLink href="https://studentaid.gov/understand-aid/types/loans">studentaid.gov</ExtLink>.</li>
            </ul>
          </Card>
        </>
      )}
      {void cx}
    </div>
  );
}
