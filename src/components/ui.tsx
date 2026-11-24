import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BooksSpot } from './art';

// Fixed-position layers render into <body> so animated (transformed) page containers can't trap them.
export function Portal({ children }: { children: React.ReactNode }) {
  return typeof document === 'undefined' ? <>{children}</> : createPortal(children, document.body);
}
import { LuX, LuInfo, LuCircleCheck, LuTriangleAlert, LuBadgeCheck, LuExternalLink } from 'react-icons/lu';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function prefersReducedMotion() {
  try { return document.documentElement.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
export function Button({ variant = 'secondary', size = 'md', className, children, icon, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: React.ReactNode }) {
  const v = {
    primary: 'bg-accent text-white border-[1.5px] border-ink btn-press',
    secondary: 'bg-surface text-ink border-[1.5px] border-ink/80 hover:bg-raised',
    ghost: 'text-muted hover:text-ink hover:bg-raised',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    soft: 'bg-ivy/10 text-ivy dark:text-teal hover:bg-ivy/15',
  }[variant];
  const s = { sm: 'h-9 px-3 text-sm gap-1.5', md: 'h-11 px-4 text-[15px] gap-2', lg: 'h-12 px-6 text-base gap-2' }[size];
  return (
    <button {...p} className={cx('btn inline-flex items-center justify-center rounded-md font-semibold whitespace-nowrap select-none transition-[transform,box-shadow,background-color] duration-100 disabled:opacity-45 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent', v, s, className)}>
      {icon && <span className="shrink-0 text-[1.05em]">{icon}</span>}{children}
    </button>
  );
}

export function Card({ className, children, hover, as: As = 'div', ...p }: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean; as?: 'div' | 'section' | 'article' }) {
  return <As {...p} data-rv="" className={cx('rv rounded-lg border border-line bg-surface shadow-card', hover && 'transition-[border-color,box-shadow,translate] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-lift hover:border-ink', className)}>{children}</As>;
}

export function CardHeader({ title, desc, action, className, flush }: { title: React.ReactNode; desc?: React.ReactNode; action?: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-3', !flush && 'px-5 pt-5', className)}>
      <div className="min-w-0"><h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>{desc && <p className="mt-0.5 text-sm text-muted">{desc}</p>}</div>
      {action}
    </div>
  );
}

const BADGE: Record<string, string> = {
  neutral: 'bg-raised text-muted border-line', blue: 'bg-[color-mix(in_srgb,var(--sky)_12%,transparent)] text-[var(--sky)] border-[var(--sky)]',
  violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20', teal: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20',
  amber: 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/25', rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
  green: 'bg-[color-mix(in_srgb,var(--teal)_10%,transparent)] text-[var(--teal)] border-[var(--teal)]',
  orange: 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)] border-[var(--accent)]',
};
export function Badge({ tone = 'neutral', children, className, title }: { tone?: keyof typeof BADGE | string; children: React.ReactNode; className?: string; title?: string }) {
  const isStamp = ['Reach', 'Target', 'Likely', 'Accepted', 'Rejected', 'Waitlisted', 'Deferred', 'Submitted'].some((w) => typeof children === 'string' ? children === w || children.endsWith(` ${w}`) : false);
  return <span title={title} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border px-1.5 py-0.5 text-xs font-medium', isStamp && 'stamp text-[12px]', BADGE[tone] || BADGE.neutral, className)}>{children}</span>;
}
export const bucketTone = (b: string) => ({ Reach: 'orange', Target: 'blue', Likely: 'green' } as Record<string, string>)[b] || 'neutral';
export const compTone = (c: string) => ({ 'Highly competitive': 'rose', Competitive: 'amber', Possible: 'blue', 'Less competitive': 'teal', 'Open admission': 'green' } as Record<string, string>)[c] || 'neutral';
export const statusTone = (s: string) => ({ Researching: 'neutral', Planned: 'neutral', 'In progress': 'blue', 'Ready to submit': 'violet', Submitted: 'teal', Accepted: 'green', Deferred: 'amber', Waitlisted: 'amber', Rejected: 'rose' } as Record<string, string>)[s] || 'neutral';

export function Field({ label, hint, error, children, className, htmlFor }: { label: string; hint?: string; error?: string | null; children: React.ReactNode; className?: string; htmlFor?: string }) {
  const gen = useId();
  // Associate the label with its control automatically when no explicit id is given.
  let id = htmlFor;
  let child = children;
  if (!id && React.isValidElement(children)) {
    const props = children.props as { id?: string };
    id = props.id || `f${gen.replace(/:/g, '')}`;
    if (!props.id) child = React.cloneElement(children as React.ReactElement<{ id?: string }>, { id });
  }
  const isGroup = React.isValidElement(children) && !!(children.type as { isGroup?: boolean })?.isGroup;
  return (
    <div className={cx('flex flex-col gap-1.5', className)} role={isGroup ? 'group' : undefined} aria-labelledby={isGroup ? `${id}-l` : undefined}>
      <label id={`${id}-l`} htmlFor={isGroup ? undefined : id} className="text-sm font-medium text-ink">{label}</label>
      {child}
      {error ? <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
const inputCls = 'w-full rounded-lg border border-line bg-surface px-3.5 text-[16px] text-ink placeholder:text-muted/70 transition-shadow focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-60';
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(({ className, invalid, ...p }, ref) => (
  <input ref={ref} {...p} aria-invalid={invalid || undefined} className={cx(inputCls, 'h-11', invalid && 'border-rose-500 focus:ring-rose-500/15', className)} />
));
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} {...p} className={cx(inputCls, 'py-3 leading-relaxed', className)} />
));
export function Select({ className, options, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: (string | { value: string; label: string })[] }) {
  return (
    <select {...p} className={cx(inputCls, 'h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9 select-chevron', className)}>
      {options.map((o) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
export function NumberInput({ value, onChange, min, max, step, placeholder, id, invalid, className, ...rest }: { value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; placeholder?: string; id?: string; invalid?: boolean; className?: string; 'aria-label'?: string }) {
  const [txt, setTxt] = useState(value === null ? '' : String(value));
  useEffect(() => { setTxt(value === null ? '' : String(value)); }, [value]);
  return <Input {...rest} id={id} inputMode="decimal" value={txt} placeholder={placeholder} invalid={invalid} className={className}
    onChange={(e) => { const t = e.target.value; setTxt(t); if (t.trim() === '') return onChange(null); const n = Number(t); if (!Number.isNaN(n)) onChange(n); }}
    min={min} max={max} step={step} />;
}

export function Toggle({ checked, onChange, label, desc, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string; id?: string }) {
  const gen = useId(); const tid = id || gen;
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <label htmlFor={tid} className="min-w-0 cursor-pointer"><span className="block text-sm font-medium text-ink">{label}</span>{desc && <span className="block text-xs text-muted">{desc}</span>}</label>
      <button id={tid} role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cx('relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent', checked ? 'bg-accent' : 'bg-line-strong')}>
        <span className={cx('absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200', checked && 'translate-x-5')} />
      </button>
    </div>
  );
}

export function Chips({ options, value, onChange, multi = true }: { options: string[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((o) => {
        const on = value.includes(o);
        return <button key={o} type="button" aria-pressed={on} onClick={() => onChange(multi ? (on ? value.filter((x) => x !== o) : [...value, o]) : [o])}
          className={cx('min-h-9 rounded-full border px-3.5 text-sm transition-all active:scale-95', on ? 'border-accent bg-accent text-white shadow-sm' : 'border-line bg-surface text-ink hover:border-ink/25')}>{o}</button>;
      })}
    </div>
  );
}

(Chips as unknown as { isGroup: boolean }).isGroup = true;

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);
  const labels = tabs.map((t) => t.label + (t.count ?? '')).join('|');
  useEffect(() => {
    const box = ref.current; if (!box) return;
    const measure = () => {
      const el = box.querySelector<HTMLButtonElement>(`[data-tab="${value}"]`);
      if (!el) return;
      setInd({ left: el.offsetLeft, width: el.offsetWidth });
      if (el.offsetLeft < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollTo({ left: Math.max(0, el.offsetLeft - 24) });
    };
    measure();
    // Re-measure once the web font loads and whenever the strip resizes (label widths change).
    document.fonts?.ready.then(measure).catch(() => {});
    const ro = new ResizeObserver(measure); ro.observe(box);
    const t = setTimeout(() => setReady(true), 60); // no slide animation on first paint
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [value, labels]);
  return (
    <div ref={ref} role="tablist" className={cx('no-scrollbar relative flex gap-1 overflow-x-auto rounded-xl bg-raised p-1', className)}
      onKeyDown={(e) => { const i = tabs.findIndex((t) => t.id === value); if (e.key === 'ArrowRight') onChange(tabs[(i + 1) % tabs.length].id); if (e.key === 'ArrowLeft') onChange(tabs[(i - 1 + tabs.length) % tabs.length].id); }}>
      <span aria-hidden className={cx('absolute top-1 bottom-1 rounded-lg bg-surface shadow-sm', ready && 'tab-ind')} style={{ left: ind.left, width: ind.width, opacity: ind.width ? 1 : 0 }} />
      {tabs.map((t) => (
        <button key={t.id} data-tab={t.id} role="tab" aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1} onClick={() => onChange(t.id)}
          className={cx('relative z-10 h-9 shrink-0 rounded-lg px-3.5 text-sm font-medium transition-colors', value === t.id ? 'text-ink' : 'text-muted hover:text-ink')}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 text-xs text-muted tabular-nums">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const [mounted, setMounted] = useState(open);
  const [show, setShow] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) { setMounted(true); requestAnimationFrame(() => requestAnimationFrame(() => setShow(true))); }
    else { setShow(false); const t = setTimeout(() => setMounted(false), 200); return () => clearTimeout(t); }
  }, [open]);
  // Keep the latest onClose in a ref so this effect runs only when the modal opens/closes —
  // not on every parent re-render (which used to steal focus back to the first field while typing).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', k);
    const t = setTimeout(() => { if (!panel.current?.contains(document.activeElement)) panel.current?.querySelector<HTMLElement>('input,textarea,select,button:not([data-close])')?.focus(); }, 60);
    return () => { clearTimeout(t); window.removeEventListener('keydown', k); prev?.focus?.(); };
  }, [open]);
  if (!mounted) return null;
  return (
    <Portal>
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className={cx('absolute inset-0 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-200', show ? 'opacity-100' : 'opacity-0')} onClick={onClose} />
      <div ref={panel} className={cx('relative flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-line bg-surface shadow-2xl transition-all duration-200 sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg', show ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-8 opacity-0 sm:translate-y-2 sm:scale-[0.98]')}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button data-close onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"><LuX /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
    </Portal>
  );
}

// ---- Confirm dialog (window.confirm is not used: it is blocked in sandboxed frames) ----
type ConfirmReq = { title: string; body: string; action: string; danger?: boolean; resolve: (ok: boolean) => void };
const ConfirmCtx = createContext<(o: Omit<ConfirmReq, 'resolve'>) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

// ---- Toasts ----
type Toast = { id: number; text: string; tone: 'success' | 'info' | 'error'; leaving?: boolean };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function Providers({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [req, setReq] = useState<ConfirmReq | null>(null);
  const toast = (text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), 3400);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3650);
  };
  const confirm = (o: Omit<ConfirmReq, 'resolve'>) => new Promise<boolean>((resolve) => setReq({ ...o, resolve }));
  const close = (ok: boolean) => { req?.resolve(ok); setReq(null); };
  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <Modal open={!!req} onClose={() => close(false)} title={req?.title || ''} footer={<><Button variant="ghost" onClick={() => close(false)}>Cancel</Button><Button variant={req?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{req?.action}</Button></>}>
          <p className="text-sm leading-relaxed text-muted">{req?.body}</p>
        </Modal>
        <Portal><div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(148px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4 lg:bottom-24 lg:items-end lg:pr-6">
          {toasts.map((t) => (
            <div key={t.id} className={cx(t.leaving ? 'toast-out' : 'toast-in', 'pointer-events-auto flex')} data-tone={t.tone}><div className="flex max-w-sm items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-lift">
              {t.tone === 'success' ? <LuCircleCheck className="shrink-0 text-emerald-500" /> : t.tone === 'error' ? <LuTriangleAlert className="shrink-0 text-rose-500" /> : <LuInfo className="shrink-0 text-accent" />}
              {t.text}
            </div></div>
          ))}
        </div></Portal>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

export function Skeleton({ className }: { className?: string }) { return <div className={cx('skeleton rounded-lg', className)} />; }

export function Counter({ value, decimals = 0, prefix = '', suffix = '', duration = 900, className, group = true }: { value: number | null; decimals?: number; prefix?: string; suffix?: string; duration?: number; className?: string; group?: boolean }) {
  const [v, setV] = useState(prefersReducedMotion() ? value ?? 0 : 0);
  const shown = useRef(v); // number currently on screen, so an interrupted count continues smoothly
  useEffect(() => {
    if (value === null) return;
    if (prefersReducedMotion()) { shown.current = value; setV(value); return; }
    const start = performance.now(), a = shown.current;
    if (a === value) return;
    let raf = 0;
    const tick = (t: number) => { const p = Math.min(1, (t - start) / duration); const e = 1 - (1 - p) ** 3; const nv = a + (value - a) * e; shown.current = nv; setV(nv); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  if (value === null) return <span className={className}>—</span>;
  return <span className={cx('tabular-nums', className)}>{prefix}{v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: group })}{suffix}</span>;
}

export function Progress({ value, tone = 'accent', className, label }: { value: number; tone?: 'accent' | 'teal' | 'violet' | 'amber'; className?: string; label?: string }) {
  const bg = { accent: 'bg-accent', teal: 'bg-teal-500', violet: 'bg-violet-500', amber: 'bg-amber-500' }[tone];
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-raised', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cx('grow-x h-full rounded-full', bg)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, label, tone = 'var(--accent)' }: { value: number; size?: number; stroke?: number; label?: React.ReactNode; tone?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--raised)" strokeWidth={stroke} />
        <circle className="ring-draw" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)} style={{ ['--c' as string]: c }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums text-ink">{label ?? `${Math.round(value)}%`}</div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4">{icon ? <div className="grid h-12 w-12 place-items-center rounded-md border-[1.5px] border-ink bg-mustard text-xl text-ink">{icon}</div> : <BooksSpot />}</div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, desc, actions, eyebrow }: { title: string; desc?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <div className="mb-2 text-sm font-medium text-accent">{eyebrow}</div>}
        <h1 className="text-balance text-[40px] font-extrabold leading-[0.95] text-ink sm:text-[54px]">{title}</h1>
        {desc && <p className="mt-2 text-[15px] leading-relaxed text-muted">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Card hover className="p-4 sm:p-5">
      <div className="flex items-center justify-between text-sm text-muted"><span>{label}</span>{icon && <span className="text-accent">{icon}</span>}</div>
      <div className="font-display mt-2 text-[40px] font-extrabold leading-none text-ink tabular-nums">{value}</div>
      {sub && <div className="mt-2 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

export type Provenance = 'Verified' | 'Unverified (recall)' | 'Estimated' | 'Self-reported' | 'Historical' | 'AI interpretation' | 'Example data' | 'Unavailable';
const PROV_TONE: Record<Provenance, string> = { Verified: 'green', 'Unverified (recall)': 'amber', Estimated: 'blue', 'Self-reported': 'violet', Historical: 'neutral', 'AI interpretation': 'violet', 'Example data': 'neutral', Unavailable: 'neutral' };

export function SourceTag({ kind, source, url, year, confidence, retrieved, multi }: { kind: Provenance; source?: string; url?: string; year?: string; confidence?: string; retrieved?: string; multi?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="rounded-full focus-visible:outline-2 focus-visible:outline-accent">
        <Badge tone={PROV_TONE[kind]}>{kind === 'Verified' && <LuBadgeCheck />}{kind}</Badge>
      </button>
      {open && (
        <span className="pop-in absolute right-0 top-7 z-50 w-72 rounded-xl border border-line bg-surface p-3.5 text-left text-xs leading-relaxed text-muted shadow-lift">
          <span className="mb-1 block font-semibold text-ink">Data provenance</span>
          <span className="block"><b className="text-ink">Status:</b> {kind}</span>
          {source && <span className="block"><b className="text-ink">Source:</b> {source}</span>}
          {year && <span className="block"><b className="text-ink">Reporting year:</b> {year}</span>}
          {retrieved && <span className="block"><b className="text-ink">Collected:</b> {retrieved}</span>}
          {confidence && <span className="block"><b className="text-ink">Confidence:</b> {confidence}</span>}
          <span className="block"><b className="text-ink">Multiple sources:</b> {multi ? 'Yes' : 'No'}</span>
          {url && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium text-accent hover:underline">Check source <LuExternalLink /></a>}
        </span>
      )}
    </span>
  );
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warn' | 'ok'; children: React.ReactNode; className?: string }) {
  const t = { info: 'border-accent/20 bg-accent/[0.06] text-ink', warn: 'border-amber-500/30 bg-amber-500/[0.08] text-ink', ok: 'border-emerald-500/25 bg-emerald-500/[0.07] text-ink' }[tone];
  const I = tone === 'warn' ? LuTriangleAlert : tone === 'ok' ? LuCircleCheck : LuInfo;
  return <div className={cx('flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed', t, className)}><I className={cx('mt-0.5 shrink-0', tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-emerald-600' : 'text-accent')} /><div className="min-w-0">{children}</div></div>;
}

export function ExtLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={cx('inline-flex items-center gap-1 font-medium text-accent hover:underline', className)}>{children}<LuExternalLink className="shrink-0 text-[0.85em]" /></a>;
}

export function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch { return false; }
  }
}
export function downloadFile(name: string, content: string, type = 'text/plain') {
  try {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000); return true;
  } catch { return false; }
}
