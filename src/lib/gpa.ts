import type { Course } from './types';

export const GRADE_POINTS: Record<string, number | null> = {
  'A+': 4.0, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7, 'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, 'D-': 0.7, F: 0, P: null,
};
export const LEVEL_BONUS: Record<string, number> = { Regular: 0, Honors: 0.5, AP: 1, IB: 1, 'Dual enrollment': 1 };

export interface GpaResult { value: number | null; credits: number; courses: number }

const graded = (cs: Course[]) => cs.filter((c) => GRADE_POINTS[c.grade] !== null);

export function unweighted(cs: Course[]): GpaResult {
  const g = graded(cs);
  const credits = g.reduce((a, c) => a + c.credits, 0);
  if (!credits) return { value: null, credits: 0, courses: 0 };
  return { value: g.reduce((a, c) => a + (GRADE_POINTS[c.grade] as number) * c.credits, 0) / credits, credits, courses: g.length };
}

export function weighted(cs: Course[]): GpaResult {
  const g = graded(cs);
  const credits = g.reduce((a, c) => a + c.credits, 0);
  if (!credits) return { value: null, credits: 0, courses: 0 };
  const pts = g.reduce((a, c) => {
    const base = GRADE_POINTS[c.grade] as number;
    // Many schools give no honors bonus for a D or F; we follow that convention.
    const bonus = base >= 2 ? LEVEL_BONUS[c.level] : 0;
    return a + Math.min(5, base + bonus) * c.credits;
  }, 0);
  return { value: pts / credits, credits, courses: g.length };
}

// Approximation of the University of California "capped weighted" GPA:
// 10th–11th grade academic courses only; +1 point per semester of Honors/AP/IB/DE with a C or better,
// at most 8 bonus semesters total and at most 4 from 10th grade. Real UC calculations also depend on
// UC-approved course lists (A–G) and honors designations, so treat this as an estimate.
export function ucCapped(cs: Course[]): GpaResult {
  const sem: { base: number; bonusEligible: boolean; year: number }[] = [];
  for (const c of cs) {
    if (c.year < 10 || c.year > 11 || c.subject === 'Elective') continue;
    const base = GRADE_POINTS[c.grade];
    if (base === null) continue;
    const n = c.term === 'Full year' ? 2 : 1;
    for (let i = 0; i < n; i++) sem.push({ base, bonusEligible: c.level !== 'Regular' && base >= 2, year: c.year });
  }
  if (!sem.length) return { value: null, credits: 0, courses: 0 };
  let bonus = 0, bonus10 = 0;
  for (const s of sem) {
    if (!s.bonusEligible || bonus >= 8) continue;
    if (s.year === 10) { if (bonus10 >= 4) continue; bonus10++; }
    bonus++;
  }
  const total = sem.reduce((a, s) => a + s.base, 0) + bonus;
  return { value: total / sem.length, credits: sem.length, courses: sem.length };
}

export function byTerm(cs: Course[]) {
  const out: { label: string; unweighted: number | null; weighted: number | null }[] = [];
  for (const y of [9, 10, 11, 12]) {
    for (const t of ['Semester 1', 'Semester 2'] as const) {
      const inTerm = cs.filter((c) => c.year === y && (c.term === t || c.term === 'Full year'));
      if (!inTerm.length) continue;
      out.push({ label: `${y}th · ${t === 'Semester 1' ? 'S1' : 'S2'}`, unweighted: unweighted(inTerm).value, weighted: weighted(inTerm).value });
    }
  }
  return out;
}

export function rigor(cs: Course[]) {
  const count = (l: string) => cs.filter((c) => c.level === l).length;
  return { ap: count('AP'), ib: count('IB'), honors: count('Honors'), de: count('Dual enrollment'), advanced: count('AP') + count('IB') + count('Dual enrollment'), total: cs.length };
}

export const METHODOLOGY = [
  { name: 'Unweighted (4.0)', text: 'Letter grades convert to points (A/A+ = 4.0, A- = 3.7, B+ = 3.3 … F = 0). Each course is weighted by its credits. Pass/Fail courses are excluded. Course level is ignored.' },
  { name: 'Weighted (5.0 cap)', text: 'Same as unweighted, plus +0.5 for Honors and +1.0 for AP, IB and dual-enrollment courses, capped at 5.0 per course. No bonus for grades below C. Your school may use a different scale — colleges usually recalculate GPA themselves.' },
  { name: 'UC-style capped (estimate)', text: 'Only 10th–11th grade academic (non-elective) courses, counted by semester. +1 for each Honors/AP/IB/DE semester with C or better, at most 8 bonus semesters (max 4 in 10th grade). The official UC GPA depends on UC-approved course lists, so this is an approximation.' },
];
