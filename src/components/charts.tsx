import React, { useEffect, useRef, useState } from 'react';
import { Card, cx } from './ui';

export const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)', 'var(--c9)', 'var(--c10)'];

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function ChartCard({ title, desc, source, date, legend, children, className, action }: { title: string; desc?: string; source: string; date?: string; legend?: { label: string; color: string; dashed?: boolean }[]; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <Card as="section" className={cx('flex flex-col p-5', className)} aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>{desc && <p className="mt-0.5 text-sm text-muted">{desc}</p>}</div>
        {action}
      </div>
      {legend && legend.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
          {legend.map((l) => <li key={l.label} className="flex items-center gap-1.5"><span className={cx('inline-block h-2.5 w-2.5 rounded-sm', l.dashed && 'rounded-none border-t-2 border-dashed bg-transparent! h-0 w-3.5')} style={{ background: l.dashed ? undefined : l.color, borderColor: l.color }} />{l.label}</li>)}
        </ul>
      )}
      <div className="mt-4 flex-1">{children}</div>
      <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-muted">Source: {source}{date ? ` · ${date}` : ''}</p>
    </Card>
  );
}

function Tip({ x, y, children, w }: { x: number; y: number; children: React.ReactNode; w: number }) {
  const left = Math.max(8, Math.min(x, w - 188));
  // Outer element positions (transform); inner element animates — otherwise the pop-in keyframes override the offset.
  return <div role="status" className="pointer-events-none absolute z-20 w-[180px]" style={{ left, top: Math.max(0, y - 8), transform: 'translateY(-100%)' }}><div className="pop-in rounded-lg border border-line bg-surface/95 px-3 py-2 text-xs text-ink shadow-lift backdrop-blur">{children}</div></div>;
}

// ---- Horizontal bars (HTML) ----
export function HBars({ data, max, format = (v) => String(v), empty = 'No data' }: { data: { label: string; value: number | null; color?: string; note?: string; highlight?: boolean }[]; max?: number; format?: (v: number) => string; empty?: string }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.value ?? 0));
  if (!data.length) return <p className="py-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={d.label + i} className="group grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]" title={d.note}>
          <span className={cx('truncate', d.highlight ? 'font-semibold text-ink' : 'text-muted')}>{d.label}</span>
          <span className="relative h-6 overflow-hidden rounded-md bg-raised">
            {d.value !== null && <span className="grow-x absolute inset-y-0 left-0 rounded-md transition-[filter] group-hover:brightness-110" style={{ width: `${(d.value / m) * 100}%`, background: d.color || 'var(--accent)', animationDelay: `${i * 40}ms` }} />}
          </span>
          <span className="w-20 text-right font-medium tabular-nums text-ink">{d.value === null ? <span className="text-muted">Unavail.</span> : format(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}

// ---- Range chart: college middle-50% band vs. student's value ----
export function RangeChart({ rows, min, max, you, youLabel, format = (v) => String(v) }: { rows: { label: string; lo: number | null; hi: number | null; note?: string }[]; min: number; max: number; you: number | null; youLabel: string; format?: (v: number) => string }) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="relative">
      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <div key={r.label} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-3 text-sm sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${r.label}: ${r.lo !== null ? `${format(r.lo)} to ${format(r.hi!)}` : 'unavailable'}`}>
            <span className="truncate text-muted">{r.label}</span>
            <span className="relative h-7 rounded-md bg-raised/70">
              {r.lo !== null && r.hi !== null ? (
                <span className="grow-x absolute inset-y-1.5 rounded-full" style={{ left: `${pct(r.lo)}%`, width: `${pct(r.hi) - pct(r.lo)}%`, background: you !== null && you >= r.hi ? 'var(--c3)' : you !== null && you < r.lo ? 'var(--c2)' : 'var(--c1)', opacity: 0.85, animationDelay: `${i * 40}ms` }} />
              ) : <span className="absolute inset-0 grid place-items-center text-xs text-muted">{r.note || 'Unavailable'}</span>}
              {hover === i && r.lo !== null && <span className="pop-in absolute -top-8 z-10 rounded-md border border-line bg-surface px-2 py-1 text-xs whitespace-nowrap text-ink shadow" style={{ left: `${pct(r.lo)}%` }}>25th {format(r.lo)} · 75th {format(r.hi!)}</span>}
            </span>
          </div>
        ))}
      </div>
      {you !== null && you >= min && you <= max && (
        <div className="pointer-events-none absolute inset-y-0 grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] w-full" aria-hidden>
          <span />
          <span className="relative">
            <span className="absolute -top-1 -bottom-1 border-l-2 border-dashed border-ink" style={{ left: `${pct(you)}%` }} />
            <span className="absolute -top-6 -translate-x-1/2 rounded bg-ink px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-canvas" style={{ left: `${pct(you)}%` }}>{youLabel} {format(you)}</span>
          </span>
        </div>
      )}
      <div className="mt-2 grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-3 text-[11px] text-muted sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"><span /><span className="flex justify-between tabular-nums"><span>{format(min)}</span><span>{format(Math.round((min + max) / 2))}</span><span>{format(max)}</span></span></div>
    </div>
  );
}

// ---- Line chart (SVG) ----
export function LineChart({ series, labels, yMin, yMax, format = (v) => v.toFixed(2), height = 220, yTicks = 4 }: { series: { name: string; color: string; values: (number | null)[]; dashed?: boolean }[]; labels: string[]; yMin: number; yMax: number; format?: (v: number) => string; height?: number; yTicks?: number }) {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const pad = { l: 40, r: 12, t: 12, b: 28 };
  const W = Math.max(w, 200), H = height;
  const x = (i: number) => pad.l + (labels.length <= 1 ? (W - pad.l - pad.r) / 2 : (i / (labels.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const narrow = W < 420;
  const step = narrow ? Math.ceil(labels.length / 4) : Math.ceil(labels.length / 8);
  return (
    <div ref={ref} className="relative" style={{ height: H }}>
      {w > 0 && (
        <svg width={W} height={H} role="img" aria-label={`Line chart: ${series.map((s) => s.name).join(', ')}`} onMouseLeave={() => setHi(null)}
          onMouseMove={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); const px = e.clientX - r.left; let best = 0, d = Infinity; labels.forEach((_, i) => { const dd = Math.abs(x(i) - px); if (dd < d) { d = dd; best = i; } }); setHi(best); }}>
          {Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTicks).map((t) => (
            <g key={t}><line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" /><text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{format(t)}</text></g>
          ))}
          {labels.map((l, i) => i % step === 0 && <text key={l + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{l}</text>)}
          {series.map((s) => {
            const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)] as const)).filter(Boolean) as [number, number][];
            if (!pts.length) return null;
            const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
            return (
              <g key={s.name}>
                <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className={s.dashed ? '' : 'line-draw'} strokeDasharray={s.dashed ? '5 5' : undefined} pathLength={s.dashed ? undefined : 1} />
                {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="var(--surface)" stroke={s.color} strokeWidth="2" className="fade-in" style={{ animationDelay: `${300 + i * 40}ms` }} />)}
              </g>
            );
          })}
          {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={pad.t} y2={H - pad.b} stroke="var(--muted)" strokeDasharray="3 3" />}
        </svg>
      )}
      {hi !== null && (
        <Tip x={x(hi) - 90} y={pad.t + 20} w={W}>
          <div className="mb-1 font-semibold">{labels[hi]}</div>
          {series.map((s) => <div key={s.name} className="flex justify-between gap-2"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span><span className="tabular-nums">{s.values[hi] === null ? '—' : format(s.values[hi]!)}</span></div>)}
        </Tip>
      )}
    </div>
  );
}

// ---- Radar chart (SVG) ----
export function Radar({ axes, series, size = 300 }: { axes: string[]; series: { name: string; color: string; values: (number | null)[]; raw: string[] }[]; size?: number }) {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const [hi, setHi] = useState<{ s: number; a: number } | null>(null);
  const S = Math.min(size, Math.max(220, w)), cxp = S / 2, cyp = S / 2, R = S / 2 - 46;
  const ang = (i: number) => -Math.PI / 2 + (i / axes.length) * Math.PI * 2;
  const pt = (i: number, v: number) => [cxp + Math.cos(ang(i)) * R * v, cyp + Math.sin(ang(i)) * R * v] as const;
  return (
    <div ref={ref} className="relative flex justify-center">
      {w > 0 && (
        <svg width={S} height={S} role="img" aria-label="Radar chart comparing normalized metrics">
          {[0.25, 0.5, 0.75, 1].map((r) => <polygon key={r} points={axes.map((_, i) => pt(i, r).join(',')).join(' ')} fill="none" stroke="var(--line)" />)}
          {axes.map((a, i) => { const [px, py] = pt(i, 1); const [lx, ly] = pt(i, 1.16); return (<g key={a}><line x1={cxp} y1={cyp} x2={px} y2={py} stroke="var(--line)" /><text x={lx} y={ly + 4} textAnchor={Math.abs(lx - cxp) < 8 ? 'middle' : lx > cxp ? 'start' : 'end'} fontSize="11" fill="var(--muted)">{a}</text></g>); })}
          {series.map((s, si) => (
            <g key={s.name} className="radar-in" style={{ transformOrigin: `${cxp}px ${cyp}px`, animationDelay: `${si * 80}ms` }}>
              <polygon points={s.values.map((v, i) => pt(i, v ?? 0).join(',')).join(' ')} fill={s.color} fillOpacity={hi && hi.s !== si ? 0.04 : 0.12} stroke={s.color} strokeWidth={2} strokeOpacity={hi && hi.s !== si ? 0.3 : 1} />
              {s.values.map((v, i) => v === null ? null : <circle key={i} cx={pt(i, v)[0]} cy={pt(i, v)[1]} r={hi?.s === si && hi.a === i ? 6 : 4} fill={s.color} tabIndex={0} onMouseEnter={() => setHi({ s: si, a: i })} onMouseLeave={() => setHi(null)} onFocus={() => setHi({ s: si, a: i })} onBlur={() => setHi(null)} aria-label={`${s.name} ${axes[i]}: ${s.raw[i]}`} />)}
            </g>
          ))}
        </svg>
      )}
      {hi && <Tip x={pt(hi.a, series[hi.s].values[hi.a] ?? 0)[0] + (w - S) / 2 - 90} y={pt(hi.a, series[hi.s].values[hi.a] ?? 0)[1]} w={w}><div className="font-semibold">{series[hi.s].name}</div><div>{axes[hi.a]}: {series[hi.s].raw[hi.a]}</div></Tip>}
    </div>
  );
}

// ---- Stacked horizontal bars (HTML) ----
export function StackedBars({ rows, keys, format }: { rows: { label: string; parts: Record<string, number>; total?: number | null; note?: string }[]; keys: { key: string; label: string; color: string }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => keys.reduce((a, k) => a + (r.parts[k.key] || 0), 0)));
  const [hi, setHi] = useState<string | null>(null);
  return (
    <ul className="space-y-3">
      {rows.map((r, ri) => {
        const total = keys.reduce((a, k) => a + (r.parts[k.key] || 0), 0);
        return (
          <li key={r.label} className="text-sm">
            <div className="mb-1 flex justify-between gap-2"><span className="truncate text-ink">{r.label}</span><span className="font-medium tabular-nums text-ink">{r.total === null ? <span className="text-muted">Unavailable</span> : format(r.total ?? total)}</span></div>
            <div className="flex h-6 overflow-hidden rounded-md bg-raised" style={{ width: `${(total / max) * 100}%`, minWidth: total ? 24 : 0 }}>
              {keys.map((k, ki) => r.parts[k.key] ? (
                <span key={k.key} className="grow-x relative h-full border-r border-surface/60 last:border-0 transition-opacity" tabIndex={0} aria-label={`${r.label} ${k.label}: ${format(r.parts[k.key])}`}
                  onMouseEnter={() => setHi(`${ri}-${k.key}`)} onMouseLeave={() => setHi(null)} onFocus={() => setHi(`${ri}-${k.key}`)} onBlur={() => setHi(null)}
                  style={{ width: `${(r.parts[k.key] / total) * 100}%`, background: k.color, opacity: hi && hi !== `${ri}-${k.key}` ? 0.55 : 1, animationDelay: `${ri * 50 + ki * 30}ms` }} />
              ) : null)}
            </div>
            {hi?.startsWith(`${ri}-`) && <div className="mt-1 text-xs text-muted">{keys.find((k) => `${ri}-${k.key}` === hi)?.label}: <b className="text-ink">{format(r.parts[hi.split('-').slice(1).join('-')])}</b></div>}
            {r.note && <div className="mt-1 text-xs text-muted">{r.note}</div>}
          </li>
        );
      })}
    </ul>
  );
}

// ---- Donut (SVG) ----
export function Donut({ parts, size = 150, center }: { parts: { label: string; value: number; color: string }[]; size?: number; center?: React.ReactNode }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = size / 2 - 12, c = 2 * Math.PI * r;
  let acc = 0;
  const [hi, setHi] = useState<number | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(', ')}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--raised)" strokeWidth="16" />
          {total > 0 && parts.map((p, i) => {
            const len = (p.value / total) * c; const off = acc; acc += len;
            return <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={hi === i ? 20 : 16} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-off} className="donut-seg" style={{ animationDelay: `${i * 90}ms` }} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} />;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">{hi !== null ? <div><div className="text-lg font-semibold text-ink tabular-nums">{parts[hi].value}</div><div className="text-[11px] text-muted">{parts[hi].label}</div></div> : center}</div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {parts.map((p, i) => <li key={p.label} className="flex items-center gap-2" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} /><span className="text-muted">{p.label}</span><span className="ml-auto pl-4 font-medium tabular-nums text-ink">{p.value}</span></li>)}
      </ul>
    </div>
  );
}

// ---- Vertical column chart (for essay scores over drafts etc.) ----
export function Columns({ data, max, format = (v) => String(v), height = 180 }: { data: { label: string; value: number; color?: string }[]; max: number; format?: (v: number) => string; height?: number }) {
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={d.label + i} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 h-full" title={`${d.label}: ${format(d.value)}`}>
          <span className="text-xs font-medium tabular-nums text-ink">{format(d.value)}</span>
          <span className="grow-y w-full max-w-14 rounded-t-lg transition-[filter] group-hover:brightness-110" style={{ height: `${(d.value / max) * (height - 44)}px`, background: d.color || 'var(--accent)', animationDelay: `${i * 60}ms` }} />
          <span className="w-full truncate text-center text-[11px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
