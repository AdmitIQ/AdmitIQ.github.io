#!/usr/bin/env node
// Interactive setup: `npm run setup`
// Asks which (optional) services to enable, tests each key live, and writes .env.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env');
// Line queue works for interactive terminals and piped input alike.
const rl = readline.createInterface({ input, terminal: false });
const lines = []; const waiters = []; let closed = false;
rl.on('line', (l) => (waiters.length ? waiters.shift()(l) : lines.push(l)));
rl.on('close', () => { closed = true; while (waiters.length) waiters.shift()(''); });
const nextLine = () => (lines.length ? Promise.resolve(lines.shift()) : closed ? Promise.resolve('') : new Promise((r) => waiters.push(r)));
const ask = async (q, d = '') => { output.write(d ? `${q} [${d}]: ` : `${q}: `); const a = (await nextLine()).trim(); if (!input.isTTY) output.write(`${a}\n`); return a || d; };
const yes = async (q, d = 'n') => /^y/i.test(await ask(`${q} (y/n)`, d));
const existing = fs.existsSync(envFile) ? Object.fromEntries(fs.readFileSync(envFile, 'utf8').split('\n').map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]])) : {};
const env = { PORT: '8787', TRUST_PROXY: 'false', RATE_LIMIT_PER_MIN: '20', REQUIRE_AUTH: 'false', ...existing };

const PROVIDERS = {
  groq: { base: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', note: 'Free tier, fast. Recommended free option — Groq states it does not train on your data.' },
  gemini: { base: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey', note: 'Free tier, BUT Google lists free-tier prompts as "used to improve our products". Avoid for student essays unless you accept that.' },
  openrouter: { base: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', note: 'Has some free models (":free" suffix), rate-limited; data policy varies by model.' },
  ollama: { base: 'http://127.0.0.1:11434/v1', keyUrl: 'https://ollama.com/download', note: 'Free and fully private — runs on your own computer. Install Ollama, then `ollama pull llama3.1`.' },
  openai: { base: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', note: 'Paid.' },
  anthropic: { base: 'https://api.anthropic.com/v1', keyUrl: 'https://console.anthropic.com/settings/keys', note: 'Paid.' },
};

async function testAI(provider, key, model) {
  const p = PROVIDERS[provider];
  if (provider === 'anthropic') {
    const r = await fetch(`${p.base}/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: model || 'claude-haiku-4-5', max_tokens: 10, messages: [{ role: 'user', content: 'Reply with OK' }] }) });
    return r.ok ? { ok: true } : { ok: false, msg: (await r.json().catch(() => ({})))?.error?.message || r.status };
  }
  const headers = key ? { authorization: `Bearer ${key}` } : {};
  const m = await fetch(`${p.base}/models`, { headers }).catch((e) => ({ ok: false, statusText: e.message }));
  if (!m.ok) return { ok: false, msg: `Could not list models (${m.status || m.statusText}). Check the key${provider === 'ollama' ? ' / that Ollama is running' : ''}.` };
  const ids = ((await m.json()).data || []).map((x) => String(x.id).replace(/^models\//, ''));
  return { ok: true, models: ids };
}

console.log('\nAdmitIQ setup — every service is optional. Press Enter to keep the value in [brackets].\n');

if (await yes('Connect an AI provider?', env.AI_PROVIDER && env.AI_PROVIDER !== 'none' ? 'y' : 'y')) {
  for (const [k, v] of Object.entries(PROVIDERS)) console.log(`  ${k.padEnd(11)} ${v.note}`);
  let provider = await ask('\nProvider', env.AI_PROVIDER && env.AI_PROVIDER !== 'none' ? env.AI_PROVIDER : 'groq');
  while (!PROVIDERS[provider]) provider = await ask('Choose one of: ' + Object.keys(PROVIDERS).join(', '), 'groq');
  let key = '';
  if (provider !== 'ollama') { console.log(`Get a key: ${PROVIDERS[provider].keyUrl}`); key = await ask('API key', env.AI_PROVIDER === provider ? env.AI_API_KEY : ''); }
  process.stdout.write('Testing… ');
  const t = await testAI(provider, key, env.AI_MODEL).catch((e) => ({ ok: false, msg: e.message }));
  if (t.ok) {
    console.log('✓ connected' + (t.models ? ` (${t.models.length} models available)` : ''));
    console.log('Leave the model blank to let AdmitIQ pick an available one automatically.');
    env.AI_MODEL = await ask('Model (optional)', env.AI_PROVIDER === provider ? env.AI_MODEL || '' : '');
    env.AI_PROVIDER = provider; env.AI_API_KEY = key;
  } else { console.log(`✗ ${t.msg}`); if (await yes('Save it anyway?')) { env.AI_PROVIDER = provider; env.AI_API_KEY = key; } }
  if (provider === 'gemini') console.log('Note: on Gemini\'s free tier, prompts (including essays) may be used by Google to improve its products.');
}

if (await yes('\nAdd a College Scorecard key for official data? (free: https://api.data.gov/signup)', env.SCORECARD_API_KEY ? 'y' : 'n')) {
  const key = await ask('api.data.gov key', env.SCORECARD_API_KEY || '');
  const r = await fetch(`https://api.data.gov/ed/collegescorecard/v1/schools?api_key=${encodeURIComponent(key)}&id=243780&fields=id`).catch(() => null);
  console.log(r?.ok ? '✓ key works — run `npm run sync:scorecard` next to verify the college data' : '✗ key test failed (saved anyway)');
  env.SCORECARD_API_KEY = key;
}

if (await yes('\nEnable accounts & sync with Supabase?', env.SUPABASE_URL ? 'y' : 'n')) {
  console.log('Create a free project at https://supabase.com, run supabase/migrations/0001_init.sql then supabase/seed.sql in its SQL editor.');
  env.SUPABASE_URL = await ask('Project URL (https://xxxx.supabase.co)', env.SUPABASE_URL || '');
  env.SUPABASE_ANON_KEY = await ask('anon public key (NOT the service_role key)', env.SUPABASE_ANON_KEY || '');
  if (/service_role/.test(Buffer.from((env.SUPABASE_ANON_KEY.split('.')[1] || ''), 'base64').toString())) { console.log('✗ That is a service_role key — never use it here. Cleared.'); env.SUPABASE_ANON_KEY = ''; }
  if (env.AI_PROVIDER && env.AI_PROVIDER !== 'none') env.REQUIRE_AUTH = (await yes('Require sign-in to use AI (recommended for public sites)?', 'y')) ? 'true' : 'false';
}

const envLines = Object.entries(env).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`);
fs.writeFileSync(envFile, `# Written by npm run setup — keep this file private (it's in .gitignore)\n${envLines.join('\n')}\n`, { mode: 0o600 });
console.log(`\nSaved ${envFile}. Start AdmitIQ with: npm run build && npm start\n`);
rl.close();
