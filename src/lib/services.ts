// Client for the optional AdmitIQ server (server/server.mjs). Every feature has a
// non-AI / offline fallback, so the app is fully usable when this server is absent
// (e.g. on a static host or inside a sandboxed preview).

export interface ServerCaps {
  ai: { provider: string; model: string; transcribe?: boolean } | null;
  research: { search: string | null; scorecard: boolean };
  supabase: { url: string; anonKey: string } | null;
}

let capsPromise: Promise<ServerCaps | null> | null = null;
export function serverCaps(): Promise<ServerCaps | null> {
  if (!capsPromise) {
    capsPromise = (async () => {
      // Only probe when served by server/server.mjs (it injects this meta tag); static hosts skip the request.
      if (typeof document !== 'undefined' && !document.querySelector('meta[name="admitiq-server"]')) return null;
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 2500);
        const r = await fetch('/api/health', { signal: ctl.signal });
        clearTimeout(t);
        if (!r.ok) return null;
        return (await r.json()) as ServerCaps;
      } catch { return null; }
    })();
  }
  return capsPromise;
}

async function post<T>(path: string, body: unknown, token: string | undefined = session?.access_token): Promise<T> {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `Request failed (${r.status})`);
  return data as T;
}

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export const ai = {
  chat: (messages: ChatMessage[], json = false) => post<{ text: string }>('/api/ai', { messages, json }),
  async essay(text: string, prompt: string, mode: string) {
    const sys = `You are a careful college essay reviewer. Evaluate the student's essay on these 12 criteria, each scored 1-10: Authenticity, Personal voice, Specificity, Storytelling, Reflection, Emotional resonance, Structure, Clarity, Originality, Prompt fulfillment, Depth, Memorability.
Rules: Never rewrite the essay in your own voice. Never invent experiences, awards, hardships or details. Quote the student's own words when pointing at problems. Feedback mode: ${mode}.
Return JSON: {"scores":{criterion:number},"overall":string,"strengths":[string],"weaknesses":[string],"line_feedback":[{"quote":string,"comment":string}],"suggestions":[string]}`;
    const r = await this.chat([{ role: 'system', content: sys }, { role: 'user', content: `PROMPT:\n${prompt || '(not provided)'}\n\nESSAY:\n${text}` }], true);
    return JSON.parse(r.text.replace(/^```json\s*|```$/g, '')) as { scores: Record<string, number>; overall: string; strengths: string[]; weaknesses: string[]; line_feedback: { quote: string; comment: string }[]; suggestions: string[] };
  },
};

export interface ResearchResult {
  question: string;
  steps: { label: string; status: 'done' | 'skipped' | 'error'; detail: string }[];
  findings: { claim: string; value?: string; source: string; url: string; retrieved: string; reportingYear?: string; confidence: 'High' | 'Medium' | 'Low'; official: boolean }[];
  summary: string | null;
  conflicts: string[];
  uncertainty: string[];
}
export const research = {
  ask: (question: string, collegeIds: string[]) => post<ResearchResult>('/api/research', { question, collegeIds }),
  scorecard: (name: string) => post<{ results: Record<string, unknown>[]; retrieved: string; url: string }>('/api/scorecard', { name }),
};

// ---- Supabase (REST, no SDK) ----
const SESSION_KEY = 'admitiq:session';
export interface Session { access_token: string; refresh_token: string; user: { id: string; email: string }; expires_at: number }
let session: Session | null = (() => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } })();
const saveSession = (s: Session | null) => { session = s; try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } };

async function sb(cfg: { url: string; anonKey: string }, path: string, init: RequestInit & { auth?: boolean } = {}) {
  const r = await fetch(`${cfg.url}${path}`, { ...init, headers: { apikey: cfg.anonKey, 'content-type': 'application/json', ...(init.auth && session ? { authorization: `Bearer ${session.access_token}` } : {}), ...(init.headers || {}) } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.msg || data.error_description || data.message || `Supabase error ${r.status}`);
  return data;
}

function decodeJwt(t: string): { sub?: string; email?: string; exp?: number } {
  try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return {}; }
}

// Supabase email links (magic link, signup confirmation, password recovery) return to the app with
// tokens in the URL hash. Capture them before the hash router sees them, then clean the URL.
export function captureAuthRedirect(): { type: string; error?: string } | null {
  if (typeof location === 'undefined') return null;
  const h = location.hash.replace(/^#/, '');
  if (!/(^|&)(access_token|error_description)=/.test(h)) return null;
  const q = new URLSearchParams(h);
  if (q.get('error_description')) { history.replaceState(null, '', location.pathname + '#login'); return { type: 'error', error: q.get('error_description')! }; }
  const access = q.get('access_token')!, claims = decodeJwt(access);
  saveSession({ access_token: access, refresh_token: q.get('refresh_token') || '', expires_at: Number(q.get('expires_at')) || claims.exp || Date.now() / 1000 + Number(q.get('expires_in') || 3600), user: { id: claims.sub || '', email: claims.email || '' } });
  const type = q.get('type') || 'magiclink';
  history.replaceState(null, '', location.pathname + (type === 'recovery' ? '#reset-password' : '#dashboard'));
  try { sessionStorage.setItem('admitiq:justSignedIn', '1'); } catch { /* ignore */ }
  return { type };
}

export const auth = {
  current: () => session,
  async requestPasswordReset(cfg: { url: string; anonKey: string }, email: string) {
    await sb(cfg, `/auth/v1/recover?redirect_to=${encodeURIComponent(location.origin + location.pathname)}`, { method: 'POST', body: JSON.stringify({ email }) });
  },
  async updatePassword(cfg: { url: string; anonKey: string }, password: string) {
    await sb(cfg, '/auth/v1/user', { method: 'PUT', auth: true, body: JSON.stringify({ password }) });
  },
  async deleteAccount(cfg: { url: string; anonKey: string }) {
    await this.refresh(cfg);
    await sb(cfg, '/rest/v1/rpc/delete_my_account', { method: 'POST', auth: true, body: '{}' });
    saveSession(null);
  },
  async signUp(cfg: { url: string; anonKey: string }, email: string, password: string) {
    const d = await sb(cfg, `/auth/v1/signup?redirect_to=${encodeURIComponent(location.origin + location.pathname)}`, { method: 'POST', body: JSON.stringify({ email, password }) });
    if (d.access_token) saveSession({ ...d, expires_at: Date.now() / 1000 + d.expires_in });
    return d.access_token ? 'signed-in' : 'confirm-email';
  },
  async signIn(cfg: { url: string; anonKey: string }, email: string, password: string) {
    const d = await sb(cfg, '/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
    saveSession({ ...d, expires_at: Date.now() / 1000 + d.expires_in });
  },
  async magicLink(cfg: { url: string; anonKey: string }, email: string) {
    await sb(cfg, `/auth/v1/otp?redirect_to=${encodeURIComponent(location.origin + location.pathname)}`, { method: 'POST', body: JSON.stringify({ email, create_user: true }) });
  },
  async refresh(cfg: { url: string; anonKey: string }) {
    if (!session) return;
    if (session.expires_at - 60 > Date.now() / 1000) return;
    const d = await sb(cfg, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) });
    saveSession({ ...d, expires_at: Date.now() / 1000 + d.expires_in });
  },
  async signOut(cfg: { url: string; anonKey: string } | null) {
    try { if (cfg && session) await sb(cfg, '/auth/v1/logout', { method: 'POST', auth: true }); } catch { /* ignore */ }
    saveSession(null);
  },
  // Server-side the RPC functions write to normalized tables under row-level security (see supabase/migrations).
  async push(cfg: { url: string; anonKey: string }, state: unknown) { await this.refresh(cfg); return sb(cfg, '/rest/v1/rpc/sync_state', { method: 'POST', auth: true, body: JSON.stringify({ payload: state }) }); },
  async pull(cfg: { url: string; anonKey: string }) { await this.refresh(cfg); return sb(cfg, '/rest/v1/rpc/load_state', { method: 'POST', auth: true, body: '{}' }); },
  // Anonymous experience submissions: inserted without any user id (the table has none); shown only after moderation.
  async submitExperience(cfg: { url: string; anonKey: string }, e: { collegeId: string; relation: string; year: string; ratings: Record<string, number>; positives: string; concerns: string }) {
    await this.refresh(cfg);
    const r = await fetch(`${cfg.url}/rest/v1/student_experience_submissions`, { method: 'POST', headers: { apikey: cfg.anonKey, authorization: `Bearer ${session?.access_token}`, 'content-type': 'application/json', prefer: 'return=minimal' }, body: JSON.stringify({ college_id: e.collegeId, relation: e.relation, year: Number(e.year) || null, ratings: e.ratings, positives: e.positives, concerns: e.concerns, consent: true }) });
    if (!r.ok) throw new Error(`Could not submit (${r.status})`);
  },
  async approvedExperiences(cfg: { url: string; anonKey: string }, collegeId: string) {
    const r = await fetch(`${cfg.url}/rest/v1/student_experience_submissions?college_id=eq.${encodeURIComponent(collegeId)}&select=id,relation,year,ratings,positives,concerns,created_at&order=created_at.desc&limit=200`, { headers: { apikey: cfg.anonKey } });
    if (!r.ok) return [];
    return (await r.json()) as { id: string; relation: string; year: number | null; ratings: Record<string, number>; positives: string; concerns: string; created_at: string }[];
  },
  async deleteAccountData(cfg: { url: string; anonKey: string }) { await this.refresh(cfg); return sb(cfg, '/rest/v1/rpc/delete_my_data', { method: 'POST', auth: true, body: '{}' }); },
};
