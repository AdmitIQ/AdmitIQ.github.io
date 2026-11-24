import React from 'react';
import { LuCheck } from 'react-icons/lu';
import { cx } from './ui';

export type StepState = { label: string; status: 'pending' | 'active' | 'done' | 'error'; detail?: string };

// Runs real operations in order and reports each one's status. Each step is a real unit of work;
// a short dwell (≤200ms) keeps fast steps legible — it is not used to imply work that isn't happening.
export async function runSteps(steps: { label: string; run: () => unknown | Promise<unknown> }[], onUpdate: (s: StepState[]) => void) {
  const state: StepState[] = steps.map((s) => ({ label: s.label, status: 'pending' }));
  onUpdate([...state]);
  for (let i = 0; i < steps.length; i++) {
    state[i].status = 'active'; onUpdate([...state]);
    const t0 = performance.now();
    try { await steps[i].run(); state[i].status = 'done'; } catch (e) { state[i].status = 'error'; state[i].detail = (e as Error).message; }
    const dt = performance.now() - t0;
    if (dt < 200) await new Promise((r) => setTimeout(r, 200 - dt));
    onUpdate([...state]);
  }
  return state;
}

export function ResearchLoader({ steps, title }: { steps: StepState[]; title: string }) {
  const done = steps.filter((s) => s.status === 'done').length;
  return (
    <div aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--accent)] via-[var(--violet)] to-[var(--teal)]">
          <span className="grid grid-cols-3 gap-0.5">{Array.from({ length: 9 }, (_, i) => <span key={i} className="pulse-dot h-1.5 w-1.5 rounded-full bg-white" style={{ animationDelay: `${(i % 3) * 120 + Math.floor(i / 3) * 80}ms` }} />)}</span>
        </div>
        <div><div className="font-semibold text-ink">{title}</div><div className="text-sm text-muted tabular-nums">{done} of {steps.length} steps complete</div></div>
      </div>
      <div className="relative mt-5 h-1 overflow-hidden rounded-full bg-raised">
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(done / Math.max(1, steps.length)) * 100}%` }} />
        {done < steps.length && <div className="scan-bar absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" />}
      </div>
      <ol className="mt-5 space-y-2.5">
        {steps.map((s) => (
          <li key={s.label} className={cx('flex items-start gap-3 text-sm transition-opacity', s.status === 'pending' && 'opacity-45')}>
            <span className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px]', s.status === 'done' ? 'bg-teal text-white' : s.status === 'active' ? 'border-2 border-accent' : s.status === 'error' ? 'bg-rose-500 text-white' : 'border border-line')}>
              {s.status === 'done' ? <LuCheck /> : s.status === 'active' ? <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" /> : s.status === 'error' ? '!' : null}
            </span>
            <span className="min-w-0"><span className={cx(s.status === 'active' ? 'font-medium text-ink' : 'text-ink')}>{s.label}</span>{s.detail && <span className="block text-xs text-muted">{s.detail}</span>}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
