import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LuPlus, LuSave, LuUpload, LuTrash2, LuCheck, LuX, LuHistory, LuMessageSquare, LuSparkles, LuRotateCcw, LuFileText, LuLightbulb, LuCopy, LuVolume2 as LuVolume } from 'react-icons/lu';
import { useCaps } from '../App';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Notice, NumberInput, PageHeader, Ring, Select, Tabs, Textarea, copyText, cx, useConfirm, useDebounced, useToast } from '../components/ui';
import { ChartCard, Columns, LineChart } from '../components/charts';
import { ResearchLoader, runSteps, type StepState } from '../components/loader';
import { store, uid, useStore } from '../lib/store';
import { ESSAY_TYPES, type Essay } from '../lib/types';
import { MODES, RUBRIC, RUBRIC_MEASURES, analyzeEssay, applyEdits, diffWords, type Analysis, type Edit } from '../lib/essay';
import { ai } from '../lib/services';
import { docxToText } from '../lib/docx';
import { COLLEGES } from '../data/colleges';
import { fmtDate } from '../lib/format';
import { MicButton } from '../components/assistant';
import { speak, stopSpeaking, useListener, useSpeaking } from '../lib/voice';

const LIMITS: Record<string, number | null> = { 'Common App personal statement': 650, 'Supplemental essay': 250, 'Why This College': 300, 'Why This Major': 300, 'Scholarship essay': 500, 'Additional information': 650, Other: null };
const scoreTone = (v: number) => (v >= 7 ? 'var(--teal)' : v >= 5 ? 'var(--accent)' : 'var(--c5)');

function HighlightedText({ text, a, onPick }: { text: string; a: Analysis; onPick: (e: Edit) => void }) {
  const marks: { start: number; end: number; cls: string; title: string; edit?: Edit }[] = [];
  for (const e of a.edits) marks.push({ start: e.start, end: e.end, cls: e.kind === 'grammar' ? 'hl hl-grammar' : 'hl', title: e.reason, edit: e });
  for (const c of a.cliches) marks.push({ start: c.index, end: c.index + c.phrase.length, cls: 'hl hl-cliche', title: `Cliché: "${c.phrase}"` });
  marks.sort((x, y) => x.start - y.start);
  const out: React.ReactNode[] = []; let pos = 0;
  for (const m of marks) {
    if (m.start < pos) continue;
    out.push(text.slice(pos, m.start));
    out.push(<mark key={m.start} className={m.cls} title={m.title} onClick={() => m.edit && onPick(m.edit)}>{text.slice(m.start, m.end) || '·'}</mark>);
    pos = m.end;
  }
  out.push(text.slice(pos));
  return <div className="whitespace-pre-wrap text-[15.5px] leading-[1.75] text-ink">{out}</div>;
}

export default function Essays() {
  const essays = useStore((s) => s.essays);
  const mode = useStore((s) => s.prefs.essayMode);
  const { caps } = useCaps();
  const toast = useToast();
  const confirm = useConfirm();
  const [activeId, setActiveId] = useState<string | null>(essays[0]?.id || null);
  const [tab, setTab] = useState<'feedback' | 'lines' | 'edits' | 'highlights' | 'drafts' | 'comments' | 'progress' | 'brainstorm'>('feedback');
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'Common App personal statement' as Essay['type'], prompt: '', limit: 650 as number | null, collegeId: '' });
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [cmp, setCmp] = useState<{ a: string; b: string }>({ a: '', b: '' });
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [aiState, setAiState] = useState<{ steps: StepState[] | null; result: Awaited<ReturnType<typeof ai.essay>> | null; error: string }>({ steps: null, result: null, error: '' });
  const taRef = useRef<HTMLTextAreaElement>(null);
  const speaking = useSpeaking();
  // Dictation inserts at the cursor (or the end) and keeps the student's words exactly as spoken.
  const dictation = useListener({ continuous: true, serverTranscribe: !!caps?.ai?.transcribe, onFinal: (t) => {
    const ta = taRef.current; const cur = store.get().essays.find((x) => x.id === essayIdRef.current)?.working ?? '';
    const at = ta && document.activeElement === ta ? ta.selectionStart : cur.length;
    const before = cur.slice(0, at), after = cur.slice(at);
    const chunk = (before && !/\s$/.test(before) ? ' ' : '') + t.replace(/^\w/, (m) => (!before.trim() || /[.!?]\s*$/.test(before) ? m.toUpperCase() : m));
    store.set((st) => { const e = st.essays.find((x) => x.id === essayIdRef.current); if (e) { e.working = before + chunk + after; e.updatedAt = new Date().toISOString(); } });
  } });
  const essayIdRef = useRef<string | undefined>(undefined);
  useEffect(() => () => { stopSpeaking(); }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const essay = essays.find((e) => e.id === activeId) || essays[0];
  useEffect(() => { if (!activeId && essays[0]) setActiveId(essays[0].id); }, [essays.length]);
  const text = essay?.working || '';
  essayIdRef.current = essay?.id;
  useEffect(() => {
    try {
      if (sessionStorage.getItem('admitiq:newEssay')) { sessionStorage.removeItem('admitiq:newEssay'); setNewOpen(true); }
      if (sessionStorage.getItem('admitiq:readEssay')) { sessionStorage.removeItem('admitiq:readEssay'); if (essay?.working) speak(essay.working, { rate: 0.95 }); }
    } catch { /* ignore */ }
  }, []);
  const debounced = useDebounced(text, 350);
  const a = useMemo(() => analyzeEssay(debounced, { prompt: essay?.prompt, limit: essay?.limit, type: essay?.type, collegeId: essay?.collegeId }), [debounced, essay?.prompt, essay?.limit, essay?.type, essay?.collegeId]);
  const edits = a.edits.filter((e) => !dismissed.includes(e.id) && (mode !== 'Grammar only' || e.kind === 'grammar'));
  const update = (patch: Partial<Essay>) => essay && store.set((s) => { const e = s.essays.find((x) => x.id === essay.id); if (e) Object.assign(e, patch, { updatedAt: new Date().toISOString() }); });
  const draftScores = useMemo(() => essay ? essay.drafts.map((d) => ({ d, an: analyzeEssay(d.text, { prompt: essay.prompt, limit: essay.limit, type: essay.type, collegeId: essay.collegeId }) })) : [], [essay?.drafts, essay?.prompt]);

  function createEssay(seedText = '', title?: string) {
    const id = uid();
    store.set((s) => { s.essays.unshift({ id, title: (title || form.title).trim() || form.type, type: form.type, prompt: form.prompt, limit: form.limit, collegeId: form.collegeId, drafts: [], working: seedText, comments: [], updatedAt: new Date().toISOString() }); });
    setActiveId(id); setNewOpen(false); setForm({ ...form, title: '', prompt: '' });
  }
  function saveDraft() {
    if (!essay || !text.trim()) return;
    const last = essay.drafts[essay.drafts.length - 1];
    if (last && last.text === text) return toast('No changes since the last saved draft', 'info');
    const label = `Draft ${essay.drafts.length + 1}`;
    store.set((s) => { const e = s.essays.find((x) => x.id === essay.id)!; e.drafts.push({ id: uid(), text, createdAt: new Date().toISOString(), label, scores: Object.fromEntries(RUBRIC.map((k) => [k, a.scores[k]])) }); });
    toast(`${label} saved`);
  }
  function accept(e: Edit) { update({ working: applyEdits(text, [e]) }); setDismissed((d) => [...d, e.id]); }
  async function onFile(f: File) {
    try {
      let t = '';
      if (/\.docx$/i.test(f.name)) t = await docxToText(await f.arrayBuffer());
      else if (/\.(txt|md|text)$/i.test(f.name) || f.type.startsWith('text/')) t = await f.text();
      else throw new Error('Upload a .txt, .md or .docx file. For Google Docs or PDFs, copy and paste the text.');
      if (!t.trim()) throw new Error('The file has no text.');
      if (essay && !essay.working.trim()) update({ working: t }); else createEssay(t, f.name.replace(/\.[^.]+$/, ''));
      toast(`Imported ${f.name}`);
    } catch (err) { toast((err as Error).message, 'error'); }
  }
  async function aiRead() {
    if (!essay) return;
    let result: Awaited<ReturnType<typeof ai.essay>> | null = null;
    setAiState({ steps: [], result: null, error: '' });
    const steps = await runSteps([
      { label: 'Preparing essay and prompt', run: () => { if (!text.trim()) throw new Error('Essay is empty'); } },
      { label: `Requesting rubric read from ${caps?.ai?.provider} (${caps?.ai?.model})`, run: async () => { result = await ai.essay(text, essay.prompt, mode); } },
      { label: 'Validating response', run: () => { if (!result || typeof result.scores !== 'object') throw new Error('The AI response was not in the expected format'); } },
    ], (st) => setAiState((x) => ({ ...x, steps: st })));
    const failed = steps.find((s) => s.status === 'error');
    setAiState({ steps: failed ? steps : null, result, error: failed ? failed.detail || 'AI request failed' : '' });
  }

  const tabs = [
    { id: 'feedback', label: 'Feedback' }, { id: 'lines', label: 'Line by line' }, { id: 'edits', label: 'Suggested edits', count: edits.length },
    { id: 'highlights', label: 'Highlights' }, { id: 'drafts', label: 'Drafts', count: essay?.drafts.length }, { id: 'comments', label: 'Comments', count: essay?.comments.length },
    { id: 'progress', label: 'Progress' }, { id: 'brainstorm', label: 'Brainstorm' },
  ] as const;

  return (
    <>
      <PageHeader title="Essay lab" desc="Feedback that helps you revise in your own voice. Scores are heuristic signals computed in your browser — not admissions officer scores or acceptance predictors."
        actions={<><input ref={fileRef} type="file" accept=".txt,.md,.docx,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} /><Button icon={<LuUpload />} onClick={() => fileRef.current?.click()}>Upload</Button><Button variant="primary" icon={<LuPlus />} onClick={() => setNewOpen(true)}>New essay</Button></>} />

      {!essay ? (
        <Card><EmptyState icon={<LuFileText />} title="No essays yet" body="Paste a draft or upload a .txt/.docx file. You can analyze personal statements, supplements, 'Why us' essays, scholarship essays and additional information." action={<div className="flex flex-wrap justify-center gap-2"><Button variant="primary" onClick={() => setNewOpen(true)}>Start an essay</Button><Button onClick={() => fileRef.current?.click()}>Upload a file</Button></div>} /></Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Essays" className="no-scrollbar flex gap-2 overflow-x-auto xl:flex-col xl:overflow-visible">
            {essays.map((e) => (
              <button key={e.id} onClick={() => { setActiveId(e.id); setDismissed([]); setAiState({ steps: null, result: null, error: '' }); }} className={cx('min-w-[180px] shrink-0 rounded-xl border px-3.5 py-2.5 text-left transition-colors xl:min-w-0', e.id === essay.id ? 'border-accent/40 bg-surface shadow-card' : 'border-transparent hover:bg-surface/60')}>
                <span className="block truncate text-sm font-medium text-ink">{e.title}</span>
                <span className="block truncate text-xs text-muted">{e.type}{e.collegeId ? ` · ${COLLEGES.find((c) => c.id === e.collegeId)?.short}` : ''} · {(e.working.match(/[A-Za-z0-9’']+/g) || []).length}w</span>
              </button>
            ))}
          </nav>

          <div className="min-w-0 space-y-4">
            <Card className="p-5">
              <div className="flex flex-wrap items-start gap-3">
                <Input aria-label="Essay title" value={essay.title} onChange={(e) => update({ title: e.target.value })} className="h-10 min-w-[200px] flex-1 border-transparent px-2 text-lg font-semibold hover:border-line" />
                <Select aria-label="Feedback mode" value={mode} onChange={(e) => store.set((s) => { s.prefs.essayMode = e.target.value; })} options={[...MODES]} className="h-10 w-auto" />
                <Button size="sm" variant="ghost" aria-label="Delete essay" icon={<LuTrash2 />} onClick={async () => { if (await confirm({ title: 'Delete this essay?', body: 'All drafts and comments will be permanently deleted from this device.', action: 'Delete', danger: true })) { store.set((s) => { s.essays = s.essays.filter((x) => x.id !== essay.id); }); setActiveId(null); } }} />
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-muted">{essay.type}{essay.limit ? ` · ${essay.limit} words` : ''}{essay.prompt ? ' · prompt set' : ' · no prompt'} — edit details</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="Type"><Select value={essay.type} onChange={(e) => update({ type: e.target.value as Essay['type'], limit: essay.limit ?? LIMITS[e.target.value] })} options={[...ESSAY_TYPES]} /></Field>
                  <Field label="Word limit"><NumberInput value={essay.limit} onChange={(v) => update({ limit: v })} placeholder="None" /></Field>
                  <Field label="College (optional)"><Select value={essay.collegeId} onChange={(e) => update({ collegeId: e.target.value })} options={[{ value: '', label: 'None' }, ...COLLEGES.map((c) => ({ value: c.id, label: c.short }))]} /></Field>
                  <Field label="Prompt" className="sm:col-span-3" hint="Pasting the prompt enables prompt-fulfillment feedback."><Textarea rows={2} value={essay.prompt} onChange={(e) => update({ prompt: e.target.value })} /></Field>
                </div>
              </details>
              <div className="relative mt-3">
                <Textarea ref={taRef as never} aria-label="Essay text" value={text} rows={16} placeholder="Paste or write your essay here…" className="min-h-[360px] resize-y font-[450] text-[16px] leading-[1.75]"
                  onChange={(e) => update({ working: e.target.value })}
                  onSelect={(e) => { const t = e.currentTarget; setSel(t.selectionEnd > t.selectionStart ? { start: t.selectionStart, end: t.selectionEnd } : null); }} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted tabular-nums">
                <span className={cx(a.stats.overLimit && 'font-semibold text-rose-600')}>{a.stats.words}{essay.limit ? ` / ${essay.limit}` : ''} words</span>
                <span>{a.stats.chars.toLocaleString()} characters</span><span>{a.stats.sentences} sentences</span><span>{a.stats.paragraphs} paragraphs</span><span>~{a.stats.readingMinutes} min read</span>
                <span>{a.grammarCount} grammar flag{a.grammarCount === 1 ? '' : 's'}</span>
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  <MicButton listener={dictation} label="Dictate" size="sm" />
                  <Button size="sm" variant="ghost" icon={speaking ? undefined : <LuVolume />} onClick={() => (speaking ? stopSpeaking() : speak(text, { rate: 0.95 }))} disabled={!text.trim()}>{speaking ? 'Stop reading' : 'Read aloud'}</Button>
                  {sel && <Button size="sm" icon={<LuMessageSquare />} onClick={() => setTab('comments')}>Comment on selection</Button>}
                  {caps?.ai && <Button size="sm" icon={<LuSparkles />} onClick={aiRead} disabled={!!aiState.steps && !aiState.error}>AI deep read</Button>}
                  <Button size="sm" variant="primary" icon={<LuSave />} onClick={saveDraft} disabled={!text.trim()}>Save as draft</Button>
                </span>
              </div>
              {(dictation.listening || dictation.transcribing || dictation.error) && <p className={cx('mt-2 text-sm', dictation.error ? 'text-amber-700 dark:text-amber-300' : 'text-muted')}>{dictation.error || (dictation.transcribing ? 'Transcribing…' : <>Dictating{dictation.interim ? <>: <i className="text-ink">{dictation.interim}</i></> : ' — speak naturally; say your punctuation in your head and fix it after.'}</>)}</p>}
              {essay.limit && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised"><div className={cx('h-full rounded-full transition-[width] duration-300', a.stats.overLimit ? 'bg-rose-500' : 'bg-accent')} style={{ width: `${Math.min(100, (a.stats.words / essay.limit) * 100)}%` }} /></div>}
            </Card>

            {aiState.steps && <Card className="p-5">{aiState.error ? <Notice tone="warn">AI read failed: {aiState.error}. Heuristic feedback below still works.</Notice> : <ResearchLoader steps={aiState.steps} title="AI deep read" />}</Card>}
            {aiState.result && (
              <Card className="p-5">
                <CardHeader flush title={<span className="flex items-center gap-2"><Badge tone="violet">AI interpretation</Badge>Rubric read by {caps?.ai?.model}</span>} desc="An AI model's opinion. Not an admissions officer's score. It may be wrong — weigh it against your own judgment and a trusted reader." action={<Button size="sm" variant="ghost" icon={<LuX />} onClick={() => setAiState({ steps: null, result: null, error: '' })}>Close</Button>} />
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">{RUBRIC.map((k) => { const v = Number(aiState.result!.scores[k]) || 0; return <div key={k} className="flex flex-col items-center gap-1 text-center"><Ring size={50} stroke={5} value={v * 10} label={v.toFixed(0)} tone={scoreTone(v)} /><span className="text-[11px] text-muted">{k}</span></div>; })}</div>
                <p className="mt-4 text-sm text-ink">{aiState.result.overall}</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2"><div><h4 className="text-sm font-semibold text-ink">Strengths</h4><ul className="mt-1 list-disc pl-5 text-sm text-muted">{aiState.result.strengths?.map((x) => <li key={x}>{x}</li>)}</ul></div><div><h4 className="text-sm font-semibold text-ink">Weaknesses</h4><ul className="mt-1 list-disc pl-5 text-sm text-muted">{aiState.result.weaknesses?.map((x) => <li key={x}>{x}</li>)}</ul></div></div>
                {aiState.result.line_feedback?.length > 0 && <ul className="mt-4 space-y-2">{aiState.result.line_feedback.map((l, i) => <li key={i} className="rounded-xl border border-line p-3 text-sm"><q className="text-ink italic">{l.quote}</q><p className="mt-1 text-muted">{l.comment}</p></li>)}</ul>}
              </Card>
            )}

            <Tabs tabs={tabs.map((t) => ({ ...t, count: 'count' in t ? t.count : undefined })) as never} value={tab} onChange={(v) => setTab(v as typeof tab)} />

            <div key={tab} className="fade-up">
              {tab === 'feedback' && (mode === 'Grammar only' ? (
                <Card className="p-5"><p className="text-sm text-muted">Grammar-only mode: see <button className="text-accent underline" onClick={() => setTab('edits')}>Suggested edits</button> ({edits.length}). Switch modes for content feedback.</p></Card>
              ) : mode === 'Brainstorming' ? (
                <Card className="p-5"><p className="text-sm text-muted">Brainstorming mode — see the <button className="text-accent underline" onClick={() => setTab('brainstorm')}>Brainstorm</button> tab.</p></Card>
              ) : (
                <div className="space-y-4">
                  <Card className="p-5">
                    <div className="flex flex-wrap items-center gap-5">
                      <Ring size={92} stroke={9} value={a.overall * 10} label={<span className="text-xl">{a.overall.toFixed(1)}</span>} tone={scoreTone(a.overall)} />
                      <div className="min-w-0 flex-1"><h3 className="font-semibold text-ink">Overall heuristic signal</h3><p className="mt-1 text-sm text-muted">Average of 12 rubric proxies (1–10). It measures text patterns that often correlate with strong personal essays, like concrete detail and reflection. It can't judge whether your story is meaningful — only a human reader can. Use it to find revision targets.</p></div>
                    </div>
                    {mode !== 'Minimal editing' && (
                      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
                        {RUBRIC.map((k) => (
                          <div key={k} className="group flex items-center gap-3" title={RUBRIC_MEASURES[k]}>
                            <Ring size={48} stroke={5} value={a.scores[k] * 10} label={a.scores[k].toFixed(1)} tone={scoreTone(a.scores[k])} />
                            <div className="min-w-0"><div className="text-sm font-medium text-ink">{k}</div><div className="line-clamp-2 text-[11px] leading-snug text-muted">{RUBRIC_MEASURES[k].replace('Proxy: ', '')}</div></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                  {a.redFlags.length > 0 && <Notice tone="warn"><b>Potential red flags</b><ul className="mt-1 list-disc pl-5">{a.redFlags.map((x) => <li key={x}>{x}</li>)}</ul></Notice>}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="p-5"><h3 className="text-sm font-semibold text-ink">Strengths</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{a.strengths.length ? a.strengths.map((x) => <li key={x}>{x}</li>) : <li>Keep writing — strengths appear as the draft grows.</li>}</ul></Card>
                    <Card className="p-5"><h3 className="text-sm font-semibold text-ink">Weaknesses</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{a.weaknesses.length ? a.weaknesses.map((x) => <li key={x}>{x}</li>) : <li>No major weaknesses detected by the heuristics.</li>}</ul></Card>
                    {(mode === 'Structural feedback' || mode === 'Deep critique') && <Card className="p-5"><h3 className="text-sm font-semibold text-ink">Structure</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{a.structure.map((x) => <li key={x}>{x}</li>)}</ul></Card>}
                    {mode === 'Deep critique' && <Card className="p-5"><h3 className="text-sm font-semibold text-ink">Where reflection could deepen</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{a.deepen.length ? a.deepen.map((x) => <li key={x}>{x}</li>) : <li>Reflection is well distributed.</li>}</ul></Card>}
                    {mode !== 'Minimal editing' && <Card className="p-5"><h3 className="text-sm font-semibold text-ink">Suggestions</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{a.suggestions.length ? a.suggestions.map((x) => <li key={x}>{x}</li>) : <li>No further suggestions.</li>}</ul></Card>}
                    {mode === 'Deep critique' && (
                      <Card className="p-5">
                        <h3 className="text-sm font-semibold text-ink">Language patterns</h3>
                        <dl className="mt-2 space-y-2 text-sm">
                          <div><dt className="text-muted">Clichés</dt><dd className="text-ink">{a.cliches.length ? a.cliches.map((c) => `“${c.phrase}”`).join(', ') : 'None'}</dd></div>
                          <div><dt className="text-muted">Generic words</dt><dd className="text-ink">{a.generic.length ? a.generic.slice(0, 6).map((g) => `${g.word} ×${g.count}`).join(', ') : 'None'}</dd></div>
                          <div><dt className="text-muted">Repeated words</dt><dd className="text-ink">{a.repetition.length ? a.repetition.map((r) => `${r.word} ×${r.count}`).join(', ') : 'None'}</dd></div>
                          <div><dt className="text-muted">Weak transitions</dt><dd className="text-ink">{a.weakTransitions.length ? a.weakTransitions.map((w) => w.phrase).join(', ') : 'None'}</dd></div>
                          <div><dt className="text-muted">Unclear (long) sentences</dt><dd className="text-ink">{a.unclear.length}</dd></div>
                        </dl>
                      </Card>
                    )}
                  </div>
                </div>
              ))}

              {tab === 'lines' && (
                <Card className="divide-y divide-line">
                  {a.sentences.length ? a.sentences.map((x) => (
                    <div key={x.index} className="grid gap-2 px-5 py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,16rem)]">
                      <span className="text-xs text-muted tabular-nums">{x.index + 1}</span>
                      <button className="text-left text-[15px] leading-relaxed text-ink hover:text-accent" onClick={() => { const t = taRef.current; if (t) { t.focus(); t.setSelectionRange(x.start, x.start + x.text.length); } }}>{x.text}</button>
                      <div className="flex flex-wrap content-start gap-1">{x.issues.map((i) => <Badge key={i} tone={i.startsWith('✓') ? 'teal' : /Cliché|Generic/.test(i) ? 'rose' : 'amber'}>{i}</Badge>)}</div>
                    </div>
                  )) : <EmptyState title="Nothing to review" body="Write or paste your essay above." />}
                </Card>
              )}

              {tab === 'edits' && (
                <Card className="p-5">
                  <CardHeader flush title={`${edits.length} suggested edit${edits.length === 1 ? '' : 's'}`} desc="Mechanical fixes and cuts only. AdmitIQ never rewrites your sentences or adds content." action={edits.some((e) => e.kind === 'grammar') && <Button size="sm" onClick={() => { const g = edits.filter((e) => e.kind === 'grammar'); update({ working: applyEdits(text, g) }); setDismissed((d) => [...d, ...g.map((e) => e.id)]); toast(`Applied ${g.length} grammar fixes`); }}>Accept all grammar</Button>} />
                  <ul className="mt-4 space-y-2">
                    {edits.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
                        <Badge tone={e.kind === 'grammar' ? 'amber' : e.kind === 'filler' ? 'blue' : 'violet'}>{e.kind}</Badge>
                        <span className="min-w-0 flex-1 text-sm"><span className="mark-del rounded px-0.5">{e.original}</span>{e.replacement && <> → <span className="mark-add rounded px-0.5">{e.replacement}</span></>}<span className="block text-xs text-muted">{e.reason} · “…{text.slice(Math.max(0, e.start - 30), e.start)}<b>{e.original}</b>{text.slice(e.end, e.end + 30)}…”</span></span>
                        <Button size="sm" variant="soft" icon={<LuCheck />} onClick={() => accept(e)}>Accept</Button>
                        <Button size="sm" variant="ghost" icon={<LuX />} onClick={() => setDismissed((d) => [...d, e.id])}>Reject</Button>
                      </li>
                    ))}
                    {!edits.length && <li className="py-6 text-center text-sm text-muted">No pending edits.{dismissed.length ? <> <button className="text-accent underline" onClick={() => setDismissed([])}>Show rejected</button></> : null}</li>}
                  </ul>
                </Card>
              )}

              {tab === 'highlights' && (
                <Card className="p-5">
                  <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted"><span><mark className="hl hl-grammar">grammar</mark> grammar</span><span><mark className="hl">edit</mark> filler/wordy (click to accept)</span><span><mark className="hl hl-cliche">cliché</mark> cliché</span></div>
                  {text ? <HighlightedText text={debounced} a={a} onPick={(e) => { accept(e); toast('Edit applied'); }} /> : <p className="text-sm text-muted">Nothing to highlight yet.</p>}
                </Card>
              )}

              {tab === 'drafts' && (
                <div className="space-y-4">
                  <Card className="p-5">
                    <CardHeader flush title="Version history" desc="Save drafts as you revise; restore any version." />
                    {essay.drafts.length ? (
                      <ul className="mt-3 divide-y divide-line">
                        {[...essay.drafts].reverse().map((d) => {
                          const ds = draftScores.find((x) => x.d.id === d.id)?.an;
                          return (
                            <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                              <LuHistory className="text-muted" />
                              <span className="min-w-0 flex-1"><span className="font-medium text-ink">{d.label}</span><span className="block text-xs text-muted">{fmtDate(d.createdAt)} · {ds?.stats.words} words · signal {ds?.overall.toFixed(1)}</span></span>
                              <Button size="sm" icon={<LuRotateCcw />} onClick={async () => { if (await confirm({ title: `Restore ${d.label}?`, body: 'Your current text will be replaced. Save it as a draft first if you want to keep it.', action: 'Restore' })) update({ working: d.text }); }}>Restore</Button>
                              <Button size="sm" variant="ghost" aria-label={`Delete ${d.label}`} icon={<LuTrash2 />} onClick={() => store.set((s) => { const e = s.essays.find((x) => x.id === essay.id)!; e.drafts = e.drafts.filter((x) => x.id !== d.id); })} />
                            </li>
                          );
                        })}
                      </ul>
                    ) : <p className="mt-3 text-sm text-muted">No saved drafts yet. Use "Save as draft" above.</p>}
                  </Card>
                  {essay.drafts.length > 0 && (
                    <Card className="p-5">
                      <CardHeader flush title="Compare drafts" />
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Select aria-label="Older version" value={cmp.a || essay.drafts[Math.max(0, essay.drafts.length - 2)].id} onChange={(e) => setCmp({ ...cmp, a: e.target.value })} options={essay.drafts.map((d) => ({ value: d.id, label: d.label }))} />
                        <Select aria-label="Newer version" value={cmp.b || 'working'} onChange={(e) => setCmp({ ...cmp, b: e.target.value })} options={[{ value: 'working', label: 'Current text' }, ...essay.drafts.map((d) => ({ value: d.id, label: d.label }))]} />
                      </div>
                      {(() => {
                        const A = essay.drafts.find((d) => d.id === (cmp.a || essay.drafts[Math.max(0, essay.drafts.length - 2)].id))?.text || '';
                        const B = (cmp.b || 'working') === 'working' ? text : essay.drafts.find((d) => d.id === cmp.b)?.text || '';
                        const parts = diffWords(A, B);
                        const added = parts.filter((p) => p.type === 'add').reduce((n, p) => n + (p.text.match(/\S+/g) || []).length, 0);
                        const removed = parts.filter((p) => p.type === 'del').reduce((n, p) => n + (p.text.match(/\S+/g) || []).length, 0);
                        const sa = analyzeEssay(A), sb = analyzeEssay(B);
                        return (
                          <>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge tone="green">+{added} words</Badge><Badge tone="rose">−{removed} words</Badge><Badge>Signal {sa.overall.toFixed(1)} → {sb.overall.toFixed(1)}</Badge></div>
                            <div className="mt-3 max-h-[480px] overflow-y-auto rounded-xl border border-line bg-canvas p-4 text-[15px] leading-[1.75] whitespace-pre-wrap text-ink">{parts.map((p, i) => <span key={i} className={p.type === 'add' ? 'mark-add' : p.type === 'del' ? 'mark-del' : ''}>{p.text}</span>)}</div>
                          </>
                        );
                      })()}
                    </Card>
                  )}
                </div>
              )}

              {tab === 'comments' && (
                <Card className="p-5">
                  <CardHeader flush title="Comments" desc="Notes to yourself (or from a reader). Select text in the editor to anchor a comment to it." />
                  <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); if (!commentText.trim()) return; const quote = sel ? text.slice(sel.start, sel.end).slice(0, 200) : ''; store.set((s) => { s.essays.find((x) => x.id === essay.id)!.comments.push({ id: uid(), quote, text: commentText.trim(), at: new Date().toISOString() }); }); setCommentText(''); setSel(null); }}>
                    {sel && <p className="rounded-lg bg-raised px-3 py-2 text-sm text-muted">On: “{text.slice(sel.start, sel.end).slice(0, 160)}”</p>}
                    <Textarea aria-label="Comment" rows={2} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment…" />
                    <Button size="sm" type="submit" variant="primary" disabled={!commentText.trim()}>Add comment</Button>
                  </form>
                  <ul className="mt-4 space-y-2">
                    {essay.comments.map((c) => (
                      <li key={c.id} className="rounded-xl border border-line p-3 text-sm">
                        {c.quote && <button className="mb-1 block text-left text-muted italic hover:text-accent" onClick={() => { const i = text.indexOf(c.quote); const t = taRef.current; if (t && i >= 0) { t.focus(); t.setSelectionRange(i, i + c.quote.length); } }}>“{c.quote}”{text.includes(c.quote) ? '' : ' (text has changed)'}</button>}
                        <div className="flex items-start justify-between gap-2"><p className="text-ink">{c.text}</p><button aria-label="Resolve comment" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-raised hover:text-teal" onClick={() => store.set((s) => { const e = s.essays.find((x) => x.id === essay.id)!; e.comments = e.comments.filter((x) => x.id !== c.id); })}><LuCheck /></button></div>
                        <div className="mt-1 text-xs text-muted">{fmtDate(c.at)}</div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {tab === 'progress' && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <ChartCard title="Overall signal by draft" desc="Heuristic average (1–10)." source="Essay Lab heuristic analysis of your saved drafts">
                    {draftScores.length ? <Columns data={[...draftScores.map((x) => ({ label: x.d.label, value: x.an.overall })), { label: 'Current', value: a.overall, color: 'var(--c3)' }]} max={10} format={(v) => v.toFixed(1)} /> : <p className="py-8 text-center text-sm text-muted">Save drafts to track progress.</p>}
                  </ChartCard>
                  <ChartCard title="Rubric categories across drafts" source="Essay Lab heuristic analysis" legend={(['Specificity', 'Reflection', 'Clarity', 'Originality'] as const).map((k, i) => ({ label: k, color: `var(--c${i + 1})` }))}>
                    {draftScores.length ? <LineChart labels={[...draftScores.map((x) => x.d.label), 'Current']} yMin={0} yMax={10} format={(v) => v.toFixed(0)} series={(['Specificity', 'Reflection', 'Clarity', 'Originality'] as const).map((k, i) => ({ name: k, color: `var(--c${i + 1})`, values: [...draftScores.map((x) => x.an.scores[k]), a.scores[k]] }))} /> : <p className="py-8 text-center text-sm text-muted">Save drafts to track progress.</p>}
                  </ChartCard>
                  <Card className="p-5 lg:col-span-2">
                    <h3 className="text-sm font-semibold text-ink">Word count by draft</h3>
                    <div className="mt-3"><Columns data={[...draftScores.map((x) => ({ label: x.d.label, value: x.an.stats.words })), { label: 'Current', value: a.stats.words, color: 'var(--c3)' }]} max={Math.max(essay.limit || 0, a.stats.words, ...draftScores.map((x) => x.an.stats.words), 1)} height={150} /></div>
                  </Card>
                </div>
              )}

              {tab === 'brainstorm' && (
                <Card className="p-5">
                  <CardHeader flush title={<span className="flex items-center gap-2"><LuLightbulb className="text-amber-500" />Questions to dig deeper</span>} desc="Generated from words you already wrote. AdmitIQ asks — you supply the story. It never invents experiences." action={<Button size="sm" variant="ghost" icon={<LuCopy />} onClick={async () => toast((await copyText(a.brainstorm.join('\n'))) ? 'Copied' : 'Copy failed', 'info')}>Copy</Button>} />
                  <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] text-ink">{a.brainstorm.map((q) => <li key={q}>{q}</li>)}</ol>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New essay" footer={<><Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => createEssay()}>Create</Button></>}>
        <div className="grid gap-4">
          <Field label="Type" htmlFor="ne-type"><Select id="ne-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Essay['type'], limit: LIMITS[e.target.value] })} options={[...ESSAY_TYPES]} /></Field>
          <Field label="Title" htmlFor="ne-title"><Input id="ne-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={form.type} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Word limit" htmlFor="ne-limit"><NumberInput id="ne-limit" value={form.limit} onChange={(v) => setForm({ ...form, limit: v })} placeholder="None" /></Field>
            <Field label="College" htmlFor="ne-col"><Select id="ne-col" value={form.collegeId} onChange={(e) => setForm({ ...form, collegeId: e.target.value })} options={[{ value: '', label: 'None' }, ...COLLEGES.map((c) => ({ value: c.id, label: c.short }))]} /></Field>
          </div>
          <Field label="Prompt" htmlFor="ne-prompt" hint="Paste the exact prompt for prompt-fulfillment feedback."><Textarea id="ne-prompt" rows={3} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  );
}
