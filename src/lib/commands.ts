// Natural-language commands shared by the voice assistant and the command palette.
import { COLLEGES, type College } from '../data/colleges';
import { store, uid } from './store';
import { findTerm } from './glossary';
import { assess } from './analysis';
import { daysUntil, fmtDate } from './format';

export const PAGES: { id: string; label: string; words: string[] }[] = [
  { id: 'dashboard', label: 'Dashboard', words: ['dashboard', 'home', 'overview'] },
  { id: 'profile', label: 'Profile', words: ['profile', 'my info'] },
  { id: 'profile-transcript', label: 'Transcript', words: ['transcript', 'grades', 'courses', 'classes'] },
  { id: 'profile-activities', label: 'Activities', words: ['activities', 'extracurriculars', 'extracurricular'] },
  { id: 'colleges', label: 'College search', words: ['college search', 'search', 'find colleges', 'colleges'] },
  { id: 'compare', label: 'Compare', words: ['compare', 'comparison'] },
  { id: 'list', label: 'My college list', words: ['my list', 'college list', 'list'] },
  { id: 'analysis', label: 'Admissions analysis', words: ['analysis', 'admissions analysis', 'chances', 'what if', 'simulator'] },
  { id: 'essays', label: 'Essay lab', words: ['essay', 'essays', 'essay lab'] },
  { id: 'interview', label: 'Interview coach', words: ['interview', 'interview coach', 'practice interview', 'mock interview'] },
  { id: 'tracker', label: 'Application tracker', words: ['tracker', 'applications', 'deadlines', 'calendar', 'tasks'] },
  { id: 'strategist', label: 'AI strategist', words: ['strategist', 'counselor', 'chat'] },
  { id: 'costs', label: 'Cost calculator', words: ['cost', 'costs', 'calculator', 'money', 'financial aid', 'aid offers', 'offers'] },
  { id: 'scholarships', label: 'Scholarships', words: ['scholarship', 'scholarships'] },
  { id: 'research', label: 'Research center', words: ['research', 'sources'] },
  { id: 'community', label: 'Student experiences', words: ['student experiences', 'experiences', 'community', 'reviews'] },
  { id: 'glossary', label: 'Glossary', words: ['glossary', 'terms', 'dictionary'] },
  { id: 'preferences', label: 'Settings', words: ['settings', 'preferences'] },
  { id: 'data', label: 'Data & privacy', words: ['data', 'privacy', 'export'] },
];

const ALIASES: Record<string, string[]> = {
  gatech: ['georgia tech', 'georgia institute of technology', 'gt'], umich: ['michigan', 'university of michigan', 'u of m', 'umich', 'u mich'],
  uiuc: ['uiuc', 'illinois', 'urbana champaign', 'u of i'], utaustin: ['ut austin', 'texas', 'university of texas'], osu: ['ohio state', 'osu'],
  psu: ['penn state'], uw: ['university of washington', 'uw seattle', 'udub', 'u dub'], wisc: ['wisconsin', 'uw madison'], cmu: ['carnegie mellon', 'cmu'],
  unc: ['unc', 'chapel hill', 'north carolina'], uva: ['uva', 'university of virginia', 'virginia'], uf: ['university of florida', 'uf', 'florida'],
  bu: ['boston university', 'bu'], nyu: ['nyu', 'new york university'], usc: ['usc', 'southern california'], mit: ['mit', 'm.i.t.', 'massachusetts institute'],
  berkeley: ['berkeley', 'cal', 'uc berkeley'], ucla: ['ucla'], asu: ['arizona state', 'asu'], northeastern: ['northeastern'], purdue: ['purdue'],
  harvard: ['harvard'], stanford: ['stanford'], duke: ['duke'], northwestern: ['northwestern'], vanderbilt: ['vanderbilt', 'vandy'], rice: ['rice'], emory: ['emory'],
  tufts: ['tufts'], rutgers: ['rutgers'], williams: ['williams'], amherst: ['amherst'], pomona: ['pomona'], smc: ['santa monica'], nova: ['nova', 'northern virginia'],
  toronto: ['toronto', 'u of t', 'uoft'], mcgill: ['mcgill'], edinburgh: ['edinburgh'],
};

/** All colleges mentioned in text, in order of appearance (longest alias wins). */
export function collegesIn(text: string): College[] {
  const s = ` ${text.toLowerCase().replace(/[^a-z0-9. ]/g, ' ').replace(/\s+/g, ' ')} `;
  const all: { c: College; at: number; len: number }[] = [];
  for (const c of COLLEGES) {
    for (const n of new Set([...(ALIASES[c.id] || []), c.short.toLowerCase(), c.name.toLowerCase()])) {
      let at = s.indexOf(` ${n} `);
      while (at >= 0) { all.push({ c, at, len: n.length + 1 }); at = s.indexOf(` ${n} `, at + 1); }
    }
  }
  // Longest matches claim their span first, so "northern virginia" doesn't also count as "virginia".
  const taken: { c: College; at: number; len: number }[] = [];
  for (const h of all.sort((a, b) => b.len - a.len)) if (!taken.some((t) => h.at < t.at + t.len && t.at < h.at + h.len)) taken.push(h);
  const seen = new Set<string>();
  return taken.sort((a, b) => a.at - b.at).filter((h) => !seen.has(h.c.id) && seen.add(h.c.id)).map((h) => h.c);
}

function parseDue(text: string, now = new Date()): string {
  const s = text.toLowerCase(); const d = new Date(now);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (/\btoday\b|\btonight\b/.test(s)) return iso(d);
  if (/\btomorrow\b/.test(s)) { d.setDate(d.getDate() + 1); return iso(d); }
  if (/\bnext week\b/.test(s)) { d.setDate(d.getDate() + 7); return iso(d); }
  const inDays = s.match(/\bin (\d+) days?\b/); if (inDays) { d.setDate(d.getDate() + Number(inDays[1])); return iso(d); }
  const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].findIndex((w) => new RegExp(`\\b${w}\\b`).test(s));
  if (wd >= 0) { let diff = (wd - d.getDay() + 7) % 7; if (diff === 0) diff = 7; d.setDate(d.getDate() + diff); return iso(d); }
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const m = s.match(new RegExp(`\\b(${months.join('|')}|${months.map((x) => x.slice(0, 3)).join('|')})\\.? (\\d{1,2})(st|nd|rd|th)?\\b`));
  if (m) { const mi = months.findIndex((x) => x.startsWith(m[1].slice(0, 3))); const t = new Date(now.getFullYear(), mi, Number(m[2])); if (t < now) t.setFullYear(t.getFullYear() + 1); return iso(t); }
  return '';
}

export interface CommandResult { title: string; say: string; route?: string; kind: 'navigate' | 'action' | 'answer' | 'ask' }

export function runCommand(raw: string, nav: (r: string) => void): CommandResult {
  const text = raw.trim().replace(/[.?!]+$/, '');
  const s = text.toLowerCase();
  const st = store.get();
  const cs = collegesIn(text);
  const go = (r: string) => { nav(r); return r; };

  // Compare
  if (/\b(compare|versus|vs)\b/.test(s) && cs.length >= 2) {
    store.set((x) => { x.compare = cs.slice(0, 10).map((c) => c.id); });
    return { kind: 'navigate', route: go('compare'), title: `Comparing ${cs.map((c) => c.short).join(', ')}`, say: `Here's ${cs.map((c) => c.short).join(' versus ')} side by side.` };
  }
  // Add / remove from list
  const addM = /\b(add|put|save)\b.*\b(list|reach|target|likely)\b/.test(s) || (/^add\b/.test(s) && cs.length);
  if (addM && cs.length) {
    const cat = /\breach\b/.test(s) ? 'Reach' : /\btarget\b/.test(s) ? 'Target' : /\blikely|safety\b/.test(s) ? 'Likely' : null;
    const added: string[] = [];
    store.set((x) => { for (const c of cs) if (!x.list.some((l) => l.collegeId === c.id)) { x.list.push({ collegeId: c.id, category: cat || assess(c, x).bucket, favorite: false, notes: '', addedAt: new Date().toISOString() }); added.push(c.short); } });
    return { kind: 'action', title: added.length ? `Added ${added.join(', ')} to your list` : 'Already on your list', say: added.length ? `Done. I added ${added.join(' and ')} to your list${cat ? ` as ${cat}` : ''}.` : `${cs.map((c) => c.short).join(' and ')} ${cs.length > 1 ? 'are' : 'is'} already on your list.` };
  }
  if (/\b(remove|delete|take off|drop)\b/.test(s) && cs.length && /\blist\b/.test(s)) {
    store.set((x) => { x.list = x.list.filter((l) => !cs.some((c) => c.id === l.collegeId)); });
    return { kind: 'action', title: `Removed ${cs.map((c) => c.short).join(', ')}`, say: `Removed ${cs.map((c) => c.short).join(' and ')} from your list.` };
  }
  // Reminders / tasks
  const rem = text.match(/^(?:remind me to|add (?:a )?task(?: to)?|todo|to do)\s+(.+)$/i);
  if (rem) {
    const due = parseDue(rem[1]);
    const title = rem[1].replace(/\b(by|on|before)?\s*(today|tonight|tomorrow|next week|in \d+ days?|(this |next )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(st|nd|rd|th)?)\b/gi, '').trim().replace(/^\w/, (m) => m.toUpperCase());
    store.set((x) => { x.tasks.push({ id: uid(), title: title || rem[1], due, done: false, priority: 'Medium', collegeId: cs[0]?.id || '', reminder: true }); });
    return { kind: 'action', title: `Task added${due ? ` · due ${fmtDate(due)}` : ''}`, say: `Got it. I'll remind you to ${title.toLowerCase()}${due ? ` by ${fmtDate(due)}` : ''}.` };
  }
  // Theme
  if (/\b(dark mode|night mode)\b/.test(s)) { store.set((x) => { x.prefs.theme = 'dark'; }); return { kind: 'action', title: 'Dark mode on', say: 'Dark mode is on.' }; }
  if (/\b(light mode|day mode)\b/.test(s)) { store.set((x) => { x.prefs.theme = 'light'; }); return { kind: 'action', title: 'Light mode on', say: 'Light mode is on.' }; }
  // Deadlines
  if (/\b(next|upcoming)\b.*\bdeadlines?\b|\bwhat'?s due\b|\bwhen is .*due\b/.test(s)) {
    const up = st.apps.filter((a) => a.deadline && daysUntil(a.deadline) >= 0 && !['Submitted', 'Accepted', 'Rejected', 'Waitlisted', 'Deferred'].includes(a.status)).sort((a, b) => a.deadline.localeCompare(b.deadline));
    const scoped = cs.length ? up.filter((a) => cs.some((c) => c.id === a.collegeId)) : up;
    if (!scoped.length) return { kind: 'answer', title: 'No upcoming deadlines', say: 'You have no upcoming application deadlines in your tracker.' };
    const list = scoped.slice(0, 3).map((a) => `${COLLEGES.find((c) => c.id === a.collegeId)?.short} ${a.round} on ${fmtDate(a.deadline)}, in ${daysUntil(a.deadline)} days`);
    return { kind: 'answer', title: 'Upcoming deadlines', say: `Your next deadline${list.length > 1 ? 's are' : ' is'}: ${list.join('; ')}.` };
  }
  // Glossary
  const def = s.match(/^(?:what(?:'s| is| does)|define|explain|meaning of)\s+(?:an? |the )?(.+?)(?:\s+mean)?$/);
  if (def) { const t = findTerm(def[1]); if (t) return { kind: 'answer', title: t.term, say: `${t.term}: ${t.short}${t.detail ? ` ${t.detail}` : ''}` }; }
  // Essays
  if (/\b(new|start|write)\b.*\bessay\b/.test(s)) { try { sessionStorage.setItem('admitiq:newEssay', '1'); } catch { /* ignore */ } return { kind: 'navigate', route: go('essays'), title: 'New essay', say: 'Opening a new essay.' }; }
  if (/\bread\b.*\bessay\b/.test(s)) { try { sessionStorage.setItem('admitiq:readEssay', '1'); } catch { /* ignore */ } return { kind: 'navigate', route: go('essays'), title: 'Reading your essay', say: '' }; }
  if (/\b(practice|mock|start)\b.*\binterview\b/.test(s)) { if (cs[0]) try { sessionStorage.setItem('admitiq:interviewCollege', cs[0].id); } catch { /* ignore */ } return { kind: 'navigate', route: go('interview'), title: 'Interview coach', say: `Let's practice${cs[0] ? ` for ${cs[0].short}` : ''}.` }; }
  // Search
  const find = s.match(/^(?:find|search(?: for)?|look up|show me)\s+(.+)$/);
  if (find && !cs.length && !PAGES.some((p) => p.words.includes(find[1]))) { try { sessionStorage.setItem('admitiq:searchQ', find[1]); } catch { /* ignore */ } return { kind: 'navigate', route: go('colleges'), title: `Searching "${find[1]}"`, say: `Searching for ${find[1]}.` }; }
  // Open a college
  if (cs.length === 1 && (/^(open|show|go to|tell me about|pull up)\b/.test(s) || s.split(' ').length <= 4)) {
    return { kind: 'navigate', route: go(`college-${cs[0].id}`), title: cs[0].name, say: `Here's ${cs[0].short}.` };
  }
  // Navigate to a page
  const page = PAGES.map((p) => ({ p, w: p.words.filter((w) => new RegExp(`\\b${w}\\b`).test(s)).sort((a, b) => b.length - a.length)[0] })).filter((x) => x.w).sort((a, b) => b.w!.length - a.w!.length)[0];
  if (page && (/^(open|go to|show|take me to|navigate to)\b/.test(s) || s.split(' ').length <= 3)) return { kind: 'navigate', route: go(page.p.id), title: page.p.label, say: `Opening ${page.p.label}.` };
  // Everything else: ask the strategist
  try { sessionStorage.setItem('admitiq:ask', text); } catch { /* ignore */ }
  setTimeout(() => window.dispatchEvent(new Event('admitiq:ask')), 0); // delivers it if the strategist is already open
  return { kind: 'ask', route: go('strategist'), title: 'Asking the strategist', say: '' };
}
