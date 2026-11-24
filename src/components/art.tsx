import React from 'react';

// Hand-drawn (in code) illustrations. Everything uses theme variables so it re-colors for dark mode.

const PENNANT_COLORS = [['var(--ivy)', 'var(--mustard)'], ['var(--accent)', 'var(--surface)'], ['var(--sky)', 'var(--surface)'], ['var(--mustard)', 'var(--ink)'], ['var(--c8)', 'var(--surface)'], ['var(--c6)', 'var(--surface)'], ['var(--c5)', 'var(--surface)']];
const hash = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const initials = (name: string) => {
  const skip = new Set(['of', 'the', 'at', 'and', '–', '-', 'university', 'college', 'institute']);
  const words = name.replace(/[–—-].*$/, '').split(/\s+/).filter((w) => !skip.has(w.toLowerCase()));
  const s = words.map((w) => w[0]).join('').toUpperCase();
  return (s || name.slice(0, 2)).slice(0, 3);
};

/** A felt pennant with the college's initials. Generic shape + AdmitIQ palette — not the school's logo or colors. */
export function Pennant({ name, id, size = 44, className }: { name: string; id: string; size?: number; className?: string }) {
  const [bg, fg] = PENNANT_COLORS[hash(id) % PENNANT_COLORS.length];
  const w = size * 1.5, h = size;
  const txt = initials(name);
  return (
    <svg width={w} height={h} viewBox="0 0 60 40" className={className} aria-hidden>
      <rect x="0" y="0" width="3" height="40" rx="1.2" fill="var(--ink)" />
      <path d="M3 3 L58 20 L3 37 Z" fill={bg} stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3 3 L9 4.8 L9 35.2 L3 37 Z" fill="var(--ink)" opacity=".18" />
      <text x="24" y="21.5" textAnchor="middle" dominantBaseline="middle" fontFamily="Big Shoulders Display, sans-serif" fontWeight="800" fontSize={txt.length > 2 ? 11 : 13} fill={fg} letterSpacing=".5" transform="rotate(17 24 21)">{txt}</text>
    </svg>
  );
}

/** Campus scene for the landing hero: clock tower, halls, quad trees and a string of pennants. */
export function CampusScene({ className }: { className?: string }) {
  const win = (x: number, y: number, k: string) => <rect key={k} x={x} y={y} width="7" height="11" rx="3.5" fill="var(--mustard)" opacity=".9" />;
  return (
    <svg viewBox="0 0 640 440" className={className} role="img" aria-label="Illustration of a college campus with a clock tower, halls, trees and pennants">
      <rect width="640" height="440" fill="var(--sky)" opacity=".18" />
      <circle cx="520" cy="92" r="46" fill="var(--mustard)" opacity=".9" />
      <circle cx="520" cy="92" r="64" fill="var(--mustard)" opacity=".15" />
      {/* distant hills */}
      <path d="M0 300 Q120 240 240 286 T480 270 T640 280 V440 H0 Z" fill="var(--ivy)" opacity=".25" />
      {/* left hall */}
      <g stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M40 330 V220 L110 180 L180 220 V330 Z" fill="var(--surface)" />
        <path d="M40 220 L110 180 L180 220" fill="none" />
        <rect x="96" y="276" width="28" height="54" rx="14" fill="var(--ivy)" />
      </g>
      {[60, 80, 140, 160].flatMap((x) => [win(x, 232, `a${x}`), win(x, 260, `b${x}`)])}
      {/* clock tower */}
      <g stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M262 330 V150 H338 V330 Z" fill="var(--surface)" />
        <path d="M256 150 L300 74 L344 150 Z" fill="var(--accent)" />
        <path d="M296 74 V52" />
        <path d="M296 52 L314 58 L296 64" fill="var(--mustard)" />
        <circle cx="300" cy="186" r="22" fill="var(--canvas)" />
        <path d="M300 186 V172 M300 186 L311 192" strokeLinecap="round" />
        <rect x="284" y="282" width="32" height="48" rx="16" fill="var(--ivy)" />
      </g>
      {win(275, 228, 't1')}{win(318, 228, 't2')}{win(275, 252, 't3')}{win(318, 252, 't4')}
      {/* right hall with columns */}
      <g stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M380 330 V236 H600 V330 Z" fill="var(--surface)" />
        <path d="M368 236 L490 196 L612 236 Z" fill="var(--canvas)" />
        {[402, 436, 470, 504, 538, 572].map((x) => <path key={x} d={`M${x} 250 V318`} />)}
        <path d="M380 318 H600" />
      </g>
      {/* quad + path */}
      <path d="M0 330 H640 V440 H0 Z" fill="var(--ivy)" />
      <path d="M268 440 L292 330 H308 L332 440 Z" fill="var(--canvas)" opacity=".85" />
      {/* trees */}
      {[[26, 312, 30], [212, 318, 26], [360, 316, 24], [620, 312, 30]].map(([x, y, r], i) => (
        <g key={i} stroke="var(--ink)" strokeWidth="2.2"><path d={`M${x} ${y + r * 0.6} V${y + r + 26}`} /><circle cx={x} cy={y} r={r} fill="var(--teal)" /><circle cx={x - r * 0.35} cy={y - r * 0.3} r={r * 0.32} fill="var(--surface)" opacity=".18" stroke="none" /></g>
      ))}
      {/* pennant string */}
      <path d="M0 40 Q160 92 320 58 T640 46" fill="none" stroke="var(--ink)" strokeWidth="1.6" />
      {[[40, 54, 'var(--accent)'], [110, 72, 'var(--ivy)'], [180, 78, 'var(--mustard)'], [250, 70, 'var(--sky)'], [390, 52, 'var(--accent)'], [450, 48, 'var(--ivy)'], [580, 46, 'var(--mustard)']].map(([x, y, c], i) => (
        <path key={i} d={`M${x} ${y} l26 2 l-12 30 Z`} fill={c as string} stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" className="sway" style={{ transformOrigin: `${Number(x) + 13}px ${y}px`, animationDelay: `${i * 0.35}s` }} />
      ))}
    </svg>
  );
}

/** Small spot illustration for empty states: a stack of books with a pennant. */
export function BooksSpot({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 120 96" aria-hidden>
      <g stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round">
        <rect x="18" y="70" width="84" height="16" rx="2" fill="var(--accent)" />
        <rect x="24" y="54" width="74" height="16" rx="2" fill="var(--mustard)" />
        <rect x="14" y="38" width="80" height="16" rx="2" fill="var(--ivy)" />
        <path d="M86 38 V8" /><path d="M86 8 L110 15 L86 22 Z" fill="var(--sky)" />
      </g>
      <path d="M26 46 H60 M34 62 H70 M30 78 H64" stroke="var(--surface)" strokeWidth="2" opacity=".7" />
    </svg>
  );
}
