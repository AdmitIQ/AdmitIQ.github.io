import React, { useRef, useState } from 'react';
import { LuDownload, LuUpload, LuTrash2, LuCopy, LuCloudUpload, LuCloudDownload, LuShieldCheck, LuUserRound } from 'react-icons/lu';
import { navigate, useCaps } from '../App';
import { Badge, Button, Card, CardHeader, Notice, PageHeader, copyText, downloadFile, useConfirm, useToast } from '../components/ui';
import { store, useStore } from '../lib/store';
import { ImportSchema } from '../lib/types';
import { demoState } from '../data/demo';
import { auth } from '../lib/services';

export default function DataPage() {
  const s = useStore((x) => x);
  const { caps } = useCaps();
  const toast = useToast();
  const confirm = useConfirm();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const session = auth.current();
  const json = () => JSON.stringify(store.get(), null, 2);
  const size = new Blob([JSON.stringify(s)]).size;

  async function doImport(f: File) {
    try {
      const data = JSON.parse(await f.text());
      const r = ImportSchema.safeParse(data);
      if (!r.success) throw new Error(`This file isn't a valid AdmitIQ export (${r.error.issues[0].path.join('.')}: ${r.error.issues[0].message}).`);
      if (!(await confirm({ title: 'Replace your data?', body: 'Importing replaces everything currently stored in this browser with the file\'s contents.', action: 'Import' }))) return;
      store.replace(data); toast('Data imported');
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  const counts: [string, number][] = [['Courses', s.courses.length], ['Activities', s.activities.length], ['Colleges on list', s.list.length], ['Applications', s.apps.length], ['Tasks', s.tasks.length], ['Essays', s.essays.length], ['Essay drafts', s.essays.reduce((a, e) => a + e.drafts.length, 0)], ['Experience submissions', s.experiences.length]];

  return (
    <>
      <PageHeader title="Data & privacy" desc="Your information belongs to you. See what's stored, take it with you, or delete it." />
      {!store.storageAvailable() && <Notice tone="warn" className="mb-4">This browser is blocking local storage, so changes will be lost when you close the page. Export your data to keep it.</Notice>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader flush title="What's stored" desc={`About ${(size / 1024).toFixed(1)} KB, in this browser only${session ? ' and in your synced account' : ''}.`} />
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">{counts.map(([l, n]) => <div key={l} className="flex justify-between border-b border-line py-1.5"><dt className="text-muted">{l}</dt><dd className="font-medium tabular-nums text-ink">{n}</dd></div>)}</dl>
          {s.meta.demo && <Notice className="mt-4">Demo data is loaded. It's a fictional student.</Notice>}
        </Card>
        <Card className="p-5">
          <CardHeader flush title="Export & import" desc="A complete JSON copy of everything you've entered." />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" icon={<LuDownload />} onClick={() => { if (downloadFile(`admitiq-export-${new Date().toISOString().slice(0, 10)}.json`, json(), 'application/json')) toast('Export downloaded'); else copyText(json()).then((ok) => toast(ok ? 'Download blocked here — export copied to clipboard' : 'Export failed', ok ? 'info' : 'error')); }}>Download export</Button>
            <Button icon={<LuCopy />} onClick={async () => toast((await copyText(json())) ? 'Copied to clipboard' : 'Copy failed', 'info')}>Copy JSON</Button>
            <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
            <Button icon={<LuUpload />} onClick={() => file.current?.click()}>Import file</Button>
          </div>
        </Card>
        <Card className="p-5">
          <CardHeader flush title="Demo data" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon={<LuUserRound />} onClick={async () => { if (s.meta.demo || (!s.list.length && !s.courses.length) || await confirm({ title: 'Load demo student?', body: 'This replaces your current data in this browser. Export first if you want to keep it.', action: 'Load demo', danger: true })) { store.replace(demoState()); toast('Demo loaded'); navigate('dashboard'); } }}>Load demo student</Button>
            {s.meta.demo && <Button variant="danger" icon={<LuTrash2 />} onClick={async () => { if (await confirm({ title: 'Clear demo data?', body: 'Removes the fictional student so you can start your own profile.', action: 'Clear demo', danger: true })) { store.wipe(); toast('Demo cleared'); navigate('onboarding'); } }}>Clear demo data</Button>}
          </div>
        </Card>
        <Card className="p-5">
          <CardHeader flush title="Cloud sync" desc="Optional. Requires an account on a deployment with Supabase configured." />
          {caps?.supabase && session ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted">Signed in as <b className="text-ink">{session.user.email}</b>.</p>
              <div className="flex flex-wrap gap-2">
                <Button icon={<LuCloudUpload />} disabled={busy} onClick={async () => { setBusy(true); try { await auth.push(caps.supabase!, store.get()); toast('Uploaded to your account'); } catch (e) { toast((e as Error).message, 'error'); } setBusy(false); }}>Upload to cloud</Button>
                <Button icon={<LuCloudDownload />} disabled={busy} onClick={async () => { setBusy(true); try { const r = await auth.pull(caps.supabase!); if (r && r.version === 1) { store.replace(r); toast('Downloaded from your account'); } else toast('No cloud data yet', 'info'); } catch (e) { toast((e as Error).message, 'error'); } setBusy(false); }}>Download from cloud</Button>
                <Button variant="danger" icon={<LuTrash2 />} disabled={busy} onClick={async () => { if (await confirm({ title: 'Delete your account?', body: 'Permanently deletes your login and everything stored on the server. Data in this browser stays until you delete it below. This cannot be undone.', action: 'Delete account', danger: true })) { setBusy(true); try { await auth.deleteAccount(caps.supabase!); toast('Account deleted'); navigate('data'); } catch (e) { toast((e as Error).message, 'error'); } setBusy(false); } }}>Delete account</Button>
                <Button variant="danger" icon={<LuTrash2 />} disabled={busy} onClick={async () => { if (await confirm({ title: 'Delete cloud data?', body: 'Permanently deletes your profile, essays and applications from the server. This cannot be undone.', action: 'Delete cloud data', danger: true })) { setBusy(true); try { await auth.deleteAccountData(caps.supabase!); toast('Cloud data deleted'); } catch (e) { toast((e as Error).message, 'error'); } setBusy(false); } }}>Delete cloud data</Button>
              </div>
            </div>
          ) : <p className="mt-3 text-sm text-muted">{caps?.supabase ? <>Not signed in. <a href="#login" className="font-medium text-accent hover:underline">Sign in</a> to sync.</> : 'Not available on this deployment — your data stays in this browser.'}</p>}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <CardHeader flush title={<span className="flex items-center gap-2"><LuShieldCheck className="text-teal" />Privacy commitments</span>} />
          <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm text-muted sm:grid-cols-2">
            <li>• No public student profiles — nothing you enter is visible to others.</li>
            <li>• Your data is never sold or shared for advertising.</li>
            <li>• Essays are never used to train AI models. If you turn on AI features, essays are sent only to the provider you configure, for that request.</li>
            <li>• Financial details are excluded from AI requests unless you allow it.</li>
            <li>• Sensitive characteristics are never collected or inferred.</li>
            <li>• Synced data is protected by row-level security: only your account can read it.</li>
            <li>• Experience submissions are anonymous and scrubbed of contact details.</li>
            <li>• You can export or permanently delete everything, any time.</li>
          </ul>
        </Card>
        <Card className="border-rose-500/30 p-5 lg:col-span-2">
          <CardHeader flush title="Delete everything on this device" desc="Removes your profile, list, essays, applications and settings from this browser." action={<Button variant="danger" icon={<LuTrash2 />} onClick={async () => { if (await confirm({ title: 'Delete all data?', body: 'This permanently deletes everything AdmitIQ has stored in this browser. Export first if you want a copy. This cannot be undone.', action: 'Delete everything', danger: true })) { store.wipe(); toast('All local data deleted'); navigate('home'); } }}>Delete all data</Button>} />
          <p className="mt-2 text-xs text-muted"><Badge>Tip</Badge> Signed-in users should also delete cloud data above.</p>
        </Card>
      </div>
    </>
  );
}
