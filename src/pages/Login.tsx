import React, { useState } from 'react';
import { z } from 'zod';
import { LuArrowLeft, LuLock, LuMail, LuServer } from 'react-icons/lu';
import { Logo, navigate, useCaps } from '../App';
import { Button, Card, Field, Input, Notice, Skeleton, Tabs, useToast } from '../components/ui';
import { auth } from '../lib/services';
import { reconcile } from '../lib/sync';
import { store } from '../lib/store';

const Creds = z.object({ email: z.string().email('Enter a valid email address'), password: z.string().min(8, 'Use at least 8 characters') });

export default function Login() {
  const { caps, checked } = useCaps();
  const toast = useToast();
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(() => { try { const e = sessionStorage.getItem('admitiq:authError'); sessionStorage.removeItem('admitiq:authError'); return e ? `Sign-in link problem: ${e}. Request a new link below.` : ''; } catch { return ''; } });
  const cfg = caps?.supabase || null;
  const session = auth.current();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    setMsg('');
    const parsed = mode === 'magic' || mode === 'forgot' ? z.object({ email: Creds.shape.email }).safeParse({ email }) : Creds.safeParse({ email, password });
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message]))); return; }
    setErrors({}); setBusy(true);
    try {
      if (mode === 'signin') { await auth.signIn(cfg, email, password); const r = await reconcile(cfg); store.set((s) => { s.meta.onboarded = true; }); toast(r === 'pulled' ? 'Signed in — loaded your saved data' : 'Signed in'); navigate('dashboard'); }
      else if (mode === 'forgot') { await auth.requestPasswordReset(cfg, email); setMsg('If an account exists for that email, a reset link is on its way.'); }
      else if (mode === 'signup') { const r = await auth.signUp(cfg, email, password); if (r === 'confirm-email') setMsg('Check your inbox to confirm your email — the link brings you straight back here, signed in.'); else { await reconcile(cfg); toast('Account created — your data is now synced'); navigate('dashboard'); } }
      else { await auth.magicLink(cfg, email); setMsg('If that address can receive mail, a sign-in link is on its way.'); }
    } catch (err) { setMsg((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto flex max-w-md flex-col px-4 py-8">
        <div className="flex items-center justify-between"><a href="#home"><Logo /></a><a href="#home" className="inline-flex h-10 items-center gap-1.5 text-sm text-muted hover:text-ink"><LuArrowLeft /> Back</a></div>
        <Card className="fade-up mt-10 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{session ? 'You are signed in' : 'Sign in to sync'}</h1>
          <p className="mt-1.5 text-sm text-muted">An account is optional. It lets you sync your profile across devices.</p>
          {!checked ? <div className="mt-6 space-y-3"><Skeleton className="h-11" /><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
            : session && cfg ? (
              <div className="mt-6 space-y-4">
                <Notice tone="ok">Signed in as <b>{session.user.email}</b>.</Notice>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => navigate('dashboard')}>Go to dashboard</Button>
                  <Button onClick={async () => { await auth.signOut(cfg); toast('Signed out', 'info'); navigate('home'); }}>Sign out</Button>
                </div>
              </div>
            ) : cfg ? (
              <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                <Tabs tabs={[{ id: 'signin', label: 'Sign in' }, { id: 'signup', label: 'Create account' }, { id: 'magic', label: 'Email link' }]} value={mode === 'forgot' ? 'signin' : mode} onChange={(v) => { setMode(v); setMsg(''); }} />
                <Field label="Email" htmlFor="email" error={errors.email}><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} /></Field>
                {mode !== 'magic' && mode !== 'forgot' && <Field label="Password" htmlFor="pw" error={errors.password} hint={mode === 'signup' ? 'At least 8 characters.' : undefined}><Input id="pw" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} /></Field>}
                {msg && <Notice tone="info">{msg}</Notice>}
                <Button variant="primary" className="w-full" disabled={busy} icon={mode === 'magic' ? <LuMail /> : <LuLock />}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Send sign-in link'}</Button>
                {mode === 'signin' && <button type="button" className="w-full text-center text-sm text-accent hover:underline" onClick={() => { setMode('forgot'); setMsg(''); }}>Forgot password?</button>}
                {mode === 'forgot' && <button type="button" className="w-full text-center text-sm text-accent hover:underline" onClick={() => { setMode('signin'); setMsg(''); }}>Back to sign in</button>}
                <p className="text-xs text-muted">If you are under 13, ask a parent or guardian before creating an account.</p>
              </form>
            ) : (
              <div className="mt-6 space-y-4">
                <Notice tone="info"><b>Accounts aren't enabled on this deployment.</b> AdmitIQ is running in local mode: everything you enter is saved privately in this browser, and you can export it any time from Data & privacy.</Notice>
                <div className="rounded-xl border border-line bg-raised/60 p-4 text-sm text-muted">
                  <div className="mb-1 flex items-center gap-2 font-medium text-ink"><LuServer /> To enable sign-in</div>
                  Run AdmitIQ with its server and a free Supabase project: set <code className="rounded bg-surface px-1">SUPABASE_URL</code> and <code className="rounded bg-surface px-1">SUPABASE_ANON_KEY</code>, then apply <code className="rounded bg-surface px-1">supabase/migrations</code>. See the README.
                </div>
                <Button variant="primary" className="w-full" onClick={() => navigate(store.get().meta.onboarded ? 'dashboard' : 'onboarding')}>Continue in local mode</Button>
              </div>
            )}
        </Card>
      </div>
    </div>
  );
}
