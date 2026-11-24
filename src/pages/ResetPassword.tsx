import React, { useState } from 'react';
import { LuLock } from 'react-icons/lu';
import { Logo, navigate, useCaps } from '../App';
import { Button, Card, Field, Input, Notice } from '../components/ui';
import { auth } from '../lib/services';

export default function ResetPassword() {
  const { caps, checked } = useCaps();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const session = auth.current();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setErr('Use at least 8 characters');
    if (pw !== pw2) return setErr("Passwords don't match");
    if (!caps?.supabase) return setErr('Accounts are not enabled on this deployment');
    setBusy(true); setErr('');
    try { await auth.updatePassword(caps.supabase, pw); setDone(true); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-md px-4 py-8">
        <a href="#home"><Logo /></a>
        <Card className="fade-up mt-10 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Choose a new password</h1>
          {!checked ? null : done ? (
            <div className="mt-6 space-y-4"><Notice tone="ok">Password updated. You're signed in.</Notice><Button variant="primary" onClick={() => navigate('dashboard')}>Go to dashboard</Button></div>
          ) : !session ? (
            <div className="mt-6 space-y-4"><Notice tone="warn">This reset link has expired or was already used. Request a new one from the sign-in page.</Notice><Button onClick={() => navigate('login')}>Back to sign in</Button></div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <p className="text-sm text-muted">For {session.user.email}</p>
              <Field label="New password" htmlFor="np1" hint="At least 8 characters."><Input id="np1" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
              <Field label="Confirm password" htmlFor="np2" error={err || null}><Input id="np2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} invalid={!!err} /></Field>
              <Button variant="primary" className="w-full" disabled={busy} icon={<LuLock />}>{busy ? 'Saving…' : 'Update password'}</Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
