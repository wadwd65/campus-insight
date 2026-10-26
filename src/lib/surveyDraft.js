import { MATRIX_VERSION, QUESTIONS, isKnownOption } from './surveySchema.js';

export const SURVEY_DRAFT_KEY = 'campus-insight:survey-draft';

/** Only retain valid answers in this tab; storage failures never block the quiz. */
export function readSurveyDraft(storage, scope = '') {
  try {
    const draft = JSON.parse((storage ?? globalThis.sessionStorage)?.getItem(scope ? `${SURVEY_DRAFT_KEY}:${scope}` : SURVEY_DRAFT_KEY) || 'null');
    if (!draft || draft.version !== MATRIX_VERSION || !Number.isInteger(draft.index)
      || draft.index < 0 || draft.index >= QUESTIONS.length) return null;
    const answers = {};
    for (const q of QUESTIONS) {
      if (isKnownOption(q.field, draft.answers?.[q.field])) answers[q.field] = draft.answers[q.field];
    }
    if (QUESTIONS.slice(0, draft.index).some(q => !answers[q.field])) return null;
    return { index: draft.index, answers };
  } catch { return null; }
}

export function saveSurveyDraft(index, answers, storage, scope = '') {
  try {
    (storage ?? globalThis.sessionStorage)?.setItem(scope ? `${SURVEY_DRAFT_KEY}:${scope}` : SURVEY_DRAFT_KEY, JSON.stringify({ version: MATRIX_VERSION, index, answers }));
  } catch { /* Disabled storage is a supported browser setting. */ }
}

export function clearSurveyDraft(storage, scope = '') {
  try { (storage ?? globalThis.sessionStorage)?.removeItem(scope ? `${SURVEY_DRAFT_KEY}:${scope}` : SURVEY_DRAFT_KEY); } catch { /* Best effort. */ }
}

export function clearAccountDrafts(userId, storage) {
  try {
    const target = storage ?? globalThis.sessionStorage;
    const prefix = `${SURVEY_DRAFT_KEY}:${userId}:`;
    const keys = Array.from({ length: target.length }, (_, index) => target.key(index)).filter(key => key?.startsWith(prefix));
    for (const key of keys) target.removeItem(key);
  } catch { /* Disabled storage is supported. */ }
}
