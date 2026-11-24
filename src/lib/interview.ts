import { analyzeSpeech } from './voice';
import type { College } from '../data/colleges';

export type QKind = 'intro' | 'why' | 'major' | 'activity' | 'story' | 'curiosity' | 'fun' | 'future' | 'closing';
export interface Question { id: string; kind: QKind; text: (c: College | null) => string; tip: string }

// Common alumni / admissions interview questions (general practice — not any college's official list).
export const QUESTIONS: Question[] = [
  { id: 'q1', kind: 'intro', text: () => 'Tell me about yourself.', tip: 'Pick two or three things that genuinely define you and connect them — not a résumé readout. Aim for about a minute.' },
  { id: 'q2', kind: 'why', text: (c) => `Why are you interested in ${c ? c.short : 'this college'}?`, tip: 'Name specifics only true of this school — a program, course, research opportunity or tradition — and link each to you.' },
  { id: 'q3', kind: 'major', text: () => 'What do you want to study, and why?', tip: 'It is fine to be undecided. Show the curiosity behind your interests with a concrete moment.' },
  { id: 'q4', kind: 'activity', text: () => 'Tell me about an activity that matters to you.', tip: 'Go deeper than the title: what you actually do, a specific moment, and why it matters to you.' },
  { id: 'q5', kind: 'story', text: () => 'Describe a challenge you faced and how you handled it.', tip: 'Use a simple structure: the situation, what you did, the result, and what you learned.' },
  { id: 'q6', kind: 'curiosity', text: () => "What's something you've learned recently outside of class?", tip: 'Show genuine curiosity. Specific beats impressive.' },
  { id: 'q7', kind: 'why', text: (c) => `How would you contribute to the ${c ? c.short : 'campus'} community?`, tip: 'Connect something you already do to a specific part of campus life.' },
  { id: 'q8', kind: 'story', text: () => 'Tell me about a time you worked with people who disagreed with you.', tip: 'Situation, what you did, result. Show that you listened, not just that you won.' },
  { id: 'q9', kind: 'fun', text: () => 'What do you do for fun?', tip: 'Be yourself. A specific, honest answer is more memorable than an "impressive" one.' },
  { id: 'q10', kind: 'story', text: () => 'Who has influenced you the most, and how?', tip: 'Keep the focus on how they changed what you do or think.' },
  { id: 'q11', kind: 'future', text: () => 'Where do you see yourself after college?', tip: 'You do not need a fixed plan — explain the direction and why it pulls you.' },
  { id: 'q12', kind: 'closing', text: (c) => `What questions do you have for me about ${c ? c.short : 'the college'}?`, tip: 'Always have one or two genuine questions — ideally about the interviewer\'s own experience.' },
];

export function pickQuestions(n: number) {
  const fixed = [QUESTIONS[0], QUESTIONS[1]];
  const middle = QUESTIONS.slice(2, 11).sort(() => Math.random() - 0.5).slice(0, Math.max(0, n - 3));
  return [...fixed, ...middle, QUESTIONS[11]].slice(0, n);
}

export interface AnswerFeedback { score: number; stats: ReturnType<typeof analyzeSpeech>; good: string[]; improve: string[] }

export function scoreAnswer(q: Question, transcript: string, seconds: number, college: College | null, typed: boolean): AnswerFeedback {
  const st = analyzeSpeech(transcript, seconds);
  const good: string[] = [], improve: string[] = [];
  let score = 6;
  const l = transcript.toLowerCase();
  if (!st.words) return { score: 0, stats: st, good, improve: ['No answer recorded.'] };
  // Length: most answers land best at ~45–120 seconds (~100–300 words); closing questions are shorter.
  const lo = q.kind === 'closing' ? 15 : 60, hi = q.kind === 'closing' ? 120 : 330;
  if (st.words < lo) { score -= 2; improve.push(`Short (${st.words} words). Add a specific example to develop the answer.`); }
  else if (st.words > hi) { score -= 1; improve.push(`Long (${st.words} words). Interviewers appreciate answers under about two minutes — trim to your strongest example.`); }
  else { score += 1; good.push('Good length.'); }
  if (!typed && st.wpm) {
    if (st.wpm > 175) { score -= 1; improve.push(`Fast pace (${st.wpm} words/min). Slow down slightly — around 130–160 sounds confident.`); }
    else if (st.wpm < 105) { improve.push(`Slow pace (${st.wpm} words/min) — or long pauses. A little preparation on your key points helps.`); }
    else good.push(`Comfortable pace (${st.wpm} words/min).`);
  }
  if (st.fillerRate > 0.05) { score -= 2; improve.push(`${st.fillerCount} filler words (${st.fillers.map((f) => `"${f.f}" ×${f.n}`).join(', ')}). Pausing silently sounds more confident than "um".`); }
  else if (st.fillerRate > 0.025) { score -= 1; improve.push(`Some filler words (${st.fillers.map((f) => `"${f.f}" ×${f.n}`).join(', ')}).`); }
  else if (!typed) good.push('Very few filler words.');
  if (st.specifics >= 2) { score += 1; good.push('Concrete details (names, numbers, places).'); } else improve.push('Add a concrete detail — a name, number, place or moment — so the answer is memorable.');
  if (q.kind === 'why' && college) {
    if (l.includes(college.short.toLowerCase()) || l.includes(college.name.toLowerCase().split(' ').slice(-1)[0])) good.push(`Mentions ${college.short} by name.`);
    const spec = college.features.concat(college.majors).some((f) => l.includes(f.toLowerCase().split(' ')[0]));
    if (!spec) { score -= 1; improve.push(`Name something specific to ${college.short} (a program, course or opportunity you researched).`); } else { score += 1; good.push('References something specific to the school.'); }
  }
  if (q.kind === 'story') {
    const action = /\bi (decided|started|asked|talked|tried|built|organized|led|reached out|changed|helped|learned)\b/.test(l);
    const result = /\b(as a result|in the end|eventually|ended up|now|since then|which meant|so that|learned|realized)\b/.test(l);
    if (action && result) { score += 1; good.push('Clear structure: what you did and what came of it.'); }
    else improve.push(!action ? 'Say clearly what *you* did (I decided… I asked…).' : 'Finish with the result and what you learned.');
  }
  if (q.kind === 'closing') { if (/\?|\b(what|how|why|do you|did you)\b/.test(l)) good.push('You asked a real question.'); else { score -= 2; improve.push('Ask at least one genuine question — "Nothing, thanks" can read as low interest.'); } }
  if (/\b(i don't know|not sure|i guess)\b/.test(l) && q.kind !== 'closing') improve.push('Hedging ("I guess", "not sure") weakens answers — it\'s fine to take a second to think first.');
  return { score: Math.max(1, Math.min(10, score)), stats: st, good, improve };
}
