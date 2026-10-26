import { ALL_ATTR_KEYS, QUESTIONS, isKnownOption } from './surveySchema.js';
import { RADAR_KEYS, RADAR_AXIS_NAME, buildReportFromPercents } from './results.js';
import { GROUPS } from './cohort.js';
import { buildSummaryRequest } from './buildSummary.js';
import { buildCohortRequest } from './cohortSummary.js';
import { cleanName } from './text.js';

/** Only registered answers/positions or aggregate statistics. No records, identifiers or custom prompts. */
export function buildLlmPayload({ report, cohort, name = '', className = '' }) {
  if (cohort) return {
    kind: 'cohort', className: cleanName(className), size: cohort.size,
    counts: GROUPS.map(({ key }) => ({ key, count: cohort.groups.find((group) => group.key === key)?.count ?? 0 })),
    axes: RADAR_KEYS.map((key) => { const axis = cohort.axes.find((item) => item.key === key); return { key, median: axis?.median, q1: axis?.q1, q3: axis?.q3, iqr: axis?.iqr }; }),
    medianAttrs: Object.fromEntries(ALL_ATTR_KEYS.map((key) => [key, cohort.medianAttrs[key]])),
  };
  return { kind: 'personal', name: cleanName(name), answers: Object.fromEntries(QUESTIONS.map(({ field }) => [field, isKnownOption(field, report.answers?.[field]) ? report.answers[field] : null])), percents: Object.fromEntries(ALL_ATTR_KEYS.map((key) => [key, report.percents[key]])) };
}

function requireThat(condition) { if (!condition) throw new Error('invalid-summary-payload'); }
function objectKeys(value, allowed) { requireThat(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => allowed.includes(key))); }
function numeric(value, minimum = 0, maximum = 100) { requireThat(Number.isInteger(value) && value >= minimum && value <= maximum); return value; }
function positions(value) { objectKeys(value, ALL_ATTR_KEYS); return Object.fromEntries(ALL_ATTR_KEYS.map((key) => [key, numeric(value[key], 2, 98)])); }
function nameValue(value) { requireThat(typeof value === 'string' && value.length <= 64); return cleanName(value); }

/** The server builds fixed prompts from this schema; browser messages/model/URL overrides are rejected. */
export function readLlmPayload(payload) {
  if (payload?.kind === 'personal') {
    objectKeys(payload, ['kind', 'name', 'answers', 'percents']);
    objectKeys(payload.answers, QUESTIONS.map((question) => question.field));
    const answers = Object.fromEntries(QUESTIONS.map(({ field }) => { const value = payload.answers[field] ?? null; requireThat(value === null || isKnownOption(field, value)); return [field, value]; }));
    const report = buildReportFromPercents(positions(payload.percents), { answers });
    return { report, cohort: null, request: buildSummaryRequest(report, { name: nameValue(payload.name) }) };
  }
  requireThat(payload?.kind === 'cohort');
  objectKeys(payload, ['kind', 'className', 'size', 'counts', 'axes', 'medianAttrs']);
  const size = numeric(payload.size, 1, 10000);
  requireThat(Array.isArray(payload.counts) && payload.counts.length === GROUPS.length);
  const groups = GROUPS.map((group, index) => {
    const item = payload.counts[index]; objectKeys(item, ['key', 'count']); requireThat(item.key === group.key);
    const count = numeric(item.count, 0, size);
    return { ...group, count, pct: Math.round(count / size * 1000) / 10 };
  });
  requireThat(groups.reduce((sum, item) => sum + item.count, 0) === size);
  requireThat(Array.isArray(payload.axes) && payload.axes.length === RADAR_KEYS.length);
  const axes = RADAR_KEYS.map((key, index) => {
    const item = payload.axes[index]; objectKeys(item, ['key', 'median', 'q1', 'q3', 'iqr']); requireThat(item.key === key);
    const q1 = numeric(item.q1, 2, 98), q3 = numeric(item.q3, q1, 98), median = numeric(item.median, q1, q3), iqr = numeric(item.iqr);
    requireThat(Math.abs(iqr - (q3 - q1)) <= 1);
    return { key, axis: RADAR_AXIS_NAME[key], median, q1, q3, iqr };
  });
  objectKeys(payload.medianAttrs, ALL_ATTR_KEYS);
  const medianAttrs = Object.fromEntries(ALL_ATTR_KEYS.map((key) => [key, numeric(payload.medianAttrs[key], -100, 100)]));
  const cohort = { size, groups, axes, medianAttrs, most: groups.reduce((best, group) => group.count > best.count ? group : best), divergent: axes.reduce((best, axis) => axis.iqr > best.iqr ? axis : best), similar: null };
  return { report: null, cohort, request: buildCohortRequest(cohort, { className: nameValue(payload.className) }) };
}
