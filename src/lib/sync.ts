import { auth } from './services';
import { store } from './store';
import type { AppState } from './types';

type Cfg = { url: string; anonKey: string };
type Listener = (s: { state: 'idle' | 'syncing' | 'synced' | 'error'; at?: string; error?: string }) => void;
const listeners = new Set<Listener>();
let status: Parameters<Listener>[0] = { state: 'idle' };
const set = (s: typeof status) => { status = s; listeners.forEach((l) => l(s)); };
export const syncStatus = { get: () => status, subscribe: (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; } };

const isEmpty = (s: AppState) => !s.courses.length && !s.list.length && !s.essays.length && !s.activities.length && !s.profile.name;

// After sign-in: whichever copy (this browser vs. account) was saved more recently wins.
export async function reconcile(cfg: Cfg) {
  if (!auth.current()) return 'signed-out';
  set({ state: 'syncing' });
  try {
    const remote = (await auth.pull(cfg)) as AppState | null;
    const local = store.get();
    const localNewer = !remote || remote.version !== 1 || (!isEmpty(local) && !local.meta.demo && (local.meta.lastSaved || '') > (remote.meta?.lastSaved || ''));
    if (localNewer) { if (!local.meta.demo) await auth.push(cfg, local); set({ state: 'synced', at: new Date().toISOString() }); return 'pushed'; }
    store.replace(remote!);
    set({ state: 'synced', at: new Date().toISOString() });
    return 'pulled';
  } catch (e) { set({ state: 'error', error: (e as Error).message }); return 'error'; }
}

// Upload a few seconds after each local save while signed in. Demo data is never uploaded.
export function startAutoSync(cfg: Cfg) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const off = store.onSave((s) => {
    if (!auth.current() || s.meta.demo || !s.prefs.autoSync) return;
    clearTimeout(t);
    t = setTimeout(async () => {
      set({ state: 'syncing' });
      try { await auth.push(cfg, store.get()); set({ state: 'synced', at: new Date().toISOString() }); }
      catch (e) { set({ state: 'error', error: (e as Error).message }); }
    }, 3000);
  });
  return () => { off(); clearTimeout(t); };
}
