import { COLLEGES, DATA_META, scorecardUrl, type College } from '../data/colleges';
import type { AppState } from './types';
import { assess, fit, fmtUSD, recommendList, studentAcademics } from './analysis';
import { portfolio } from './activities';
import { computeCost, DEFAULT_COST } from './cost';

export type Tag = 'Data' | 'Opinion' | 'Missing info' | 'From your profile';
export interface Block { tag: Tag; text: string; items?: string[]; sources?: { label: string; url: string }[] }
export interface Answer { intent: string; blocks: Block[] }

const byId = (id: string) => COLLEGES.find((c) => c.id === id)!;
const listColleges = (s: AppState) => s.list.map((l) => byId(l.collegeId)).filter(Boolean);
const src = (cs: College[]) => cs.slice(0, 4).map((c) => ({ label: `${c.short} · College Scorecard`, url: scorecardUrl(c) }));
const dataNote = `Figures are ${DATA_META.label.toLowerCase()}, ${DATA_META.reportingYears}. Verify on official sources.`;

const CAREER_MAJORS: [RegExp, string[]][] = [
  [/doctor|physician|medic|surgeon|dentist|pharm/i, ['Biology', 'Chemistry', 'Neuroscience', 'Public Health', 'Pre-Med track']],
  [/nurse|nursing/i, ['Nursing', 'Health Sciences']],
  [/software|programm|developer|tech|ai|machine learning|computer/i, ['Computer Science', 'Data Science', 'Mathematics', 'Information Technology']],
  [/engineer|robot|aerospace|mechanic|civil|electrical/i, ['Engineering', 'Physics', 'Computer Science']],
  [/lawyer|law|attorney|policy|government|politic/i, ['Political Science', 'History', 'Philosophy', 'Economics', 'English']],
  [/business|finance|bank|entrepreneur|consult|marketing/i, ['Business', 'Economics', 'Data Science', 'Mathematics']],
  [/journalis|writer|author|media|publish/i, ['Journalism', 'English', 'Film']],
  [/teach|education/i, ['Education', 'Psychology']],
  [/psycholog|therap|counsel/i, ['Psychology', 'Neuroscience']],
  [/climate|environment|sustainab|ecolog/i, ['Environmental Science', 'Biology', 'Engineering', 'Public Health']],
  [/architect/i, ['Architecture', 'Art & Design', 'Engineering']],
  [/art|design|animation|illustrat/i, ['Art & Design', 'Film', 'Architecture']],
  [/music|perform|compos/i, ['Music']],
  [/film|director|cinema/i, ['Film', 'Art & Design']],
  [/research|scien|lab/i, ['Biology', 'Chemistry', 'Physics', 'Neuroscience']],
];

function careerMajors(s: AppState) {
  const text = `${s.personal.career} ${s.personal.academicInterests} ${s.personal.careerPriorities}`;
  const out = new Set<string>();
  for (const [re, ms] of CAREER_MAJORS) if (re.test(text)) ms.forEach((m) => out.add(m));
  return [...out];
}

export const SUGGESTED = [
  'Which colleges fit my profile best?', 'What should I improve before applying?', 'Which extracurriculars are strongest?',
  'What majors should I consider?', 'Should I submit my SAT?', 'Which colleges are affordable?',
  'Which schools have good programs for my career?', 'How should I prioritize my applications?',
  'What weaknesses are present in my application?', 'Help me plan my senior year.',
];

export function answer(q: string, s: AppState, today = new Date()): Answer {
  const lq = q.toLowerCase();
  const list = listColleges(s);
  const pool = list.length ? list : COLLEGES.filter((c) => c.kind !== 'International');
  const blocks: Block[] = [];
  const ac = studentAcademics(s);
  if (ac.gpa4 === null && !s.profile.sat.total && !s.profile.act.composite) blocks.push({ tag: 'Missing info', text: 'Your profile has no GPA or test scores yet, so academic comparisons are limited. Add them under Profile → Academics.' });

  if (/fit|best match|match my|good fit/.test(lq)) {
    const r = recommendList(COLLEGES, s, 3);
    blocks.push({ tag: 'Opinion', text: 'Based on AdmitIQ\'s fit score (major availability, setting, region, size, distance, budget and research/internship preferences — weights are AdmitIQ\'s own judgment):' });
    for (const b of ['Reach', 'Target', 'Likely'] as const) if (r[b].length) blocks.push({ tag: 'Opinion', text: `${b}:`, items: r[b].map((f) => `${f.college.short} — fit ${f.score}/100${f.reasons.length ? ` · ${f.reasons.slice(0, 3).join(', ')}` : ''}${f.concerns.length ? ` · concern: ${f.concerns[0]}` : ''}`) });
    blocks.push({ tag: 'Data', text: dataNote, sources: src(Object.values(r).flat().map((f) => f.college)) });
    return { intent: 'fit', blocks };
  }
  if (/improve|before applying|get better|strengthen/.test(lq)) {
    const all = pool.slice(0, 12).map((c) => assess(c, s));
    const miss = Array.from(new Set(all.flatMap((a) => a.missing)));
    const imp = Array.from(new Set(all.flatMap((a) => a.improvements)));
    if (miss.length) blocks.push({ tag: 'Missing info', text: 'Fill these in for a sharper analysis:', items: miss });
    blocks.push({ tag: 'Opinion', text: 'Highest-leverage improvements for your list:', items: imp.length ? imp : ['No specific gaps detected from your entered data. Focus on essay quality and on finishing senior-year courses strongly.'] });
    const p = portfolio(s.activities);
    if (p.suggestions.length) blocks.push({ tag: 'Opinion', text: 'Activities:', items: p.suggestions });
    if (!s.essays.length) blocks.push({ tag: 'From your profile', text: 'You have not started an essay in the Essay Lab yet.' });
    return { intent: 'improve', blocks };
  }
  if (/extracurric|activit|strongest/.test(lq)) {
    const p = portfolio(s.activities);
    if (!s.activities.length) return { intent: 'activities', blocks: [{ tag: 'Missing info', text: 'No activities entered yet. Add them under Profile → Activities.' }] };
    const ranked = s.activities.map((a, i) => ({ a, sc: p.scores[i] })).sort((x, y) => y.sc.total - x.sc.total);
    blocks.push({ tag: 'Opinion', text: 'Ranked by AdmitIQ\'s heuristic (depth 35%, leadership 30%, impact 25%, recognition 10%):', items: ranked.map(({ a, sc }) => `${a.position ? `${a.position}, ` : ''}${a.org} — ${sc.total}/100 · ${sc.notes.slice(0, 2).join(' ')}`) });
    blocks.push({ tag: 'From your profile', text: `Profile style: ${p.style}. ${p.totalHours.toLocaleString()} total hours across ${s.activities.length} activities; ${p.leadershipCount} with leadership or responsibility.` });
    return { intent: 'activities', blocks };
  }
  if (/major/.test(lq) && !/career/.test(lq)) {
    const cm = careerMajors(s);
    const fromActs = Array.from(new Set(s.activities.map((a) => ({ Research: 'Biology', Robotics: 'Engineering', 'Computer/Technology': 'Computer Science', 'Journalism/Publication': 'Journalism', 'Debate/Speech': 'Political Science', Music: 'Music', Art: 'Art & Design', 'Science/Math': 'Mathematics', 'Community service': 'Public Health', 'Student government': 'Political Science', 'Career-oriented': 'Business' } as Record<string, string>)[a.category]).filter(Boolean)));
    if (!cm.length && !fromActs.length) blocks.push({ tag: 'Missing info', text: 'Add your intended career and academic interests (Profile → Personal) so suggestions reflect you.' });
    if (cm.length) blocks.push({ tag: 'Opinion', text: `Majors connected to your stated career/interest ("${s.personal.career || s.personal.academicInterests}"):`, items: cm });
    if (fromActs.length) blocks.push({ tag: 'Opinion', text: 'Majors suggested by what you already spend time on:', items: fromActs as string[] });
    blocks.push({ tag: 'Opinion', text: 'Many students change majors; at schools that admit by major, check how easy internal transfers are before choosing a competitive first-choice major.' });
    return { intent: 'majors', blocks };
  }
  if (/sat|act|test/.test(lq)) {
    if (!s.profile.sat.total && !s.profile.act.composite) blocks.push({ tag: 'From your profile', text: 'No SAT/ACT score on file.' });
    blocks.push({ tag: 'Data', text: 'Testing policy and recommendation per school:', items: pool.slice(0, 12).map((c) => `${c.short} (${c.tests}): ${assess(c, s).testing}`), sources: src(pool) });
    blocks.push({ tag: 'Opinion', text: 'The "submit if at or above the midpoint" rule is common counselor guidance, not a published rule. Policies change yearly — confirm each school\'s current policy.' });
    return { intent: 'testing', blocks };
  }
  if (/afford|cheap|cost|budget|money|financial/.test(lq)) {
    const budget = s.financial.maxAnnualCost;
    const costs = pool.map((c) => computeCost(c, { ...DEFAULT_COST, homeState: s.profile.state })).filter((x) => x.known).sort((a, b) => (a.avgNetPrice ?? a.gross ?? 0) - (b.avgNetPrice ?? b.gross ?? 0));
    if (!budget) blocks.push({ tag: 'Missing info', text: 'Set a maximum annual cost in Profile → Financial to filter by budget.' });
    blocks.push({ tag: 'Data', text: `Lowest average net price${list.length ? ' on your list' : ''} (average for aided students — your price will differ):`, items: costs.slice(0, 8).map((x) => `${x.college.short}: avg net ${fmtUSD(x.avgNetPrice)} · sticker ${fmtUSD(x.gross)}${x.inState ? ' (in-state)' : ''}${budget && x.avgNetPrice !== null ? (x.avgNetPrice <= budget ? ' ✓ within budget' : ' · above budget') : ''}`), sources: src(costs.map((x) => x.college)) });
    blocks.push({ tag: 'Opinion', text: 'Run each school\'s official net price calculator: schools that meet full need can cost less than in-state publics for lower-income families, while merit aid matters more at higher incomes.', sources: [{ label: 'Net Price Calculator Center (U.S. Dept. of Education)', url: 'https://collegecost.ed.gov/net-price' }] });
    return { intent: 'cost', blocks };
  }
  if (/career|program|job|outcome|earn/.test(lq)) {
    const cm = careerMajors(s);
    const majors = cm.length ? cm : s.profile.intendedMajor ? [s.profile.intendedMajor] : [];
    if (!majors.length) return { intent: 'career', blocks: [{ tag: 'Missing info', text: 'Add an intended career or major first (Profile → Personal / Academics).' }] };
    const matches = COLLEGES.filter((c) => majors.some((m) => c.majors.includes(m))).filter((c) => c.earnings !== null).sort((a, b) => (b.earnings ?? 0) - (a.earnings ?? 0)).slice(0, 8);
    blocks.push({ tag: 'Data', text: `Schools offering ${majors.slice(0, 3).join(' / ')}, sorted by institution-wide median earnings ~10 years after entry (not major-specific, low confidence):`, items: matches.map((c) => `${c.short}: ${fmtUSD(c.earnings)}${c.features.length ? ` · ${c.features.filter((f) => /co-op|research|internship/i.test(f)).join(', ')}` : ''}`), sources: src(matches) });
    blocks.push({ tag: 'Opinion', text: 'Institution-wide earnings mostly reflect the mix of majors at each school. College Scorecard publishes field-of-study earnings — check those for your specific major.' });
    return { intent: 'career', blocks };
  }
  if (/priorit|order|which first|deadline/.test(lq)) {
    const apps = s.apps.length ? s.apps : list.map((c) => ({ collegeId: c.id, deadline: '', round: c.rounds[0] } as unknown as AppState['apps'][number]));
    if (!apps.length) return { intent: 'prioritize', blocks: [{ tag: 'Missing info', text: 'Add colleges to your list or tracker first.' }] };
    const sorted = [...apps].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    blocks.push({ tag: 'From your profile', text: 'By deadline (from your tracker):', items: sorted.map((a) => { const c = byId(a.collegeId); const days = a.deadline ? Math.ceil((new Date(a.deadline).getTime() - today.getTime()) / 86400000) : null; return `${c?.short} — ${a.round || '—'}${a.deadline ? ` · ${a.deadline} (${days! < 0 ? 'passed' : `${days} days`})` : ' · no deadline set'}${'status' in a && a.status ? ` · ${a.status}` : ''}`; }) });
    blocks.push({ tag: 'Opinion', text: 'A common approach: finish binding/early applications first, then the schools whose supplements overlap most (reuse research, never reuse "why us" text verbatim), and submit a few days before each deadline.' });
    return { intent: 'prioritize', blocks };
  }
  if (/weak|red flag|concern/.test(lq)) {
    const all = pool.slice(0, 12).map((c) => assess(c, s));
    const w = Array.from(new Set(all.flatMap((a) => a.weaknesses)));
    blocks.push({ tag: 'Opinion', text: w.length ? 'Recurring weaknesses relative to your list:' : 'No academic weaknesses detected relative to your list based on the data entered.', items: w });
    const p = portfolio(s.activities);
    if (p.suggestions.length) blocks.push({ tag: 'Opinion', text: 'Activities:', items: p.suggestions });
    return { intent: 'weaknesses', blocks };
  }
  if (/senior|plan|timeline|calendar|month/.test(lq)) {
    const m = today.getMonth();
    const plan: string[] = [];
    if (m >= 7 && m <= 9) plan.push('Now–Oct: finalize college list, request recommendations, finish personal statement, submit FAFSA (opens Oct in recent cycles) and CSS Profile where required.');
    if (m >= 7 && m <= 10) plan.push('Nov 1–15: most Early Decision / Early Action deadlines. Submit a few days early.');
    plan.push('Dec: early decisions arrive. If admitted ED, withdraw other applications. Finish Regular Decision supplements.');
    plan.push('Jan 1–15: most Regular Decision deadlines; send midyear reports through your counselor.');
    plan.push('Feb–Mar: check portals for missing documents; complete scholarship applications; keep grades steady (offers can be rescinded).');
    plan.push('Late Mar–Apr: compare financial aid offers side by side (use the Cost calculator); appeal aid if circumstances justify it.');
    plan.push('May 1: National College Decision Day — submit one deposit.');
    blocks.push({ tag: 'Opinion', text: 'A typical senior-year timeline (verify each school\'s dates):', items: plan });
    const upcoming = s.apps.filter((a) => a.deadline && new Date(a.deadline) >= today).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 5);
    if (upcoming.length) blocks.push({ tag: 'From your profile', text: 'Your next deadlines:', items: upcoming.map((a) => `${byId(a.collegeId)?.short} ${a.round}: ${a.deadline}`) });
    return { intent: 'plan', blocks };
  }
  const mentioned = COLLEGES.find((c) => lq.includes(c.short.toLowerCase()) || lq.includes(c.id));
  if (mentioned) {
    const a = assess(mentioned, s), f = fit(mentioned, s);
    blocks.push({ tag: 'Opinion', text: `${mentioned.short}: ${a.competitiveness} · estimated ${a.bucket} · fit ${f.score}/100`, items: [...a.academic.map((x) => `${x.label}: ${x.detail}`), a.testing, ...a.strategy] });
    blocks.push({ tag: 'Data', text: dataNote, sources: src([mentioned]) });
    return { intent: 'college', blocks };
  }
  return { intent: 'unknown', blocks: [{ tag: 'Opinion', text: 'In offline mode I answer questions about fit, improvements, activities, majors, testing, affordability, career programs, prioritizing, weaknesses, senior-year planning, or a specific college on your list. Try one of the suggestions below. With an AI provider configured on the server, I can answer open-ended questions too.' }] };
}

export function contextForLLM(s: AppState) {
  const ac = studentAcademics(s);
  return JSON.stringify({
    profile: { gradYear: s.profile.gradYear, state: s.profile.state, gpa4: ac.gpa4?.toFixed(2), weighted: ac.weighted?.toFixed(2), sat: s.profile.sat.total, act: s.profile.act.composite, testing: s.profile.testingStatus, major: s.profile.intendedMajor, alt: s.profile.altMajors, rigor: ac.rigor },
    personal: { career: s.personal.career, interests: s.personal.academicInterests, settings: s.personal.settings, regions: s.personal.regions, size: s.personal.size },
    financial: s.financial.shareFinancials ? { max: s.financial.maxAnnualCost, merit: s.financial.meritPreference, loans: s.financial.loanWillingness } : 'private',
    activities: s.activities.map((a) => ({ org: a.org, position: a.position, years: a.grades.length, hrs: a.hrsWeek, impact: a.impact })),
    list: s.list.map((l) => { const c = byId(l.collegeId); return { name: c.name, category: l.category, admit: c.admit, sat: c.sat, tests: c.tests, netPrice: c.netPrice }; }),
    dataNote,
  });
}
