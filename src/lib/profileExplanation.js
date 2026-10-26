import { ALL_ATTR_KEYS, BASE_ATTR_KEYS, DERIVED, QUESTIONS, vectorOf } from './surveySchema.js';
import { toAttributes, withDerivedAttributes, percentileOf } from './matrix.js';

const baseVector = (value) => Object.fromEntries(BASE_ATTR_KEYS.map((key) => [key, Number.isFinite(value?.[key]) ? value[key] : 0]));

/** Explain the actual ledger. Map entries already contain visit decay; never look up their initial reward again. */
export function profileSources(answers, trail = []) {
  const sources = QUESTIONS.flatMap((question) => {
    const answer = answers?.[question.field];
    const delta = vectorOf(question.field, answer);
    return delta ? [{ id: question.id, kind: 'answer', field: question.field, question: question.text, label: answer, delta: withDerivedAttributes(baseVector(delta)) }] : [];
  });
  for (const [index, entry] of (trail ?? []).entries()) {
    if (!entry?.at || !entry.delta || !BASE_ATTR_KEYS.some((key) => Number.isFinite(entry.delta[key]) && entry.delta[key] !== 0)) continue;
    sources.push({ id: `map-${index}`, kind: 'map', label: entry.label, delta: withDerivedAttributes(baseVector(entry.delta)) });
  }
  return sources;
}

export function explainProfile({ answers, trail, attributes, baseline }) {
  const current = withDerivedAttributes(baseVector(attributes ?? toAttributes(answers)));
  const sources = profileSources(answers, trail);
  return ALL_ATTR_KEYS.map((key) => {
    const influences = sources.map((source) => ({ ...source, points: source.delta[key] })).filter((source) => source.points !== 0).sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
    const positive = influences.reduce((sum, source) => sum + Math.max(0, source.points), 0);
    const negative = influences.reduce((sum, source) => sum + Math.min(0, source.points), 0);
    return { key, raw: current[key], percentile: percentileOf(current[key], baseline?.sorted?.[key] ?? []), positive, negative, unexplained: current[key] - positive - negative, influences, formula: DERIVED.find((item) => item.key === key)?.formula ?? null };
  });
}

/** Replace exactly one recognized answer in a copy of the current ledger, including any existing map actions. */
export function previewAnswer({ answers, attributes, baseline, field, value }) {
  const before = vectorOf(field, answers?.[field]);
  const after = vectorOf(field, value);
  if (!before || !after) return null;
  const original = baseVector(attributes ?? toAttributes(answers));
  const adjusted = Object.fromEntries(BASE_ATTR_KEYS.map((key) => [key, original[key] - (before[key] ?? 0) + (after[key] ?? 0)]));
  const completed = withDerivedAttributes(adjusted);
  return { attributes: completed, percents: Object.fromEntries(ALL_ATTR_KEYS.map((key) => [key, percentileOf(completed[key], baseline?.sorted?.[key] ?? [])])) };
}
