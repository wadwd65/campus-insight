/** Legal sample answers, calculated through the same pipeline as personal reports. */
import { QUESTIONS } from './surveySchema.js';
import { buildReport } from './results.js';

export const PREVIEW_STYLES = [
  { id: 'study', label: '自习派', weights: { academic: 3, plan: 2, night: -1 } },
  { id: 'explore', label: '探索派', weights: { novelty: 3, social: 2, sport: 1 } },
  { id: 'relax', label: '松弛派', weights: { resilience: 2, plan: -2, academic: -1 } },
];

export function previewAnswers(id = 'study') {
  const style = PREVIEW_STYLES.find((item) => item.id === id) ?? PREVIEW_STYLES[0];
  return Object.fromEntries(QUESTIONS.map((q) => {
    const score = (o) => Object.entries(style.weights).reduce((sum, [k, w]) => sum + (o.vec[k] ?? 0) * w, 0);
    const best = q.options.reduce((a, b) => score(b) > score(a) ? b : a);
    return [q.field, best.text];
  }));
}

export function buildPreviewReport(baseline, id) {
  return baseline ? buildReport(previewAnswers(id), baseline) : null;
}
