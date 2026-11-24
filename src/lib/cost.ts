import type { College } from '../data/colleges';

export interface CostInputs {
  residency: 'auto' | 'in-state' | 'out-of-state';
  living: 'on-campus' | 'at-home' | 'off-campus';
  homeState: string;
  transport: number;
  books: number;
  personal: number;
  grants: number; // need-based grants the student expects or has been offered
  merit: number;
  scholarships: number; // outside scholarships
  loans: number;
  increase: number; // annual cost increase %
  offCampusRent: number;
  commute: number;
}

export const DEFAULT_COST: CostInputs = { residency: 'auto', living: 'on-campus', homeState: '', transport: 1200, books: 1200, personal: 2400, grants: 0, merit: 0, scholarships: 0, loans: 0, increase: 3, offCampusRent: 14000, commute: 2000 };

export interface CostBreakdown {
  college: College; inState: boolean; known: boolean;
  tuition: number | null; housing: number; transport: number; books: number; personal: number;
  gross: number | null; aid: number; net: number | null; outOfPocket: number | null; fourYear: number[] | null; fourYearTotal: number | null;
  avgNetPrice: number | null; notes: string[];
}

export function computeCost(c: College, i: CostInputs): CostBreakdown {
  const notes: string[] = [];
  const inState = i.residency === 'in-state' || (i.residency === 'auto' && i.homeState === c.state && c.country === 'USA');
  const isPublicLike = c.kind === 'Public' || c.kind === 'Community college';
  const tuition = isPublicLike ? (inState ? c.tuitionIn : c.tuitionOut) : c.tuitionIn;
  if (tuition === null) notes.push('Tuition unavailable in dataset — check the official cost-of-attendance page.');
  let housing = c.housingMeals ?? 0;
  if (i.living === 'at-home') { housing = 0; notes.push('Living at home: housing/meals removed, commute cost added.'); }
  else if (i.living === 'off-campus') { housing = i.offCampusRent; notes.push('Off-campus: uses your rent + food estimate.'); }
  else if (c.housingMeals === null) notes.push('On-campus housing cost unavailable — treated as $0, so the total is understated.');
  const transport = i.transport + (i.living === 'at-home' ? i.commute : 0);
  const gross = tuition === null ? null : tuition + housing + transport + i.books + i.personal;
  const aid = i.grants + i.merit + i.scholarships;
  const net = gross === null ? null : Math.max(0, gross - aid);
  const outOfPocket = net === null ? null : Math.max(0, net - i.loans);
  const fourYear = net === null ? null : [0, 1, 2, 3].map((y) => Math.round(net * (1 + i.increase / 100) ** y));
  if (c.kind === 'Public' && !inState && i.residency === 'auto') notes.push('Out-of-state rate applied (home state differs).');
  if (c.kind === 'Community college') notes.push('Community colleges are usually two-year programs; four-year totals assume transfer costs similar to year one, which is unrealistic — compare to the university you would transfer to.');
  return { college: c, inState, known: gross !== null, tuition, housing, transport, books: i.books, personal: i.personal, gross, aid, net, outOfPocket, fourYear, fourYearTotal: fourYear ? fourYear.reduce((a, b) => a + b, 0) : null, avgNetPrice: c.netPrice, notes };
}
