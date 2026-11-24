import type { Activity } from './types';

// Heuristic activity analysis. Scores are AdmitIQ's own rubric (0–100) for organizing feedback —
// they are not how any admissions office rates activities.

const LEAD_TIERS: [RegExp, number, string][] = [
  [/\b(founder|co-?founder|founded|started|created|launched)\b/i, 95, 'Founded or started something'],
  [/\b(president|captain|editor[- ]in[- ]chief|chair|director|head|executive director|ceo)\b/i, 85, 'Top leadership role'],
  [/\b(vice president|vp|co-?captain|co-?president|lead|manager|organizer|coordinator|section leader|managing editor)\b/i, 70, 'Leadership role'],
  [/\b(officer|treasurer|secretary|board|representative|delegate|mentor|tutor|coach|editor)\b/i, 55, 'Position of responsibility'],
];

const AWARD_TIERS: [RegExp, number, string][] = [
  [/\binternational|world\b/i, 100, 'International recognition'],
  [/\bnational|usamo|aime|isef|regeneron|scholastic gold\b/i, 85, 'National recognition'],
  [/\bstate|all-state\b/i, 65, 'State recognition'],
  [/\bregional|district|county|all-conference\b/i, 50, 'Regional recognition'],
  [/\b(school|club|honor|award|place|winner|finalist|semifinalist)\b/i, 30, 'School-level or unspecified recognition'],
];

export interface ActivityScore { id: string; total: number; depth: number; leadership: number; impact: number; recognition: number; hours: number; years: number; notes: string[] }

export function activityScore(a: Activity): ActivityScore {
  const notes: string[] = [];
  const years = a.grades.length;
  const hours = Math.round(a.hrsWeek * a.wksYear * Math.max(1, years));
  const depth = Math.min(100, Math.round(years * 18 + Math.min(40, hours / 25)));
  const leadText = `${a.position} ${a.leadership} ${a.description}`;
  let leadership = 15; let leadLabel = 'Member/participant';
  for (const [re, v, label] of LEAD_TIERS) if (re.test(leadText)) { leadership = v; leadLabel = label; break; }
  const impactText = `${a.impact} ${a.achievements} ${a.description}`;
  const nums = impactText.match(/\$?\d[\d,]*(\.\d+)?\s*(%|k|people|students|members|hours|dollars|volunteers|views|downloads|users|donations|meals|books)?/gi) || [];
  let impact = Math.min(100, 20 + nums.length * 15 + (a.reach ? Math.min(40, Math.log10(a.reach + 1) * 14) : 0) + (a.impact.length > 40 ? 10 : 0));
  if (!a.impact && !a.achievements) impact = 10;
  let recognition = 0; let recLabel = '';
  const recText = `${a.awards} ${a.achievements}`;
  for (const [re, v, label] of AWARD_TIERS) if (re.test(recText)) { recognition = v; recLabel = label; break; }
  const total = Math.round(depth * 0.35 + leadership * 0.3 + impact * 0.25 + recognition * 0.1);

  notes.push(`${leadLabel}.`);
  if (years >= 3) notes.push(`Sustained over ${years} years.`); else if (years <= 1) notes.push('One year or less — depth is limited so far.');
  if (hours) notes.push(`≈${hours.toLocaleString()} total hours.`);
  if (nums.length) notes.push(`${nums.length} measurable result${nums.length > 1 ? 's' : ''} mentioned.`); else notes.push('No measurable outcomes mentioned yet.');
  if (recLabel) notes.push(`${recLabel}.`);
  return { id: a.id, total, depth, leadership, impact: Math.round(impact), recognition, hours, years, notes };
}

export function portfolio(acts: Activity[]) {
  const scores = acts.map(activityScore);
  const cats = new Set(acts.map((a) => a.category));
  const avgYears = acts.length ? acts.reduce((s, a) => s + a.grades.length, 0) / acts.length : 0;
  const totalHours = scores.reduce((s, x) => s + x.hours, 0);
  const leadershipCount = scores.filter((x) => x.leadership >= 55).length;
  const style = !acts.length ? 'No activities yet' : avgYears >= 2.5 && cats.size <= Math.max(3, acts.length / 2) ? 'Depth-focused' : cats.size >= 6 && avgYears < 2 ? 'Breadth-focused' : 'Balanced';
  const suggestions: string[] = [];
  if (acts.length && leadershipCount === 0) suggestions.push('No leadership or responsibility roles yet. Leadership can be informal — organizing, teaching, or starting an initiative inside an activity you already do.');
  if (acts.length && scores.filter((x) => x.impact <= 30).length > acts.length / 2) suggestions.push('Most activities lack concrete outcomes. Add facts you already know (people served, money raised, events run) — never estimate or exaggerate.');
  if (style === 'Breadth-focused') suggestions.push('Many short-term activities: consider which 2–3 you will continue through senior year, and list those first.');
  if (acts.length > 10) suggestions.push('The Common App lists up to 10 activities. Rank yours by importance and merge closely related ones.');
  if (acts.length && acts.length < 4) suggestions.push('Responsibilities like a part-time job, caring for family, or independent projects count as activities.');
  const themes = [...cats];
  return { scores, style, totalHours, leadershipCount, categories: themes, avgYears, suggestions };
}

// Compress a student's OWN description toward the 150-character Common App limit.
// Only removes filler and wordy phrasing; it never adds facts, numbers or claims.
// Gentle: wordy phrasing, always worth fixing. Aggressive: only used while still over the limit.
const GENTLE: [RegExp, string][] = [
  [/\bI was responsible for\b/gi, ''], [/\bwas responsible for\b/gi, ''], [/\bresponsible for\b/gi, ''], [/\bin order to\b/gi, 'to'], [/\ba lot of\b/gi, 'many'],
  [/\bhelped to\b/gi, 'helped'], [/\bwas able to\b/gi, ''], [/\bvery\b|\breally\b|\bjust\b/gi, ''], [/\bon a weekly basis\b/gi, 'weekly'],
  [/\bon a daily basis\b/gi, 'daily'], [/\bevery single\b/gi, 'every'], [/\bnumerous\b/gi, 'many'], [/\butilized?\b/gi, 'used'],
];
const AGGRESSIVE: [RegExp, string][] = [
  [/\bI (also )?(have )?/g, ''], [/\bas well as\b/gi, '&'], [/\band\b/g, '&'], [/\bapproximately\b/gi, '~'], [/\bthat\b/gi, ''], [/\bthe\b/g, ''],
];

export function compressDescription(text: string, limit = 150) {
  let out = text.trim();
  const steps: string[] = [];
  const apply = (re: RegExp, rep: string) => {
    const next = out.replace(re, rep).replace(/\s{2,}/g, ' ').replace(/\s+([,.;&])/g, (m, p) => (p === '&' ? ' &' : p)).trim();
    if (next !== out) { steps.push(`${re.source.replace(/\\b/g, '')} → ${rep || '(removed)'}`); out = next; }
  };
  for (const [re, rep] of GENTLE) apply(re, rep);
  for (const [re, rep] of AGGRESSIVE) { if (out.length <= limit) break; apply(re, rep); }
  out = out.replace(/^[a-z]/, (m) => m.toUpperCase());
  return { text: out, steps, fits: out.length <= limit };
}

export const STRONG_VERBS = ['Founded', 'Led', 'Organized', 'Built', 'Designed', 'Taught', 'Coordinated', 'Raised', 'Published', 'Researched', 'Managed', 'Mentored', 'Launched', 'Directed', 'Developed', 'Trained', 'Performed', 'Competed', 'Wrote', 'Analyzed'];

export function descriptionTips(a: Activity) {
  const tips: string[] = [];
  const d = a.description.trim();
  if (!d) return ['Start with what you actually do, in plain words. You can tighten it afterwards.'];
  const first = d.split(/\s+/)[0]?.replace(/[^a-z]/gi, '');
  if (/^(I|My|We|The|This|Was|Am|Is)$/i.test(first || '')) tips.push(`Open with an action verb you can stand behind — e.g. ${STRONG_VERBS.slice(0, 5).join(', ')}.`);
  if (!/\d/.test(d)) tips.push('If you know a concrete number (members, hours, dollars, events), include it. Do not estimate figures you cannot back up.');
  if (/\b(passionate|amazing|incredible|very|really)\b/i.test(d)) tips.push('Adjectives like "passionate" or "amazing" use space without telling the reader what you did.');
  if (d.length > 150) tips.push(`Description is ${d.length} characters; the Common App allows 150.`);
  if (a.position.length > 50) tips.push(`Position title is ${a.position.length} characters; the Common App allows 50.`);
  if (a.org.length > 100) tips.push(`Organization name is ${a.org.length} characters; the Common App allows 100.`);
  if (!tips.length) tips.push('Clear, specific and within limits.');
  return tips;
}
