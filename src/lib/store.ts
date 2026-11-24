import { useSyncExternalStore } from 'react';
import type { AppState } from './types';

const KEY = 'admitiq:v1';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const todayISO = () => new Date().toISOString().slice(0, 10);

export function emptyState(): AppState {
  return {
    version: 1,
    meta: { demo: false, createdAt: new Date().toISOString(), onboarded: false, lastSaved: '' },
    profile: {
      name: '', highSchool: '', city: '', state: '', gradYear: null, gpaUnweighted: null, gpaWeighted: null, gpaScale: '4.0',
      classRank: null, classSize: null, intendedMajor: '', altMajors: [], testingStatus: 'Not yet tested',
      sat: { total: null, rw: null, math: null, date: '' }, act: { composite: null, english: null, math: null, reading: null, science: null, date: '' },
      plannedTests: '', trend: '', awards: [],
    },
    personal: {
      career: '', academicInterests: '', personalInterests: '', settings: [], regions: [], size: 'Any', maxDistance: null, kinds: [],
      culture: '', accessibility: '', careerPriorities: '', wantsResearch: false, wantsInternships: false, learning: '',
    },
    financial: {
      shareFinancials: false, incomeBracket: 'Prefer not to say', maxAnnualCost: null, expectedContribution: null,
      aidPriority: 'Somewhat important', meritPreference: false, loanWillingness: 'Federal loans only', notes: '',
    },
    courses: [], activities: [], list: [], customCategories: [], compare: [], apps: [], tasks: [], essays: [],
    savedSearches: [], savedScholarships: [], customScholarships: [], experiences: [], interviews: [], offers: [],
    prefs: { theme: 'system', reduceMotion: false, essayMode: 'Deep critique', autoSync: true, notifications: false },
  };
}

let storageOk = true;
function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1) return mergeDefaults(parsed);
    }
  } catch { storageOk = false; }
  return emptyState();
}

// Fill in any fields added in later versions so old saves keep working.
export function mergeDefaults(s: Partial<AppState>): AppState {
  const d = emptyState();
  return {
    ...d, ...s,
    meta: { ...d.meta, ...(s.meta || {}) },
    profile: { ...d.profile, ...(s.profile || {}), sat: { ...d.profile.sat, ...(s.profile?.sat || {}) }, act: { ...d.profile.act, ...(s.profile?.act || {}) } },
    personal: { ...d.personal, ...(s.personal || {}) },
    financial: { ...d.financial, ...(s.financial || {}) },
    prefs: { ...d.prefs, ...(s.prefs || {}) },
  } as AppState;
}

let state: AppState = load();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const saveListeners = new Set<(s: AppState) => void>();

let dirty = false;
function flush() {
  clearTimeout(saveTimer);
  if (!dirty) return;
  dirty = false;
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; } catch { storageOk = false; }
  saveListeners.forEach((l) => l(state));
}
function persist() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}
// Never lose the last edit when the tab is hidden or closed during the debounce window.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}

export const store = {
  get: () => state,
  set(updater: (s: AppState) => AppState | void) {
    const draft = structuredClone(state);
    const next = updater(draft) || draft;
    next.meta.lastSaved = new Date().toISOString();
    state = next;
    listeners.forEach((l) => l());
    persist();
  },
  replace(next: AppState) { state = mergeDefaults(next); listeners.forEach((l) => l()); persist(); },
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
  onSave(l: (s: AppState) => void) { saveListeners.add(l); return () => saveListeners.delete(l); },
  storageAvailable: () => storageOk,
  flush,
  wipe() {
    clearTimeout(saveTimer); dirty = false;
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    state = emptyState(); listeners.forEach((l) => l());
  },
};

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(state), () => selector(state));
}
