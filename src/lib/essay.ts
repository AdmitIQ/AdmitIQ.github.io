// AdmitIQ Essay Engine (heuristic mode).
// Every score here is an AI-free text-signal proxy, computed in your browser. It is feedback to help
// you revise — NOT an admissions officer's score and NOT a predictor of admission.
// When the optional AI server is configured, the Essay Lab can request an LLM rubric read in addition.

import { COLLEGES } from '../data/colleges';

export const RUBRIC = [
  'Authenticity', 'Personal voice', 'Specificity', 'Storytelling', 'Reflection', 'Emotional resonance',
  'Structure', 'Clarity', 'Originality', 'Prompt fulfillment', 'Depth', 'Memorability',
] as const;
export type RubricKey = (typeof RUBRIC)[number];

export const RUBRIC_MEASURES: Record<RubricKey, string> = {
  Authenticity: 'Proxy: first-person presence, low cliché/generic-phrase density, few "admissions buzzwords".',
  'Personal voice': 'Proxy: sentence-length variety, first-person presence, and fewer hedges ("I think", "kind of").',
  Specificity: 'Proxy: concrete numbers, names, places, sensory words and quoted speech per 100 words.',
  Storytelling: 'Proxy: scene markers (time, place, dialogue, action verbs) and a narrative opening.',
  Reflection: 'Proxy: density of reflective language ("I realized", "I began to", "now I", "because") especially in the second half.',
  'Emotional resonance': 'Proxy: presence of named feelings and concrete moments rather than abstract statements. Only a human reader can judge this well.',
  Structure: 'Proxy: paragraphing, paragraph balance, a distinct opening and a conclusion that does more than summarize.',
  Clarity: 'Proxy: average sentence length, very long sentences, passive voice and grammar flags.',
  Originality: 'Proxy: absence of overused topics/phrases. A heuristic cannot recognize a genuinely original idea.',
  'Prompt fulfillment': 'Proxy: overlap between the prompt\'s key words and your essay, plus word-limit compliance. Paste the prompt for this to work.',
  Depth: 'Proxy: reflection that explains why/how (causal language), not just what happened.',
  Memorability: 'Proxy: a specific opening line, distinctive concrete details and an ending image. Ask a trusted reader what they remember.',
};

const CLICHES = [
  'ever since i was a child', 'ever since i was young', 'since i was little', 'for as long as i can remember', 'webster', 'dictionary defines',
  'changed my life', 'life-changing', 'outside my comfort zone', 'out of my comfort zone', 'step out of my comfort zone', 'hard work pays off',
  'make a difference', 'make the world a better place', 'give back to the community', 'it is not about winning', 'at the end of the day',
  'in today\'s society', 'in today\'s world', 'the rest is history', 'i learned a lot', 'opened my eyes', 'eye-opening', 'never give up',
  'follow my dreams', 'reach for the stars', 'everything happens for a reason', 'a blessing in disguise', 'only time will tell',
  'think outside the box', 'when life gives you lemons', 'the journey of a thousand miles', 'little did i know', 'i have always been passionate',
  'my passion for', 'a well-rounded', 'i am a hard worker', 'i want to help people', 'broaden my horizons', 'once in a lifetime',
];
const GENERIC = ['passionate', 'passion', 'amazing', 'incredible', 'very', 'really', 'things', 'stuff', 'many people', 'a lot', 'unique', 'diverse', 'impactful', 'journey', 'growth', 'leader', 'leadership skills', 'hardworking', 'dedicated', 'interesting'];
const HEDGES = ['i think', 'i feel like', 'kind of', 'sort of', 'maybe', 'i guess', 'somewhat', 'perhaps', 'i believe that'];
const REFLECT = ['i realized', 'realize', 'i learned', 'i began to', 'i started to', 'i now', 'now i', 'taught me', 'i understand', 'i wonder', 'i see', 'because', 'which meant', 'this meant', 'i noticed', 'i questioned', 'i asked myself', 'changed how', 'made me', 'i still', 'i decided', 'i chose'];
const FEELINGS = ['afraid', 'scared', 'nervous', 'anxious', 'proud', 'ashamed', 'embarrassed', 'angry', 'frustrated', 'joy', 'happy', 'sad', 'grief', 'lonely', 'relief', 'relieved', 'excited', 'guilty', 'confused', 'hurt', 'jealous', 'grateful', 'terrified', 'overwhelmed', 'calm', 'hopeful', 'disappointed', 'curious', 'awkward'];
const SENSORY = ['smell', 'smelled', 'taste', 'tasted', 'sound', 'heard', 'loud', 'quiet', 'bright', 'dark', 'cold', 'warm', 'hot', 'rough', 'smooth', 'sticky', 'bitter', 'sweet', 'salty', 'humming', 'buzzing', 'creak', 'glow', 'shiver', 'sweat', 'echo'];
const WEAK_TRANSITIONS = ['also,', 'additionally,', 'furthermore,', 'moreover,', 'in conclusion,', 'firstly,', 'secondly,', 'lastly,', 'in addition,', 'to sum up,', 'overall,'];
const STOP = new Set('a an the and or but if then of to in on at for with from by as is was were are be been being it its this that these those i me my mine we our you your he she they them his her their not no so do did does have has had can could would should will just than too also very really into out up about over after before when while what which who whom how why where all any some more most other such only own same few each both through during again further once here there because until against between'.split(' '));
const OVERUSED_TOPICS: [RegExp, string][] = [
  [/\b(mission trip|volunteer(ed)? abroad|service trip)\b/i, 'Service-trip essays are common; they work best when the focus is on a specific, honest change in your thinking rather than on the people you helped.'],
  [/\b(winning|championship|game-winning|the big game|scored the)\b/i, 'Sports-victory/injury essays are common; the strongest ones are about something other than the game itself.'],
  [/\b(covid|pandemic|quarantine|lockdown)\b/i, 'Pandemic essays are very common; the Common App has historically offered a separate space for COVID-related context.'],
];

export interface SentenceNote { index: number; text: string; start: number; issues: string[] }
export interface Edit { id: string; kind: 'grammar' | 'filler' | 'clarity'; start: number; end: number; original: string; replacement: string; reason: string }
export interface Analysis {
  stats: { words: number; chars: number; charsNoSpaces: number; sentences: number; paragraphs: number; avgSentence: number; readingMinutes: number; overLimit: boolean | null };
  scores: Record<RubricKey, number>;
  overall: number;
  strengths: string[];
  weaknesses: string[];
  cliches: { phrase: string; index: number }[];
  generic: { word: string; count: number }[];
  repetition: { word: string; count: number }[];
  repeatedOpeners: { word: string; count: number }[];
  weakTransitions: { phrase: string; index: number }[];
  unclear: { text: string; reason: string }[];
  deepen: string[];
  redFlags: string[];
  suggestions: string[];
  sentences: SentenceNote[];
  edits: Edit[];
  structure: string[];
  brainstorm: string[];
  grammarCount: number;
}

const clamp = (v: number) => Math.max(1, Math.min(10, Math.round(v * 10) / 10));
const countPhrase = (lower: string, p: string) => { let n = 0, i = -1; while ((i = lower.indexOf(p, i + 1)) !== -1) n++; return n; };

export function splitSentences(text: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  const re = /[^.!?\n]+(?:[.!?]+["')\]]*|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    if (!raw.trim()) { if (re.lastIndex === m.index) re.lastIndex++; continue; }
    const lead = raw.length - raw.trimStart().length;
    out.push({ text: raw.trim(), start: m.index + lead });
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

function grammarEdits(text: string): Edit[] {
  const edits: Edit[] = [];
  const push = (re: RegExp, fn: (m: RegExpExecArray) => string | null, reason: string, kind: Edit['kind'] = 'grammar') => {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    while ((m = r.exec(text))) {
      const rep = fn(m);
      if (rep !== null && rep !== m[0]) edits.push({ id: `${kind}-${m.index}-${edits.length}`, kind, start: m.index, end: m.index + m[0].length, original: m[0], replacement: rep, reason });
      if (m[0].length === 0) r.lastIndex++;
    }
  };
  push(/(?<=\S) {2,}(?=\S)/g, () => ' ', 'Extra space between words.');
  push(/(^|[\s"(])i(?=[\s,.!?;:'’])/g, (m) => `${m[1]}I`, 'Capitalize "I".');
  push(/\b(\w+)\s+\1\b/gi, (m) => (/^(that|had|very|no|so|bye)$/i.test(m[1]) ? null : m[1]), 'Repeated word.');
  push(/\balot\b/gi, () => 'a lot', '"alot" should be two words.');
  push(/\b(could|should|would|must) of\b/gi, (m) => `${m[1]} have`, 'Use "have", not "of", after modal verbs.');
  push(/\birregardless\b/gi, () => 'regardless', 'Use "regardless".');
  push(/\b(dont|cant|wont|didnt|doesnt|isnt|wasnt|couldnt|shouldnt|wouldnt|im|ive|youre|theyre|thats|whats|lets)\b/gi, (m) => {
    const map: Record<string, string> = { dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't", wasnt: "wasn't", couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't", im: "I'm", ive: "I've", youre: "you're", theyre: "they're", thats: "that's", whats: "what's", lets: "let's" };
    const low = m[1].toLowerCase();
    if (low === 'lets' || low === 'wont') return null; // ambiguous ("lets" is a verb; "wont" is a word)
    const r = map[low]; return m[1][0] === m[1][0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r;
  }, 'Missing apostrophe in contraction.');
  push(/\b(a) ([aeiou]\w+)/gi, (m) => (/^(uni|use|usu|euro|one|once|ur)/i.test(m[2]) ? null : `${m[1][0] === 'A' ? 'An' : 'an'} ${m[2]}`), 'Use "an" before a vowel sound.');
  push(/\s+([,.;:!?])/g, (m) => m[1], 'No space before punctuation.');
  push(/([,;:])(?=[A-Za-z])/g, (m) => `${m[1]} `, 'Add a space after punctuation.');
  push(/([.!?]) +([a-z])/g, (m) => `${m[1]} ${m[2].toUpperCase()}`, 'Capitalize the start of a sentence.');
  return edits;
}

function fillerEdits(text: string): Edit[] {
  const out: Edit[] = [];
  const re = /\b(very|really|just|truly|basically|actually|literally) (?=\w)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ id: `filler-${m.index}`, kind: 'filler', start: m.index, end: m.index + m[0].length, original: m[0], replacement: '', reason: `"${m[1]}" rarely adds meaning — consider cutting it (or choosing a more precise word yourself).` });
  const wordy: [RegExp, string][] = [[/\bin order to\b/gi, 'to'], [/\bdue to the fact that\b/gi, 'because'], [/\bat this point in time\b/gi, 'now'], [/\bthe fact that\b/gi, 'that'], [/\bin spite of the fact that\b/gi, 'although']];
  for (const [r, rep] of wordy) { let w: RegExpExecArray | null; const rr = new RegExp(r.source, 'gi'); while ((w = rr.exec(text))) out.push({ id: `clarity-${w.index}`, kind: 'clarity', start: w.index, end: w.index + w[0].length, original: w[0], replacement: rep, reason: 'Wordy phrase.' }); }
  return out;
}

export function nonOverlapping(edits: Edit[]) {
  const sorted = [...edits].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Edit[] = []; let lastEnd = -1;
  for (const e of sorted) if (e.start >= lastEnd) { out.push(e); lastEnd = e.end; }
  return out;
}

export function applyEdits(text: string, edits: Edit[]) {
  let out = text;
  for (const e of [...nonOverlapping(edits)].sort((a, b) => b.start - a.start)) {
    if (out.slice(e.start, e.end) !== e.original) continue; // stale
    out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  }
  return out.replace(/ {2,}/g, ' ');
}

export function analyzeEssay(text: string, opts: { prompt?: string; limit?: number | null; type?: string; collegeId?: string } = {}): Analysis {
  const lower = text.toLowerCase();
  const wordsArr = text.match(/[A-Za-z0-9’']+/g) || [];
  const words = wordsArr.length;
  const paragraphs = text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  const sents = splitSentences(text);
  const lens = sents.map((s) => (s.text.match(/[A-Za-z0-9’']+/g) || []).length).filter((n) => n > 0);
  const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const sd = lens.length ? Math.sqrt(lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length) : 0;
  const per100 = (n: number) => (words ? (n / words) * 100 : 0);

  const cliches = CLICHES.flatMap((p) => { const out: { phrase: string; index: number }[] = []; let i = -1; while ((i = lower.indexOf(p, i + 1)) !== -1) out.push({ phrase: p, index: i }); return out; });
  const generic = GENERIC.map((w) => ({ word: w, count: (lower.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length })).filter((g) => g.count > 0).sort((a, b) => b.count - a.count);
  const genericTotal = generic.reduce((a, g) => a + g.count, 0);
  const hedges = HEDGES.reduce((a, h) => a + countPhrase(lower, h), 0);
  const reflectAll = REFLECT.reduce((a, r) => a + countPhrase(lower, r), 0);
  const secondHalf = lower.slice(Math.floor(lower.length / 2));
  const reflectLate = REFLECT.reduce((a, r) => a + countPhrase(secondHalf, r), 0);
  const feelings = FEELINGS.reduce((a, f) => a + (lower.match(new RegExp(`\\b${f}\\w*`, 'g')) || []).length, 0);
  const sensory = SENSORY.reduce((a, f) => a + (lower.match(new RegExp(`\\b${f}\\b`, 'g')) || []).length, 0);
  const numbers = (text.match(/\b\d[\d,.:]*\b/g) || []).length;
  const quotes = (text.match(/["“][^"”]{2,}["”]/g) || []).length;
  const properNouns = sents.reduce((a, s) => a + ((s.text.split(/\s+/).slice(1).join(' ').match(/\b[A-Z][a-z]{2,}/g) || []).filter((w) => !/^I$/.test(w)).length), 0);
  const firstPerson = (lower.match(/\b(i|me|my|mine|myself)\b/g) || []).length;
  const passive = (lower.match(/\b(was|were|is|are|been|being|be)\s+\w+ed\b/g) || []).length;
  const longSents = sents.filter((s) => (s.text.match(/[A-Za-z0-9’']+/g) || []).length > 35);
  const timeMarkers = (lower.match(/\b(when|that morning|that night|yesterday|last (year|summer|week)|at \d|\d (am|pm)|o'clock|minutes|seconds|the day|monday|tuesday|wednesday|thursday|friday|saturday|sunday|summer|winter|spring|fall)\b/g) || []).length;
  const causal = (lower.match(/\b(because|so that|which meant|this is why|that is why|led me|made me|therefore|since then|ever since)\b/g) || []).length;

  const counts: Record<string, number> = {};
  for (const w of wordsArr) { const k = w.toLowerCase().replace(/[’']s$/, ''); if (k.length > 3 && !STOP.has(k)) counts[k] = (counts[k] || 0) + 1; }
  const repetition = Object.entries(counts).filter(([, c]) => c >= Math.max(4, words / 90)).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  const openers: Record<string, number> = {};
  for (const s of sents) { const f = (s.text.match(/^[A-Za-z’']+/) || [''])[0].toLowerCase(); if (f) openers[f] = (openers[f] || 0) + 1; }
  const repeatedOpeners = Object.entries(openers).filter(([, c]) => c >= 3 && c / Math.max(1, sents.length) > 0.2).map(([word, count]) => ({ word, count }));
  const weakTransitions = WEAK_TRANSITIONS.flatMap((p) => sents.filter((s) => s.text.toLowerCase().startsWith(p)).map((s) => ({ phrase: p, index: s.start })));

  const gEdits = grammarEdits(text);
  const fEdits = fillerEdits(text);
  const edits = nonOverlapping([...gEdits, ...fEdits]);

  // Prompt overlap
  let promptOverlap: number | null = null;
  if (opts.prompt && opts.prompt.trim().length > 10) {
    const pw = Array.from(new Set((opts.prompt.toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => !STOP.has(w) && !['essay', 'describe', 'discuss', 'share', 'tell', 'words', 'please', 'response'].includes(w))));
    const hit = pw.filter((w) => lower.includes(w.slice(0, Math.max(4, w.length - 2))));
    promptOverlap = pw.length ? hit.length / pw.length : null;
  }
  const overLimit = opts.limit ? words > opts.limit : null;

  // --- Scores (proxies) ---
  const fpRate = per100(firstPerson);
  const clicheRate = per100(cliches.length) * 10;
  const genericRate = per100(genericTotal);
  const specificity = per100(numbers * 1.2 + quotes * 2 + properNouns + sensory * 1.5);
  const s: Record<RubricKey, number> = {
    Authenticity: clamp(7.5 + Math.min(1.5, fpRate / 4) - clicheRate * 0.8 - genericRate * 0.6),
    'Personal voice': clamp(4 + Math.min(3, sd / 3) + Math.min(2, fpRate / 3) - per100(hedges) * 1.5),
    Specificity: clamp(2 + specificity * 0.9),
    Storytelling: clamp(3 + Math.min(3, per100(timeMarkers) * 1.2) + Math.min(2, quotes) + (sents[0] && !/^(i have always|ever since|throughout my life|in today)/i.test(sents[0].text) ? 1.5 : 0)),
    Reflection: clamp(2 + per100(reflectAll) * 1.4 + per100(reflectLate) * 1.2),
    'Emotional resonance': clamp(3 + Math.min(4, per100(feelings) * 2.5) + Math.min(2, per100(sensory) * 2)),
    Structure: clamp((paragraphs.length >= 3 ? 6 : paragraphs.length === 2 ? 4.5 : 3) + (paragraphs.length >= 3 && Math.max(...paragraphs.map((p) => p.length)) < text.length * 0.6 ? 1.5 : 0) + (weakTransitions.length ? -0.8 * weakTransitions.length : 0.8) + (/in conclusion|to sum up|in summary/i.test(text) ? -1 : 0.7)),
    Clarity: clamp(9 - Math.max(0, avg - 22) * 0.25 - longSents.length * 0.6 - per100(passive) * 0.6 - per100(gEdits.length) * 0.8),
    Originality: clamp(7.5 - clicheRate - OVERUSED_TOPICS.filter(([re]) => re.test(text)).length * 1 + Math.min(1.5, specificity * 0.15)),
    'Prompt fulfillment': promptOverlap === null ? clamp(overLimit ? 5 : 6) : clamp(3 + promptOverlap * 6 - (overLimit ? 2 : 0)),
    Depth: clamp(2.5 + per100(causal) * 2 + per100(reflectAll) * 0.8 + (words > 350 ? 1 : 0)),
    Memorability: clamp(3.5 + Math.min(2.5, specificity * 0.3) + (sents[0] && sents[0].text.length < 140 && !/^(i have always|ever since|webster|throughout)/i.test(sents[0].text) ? 1.5 : 0) + Math.min(1.5, quotes) - clicheRate * 0.5),
  };
  if (words < 120) for (const k of RUBRIC) s[k] = clamp(Math.min(s[k], 5));
  const overall = Math.round((RUBRIC.reduce((a, k) => a + s[k], 0) / RUBRIC.length) * 10) / 10;

  // --- Feedback ---
  const strengths: string[] = [], weaknesses: string[] = [], suggestions: string[] = [], deepen: string[] = [], redFlags: string[] = [], structure: string[] = [];
  if (s.Specificity >= 6.5) strengths.push('Concrete detail: names, numbers, sensory language or dialogue ground the reader in real moments.');
  else weaknesses.push('Few concrete details. Replace general statements with a specific moment only you could describe.');
  if (s.Reflection >= 6) strengths.push('Regular reflection — you explain what experiences meant, not only what happened.');
  else { weaknesses.push('Little reflection. Admissions readers look for how your thinking changed.'); deepen.push('After your most important scene, add 2–3 sentences on what you understood afterwards that you did not before.'); }
  if (sd >= 7) strengths.push('Varied sentence rhythm, which usually reads as a natural voice.');
  else if (lens.length > 5) suggestions.push('Most sentences are a similar length. Mixing short sentences with longer ones gives the essay more rhythm.');
  if (cliches.length) weaknesses.push(`${cliches.length} cliché${cliches.length > 1 ? 's' : ''} detected (e.g. "${cliches[0].phrase}").`);
  else strengths.push('No common clichés detected.');
  if (genericTotal >= words / 60 && words > 100) weaknesses.push('Generic words ("passion", "amazing", "things") appear often; they tell rather than show.');
  if (hedges >= 3) suggestions.push(`Hedging phrases appear ${hedges} times ("I think", "kind of"). Say what you mean directly.`);
  if (longSents.length) suggestions.push(`${longSents.length} sentence${longSents.length > 1 ? 's are' : ' is'} over 35 words — consider splitting.`);
  if (per100(passive) > 2) suggestions.push('Frequent passive voice ("was given", "were taught"). Active voice keeps you as the actor.');
  if (repeatedOpeners.length) suggestions.push(`Many sentences start with "${repeatedOpeners[0].word}". Vary your openings.`);
  if (feelings === 0 && words > 150) deepen.push('You never name a feeling. Where did you feel uncertain, proud, or frustrated? Naming one honestly can make a scene land.');
  if (reflectLate < 2 && words > 200) deepen.push('The second half has little reflection. Endings that look forward (what you do differently now) tend to be stronger than summaries.');
  if (causal < 2 && words > 200) deepen.push('Add "why" — the reasons behind your choices are where your values show.');

  if (paragraphs.length < 3 && words > 250) structure.push('Only one or two paragraphs. Break the essay at shifts in time, place or idea.');
  if (paragraphs.length >= 3) {
    const lensP = paragraphs.map((p) => (p.match(/[A-Za-z0-9’']+/g) || []).length);
    const maxP = Math.max(...lensP);
    if (maxP > words * 0.5) structure.push('One paragraph holds over half the essay. Consider whether it contains two ideas.');
    if (lensP[0] > words * 0.35) structure.push('Your opening paragraph is long. A shorter opening usually pulls readers in faster.');
    const firstReflect = REFLECT.reduce((a, r) => a + countPhrase(paragraphs[0].toLowerCase(), r), 0);
    const lastReflect = REFLECT.reduce((a, r) => a + countPhrase(paragraphs[paragraphs.length - 1].toLowerCase(), r), 0);
    if (firstReflect > lastReflect + 1) structure.push('More reflection appears at the start than the end. Try opening in a scene and saving the insight for later.');
  }
  if (sents[0] && /^(i have always|ever since|throughout my life|in today|webster|according to|hello|my name is)/i.test(sents[0].text)) structure.push('The first sentence uses a common opening. Starting in the middle of a specific moment is often stronger.');
  if (/\b(in conclusion|to sum up|in summary)\b/i.test(text)) structure.push('"In conclusion" signals a school-essay format; personal essays rarely need it.');
  if (weakTransitions.length) structure.push(`${weakTransitions.length} mechanical transition${weakTransitions.length > 1 ? 's' : ''} ("${weakTransitions[0].phrase}"). Let ideas connect through content instead.`);
  if (!structure.length && paragraphs.length >= 3) structure.push('Clear paragraphing and no structural red flags detected.');

  if (overLimit) redFlags.push(`Over the word limit (${words} / ${opts.limit}). Applications usually cut off or reject text beyond the limit.`);
  if (opts.limit && words < opts.limit * 0.5 && opts.limit >= 250) redFlags.push(`Using under half of the ${opts.limit}-word limit — you may be leaving space unused.`);
  if (opts.type === 'Why This College' && opts.collegeId) {
    const target = COLLEGES.find((c) => c.id === opts.collegeId);
    const others = COLLEGES.filter((c) => c.id !== opts.collegeId && (lower.includes(c.short.toLowerCase()) || lower.includes(c.name.toLowerCase())));
    if (others.length) redFlags.push(`Mentions another college (${others.map((o) => o.short).join(', ')}) — make sure you did not reuse an essay written for another school.`);
    if (target && !lower.includes(target.short.toLowerCase()) && !lower.includes(target.name.toLowerCase())) suggestions.push(`The essay never names ${target.short}. "Why us" essays work best with specifics only true of that school (courses, programs, traditions you researched).`);
  }
  if (/\b(damn|hell|shit|fuck|crap)\b/i.test(text)) redFlags.push('Contains profanity. Make sure any use is intentional and in quoted dialogue.');
  if (/\b(drunk|weed|marijuana|vape|vaping|arrested|shoplift)/i.test(text)) redFlags.push('Mentions behavior colleges may view as a disciplinary concern. Discuss with a counselor how (or whether) to include it.');
  for (const [re, msg] of OVERUSED_TOPICS) if (re.test(text)) suggestions.push(msg);
  if (fpRate < 2 && words > 150) redFlags.push('Very little first-person language — the essay may be more about someone else than about you.');

  const unclear = longSents.slice(0, 6).map((x) => ({ text: x.text, reason: 'Long sentence (35+ words).' }));
  const sentences: SentenceNote[] = sents.map((x, i) => {
    const issues: string[] = [];
    const l = x.text.toLowerCase();
    const n = (x.text.match(/[A-Za-z0-9’']+/g) || []).length;
    if (n > 35) issues.push('Long — consider splitting.');
    for (const c of CLICHES) if (l.includes(c)) issues.push(`Cliché: "${c}".`);
    for (const h of HEDGES) if (l.includes(h)) issues.push(`Hedge: "${h}".`);
    if (/\b(was|were|is|are|been|being|be)\s+\w+ed\b/.test(l)) issues.push('Possible passive voice.');
    if (WEAK_TRANSITIONS.some((t) => l.startsWith(t))) issues.push('Mechanical transition.');
    const g = GENERIC.filter((w) => new RegExp(`\\b${w}\\b`).test(l));
    if (g.length) issues.push(`Generic: ${g.slice(0, 3).map((w) => `"${w}"`).join(', ')}.`);
    if (REFLECT.some((r) => l.includes(r))) issues.push('✓ Reflection.');
    if (/\d|["“]/.test(x.text)) issues.push('✓ Concrete detail.');
    return { index: i, text: x.text, start: x.start, issues };
  });

  // Brainstorming: questions built only from what the student wrote. Never invents content.
  const brainstorm: string[] = [];
  const nouns = Array.from(new Set((text.match(/\b(my|our|the) ([a-z]{4,})\b/gi) || []).map((m) => m.split(' ')[1].toLowerCase()).filter((w) => !STOP.has(w)))).slice(0, 5);
  for (const n of nouns) brainstorm.push(`You mention "${n}". What is one specific moment involving it that you remember in detail? What did you see, hear or say?`);
  brainstorm.push('What did you believe before this experience that you no longer believe — or believe differently now?');
  brainstorm.push('What is something about this topic that a friend who knows you well would say, but that you have not written yet?');
  brainstorm.push('What did you do next, after the moment you describe? Actions afterward often show growth better than statements.');
  if (!text.trim()) brainstorm.splice(0, brainstorm.length, 'List five moments from the last three years when you changed your mind about something.', 'Which object in your room would surprise a stranger, and why do you keep it?', 'What do you do when no one is grading you?', 'Describe a problem you keep returning to, even when it is frustrating.', 'Who taught you something without meaning to?');

  return {
    stats: { words, chars: text.length, charsNoSpaces: text.replace(/\s/g, '').length, sentences: sents.length, paragraphs: paragraphs.length, avgSentence: Math.round(avg * 10) / 10, readingMinutes: Math.max(1, Math.round(words / 230)), overLimit },
    scores: s, overall, strengths, weaknesses, cliches, generic, repetition, repeatedOpeners, weakTransitions, unclear, deepen, redFlags, suggestions, sentences, edits, structure, brainstorm,
    grammarCount: gEdits.length,
  };
}

// --- Word-level diff (LCS) for draft comparison ---
export type DiffPart = { type: 'same' | 'add' | 'del'; text: string };
export function diffWords(a: string, b: string): DiffPart[] {
  const A = a.split(/(\s+)/), B = b.split(/(\s+)/);
  const n = A.length, m = B.length;
  if (n * m > 4_000_000) return [{ type: 'del', text: a }, { type: 'add', text: b }];
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (type: DiffPart['type'], text: string) => { const last = out[out.length - 1]; if (last && last.type === type) last.text += text; else out.push({ type, text }); };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { push('same', A[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push('del', A[i]); i++; }
    else { push('add', B[j]); j++; }
  }
  while (i < n) push('del', A[i++]);
  while (j < m) push('add', B[j++]);
  return out;
}

export const MODES = ['Minimal editing', 'Structural feedback', 'Deep critique', 'Grammar only', 'Brainstorming'] as const;
