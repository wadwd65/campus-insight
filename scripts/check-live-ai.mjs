/** Explicit opt-in real-provider probe. Not part of npm run check; uses synthetic data only. */
import fs from 'node:fs';
import Papa from 'papaparse';
import { QUESTIONS } from '../src/lib/surveySchema.js';
import { buildBaseline, toAttributeMatrix } from '../src/lib/matrix.js';
import { buildReport } from '../src/lib/results.js';
import { buildCohort } from '../src/lib/cohort.js';
import { streamSummary } from '../src/lib/llm.js';
import { cohortFallbackText } from '../src/lib/cohortSummary.js';

const origin = process.env.CAMPUS_TEST_ORIGIN || 'http://127.0.0.1:5191';
const baselineRows = Papa.parse(fs.readFileSync(new URL('../public/data/问卷基准数据.csv', import.meta.url), 'utf8'), { header: true, skipEmptyLines: true }).data;
const baseline = buildBaseline(toAttributeMatrix(baselineRows));
const answers = Object.fromEntries(QUESTIONS.map((q, i) => [q.field, q.options[i % q.options.length].text]));
const isCohort = process.argv.includes('--cohort');
const cohort = isCohort ? buildCohort(Papa.parse(fs.readFileSync(new URL('../public/data/示例-班级问卷.csv', import.meta.url), 'utf8'), { header: true, skipEmptyLines: true }).data, baseline) : null;
const start = performance.now();
let firstDeltaMs = null;
const result = await streamSummary({ report: isCohort ? null : buildReport(answers, baseline), cohort, fallback: isCohort ? () => cohortFallbackText(cohort) : undefined, endpoint: { relayUrl: `${origin}/api/llm/summary`, statusUrl: `${origin}/api/llm/status` }, onDelta: () => { firstDeltaMs ??= Math.round(performance.now() - start); } });
const record = { date: new Date().toISOString(), kind: isCohort ? 'synthetic-cohort' : 'synthetic-personal', origin, degraded: result.degraded, reason: result.reason, model: result.model ?? null, firstDeltaMs, totalMs: Math.round(performance.now() - start), characters: result.text.length, paragraphs: result.text.split(/\n{2,}/).filter(Boolean).length, issues: result.issues ?? [], text: result.text };
const fileIndex = process.argv.indexOf('--output');
if (fileIndex >= 0 && process.argv[fileIndex + 1]) fs.writeFileSync(process.argv[fileIndex + 1], JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify(record, null, 2));
if (result.degraded || result.aborted) process.exitCode = 1;
