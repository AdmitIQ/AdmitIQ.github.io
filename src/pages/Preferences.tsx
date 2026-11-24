import React from 'react';
import { LuMonitor, LuMoon, LuSun } from 'react-icons/lu';
import { navigate, useCaps } from '../App';
import { Badge, Button, Card, CardHeader, Field, PageHeader, Select, Skeleton, Toggle, cx } from '../components/ui';
import { store, useStore } from '../lib/store';
import { MODES } from '../lib/essay';
import { ai, auth } from '../lib/services';
import { notificationsSupported, requestNotifications } from '../lib/reminders';
import { useToast } from '../components/ui';

export default function Preferences() {
  const prefs = useStore((s) => s.prefs);
  const { caps, checked } = useCaps();
  const set = (p: Partial<typeof prefs>) => store.set((s) => { s.prefs = { ...s.prefs, ...p }; });
  const session = auth.current();
  const toast = useToast();
  const [testing, setTesting] = React.useState<string | null>(null);
  async function testAI() {
    setTesting('Testing…');
    const t0 = performance.now();
    try { const r = await ai.chat([{ role: 'user', content: 'Reply with exactly: OK' }]); setTesting(`✓ Connected — replied "${r.text.trim().slice(0, 40)}" in ${Math.round(performance.now() - t0)} ms`); }
    catch (e) { setTesting(`✗ ${(e as Error).message}`); }
  }
  return (
    <>
      <PageHeader title="Settings" desc="Appearance, accessibility and connected services." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader flush title="Appearance" />
          <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
            {([['system', 'System', LuMonitor], ['light', 'Light', LuSun], ['dark', 'Dark', LuMoon]] as const).map(([v, l, I]) => (
              <button key={v} role="radio" aria-checked={prefs.theme === v} onClick={() => set({ theme: v })} className={cx('flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-sm transition-colors', prefs.theme === v ? 'border-accent bg-accent/10 text-ink' : 'border-line text-muted hover:border-ink/25')}><I className="text-lg" />{l}</button>
            ))}
          </div>
          <div className="mt-5 space-y-2">
            <Toggle label="Reduce motion" desc="Turns off animations. AdmitIQ also follows your device's reduced-motion setting." checked={prefs.reduceMotion} onChange={(v) => set({ reduceMotion: v })} />
          </div>
        </Card>
        <Card className="p-5">
          <CardHeader flush title="Reminders & sync" />
          <div className="mt-3 space-y-2">
            <Toggle label="Deadline notifications" desc={notificationsSupported() ? 'Browser notifications 14, 7, 3 and 1 day before deadlines, and for tasks marked "Remind me". Works while AdmitIQ is open in a tab; add deadlines to your calendar (Tracker → Export) for reminders when it is closed.' : 'This browser or preview doesn\'t allow notifications. Use Tracker → Export to calendar for reminders.'} checked={prefs.notifications} onChange={async (v) => { if (v && !(await requestNotifications())) { toast('Notifications were blocked by the browser', 'error'); return; } set({ notifications: v }); }} />
            <Toggle label="Auto-sync to my account" desc={session ? `Uploads changes to ${session.user.email} a few seconds after you edit.` : 'Applies when you are signed in.'} checked={prefs.autoSync} onChange={(v) => set({ autoSync: v })} />
          </div>
        </Card>
        <Card className="p-5">
          <CardHeader flush title="Essay Lab" />
          <Field label="Default feedback mode" htmlFor="pref-mode" className="mt-4"><Select id="pref-mode" value={prefs.essayMode} onChange={(e) => set({ essayMode: e.target.value })} options={[...MODES]} /></Field>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <CardHeader flush title="Services" desc="What this deployment can do. All core features work without any of these." />
          {!checked ? <div className="mt-4 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : (
            <ul className="mt-4 divide-y divide-line text-sm">
              <li className="flex flex-wrap items-center justify-between gap-2 py-3"><span><b className="text-ink">AdmitIQ server</b><span className="block text-muted">Proxies AI and research requests so API keys never reach the browser.</span></span>{caps ? <Badge tone="green">Connected</Badge> : <Badge>Not running — local mode</Badge>}</li>
              <li className="flex flex-wrap items-center justify-between gap-2 py-3"><span><b className="text-ink">AI provider</b><span className="block text-muted">Optional. Ollama (local, free), Groq / Gemini free tiers, or your own OpenAI / Anthropic / OpenRouter key.</span></span><span className="flex flex-wrap items-center gap-2">{caps?.ai ? <><Badge tone="green">{caps.ai.provider} · {caps.ai.model}</Badge><Button size="sm" onClick={testAI}>Test connection</Button></> : <Badge>Off — run <code>npm run setup</code></Badge>}</span>{testing && <span className="w-full text-xs text-muted">{testing}</span>}{caps?.ai?.provider === 'gemini' && <span className="w-full text-xs text-amber-700 dark:text-amber-300">Gemini's free tier may use prompts (including essays) to improve Google's products.</span>}</li>
              <li className="flex flex-wrap items-center justify-between gap-2 py-3"><span><b className="text-ink">College Scorecard API</b><span className="block text-muted">Free api.data.gov key for verified federal college data.</span></span>{caps?.research.scorecard ? <Badge tone="green">Enabled</Badge> : <Badge>Off</Badge>}</li>
              <li className="flex flex-wrap items-center justify-between gap-2 py-3"><span><b className="text-ink">Web search API</b><span className="block text-muted">Optional (Tavily or Brave). Has its own pricing/free tier.</span></span>{caps?.research.search ? <Badge tone="green">{caps.research.search}</Badge> : <Badge>Off</Badge>}</li>
              <li className="flex flex-wrap items-center justify-between gap-2 py-3"><span><b className="text-ink">Accounts & sync (Supabase)</b><span className="block text-muted">Optional, free tier compatible.</span></span>{caps?.supabase ? (session ? <Badge tone="green">Signed in · {session.user.email}</Badge> : <Button size="sm" onClick={() => navigate('login')}>Sign in</Button>) : <Badge>Not configured</Badge>}</li>
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
