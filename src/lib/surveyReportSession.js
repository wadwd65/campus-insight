import { MATRIX_VERSION, QUESTIONS, isKnownOption } from './surveySchema.js';
import { cleanDaySurveyContext } from './daySurveyBridge.js';

const PREFIX = 'campus-insight:completed-survey:';
const keyOf = (scope) => `${PREFIX}${scope || 'guest'}`;

/** A completed personal questionnaire stays in this tab, never in shared localStorage.
 * Only the ten canonical answers are retained. Server submissions remain explicit.
 */
export function validSurveyAnswers(value) {
  if (!value || QUESTIONS.some(q => !isKnownOption(q.field, value[q.field]))) return null;
  return Object.fromEntries(QUESTIONS.map(q => [q.field, value[q.field]]));
}

export function readSurveyReport(storage, scope = '') {
  return readSurveyReportSnapshot(storage, scope)?.answers ?? null;
}

export function readSurveyReportSnapshot(storage, scope = '') {
  try {
    const saved = JSON.parse((storage ?? globalThis.sessionStorage)?.getItem(keyOf(scope)) || 'null');
    const answers = saved?.version === MATRIX_VERSION ? validSurveyAnswers(saved.answers) : null;
    return answers ? { answers, dayContext: cleanDaySurveyContext(saved.dayContext) } : null;
  } catch { return null; }
}

export function saveSurveyReport(answers, storage, scope = '', dayContext) {
  const clean = validSurveyAnswers(answers);
  if (!clean) return false;
  try {
    const context = cleanDaySurveyContext(dayContext);
    (storage ?? globalThis.sessionStorage).setItem(keyOf(scope), JSON.stringify({ version: MATRIX_VERSION, answers: clean, ...(context ? {dayContext:context} : {}) }));
    return true;
  } catch { return false; }
}

export function clearSurveyReport(storage, scope = '') {
  try { (storage ?? globalThis.sessionStorage)?.removeItem(keyOf(scope)); } catch { /* Optional storage. */ }
}
