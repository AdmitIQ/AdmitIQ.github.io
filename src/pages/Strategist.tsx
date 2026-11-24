import React, { useEffect, useRef, useState } from 'react';
import { LuSend, LuSparkles, LuUser, LuTrash2 } from 'react-icons/lu';
import { useCaps } from '../App';
import { Badge, Button, Card, ExtLink, Notice, PageHeader, Textarea, Toggle, cx } from '../components/ui';
import { store, useStore } from '../lib/store';
import { SUGGESTED, answer, contextForLLM, type Answer, type Tag } from '../lib/strategist';
import { ai } from '../lib/services';
import { MicButton } from '../components/assistant';
import { speak, stopSpeaking, useListener } from '../lib/voice';

type Msg = { role: 'user' | 'assistant'; text?: string; answer?: Answer; llm?: string; error?: string; pending?: boolean };
const TAG_TONE: Record<Tag, string> = { Data: 'blue', Opinion: 'violet', 'Missing info': 'amber', 'From your profile': 'teal' };
const KEY = 'admitiq:chat';

function AnswerView({ a }: { a: Answer }) {
  return (
    <div className="space-y-3">
      {a.blocks.map((b, i) => (
        <div key={i}>
          <div className="flex items-start gap-2"><Badge tone={TAG_TONE[b.tag]} className="mt-0.5 shrink-0">{b.tag}</Badge><p className="text-[15px] text-ink">{b.text}</p></div>
          {b.items && b.items.length > 0 && <ul className="mt-1.5 ml-1 list-disc space-y-1 pl-5 text-[14.5px] text-ink/90">{b.items.map((x) => <li key={x}>{x}</li>)}</ul>}
          {b.sources && b.sources.length > 0 && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">{b.sources.map((s) => <ExtLink key={s.url} href={s.url}>{s.label}</ExtLink>)}</div>}
        </div>
      ))}
    </div>
  );
}

export default function Strategist() {
  const s = useStore((x) => x);
  const { caps } = useCaps();
  const [msgs, setMsgs] = useState<Msg[]>(() => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { return []; } });
  const [q, setQ] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const listener = useListener({ serverTranscribe: !!caps?.ai?.transcribe, onFinal: (t) => { setReadAloud(true); ask(t, true); } });
  // Questions handed over from the voice assistant / command palette.
  const askRef = useRef(ask); askRef.current = ask;
  useEffect(() => {
    const take = () => { try { const q0 = sessionStorage.getItem('admitiq:ask'); if (q0) { sessionStorage.removeItem('admitiq:ask'); askRef.current(q0, true); } } catch { /* ignore */ } };
    take(); window.addEventListener('admitiq:ask', take);
    return () => window.removeEventListener('admitiq:ask', take);
  }, []);
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.filter((m) => !m.pending))); } catch { /* ignore */ } end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs]);

  const toSpeech = (a: Answer) => a.blocks.map((b) => `${b.text} ${(b.items || []).slice(0, 4).join('. ')}`).join(' ').replace(/\s·\s/g, ', ');
  async function ask(text: string, spoken = false) {
    const t = text.trim(); if (!t) return;
    setQ('');
    const rule = answer(t, store.get());
    const say = spoken || readAloud;
    if (!(useAI && caps?.ai)) { setMsgs((m) => [...m, { role: 'user', text: t }, { role: 'assistant', answer: rule }]); if (say) speak(toSpeech(rule)); return; }
    setMsgs((m) => [...m, { role: 'user', text: t }, { role: 'assistant', answer: rule, pending: true }]);
    try {
      const sys = `You are AdmitIQ's college application strategist for a high-school student. Use ONLY the student context and the rule-based analysis provided; do not invent statistics, deadlines, scholarships or experiences. Label every paragraph with [Data] for facts drawn from the provided data, [Opinion] for advice, or [Missing info]. Admissions categories are estimates — never give probabilities. Be concise and specific.\nSTUDENT CONTEXT: ${contextForLLM(store.get())}\nRULE-BASED ANALYSIS: ${JSON.stringify(rule.blocks)}`;
      const history = msgs.filter((m) => m.text || m.llm).slice(-6).map((m) => ({ role: m.role, content: m.text || m.llm || '' }));
      const r = await ai.chat([{ role: 'system', content: sys }, ...history, { role: 'user', content: t }]);
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { role: 'assistant', answer: rule, llm: r.text } : x)));
      if (say) speak(r.text.replace(/\[(Data|Opinion|Missing info)\]/g, ''));
    } catch (e) {
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { role: 'assistant', answer: rule, error: (e as Error).message } : x)));
    }
  }

  return (
    <>
      <PageHeader title="AI strategist" desc="Ask about your list, testing, costs, activities or senior-year plan. Answers use your actual profile and AdmitIQ's college data, and label what's data versus opinion." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="flex min-h-[60vh] flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {!msgs.length && (
              <div className="py-6 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink text-canvas"><LuSparkles /></div>
                <h2 className="mt-3 font-semibold text-ink">What would you like to work on?</h2>
                <div className="mx-auto mt-4 flex max-w-xl flex-wrap justify-center gap-2">{SUGGESTED.map((x) => <button key={x} onClick={() => ask(x)} className="min-h-9 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink transition-colors hover:border-accent/50 hover:bg-accent/5">{x}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => m.role === 'user' ? (
              <div key={i} className="flex justify-end gap-2"><div className="max-w-[85%] rounded-2xl rounded-tr-md bg-ink px-4 py-2.5 text-[15px] text-canvas">{m.text}</div><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-raised text-muted"><LuUser /></span></div>
            ) : (
              <div key={i} className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-canvas"><LuSparkles className="text-sm" /></span>
                <div className="min-w-0 flex-1 space-y-3">
                  {m.pending && <div className="flex items-center gap-2 text-sm text-muted"><span className="pulse-dot h-2 w-2 rounded-full bg-accent" />Asking {caps?.ai?.model}… (showing offline analysis meanwhile)</div>}
                  {m.llm && <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.05] p-4"><Badge tone="violet" className="mb-2">AI interpretation · {caps?.ai?.model}</Badge><div className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{m.llm}</div></div>}
                  {m.error && <Notice tone="warn">AI request failed ({m.error}). Here is the offline analysis.</Notice>}
                  {m.answer && <div className={cx(m.llm && 'opacity-80')}>{m.llm && <p className="mb-2 text-xs font-medium text-muted">Grounding (rule-based analysis):</p>}<AnswerView a={m.answer} /></div>}
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          <form className="flex items-end gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <MicButton listener={listener} label="Ask by voice" />
            <Textarea aria-label="Ask the strategist" rows={1} value={listener.listening && listener.interim ? listener.interim : q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(q); } }} placeholder="Ask a question…" className="max-h-40 min-h-11 flex-1 resize-none py-2.5" />
            <Button type="submit" variant="primary" aria-label="Send" icon={<LuSend />} disabled={!q.trim()} />
          </form>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Mode</h2>
            {caps?.ai ? <Toggle label={`Use ${caps.ai.provider} (${caps.ai.model})`} desc="Sends your profile summary (no essays; budget only if allowed) to the AI provider configured on this server." checked={useAI} onChange={setUseAI} />
              : <p className="mt-1 text-sm text-muted"><b className="text-ink">Offline mode.</b> Answers come from AdmitIQ's rule engine, running in your browser — nothing leaves your device. To enable open-ended AI answers, run the AdmitIQ server with a free or bring-your-own AI provider (see README).</p>}
          </Card>
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Voice</h2>
            <Toggle label="Read answers aloud" desc={listener.supported ? 'Tap the mic to ask by voice; spoken questions are always answered out loud.' : 'Voice input isn\'t available in this browser, but answers can still be read aloud.'} checked={readAloud} onChange={(v) => { setReadAloud(v); if (!v) stopSpeaking(); }} />
            {listener.error && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{listener.error}</p>}
          </Card>
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">How to read answers</h2>
            <ul className="mt-2 space-y-2 text-sm">{(Object.keys(TAG_TONE) as Tag[]).map((t) => <li key={t} className="flex items-start gap-2"><Badge tone={TAG_TONE[t]}>{t}</Badge><span className="text-muted">{{ Data: 'From the college dataset (with source links).', Opinion: 'AdmitIQ judgment or common counselor guidance.', 'Missing info': 'Something to add for a better answer.', 'From your profile': 'What you entered.' }[t]}</span></li>)}</ul>
          </Card>
          {msgs.length > 0 && <Button variant="ghost" icon={<LuTrash2 />} onClick={() => setMsgs([])}>Clear conversation</Button>}
          {s.meta.demo && <p className="text-xs text-muted">Answers reflect the demo student.</p>}
        </div>
      </div>
    </>
  );
}
