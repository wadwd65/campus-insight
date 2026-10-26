import { QUESTIONS, MATRIX_VERSION } from './surveySchema.js';

function cell(value) {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildCircleCsv(members) {
  const valid = members.filter(m => m.submission?.matrixVersion === MATRIX_VERSION);
  const header = ['编号', '显示名称', '提交时间', '提交次数', ...QUESTIONS.map(q => q.field)];
  const rows = valid.map(m => [m.id, m.displayName, m.submission.submittedAt, m.submission.revision, ...QUESTIONS.map(q => m.submission.answers[q.field])]);
  return [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
