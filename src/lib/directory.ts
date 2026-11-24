// Turns a national-directory record (+ optional College Scorecard statistics) into an AdmitIQ college.
import type { College } from '../data/colleges';
import type { DirCollege } from './services';

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function toCollege(d: DirCollege, stats: Record<string, unknown> | null, retrieved?: string): College & { verified?: Record<string, { value: unknown; retrieved: string; url: string; source: string }> } {
  const s = stats || {};
  const sat = n(s.satRW25) && n(s.satM25) && n(s.satRW75) && n(s.satM75) ? [n(s.satRW25)! + n(s.satM25)!, n(s.satRW75)! + n(s.satM75)!] as [number, number] : null;
  const act = n(s.act25) && n(s.act75) ? [n(s.act25)!, n(s.act75)!] as [number, number] : null;
  const twoYear = d.level === 'Two-year';
  const kind: College['kind'] = twoYear ? 'Community college' : d.control === 'Public' ? 'Public' : 'Private';
  const coa = n(s.coa);
  const c: College & { verified?: Record<string, { value: unknown; retrieved: string; url: string; source: string }> } = {
    id: `ipeds-${d.unitid}`, scorecardId: d.unitid, name: d.name, short: d.name.replace(/^The /, '').replace(/University of /, 'U ').replace(/ University$/, '').slice(0, 28),
    city: d.city, state: d.state, country: 'USA', kind, setting: 'Unknown', undergrad: n(s.size), lat: d.lat ?? 39.8, lon: d.lon ?? -98.6,
    web: d.web || `https://collegescorecard.ed.gov/school/?${d.unitid}`,
    admit: n(s.admit), sat, act, gpaAvg: null,
    tuitionIn: n(s.tuitionIn), tuitionOut: n(s.tuitionOut) ?? n(s.tuitionIn), coaIn: coa, coaOut: coa, housingMeals: null,
    netPrice: n(s.netPrice), grad: n(s.grad), retention: n(s.retention), earnings: n(s.earnings), debt: n(s.debt), sfr: null,
    tests: 'Varies by program', rounds: twoYear ? ['Open enrollment'] : [], deadlines: {}, majors: [], features: [d.control, d.level].filter(Boolean),
    notes: `Added from the national college directory (${d.control}${d.level ? `, ${d.level.toLowerCase()}` : ''}). Program list, testing policy and deadlines aren't loaded for this school — check its official site.${stats ? '' : ' Statistics need the free College Scorecard key on the server.'}`,
  };
  if (stats && retrieved) {
    const src = { retrieved, url: `https://collegescorecard.ed.gov/school/?${d.unitid}`, source: 'College Scorecard (U.S. Dept. of Education)' };
    c.verified = {};
    for (const [k, v] of Object.entries({ admit: c.admit, sat: c.sat, act: c.act, tuitionIn: c.tuitionIn, tuitionOut: c.tuitionOut, coaIn: c.coaIn, netPrice: c.netPrice, grad: c.grad, retention: c.retention, earnings: c.earnings, debt: c.debt, undergrad: c.undergrad }))
      if (v !== null) c.verified[k] = { value: v, ...src };
  }
  return c;
}
