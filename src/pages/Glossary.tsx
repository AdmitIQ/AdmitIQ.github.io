import React, { useMemo, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { Card, Chips, EmptyState, Input, PageHeader } from '../components/ui';
import { SpeakButton } from '../components/assistant';
import { GLOSSARY } from '../lib/glossary';

const CATS = ['Applying', 'Testing', 'Admissions data', 'Decisions', 'Paying', 'Loans'] as const;

export default function Glossary() {
  const [q, setQ] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const rows = useMemo(() => GLOSSARY.filter((t) => (!cats.length || cats.includes(t.category)) && (!q || `${t.term} ${t.short} ${t.detail || ''} ${(t.aliases || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.term.localeCompare(b.term)), [q, cats]);
  return (
    <>
      <PageHeader title="Glossary" desc={`${GLOSSARY.length} admissions and financial-aid terms in plain language. Underlined terms anywhere in AdmitIQ open these definitions — or ask the voice assistant "What is…?"`} />
      <div className="mb-5 space-y-3">
        <div className="relative max-w-md"><LuSearch className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" /><Input aria-label="Search terms" className="pl-10" placeholder="Search terms" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Chips options={[...CATS]} value={cats} onChange={setCats} />
      </div>
      {!rows.length ? <Card><EmptyState title="No matching terms" body="Try a different word, or ask the strategist." /></Card> : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((t) => (
            <Card key={t.term} id={t.term.toLowerCase().replace(/[^a-z0-9]+/g, '-')} className="p-5">
              <div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold text-ink">{t.term}</h2><span className="text-xs text-muted">{t.category}</span></div><SpeakButton text={`${t.term}. ${t.short} ${t.detail || ''}`} /></div>
              <p className="mt-2 text-[15px] leading-relaxed text-ink">{t.short}</p>
              {t.detail && <p className="mt-2 text-sm leading-relaxed text-muted">{t.detail}</p>}
            </Card>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-muted">General definitions. Every college sets its own policies — check the official site before relying on a rule.</p>
    </>
  );
}
