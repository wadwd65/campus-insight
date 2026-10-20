import Papa from 'papaparse';
import { QUESTIONS } from './surveySchema.js';

/** Count cleaned answers directly. These proportions never use the simulated baseline. */
export function buildAnswerDistributions(records) {
  return QUESTIONS.map((q) => {
    const counts = new Map(q.options.map((o) => [o.text, 0]));
    for (const record of records) {
      const answer = record[q.field];
      if (counts.has(answer)) counts.set(answer, counts.get(answer) + 1);
    }
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
    const options = q.options.map((o, index) => ({
      text: o.text, letter: String.fromCharCode(65 + index), count: counts.get(o.text),
      pct: total ? Math.round(counts.get(o.text) / total * 1000) / 10 : 0,
    }));
    const max = Math.max(...options.map((o) => o.count));
    return {
      id: q.id, field: q.field, topic: q.topic ?? q.field, text: q.text, total, options,
      leaders: total ? options.filter((o) => o.count === max) : [],
    };
  });
}

/** Aggregate counts only: no identifiers or individual answer rows. */
export function buildAnswerDistributionCsv(distributions) {
  return Papa.unparse({
    fields: ['题目', '选项', '人数', '占比（%）', '本题有效作答数'],
    data: distributions.flatMap((q) => q.options.map((o) => [q.field, o.text, o.count, o.pct, q.total])),
  }, { newline: '\r\n', escapeFormulae: true });
}
