#!/usr/bin/env node
// AdmitIQ server — zero dependencies (Node 18+).
//  • Serves the built app from ./dist with security headers
//  • /api/health      capability report (which optional services are configured)
//  • /api/ai          provider-agnostic LLM proxy (keys stay server-side)
//  • /api/scorecard   U.S. Dept. of Education College Scorecard lookup
//  • /api/research    multi-step research: Scorecard + optional search API + robots-aware fetch + cited summary
// Every external service is optional. Without any keys, the app still works fully in local mode.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(root, '.env'));
const env = process.env;
const PORT = Number(env.PORT || 8787);
const DIST = path.join(root, 'dist');
const UA = 'AdmitIQ-Research/1.0 (+https://github.com/; contact: set ADMITIQ_CONTACT)';

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---------------- AI providers ----------------
// AI_PROVIDER: openai | anthropic | groq | openrouter | gemini | ollama | openai-compatible | none
const PROVIDERS = {
  openai: { base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', kind: 'openai' },
  // Default models are only a starting point: if a provider retires one, the server asks the provider's
  // /models endpoint and picks the best available match from `prefer` (set AI_MODEL to pin a model).
  groq: { base: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', kind: 'openai', prefer: [/gpt-oss-120b/, /llama-3\.3-70b/, /llama-4/, /qwen/, /gpt-oss/, /llama/] },
  openrouter: { base: 'https://openrouter.ai/api/v1', model: 'openai/gpt-oss-120b:free', kind: 'openai', prefer: [/:free$/] },
  gemini: { base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', kind: 'openai', prefer: [/^(models\/)?gemini-[\d.]+-flash$/, /^(models\/)?gemini-[\d.]+-flash-lite$/, /flash(?!.*(image|tts|live|preview|exp))/] },
  ollama: { base: 'http://127.0.0.1:11434/v1', model: 'llama3.1', kind: 'openai', keyless: true, prefer: [/./] },
  'openai-compatible': { base: '', model: '', kind: 'openai' },
  anthropic: { base: 'https://api.anthropic.com/v1', model: 'claude-haiku-4-5', kind: 'anthropic' },
};
function aiConfig() {
  const name = (env.AI_PROVIDER || 'none').toLowerCase();
  const p = PROVIDERS[name];
  if (!p) return null;
  const base = env.AI_BASE_URL || p.base, model = env.AI_MODEL || p.model, key = env.AI_API_KEY || '';
  if (!base || !model || (!key && !p.keyless)) return null;
  return { name, base: base.replace(/\/$/, ''), model: resolvedModel || model, pinned: !!env.AI_MODEL, key, kind: p.kind, prefer: p.prefer || [] };
}
let resolvedModel = null;

// Ask the provider which models exist and pick the best match (used when the default model is gone).
async function discoverModel(cfg) {
  const r = await fetch(`${cfg.base}/models`, { signal: AbortSignal.timeout(15_000), headers: cfg.key ? { authorization: `Bearer ${cfg.key}` } : {} });
  const d = await r.json().catch(() => ({}));
  const ids = (d.data || d.models || []).map((m) => String(m.id || m.name || '')).filter(Boolean).sort().reverse(); // newest versions first
  for (const re of cfg.prefer) { const hit = ids.find((id) => re.test(id)); if (hit) return hit.replace(/^models\//, ''); }
  return null;
}

async function callAI(messages, { json = false, maxTokens = 1400 } = {}) {
  const cfg = aiConfig();
  if (!cfg) throw httpError(503, 'No AI provider is configured on this server.');
  const ctl = AbortSignal.timeout(60_000);
  if (cfg.kind === 'anthropic') {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const rest = messages.filter((m) => m.role !== 'system');
    const r = await fetch(`${cfg.base}/messages`, { method: 'POST', signal: ctl, headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system: system + (json ? '\n\nRespond with a single JSON object only.' : ''), messages: rest }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw httpError(502, `AI provider error: ${d?.error?.message || r.status}`);
    return d.content?.map((c) => c.text || '').join('') || '';
  }
  const call = async (model, withFormat) => {
    const msgs = json && !withFormat ? [...messages.slice(0, -1), { ...messages[messages.length - 1], content: messages[messages.length - 1].content + '\n\nRespond with a single JSON object only, no markdown.' }] : messages;
    const r = await fetch(`${cfg.base}/chat/completions`, { method: 'POST', signal: ctl, headers: { 'content-type': 'application/json', ...(cfg.key ? { authorization: `Bearer ${cfg.key}` } : {}) }, body: JSON.stringify({ model, messages: msgs, temperature: 0.3, max_tokens: maxTokens, ...(json && withFormat ? { response_format: { type: 'json_object' } } : {}) }) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, d, msg: String(d?.error?.message || d?.[0]?.error?.message || r.status) };
  };
  let res = await call(cfg.model, json);
  if (!res.ok && json && /response_format|json/i.test(res.msg)) res = await call(cfg.model, false);
  if (!res.ok && !cfg.pinned && (res.status === 404 || /model|not found|decommission|deprecat|does not exist/i.test(res.msg))) {
    const m = await discoverModel(cfg).catch(() => null);
    if (m && m !== cfg.model) { console.log(`[admitiq] model "${cfg.model}" unavailable — switching to "${m}"`); resolvedModel = m; res = await call(m, json); if (!res.ok && json) res = await call(m, false); }
  }
  if (!res.ok) throw httpError(502, `AI provider error: ${res.msg}`);
  const text = res.d.choices?.[0]?.message?.content || '';
  return text.replace(/^\s*<think>[\s\S]*?<\/think>\s*/, ''); // strip reasoning traces some open models emit
}

// ---------------- Speech-to-text (Whisper via the configured provider) ----------------
// Used by browsers without built-in speech recognition. Groq and OpenAI expose /audio/transcriptions.
const TRANSCRIBE = { groq: 'whisper-large-v3-turbo', openai: 'gpt-4o-mini-transcribe', 'openai-compatible': 'whisper-1' };
function transcribeConfig() {
  const cfg = aiConfig();
  if (!cfg || !(cfg.name in TRANSCRIBE)) return null;
  return { ...cfg, model: env.AI_TRANSCRIBE_MODEL || TRANSCRIBE[cfg.name] };
}
async function readRaw(req, limit) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw httpError(413, 'Recording too long (max ~10 MB). Keep answers under a few minutes.'); chunks.push(c); }
  return Buffer.concat(chunks);
}
async function transcribeAudio(buf, mime) {
  const cfg = transcribeConfig();
  if (!cfg) throw httpError(503, 'Server-side transcription needs AI_PROVIDER=groq or openai.');
  const ext = /mp4|m4a|aac/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm';
  const send = async (model) => {
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: mime }), `speech.${ext}`);
    fd.append('model', model); fd.append('response_format', 'json');
    const r = await fetch(`${cfg.base}/audio/transcriptions`, { method: 'POST', signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${cfg.key}` }, body: fd });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, d, msg: String(d?.error?.message || r.status) };
  };
  let res = await send(cfg.model);
  if (!res.ok && !env.AI_TRANSCRIBE_MODEL && (res.status === 404 || /model/i.test(res.msg))) {
    const ids = await fetch(`${cfg.base}/models`, { headers: { authorization: `Bearer ${cfg.key}` } }).then((r) => r.json()).then((d) => (d.data || []).map((m) => m.id)).catch(() => []);
    const alt = ids.filter((id) => /whisper|transcribe/i.test(id)).sort().reverse()[0];
    if (alt) res = await send(alt);
  }
  if (!res.ok) throw httpError(502, `Transcription error: ${res.msg}`);
  return String(res.d.text || '');
}

// ---------------- College Scorecard ----------------
const SC_FIELDS = {
  id: 'id', name: 'school.name', city: 'school.city', state: 'school.state', url: 'school.school_url', npc: 'school.price_calculator_url',
  admit: 'latest.admissions.admission_rate.overall',
  satRW25: 'latest.admissions.sat_scores.25th_percentile.critical_reading', satRW75: 'latest.admissions.sat_scores.75th_percentile.critical_reading',
  satM25: 'latest.admissions.sat_scores.25th_percentile.math', satM75: 'latest.admissions.sat_scores.75th_percentile.math',
  act25: 'latest.admissions.act_scores.25th_percentile.cumulative', act75: 'latest.admissions.act_scores.75th_percentile.cumulative',
  tuitionIn: 'latest.cost.tuition.in_state', tuitionOut: 'latest.cost.tuition.out_of_state', coa: 'latest.cost.attendance.academic_year',
  netPrice: 'latest.cost.avg_net_price.overall',
  grad: 'latest.completion.completion_rate_4yr_150nt', retention: 'latest.student.retention_rate.four_year.full_time',
  earnings: 'latest.earnings.10_yrs_after_entry.median', debt: 'latest.aid.median_debt.completers.overall', size: 'latest.student.size',
};
async function scorecard(params) {
  if (!env.SCORECARD_API_KEY) throw httpError(503, 'College Scorecard is not configured (set SCORECARD_API_KEY — free at api.data.gov/signup).');
  const q = new URLSearchParams({ api_key: env.SCORECARD_API_KEY, fields: Object.values(SC_FIELDS).join(','), per_page: '5', ...params });
  const url = `https://api.data.gov/ed/collegescorecard/v1/schools?${q}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'user-agent': UA } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw httpError(502, `College Scorecard error ${r.status}: ${d?.error?.message || ''}`);
  const results = (d.results || []).map((row) => Object.fromEntries(Object.entries(SC_FIELDS).map(([k, f]) => [k, row[f] ?? null])));
  return { results, retrieved: new Date().toISOString().slice(0, 10), url: url.replace(env.SCORECARD_API_KEY, 'API_KEY') };
}

// ---------------- Web search (optional, bring your own key) ----------------
const OFFICIAL = /\.(edu|gov)(\/|$)|collegescorecard\.ed\.gov|nces\.ed\.gov|studentaid\.gov/i;
async function webSearch(query) {
  const provider = (env.SEARCH_PROVIDER || '').toLowerCase();
  if (provider === 'tavily' && env.SEARCH_API_KEY) {
    const r = await fetch('https://api.tavily.com/search', { method: 'POST', signal: AbortSignal.timeout(20_000), headers: { 'content-type': 'application/json', authorization: `Bearer ${env.SEARCH_API_KEY}` }, body: JSON.stringify({ query, max_results: 6, search_depth: 'basic' }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw httpError(502, `Search error ${r.status}`);
    return (d.results || []).map((x) => ({ title: x.title, url: x.url, snippet: x.content || '' }));
  }
  if (provider === 'brave' && env.SEARCH_API_KEY) {
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({ q: query, count: '6' })}`, { signal: AbortSignal.timeout(20_000), headers: { accept: 'application/json', 'x-subscription-token': env.SEARCH_API_KEY } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw httpError(502, `Search error ${r.status}`);
    return (d.web?.results || []).map((x) => ({ title: x.title, url: x.url, snippet: (x.description || '').replace(/<[^>]+>/g, '') }));
  }
  return null;
}

// robots.txt-aware page fetch with a per-host rate limit
const robotsCache = new Map(); const hostLast = new Map();
async function allowedByRobots(u) {
  const { origin, pathname } = new URL(u);
  if (!robotsCache.has(origin)) {
    let rules = [];
    try {
      const r = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': UA } });
      if (r.ok) {
        let applies = false;
        for (const raw of (await r.text()).split('\n')) {
          const line = raw.split('#')[0].trim(); const [k, ...v] = line.split(':'); const val = v.join(':').trim();
          if (/^user-agent$/i.test(k)) applies = val === '*' || /admitiq/i.test(val);
          else if (applies && /^disallow$/i.test(k) && val) rules.push(val);
        }
      }
    } catch { /* no robots.txt reachable: treat as allowed */ }
    robotsCache.set(origin, rules);
  }
  return !robotsCache.get(origin).some((p) => pathname.startsWith(p));
}
async function politeFetchText(u) {
  if (!(await allowedByRobots(u))) return { skipped: 'Disallowed by robots.txt' };
  const host = new URL(u).host; const wait = 1500 - (Date.now() - (hostLast.get(host) || 0));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  hostLast.set(host, Date.now());
  const r = await fetch(u, { signal: AbortSignal.timeout(15_000), headers: { 'user-agent': UA, accept: 'text/html,text/plain' }, redirect: 'follow' });
  if (!r.ok) return { skipped: `HTTP ${r.status}` };
  const ct = r.headers.get('content-type') || '';
  if (!/text\/html|text\/plain/.test(ct)) return { skipped: `Unsupported content type (${ct.split(';')[0]})` };
  const html = (await r.text()).slice(0, 600_000);
  if (/paywall|subscribe to (read|continue)|sign in to continue/i.test(html.slice(0, 20000))) return { skipped: 'Looks paywalled or login-restricted — skipped' };
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  return { text: text.slice(0, 6000) };
}

async function doResearch({ question, collegeIds = [] }, bundled) {
  const steps = []; const findings = []; const conflicts = []; const uncertainty = [];
  const today = new Date().toISOString().slice(0, 10);
  const push = (label, status, detail) => steps.push({ label, status, detail });
  if (!question || typeof question !== 'string' || question.length > 500) throw httpError(400, 'Ask a question under 500 characters.');
  const colleges = collegeIds.map((id) => bundled.find((c) => c.id === id)).filter(Boolean).slice(0, 4);
  push('Identifying the question', 'done', colleges.length ? `Colleges: ${colleges.map((c) => c.short).join(', ')}` : 'No specific college — general question');

  // 1) Official federal data
  if (env.SCORECARD_API_KEY && colleges.length) {
    for (const c of colleges) {
      try {
        const r = await scorecard(c.scorecardId ? { id: c.scorecardId } : { 'school.name': c.name });
        const row = r.results[0];
        if (!row) { push(`College Scorecard: ${c.short}`, 'error', 'No match'); continue; }
        const src = { source: 'College Scorecard (U.S. Dept. of Education)', url: `https://collegescorecard.ed.gov/school/?${row.id}`, retrieved: r.retrieved, reportingYear: 'latest release', confidence: 'High', official: true };
        const add = (claim, v, fmt) => { if (v !== null && v !== undefined) findings.push({ claim: `${c.short}: ${claim}`, value: fmt(v), ...src }); };
        const p = (v) => `${(v * 100).toFixed(1)}%`, $ = (v) => `$${Math.round(v).toLocaleString('en-US')}`;
        add('Admission rate', row.admit, p); add('6-year completion rate', row.grad, p); add('Full-time retention', row.retention, p);
        add('In-state tuition & fees', row.tuitionIn, $); add('Out-of-state tuition & fees', row.tuitionOut, $); add('Cost of attendance', row.coa, $);
        add('Average net price', row.netPrice, $); add('Median earnings 10 yrs after entry', row.earnings, $); add('Median debt (completers)', row.debt, $);
        if (row.satRW25 && row.satM25) add('SAT middle 50% (sum of section 25th/75th — approximate)', [row.satRW25 + row.satM25, row.satRW75 + row.satM75], (v) => `${v[0]}–${v[1]}`);
        if (row.npc) findings.push({ claim: `${c.short}: Official net price calculator`, value: row.npc, ...src });
        // Cross-check against bundled (unverified) values
        if (row.admit !== null && c.admit !== null && Math.abs(row.admit - c.admit) > 0.02) conflicts.push(`${c.short} admit rate: Scorecard ${p(row.admit)} vs bundled estimate ${p(c.admit)}. Official value preferred; bundled data may be from a different year.`);
        if (row.grad !== null && c.grad !== null && Math.abs(row.grad - c.grad) > 0.02) conflicts.push(`${c.short} graduation rate: Scorecard ${p(row.grad)} vs bundled ${p(c.grad)}.`);
        push(`College Scorecard: ${c.short}`, 'done', `Retrieved ${r.retrieved}`);
      } catch (e) { push(`College Scorecard: ${c.short}`, 'error', e.message); }
    }
  } else push('College Scorecard', 'skipped', env.SCORECARD_API_KEY ? 'No college specified' : 'Not configured');

  // 2) Web search, official domains first
  let results = null;
  try { results = await webSearch(`${question} ${colleges.map((c) => c.name).join(' ')}`.trim()); } catch (e) { push('Web search', 'error', e.message); }
  if (results) {
    results.sort((a, b) => Number(OFFICIAL.test(b.url)) - Number(OFFICIAL.test(a.url)));
    push('Web search', 'done', `${results.length} results (${results.filter((r) => OFFICIAL.test(r.url)).length} official)`);
    const pages = [];
    for (const r of results.filter((x) => OFFICIAL.test(x.url)).slice(0, 2)) {
      const got = await politeFetchText(r.url).catch((e) => ({ skipped: e.message }));
      if (got.text) pages.push({ ...r, text: got.text }); else uncertainty.push(`Skipped ${new URL(r.url).host}: ${got.skipped}.`);
    }
    push('Retrieving official pages (robots.txt respected)', 'done', `${pages.length} page(s) read`);
    for (const r of results) findings.push({ claim: r.title, value: r.snippet.slice(0, 160), source: new URL(r.url).host, url: r.url, retrieved: today, confidence: OFFICIAL.test(r.url) ? 'Medium' : 'Low', official: OFFICIAL.test(r.url) });
    results._pages = pages;
  } else if (!steps.some((s) => s.label === 'Web search')) push('Web search', 'skipped', 'No search API configured');

  // 3) Optional cited summary
  let summary = null;
  if (aiConfig() && findings.length) {
    try {
      const ctx = findings.map((f, i) => `[${i + 1}] ${f.claim}: ${f.value || ''} (${f.source}, ${f.url}, retrieved ${f.retrieved})`).join('\n') + (results?._pages?.length ? '\n\nPAGE EXCERPTS:\n' + results._pages.map((p) => `${p.url}\n${p.text.slice(0, 2500)}`).join('\n\n') : '');
      summary = await callAI([{ role: 'system', content: 'Summarize ONLY what the numbered sources say, citing them like [1]. Prefer official sources. If sources conflict or do not answer the question, say so explicitly. Never add facts not present in the sources.' }, { role: 'user', content: `Question: ${question}\n\nSources:\n${ctx}` }], { maxTokens: 700 });
      push('Summarizing with citations', 'done', aiConfig().model);
    } catch (e) { push('Summarizing with citations', 'error', e.message); }
  }
  if (!findings.length) uncertainty.push('No sources were retrieved, so no answer is given. AdmitIQ does not fill gaps with guesses.');
  if (findings.some((f) => !f.official)) uncertainty.push('Non-official results are shown for context only and were not used to override official figures.');
  return { question, steps, findings, summary, conflicts, uncertainty };
}

// ---------------- HTTP plumbing ----------------
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
const buckets = new Map();
function rateLimit(ip, cost = 1, perMin = Number(env.RATE_LIMIT_PER_MIN || 20)) {
  const now = Date.now(); const b = buckets.get(ip) || { t: now, tokens: perMin };
  b.tokens = Math.min(perMin, b.tokens + ((now - b.t) / 60000) * perMin); b.t = now;
  if (b.tokens < cost) throw httpError(429, 'Too many requests — please wait a minute.');
  b.tokens -= cost; buckets.set(ip, b);
}
async function readJSON(req, limit = 200_000) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw httpError(413, 'Request too large'); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw httpError(400, 'Invalid JSON'); }
}
// Optional: require a signed-in Supabase user for AI/research endpoints (prevents anonymous use of your keys).
async function requireUser(req) {
  if (env.REQUIRE_AUTH !== 'true') return;
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token || !env.SUPABASE_URL) throw httpError(401, 'Sign in to use AI and research features.');
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY || '' } });
  if (!r.ok) throw httpError(401, 'Your session has expired. Sign in again.');
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': ["default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src https://fonts.gstatic.com", "img-src 'self' data: blob:", `connect-src 'self' ${env.SUPABASE_URL || ''}`.trim(), "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"].join('; '),
};
function send(res, status, body, headers = {}) { res.writeHead(status, { ...SECURITY_HEADERS, ...headers }); res.end(body); }
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'content-type': 'application/json', 'cache-control': 'no-store' });

let bundledColleges = [];
try { bundledColleges = JSON.parse(fs.readFileSync(path.join(DIST, 'colleges.json'), 'utf8')); } catch { /* built by build script */ }

const server = http.createServer(async (req, res) => {
  const ip = (env.TRUST_PROXY === 'true' && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'local';
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/health') {
      const ai = aiConfig();
      return json(res, 200, { ai: ai ? { provider: ai.name, model: ai.model, transcribe: !!transcribeConfig() } : null, research: { search: env.SEARCH_PROVIDER && env.SEARCH_API_KEY ? env.SEARCH_PROVIDER : null, scorecard: !!env.SCORECARD_API_KEY }, supabase: env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? { url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY } : null });
    }
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'POST') throw httpError(405, 'Use POST');
      if (url.pathname === '/api/transcribe') {
        await requireUser(req);
        rateLimit(ip, 2);
        const mime = String(req.headers['content-type'] || 'audio/webm').split(';')[0];
        if (!/^audio\//.test(mime)) throw httpError(415, 'Send audio (audio/webm, audio/mp4, audio/ogg or audio/wav).');
        const buf = await readRaw(req, 10_000_000);
        return json(res, 200, { text: await transcribeAudio(buf, mime) });
      }
      const body = await readJSON(req);
      await requireUser(req);
      if (url.pathname === '/api/ai') {
        rateLimit(ip);
        if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 20) throw httpError(400, 'messages must be a non-empty array (max 20)');
        const msgs = body.messages.map((m) => ({ role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user', content: String(m.content || '').slice(0, 24000) }));
        return json(res, 200, { text: await callAI(msgs, { json: !!body.json }) });
      }
      if (url.pathname === '/api/scorecard') {
        rateLimit(ip);
        if (!body.name || String(body.name).length > 120) throw httpError(400, 'name is required');
        return json(res, 200, await scorecard({ 'school.name': String(body.name) }));
      }
      if (url.pathname === '/api/research') {
        rateLimit(ip, 3);
        return json(res, 200, await doResearch(body, bundledColleges));
      }
      throw httpError(404, 'Unknown API route');
    }
    // Static files
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    const file = path.normalize(path.join(DIST, p));
    if (!file.startsWith(DIST)) throw httpError(403, 'Forbidden');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Not found', { 'content-type': 'text/plain' });
    const ext = path.extname(file);
    let data = fs.readFileSync(file);
    if (ext === '.html') data = Buffer.from(data.toString('utf8').replace('<head>', '<head>\n  <meta name="admitiq-server" content="1" />'));
    return send(res, 200, data, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
  } catch (e) {
    const status = e.status || (e.name === 'TimeoutError' ? 504 : 500);
    if (status >= 500) console.error('[admitiq]', e.message);
    return json(res, status, { error: status === 500 ? 'Unexpected server error' : e.message });
  }
});

server.listen(PORT, () => {
  const ai = aiConfig();
  console.log(`AdmitIQ running at http://localhost:${PORT}`);
  console.log(`  AI: ${ai ? `${ai.name} (${ai.model})` : 'off'} · Scorecard: ${env.SCORECARD_API_KEY ? 'on' : 'off'} · Search: ${env.SEARCH_PROVIDER && env.SEARCH_API_KEY ? env.SEARCH_PROVIDER : 'off'} · Supabase: ${env.SUPABASE_URL ? 'on' : 'off'}`);
});
