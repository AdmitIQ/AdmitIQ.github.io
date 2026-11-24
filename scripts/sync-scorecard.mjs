// Pulls official values from the U.S. Dept. of Education College Scorecard API and writes
// src/data/verified.json. The app then shows those fields as "Verified" with retrieval date + URL.
// Usage: SCORECARD_API_KEY=... node scripts/sync-scorecard.mjs && npm run build
// Free key: https://api.data.gov/signup  (default rate limit: 1,000 requests/hour)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.SCORECARD_API_KEY;
const BASE = process.env.SCORECARD_BASE || 'https://api.data.gov/ed/collegescorecard/v1/schools';
if (!KEY) { console.error('Set SCORECARD_API_KEY (free at https://api.data.gov/signup)'); process.exit(1); }
const out = await build({ entryPoints: [path.join(root, 'src/data/colleges.ts')], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'error' });
const { COLLEGES } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const F = {
  admit: 'latest.admissions.admission_rate.overall',
  rw25: 'latest.admissions.sat_scores.25th_percentile.critical_reading', rw75: 'latest.admissions.sat_scores.75th_percentile.critical_reading',
  m25: 'latest.admissions.sat_scores.25th_percentile.math', m75: 'latest.admissions.sat_scores.75th_percentile.math',
  act25: 'latest.admissions.act_scores.25th_percentile.cumulative', act75: 'latest.admissions.act_scores.75th_percentile.cumulative',
  tuitionIn: 'latest.cost.tuition.in_state', tuitionOut: 'latest.cost.tuition.out_of_state', coa: 'latest.cost.attendance.academic_year',
  net: 'latest.cost.avg_net_price.overall',
  grad: 'latest.completion.completion_rate_4yr_150nt', retention: 'latest.student.retention_rate.four_year.full_time',
  earnings: 'latest.earnings.10_yrs_after_entry.median', debt: 'latest.aid.median_debt.completers.overall', size: 'latest.student.size',
};
const today = new Date().toISOString().slice(0, 10);
const overlay = {};
let ok = 0, fail = 0;
for (const c of COLLEGES.filter((x) => x.scorecardId)) {
  const q = new URLSearchParams({ api_key: KEY, id: c.scorecardId, fields: ['id', ...Object.values(F)].join(',') });
  try {
    const r = await fetch(`${BASE}?${q}`, { headers: { 'user-agent': 'AdmitIQ-sync/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const row = (await r.json()).results?.[0];
    if (!row) throw new Error('no result');
    const g = (k) => row[F[k]] ?? null;
    const src = { retrieved: today, url: `https://collegescorecard.ed.gov/school/?${c.scorecardId}`, source: 'College Scorecard (U.S. Dept. of Education)' };
    const o = {};
    const set = (field, value) => { if (value !== null && value !== undefined && !Number.isNaN(value)) o[field] = { value, ...src }; };
    set('admit', g('admit'));
    if (g('rw25') && g('m25') && g('rw75') && g('m75')) set('sat', [g('rw25') + g('m25'), g('rw75') + g('m75')]); // section sums approximate the composite range
    if (g('act25') && g('act75')) set('act', [g('act25'), g('act75')]);
    set('tuitionIn', g('tuitionIn')); set('tuitionOut', g('tuitionOut'));
    if (g('coa')) { set('coaIn', g('coa')); if (c.kind !== 'Public') set('coaOut', g('coa')); }
    set('netPrice', g('net')); set('grad', g('grad')); set('retention', g('retention'));
    set('earnings', g('earnings')); set('debt', g('debt')); set('undergrad', g('size'));
    overlay[c.id] = o; ok++;
    console.log(`✓ ${c.short}: ${Object.keys(o).length} fields`);
  } catch (e) { fail++; console.warn(`✗ ${c.short}: ${e.message}`); }
  await new Promise((r) => setTimeout(r, 250)); // stay well under the API rate limit
}
fs.writeFileSync(path.join(root, 'src/data/verified.json'), JSON.stringify(overlay, null, 1));
console.log(`\nWrote src/data/verified.json — ${ok} colleges verified, ${fail} failed. Rebuild with: npm run build`);
