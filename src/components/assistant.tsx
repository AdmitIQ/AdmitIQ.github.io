import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LuMic, LuMicOff, LuSearch, LuArrowRight, LuSparkles, LuBookOpen, LuGraduationCap, LuLayoutDashboard, LuVolume2, LuSquare, LuLoaderCircle, LuX } from 'react-icons/lu';
import { navigate, useCaps } from '../App';
import { Portal, cx } from './ui';
import { COLLEGES } from '../data/colleges';
import { GLOSSARY } from '../lib/glossary';
import { PAGES, collegesIn, runCommand, type CommandResult } from '../lib/commands';
import { speak, stopSpeaking, useListener, useSpeaking, type Listener } from '../lib/voice';

// ---------- Reusable mic button ----------
export function MicButton({ listener, label = 'Voice input', size = 'md' }: { listener: Listener; label?: string; size?: 'sm' | 'md' }) {
  const d = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const busy = listener.transcribing;
  return (
    <button type="button" onClick={listener.toggle} disabled={busy} aria-pressed={listener.listening} aria-label={listener.listening ? 'Stop listening' : label}
      title={!listener.supported ? 'Voice input is not available in this browser' : listener.listening ? 'Stop' : label}
      className={cx('relative grid shrink-0 place-items-center rounded-full transition-all active:scale-95 disabled:opacity-60', d, listener.listening ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'border border-line bg-surface text-ink hover:border-accent/50 hover:text-accent')}>
      {listener.listening && <span aria-hidden className="mic-ring absolute inset-0 rounded-full" style={{ ['--lvl' as string]: listener.mode === 'server' ? listener.level : 0.6 }} />}
      {busy ? <LuLoaderCircle className="animate-spin" /> : listener.listening ? <LuSquare className="text-[0.85em] fill-current" /> : listener.supported ? <LuMic /> : <LuMicOff className="text-muted" />}
    </button>
  );
}

export function SpeakButton({ text, label = 'Read aloud' }: { text: string; label?: string }) {
  const speaking = useSpeaking();
  return (
    <button type="button" onClick={() => (speaking ? stopSpeaking() : speak(text))} aria-label={speaking ? 'Stop reading' : label} title={speaking ? 'Stop' : label}
      className="inline-grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-accent">
      {speaking ? <LuSquare className="fill-current text-[0.8em]" /> : <LuVolume2 />}
    </button>
  );
}

// ---------- Command palette + voice assistant ----------
type Item = { id: string; label: string; hint: string; icon: React.ReactNode; run: () => void };
const EXAMPLES = ['Compare Purdue and Michigan', 'Add Georgia Tech to my list', "What's my next deadline?", 'What is early decision?', 'Remind me to email my counselor tomorrow', 'Practice an interview for Duke', 'Read my essay', 'Which colleges are affordable for me?'];

let openPalette: (voice?: boolean) => void = () => {};
export const openAssistant = (voice = false) => openPalette(voice);

export function Assistant() {
  const { caps } = useCaps();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [heard, setHeard] = useState('');
  const viaVoice = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const speaking = useSpeaking();

  const execute = (text: string, voice: boolean) => {
    if (!text.trim()) return;
    const r = runCommand(text, navigate);
    setResult(r);
    if (voice && r.say) speak(r.say);
    if (r.kind === 'navigate' || r.kind === 'ask') setTimeout(() => setOpen(false), voice && r.say ? 900 : 120);
  };
  const listener = useListener({ serverTranscribe: !!caps?.ai?.transcribe, onFinal: (t) => { setHeard(t); setQ(t); viaVoice.current = true; execute(t, true); } });

  openPalette = (voice) => { setOpen(true); setResult(null); setHeard(''); setQ(''); setSel(0); if (voice) setTimeout(() => listener.start(), 150); else setTimeout(() => inputRef.current?.focus(), 30); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false); stopSpeaking(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open ? setOpen(false) : openPalette(); }
      else if (e.key === '/' && !typing && !open) { e.preventDefault(); openPalette(); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open]);
  useEffect(() => { if (!open) { listener.stop(); } }, [open]);

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase(); const out: Item[] = [];
    const cs = collegesIn(q);
    if (cs.length >= 2) out.push({ id: 'cmp', label: `Compare ${cs.map((c) => c.short).join(' vs ')}`, hint: 'Action', icon: <LuSparkles />, run: () => execute(`compare ${cs.map((c) => c.short).join(' and ')}`, false) });
    if (cs.length) out.push({ id: 'add', label: `Add ${cs.map((c) => c.short).join(', ')} to my list`, hint: 'Action', icon: <LuSparkles />, run: () => execute(`add ${cs.map((c) => c.short).join(' and ')} to my list`, false) });
    for (const p of PAGES) if (!s || p.label.toLowerCase().includes(s) || p.words.some((w) => w.startsWith(s))) out.push({ id: `p-${p.id}`, label: p.label, hint: 'Page', icon: <LuLayoutDashboard />, run: () => { navigate(p.id); setOpen(false); } });
    if (s.length >= 2) {
      for (const c of COLLEGES.filter((c) => `${c.name} ${c.short}`.toLowerCase().includes(s)).slice(0, 6)) out.push({ id: `c-${c.id}`, label: c.name, hint: `${c.city}, ${c.state}`, icon: <LuGraduationCap />, run: () => { navigate(`college-${c.id}`); setOpen(false); } });
      for (const t of GLOSSARY.filter((t) => t.term.toLowerCase().includes(s) || t.aliases?.some((a) => a.startsWith(s))).slice(0, 3)) out.push({ id: `g-${t.term}`, label: t.term, hint: 'Explain', icon: <LuBookOpen />, run: () => setResult({ kind: 'answer', title: t.term, say: `${t.short}${t.detail ? ` ${t.detail}` : ''}` }) });
      out.push({ id: 'run', label: q.trim(), hint: 'Run / ask', icon: <LuArrowRight />, run: () => execute(q, false) });
    }
    return out.slice(0, 12);
  }, [q]);
  useEffect(() => setSel(0), [q]);

  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[85] flex items-start justify-center px-3 pt-[8vh] sm:pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette and voice assistant">
        <div className="fade-in absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
        <div className="pop-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <LuSearch className="ml-1 shrink-0 text-muted" />
            <input ref={inputRef} value={listener.listening && listener.interim ? listener.interim : q} onChange={(e) => { setQ(e.target.value); setResult(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((i) => Math.min(items.length - 1, i + 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((i) => Math.max(0, i - 1)); }
                else if (e.key === 'Enter') { e.preventDefault(); const it = items[sel]; if (it && !(q.trim() && it.hint === 'Page' && !it.label.toLowerCase().includes(q.trim().toLowerCase()))) it.run(); else execute(q, false); }
              }}
              placeholder={listener.listening ? 'Listening…' : 'Search, run a command, or ask anything'} aria-label="Command" className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted" />
            <MicButton listener={listener} label="Speak a command" size="sm" />
            <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-raised"><LuX /></button>
          </div>
          {(listener.error) && <p className="border-b border-line bg-amber-500/[0.07] px-4 py-2 text-sm text-ink">{listener.error}</p>}
          {result ? (
            <div className="space-y-3 px-4 py-4" aria-live="polite">
              {heard && <p className="text-xs text-muted">You said: “{heard}”</p>}
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-canvas"><LuSparkles className="text-sm" /></span>
                <div className="min-w-0 flex-1"><div className="font-semibold text-ink">{result.title}</div>{result.say && <p className="mt-1 text-[15px] leading-relaxed text-ink/90">{result.say}</p>}</div>
                {result.say && <button onClick={() => (speaking ? stopSpeaking() : speak(result.say))} aria-label={speaking ? 'Stop' : 'Read aloud'} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-raised hover:text-accent">{speaking ? <LuSquare className="fill-current text-[0.8em]" /> : <LuVolume2 />}</button>}
              </div>
              <button onClick={() => { setResult(null); setQ(''); setHeard(''); setTimeout(() => inputRef.current?.focus(), 10); }} className="text-sm text-accent hover:underline">New command</button>
            </div>
          ) : items.length ? (
            <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
              {!q && <li className="px-3 pt-2 pb-1 text-xs font-medium text-muted">Go to</li>}
              {items.map((it, i) => (
                <li key={it.id} role="option" aria-selected={i === sel}>
                  <button onMouseEnter={() => setSel(i)} onClick={it.run} className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm', i === sel ? 'bg-raised text-ink' : 'text-ink/90')}>
                    <span className="text-muted">{it.icon}</span><span className="min-w-0 flex-1 truncate">{it.label}</span><span className="shrink-0 text-xs text-muted">{it.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {!q && !result && (
            <div className="border-t border-line px-4 py-3">
              <p className="mb-2 text-xs font-medium text-muted">Try saying or typing</p>
              <div className="flex flex-wrap gap-1.5">{EXAMPLES.map((e) => <button key={e} onClick={() => { setQ(e); execute(e, false); }} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink hover:border-accent/50 hover:bg-accent/5">{e}</button>)}</div>
              <p className="mt-3 hidden text-xs text-muted sm:block"><kbd className="rounded border border-line px-1">⌘K</kbd> / <kbd className="rounded border border-line px-1">Ctrl K</kbd> or <kbd className="rounded border border-line px-1">/</kbd> opens this anywhere · <kbd className="rounded border border-line px-1">↑↓</kbd> to move · <kbd className="rounded border border-line px-1">Enter</kbd> to run</p>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

export function VoiceFab() {
  return (
    <Portal>
      <button onClick={() => openAssistant(true)} aria-label="Voice assistant"
        className="no-print fixed right-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[45] grid h-12 w-12 lg:h-14 lg:w-14 place-items-center rounded-full bg-ink text-canvas shadow-lift transition-transform hover:scale-105 active:scale-95 lg:right-6 lg:bottom-6">
        <LuMic className="text-[20px] lg:text-[22px]" />
      </button>
    </Portal>
  );
}
