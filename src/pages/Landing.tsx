import React, { useMemo, useState } from 'react';
import { LuArrowRight, LuShieldCheck, LuSparkles, LuGitCompare, LuFileText, LuCalculator, LuCalendarDays, LuTarget, LuFlaskConical, LuBadgeCheck, LuLock, LuCircleX, LuMic, LuSlidersHorizontal, LuScale } from 'react-icons/lu';
import { Logo, navigate } from '../App';
import { Badge, Button, Card, Ring, Select, cx } from '../components/ui';
import { RangeChart, HBars } from '../components/charts';
import { COLLEGES } from '../data/colleges';
import { LANDING_SAMPLE, demoState } from '../data/demo';
import { store } from '../lib/store';
import { analyzeEssay } from '../lib/essay';
import { pct, usd } from '../lib/format';

function loadDemo() { store.replace(demoState()); navigate('dashboard'); }

function HeroPreview() {
  const rows = ['gatech', 'umich', 'uiuc', 'purdue'].map((id) => COLLEGES.find((c) => c.id === id)!);
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[36px] bg-gradient-to-br from-[var(--accent)]/15 via-[var(--violet)]/10 to-[var(--teal)]/10 blur-2xl" />
      <Card className="floaty overflow-hidden p-0 shadow-lift">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></div>
          <span className="text-xs text-muted">Example data · fictional student</span>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto]">
          <div>
            <div className="text-sm font-semibold text-ink">SAT vs. middle 50% of admitted students</div>
            <div className="mt-1 mb-4 text-xs text-muted">Dashed line = your score (1480)</div>
            <RangeChart rows={rows.map((c) => ({ label: c.short, lo: c.sat?.[0] ?? null, hi: c.sat?.[1] ?? null }))} min={1100} max={1600} you={1480} youLabel="You" />
          </div>
          <div className="flex gap-4 sm:flex-col">
            <div className="flex items-center gap-3"><Ring value={72} label="72%" tone="var(--teal)" /><div className="text-xs text-muted">Applications<br />complete</div></div>
            <div className="flex items-center gap-3"><Ring value={68} label="6.8" tone="var(--violet)" /><div className="text-xs text-muted">Essay rubric<br />(heuristic)</div></div>
          </div>
        </div>
        <div className="grid grid-cols-3 border-t border-line text-center text-sm">
          {[['Reach', 4, 'text-violet'], ['Target', 5, 'text-accent'], ['Likely', 2, 'text-teal']].map(([l, n, c]) => (
            <div key={l as string} className="border-r border-line py-3 last:border-0"><div className={cx('text-xl font-semibold tabular-nums', c as string)}>{n}</div><div className="text-xs text-muted">{l}</div></div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ComparePreview() {
  const pool = COLLEGES.filter((c) => c.kind !== 'International' && c.kind !== 'Community college');
  const [a, setA] = useState('umich');
  const [b, setB] = useState('uva');
  const A = pool.find((c) => c.id === a)!, B = pool.find((c) => c.id === b)!;
  const metrics: { label: string; get: (c: typeof A) => number | null; fmt: (v: number) => string; max: number }[] = [
    { label: 'Admit rate', get: (c) => c.admit, fmt: (v) => pct(v), max: 1 },
    { label: '6-yr graduation', get: (c) => c.grad, fmt: (v) => pct(v), max: 1 },
    { label: 'Avg net price', get: (c) => c.netPrice, fmt: (v) => usd(v), max: 40000 },
    { label: 'Median earnings', get: (c) => c.earnings, fmt: (v) => usd(v), max: 130000 },
  ];
  return (
    <Card className="p-5 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select aria-label="First college" value={a} onChange={(e) => setA(e.target.value)} options={pool.map((c) => ({ value: c.id, label: c.short }))} />
        <Select aria-label="Second college" value={b} onChange={(e) => setB(e.target.value)} options={pool.map((c) => ({ value: c.id, label: c.short }))} />
      </div>
      <div className="mt-6 space-y-5">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="mb-2 text-sm font-medium text-ink">{m.label}</div>
            <HBars key={a + b + m.label} data={[{ label: A.short, value: m.get(A), color: 'var(--c1)' }, { label: B.short, value: m.get(B), color: 'var(--c2)' }]} max={m.max} format={m.fmt} />
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs text-muted">Bundled figures are unverified (approx. 2022–25 College Scorecard/CDS recall). Every number in the app links to its source and shows its confidence.</p>
    </Card>
  );
}

function EssayPreview() {
  const [text, setText] = useState(LANDING_SAMPLE);
  const a = useMemo(() => analyzeEssay(text), [text]);
  const top = (['Specificity', 'Reflection', 'Originality', 'Clarity'] as const);
  return (
    <Card className="grid gap-0 overflow-hidden p-0 md:grid-cols-[1.2fr_1fr]">
      <div className="border-b border-line p-5 md:border-r md:border-b-0">
        <label htmlFor="landing-essay" className="text-sm font-medium text-ink">Try it — edit this sample opening</label>
        <textarea id="landing-essay" value={text} onChange={(e) => setText(e.target.value)} rows={7} className="mt-2 w-full resize-none rounded-xl border border-line bg-canvas p-3.5 text-[16px] leading-relaxed text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15" />
        <div className="mt-2 text-xs text-muted tabular-nums">{a.stats.words} words · runs entirely in your browser</div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3">
          {top.map((k) => <div key={k} className="flex items-center gap-3"><Ring size={52} stroke={6} value={a.scores[k] * 10} label={a.scores[k].toFixed(1)} tone={a.scores[k] >= 6.5 ? 'var(--teal)' : a.scores[k] >= 4.5 ? 'var(--accent)' : 'var(--c5)'} /><span className="text-sm text-muted">{k}</span></div>)}
        </div>
        <ul className="mt-5 space-y-2 text-sm">
          {a.cliches.slice(0, 3).map((c) => <li key={c.index} className="flex gap-2"><Badge tone="rose">Cliché</Badge><span className="text-ink">“{c.phrase}”</span></li>)}
          {a.generic.slice(0, 2).map((g) => <li key={g.word} className="flex gap-2"><Badge tone="amber">Generic</Badge><span className="text-ink">“{g.word}” ×{g.count}</span></li>)}
          {!a.cliches.length && !a.generic.length && <li className="text-teal">No clichés or generic words detected.</li>}
        </ul>
        <p className="mt-4 text-xs text-muted">Heuristic feedback, not an admissions score. AdmitIQ never rewrites your essay in its own voice.</p>
      </div>
    </Card>
  );
}

const FEATURES = [
  { icon: LuTarget, title: 'Honest admissions analysis', body: 'Reach / Target / Likely estimates with the reasoning shown — strengths, gaps, missing info and testing advice per school. No fake percentages.' },
  { icon: LuGitCompare, title: 'Compare up to 10 colleges', body: 'Admissions, academics, costs and outcomes side by side, with radar, range and cost-breakdown charts. Toggle metrics, reorder, export.' },
  { icon: LuFileText, title: 'Essay lab', body: '12-part rubric, line-by-line notes, cliché and generic-language detection, accept/reject edits, version history and draft diffs.' },
  { icon: LuCalculator, title: 'Real cost scenarios', body: 'In-state vs. out-of-state, at home vs. on campus, aid and loans, four-year totals — clearly labeled estimates with official calculator links.' },
  { icon: LuCalendarDays, title: 'Application command center', body: 'Deadlines, checklists, calendar, timeline and tasks for every school — with completion tracking that updates as you go.' },
  { icon: LuMic, title: 'Talk to it', body: 'Voice assistant for hands-free commands ("compare Purdue and Michigan"), spoken answers, essay dictation and read-aloud.' },
  { icon: LuMic, title: 'Interview coach', body: 'Practice out loud with interview questions. Get feedback on pace, filler words, length, specifics and story structure.' },
  { icon: LuSlidersHorizontal, title: 'What-if simulator', body: 'Drag your SAT, GPA or course load and watch every college estimate update live.' },
  { icon: LuScale, title: 'Aid offer comparer', body: 'Separate free money from loans in award letters. See true 4-year cost, debt and monthly payments side by side.' },
];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-6">
          <a href="#home"><Logo /></a>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#features" className="hidden h-10 items-center rounded-lg px-3 text-sm text-muted hover:text-ink md:inline-flex">Features</a>
            <a href="#principles" className="hidden h-10 items-center rounded-lg px-3 text-sm text-muted hover:text-ink md:inline-flex">Principles</a>
            <a href="#login" className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-muted hover:text-ink">Sign in</a>
            <Button variant="primary" size="sm" onClick={() => navigate(store.get().meta.onboarded ? 'dashboard' : 'onboarding')}>{store.get().meta.onboarded ? 'Open app' : 'Get started'}</Button>
          </nav>
        </div>
      </header>

      <section className="hero-glow relative overflow-hidden">
        <div className="grid-paper pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 px-4 pt-14 pb-16 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:pb-24">
          <div className="stagger">
            <Badge tone="blue" className="mb-5"><LuSparkles /> Free, private, and works without an account</Badge>
            <h1 className="text-balance text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[54px]">Your college strategy, backed by data.</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">AdmitIQ turns your grades, scores, activities and budget into a clear plan: which colleges fit, where you stand, what each will really cost, and how to make your essays sound more like you.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="primary" size="lg" onClick={() => navigate('onboarding')} icon={<LuArrowRight />}>Build my profile</Button>
              <Button size="lg" onClick={loadDemo}>Explore with a demo student</Button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted"><LuLock className="shrink-0" /> Your data stays in your browser unless you choose to sync it.</p>
          </div>
          <HeroPreview />
        </div>
      </section>

      <section id="features" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="max-w-2xl text-balance text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">Everything a great counselor would track, in one place.</h2>
        <div className="stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} hover className="p-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent"><f.icon className="text-lg" /></div>
              <h3 className="mt-4 text-[16px] font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface/60">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-balance text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">Compare colleges on what matters.</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">Pick any two schools. In the app you can compare up to ten across 30+ metrics, with charts, toggles and exportable reports.</p>
          </div>
          <ComparePreview />
        </div>
      </section>

      <section className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.2fr_0.8fr]">
        <EssayPreview />
        <div className="lg:order-first lg:col-start-2">
          <h2 className="text-balance text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">Feedback that keeps your voice.</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">The Essay Lab finds clichés, vague language, weak transitions and missing reflection, then suggests targeted edits you accept or reject one at a time. It asks questions instead of inventing stories.</p>
        </div>
      </section>

      <section id="principles" className="bg-ink text-canvas">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="max-w-2xl text-balance text-[32px] font-semibold leading-tight tracking-[-0.02em]">Built on four promises.</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [LuBadgeCheck, 'No invented numbers', 'Unavailable data says "Unavailable". Every statistic shows its source and confidence.'],
              [LuCircleX, 'No fake probabilities', 'Admissions categories are estimates with reasons — never a "37.4% chance".'],
              [LuShieldCheck, 'Private by default', 'No public profiles, no selling data, essays are never used to train models.'],
              [LuSparkles, 'Free core features', 'Everything works without paid APIs. AI is optional and bring-your-own-key.'],
            ].map(([I, t, b]) => {
              const Icon = I as typeof LuBadgeCheck;
              return <div key={t as string}><Icon className="text-2xl text-[#9fb4ff]" /><h3 className="mt-3 font-semibold">{t as string}</h3><p className="mt-1.5 text-[15px] leading-relaxed text-canvas/70">{b as string}</p></div>;
            })}
          </div>
          <p className="mt-12 text-sm text-canvas/60">AdmitIQ is new, so there are no testimonials yet — we won't make any up.</p>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-16 text-center sm:px-6 sm:py-20">
        <h2 className="text-balance text-[32px] font-semibold tracking-[-0.02em] text-ink">Start with what you know. Add the rest as you go.</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">Your profile saves automatically. Every field is optional.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="primary" size="lg" onClick={() => navigate('onboarding')} icon={<LuArrowRight />}>Build my profile</Button>
          <Button size="lg" onClick={loadDemo}>See the demo</Button>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <Logo />
          <div className="flex flex-wrap gap-x-5 gap-y-2"><a href="#research" className="hover:text-ink">Data sources</a><a href="#data" className="hover:text-ink">Privacy & data</a><a href="#login" className="hover:text-ink">Sign in</a></div>
          <p className="w-full text-xs">College data: U.S. Dept. of Education College Scorecard/IPEDS and institutional Common Data Sets (bundled values unverified — see Research center). AdmitIQ is not affiliated with any college or the Common App.</p>
        </div>
      </footer>
    </div>
  );
}
