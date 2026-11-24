import React, { useEffect, useRef, useState } from 'react';
import { LuCircleHelp } from 'react-icons/lu';
import { findTerm } from '../lib/glossary';
import { SpeakButton } from './assistant';

/** Tap-to-explain jargon: <Term t="net price">Avg net price</Term> */
export function Term({ t, children, icon = false }: { t: string; children?: React.ReactNode; icon?: boolean }) {
  const def = findTerm(t);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  if (!def) return <>{children ?? t}</>;
  return (
    <span ref={ref} className="relative inline">
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(!open); }} aria-expanded={open}
        className="inline cursor-help text-left underline decoration-dotted decoration-from-font underline-offset-[3px] decoration-muted/60 hover:decoration-accent">
        {children ?? t}{icon && <LuCircleHelp className="ml-1 inline align-[-2px] text-[0.9em] text-muted" />}
      </button>
      {open && (
        <span role="tooltip" className="absolute left-0 top-full z-50 mt-2 block w-72 max-w-[80vw]">
          <span className="pop-in block rounded-xl border border-line bg-surface p-3.5 text-left text-[13px] font-normal leading-relaxed text-muted shadow-lift">
            <span className="mb-1 flex items-center justify-between gap-2"><b className="text-sm text-ink">{def.term}</b><SpeakButton text={`${def.term}. ${def.short} ${def.detail || ''}`} /></span>
            <span className="block text-ink/90">{def.short}</span>
            {def.detail && <span className="mt-1.5 block">{def.detail}</span>}
            <a href="#glossary" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">All terms →</a>
          </span>
        </span>
      )}
    </span>
  );
}
