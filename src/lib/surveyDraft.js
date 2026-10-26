import {cleanStoryReflection} from './campusStory.js';
import {cleanDaySurveyContext} from './daySurveyBridge.js';
import { MATRIX_VERSION, QUESTIONS as CANONICAL_QUESTIONS, isKnownOption } from './surveySchema.js';
import { JOURNEY_QUESTIONS as QUESTIONS, journeyIndex } from './surveyJourney.js';

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
    if (!draft.questionId && CANONICAL_QUESTIONS.slice(0,draft.index).some(q=>!answers[q.field])) return null;
    if (draft.questionId && journeyIndex(draft.questionId)<0) return null;
    // Legacy drafts start at their first unanswered new-route stop, retaining all choices.
    const firstMissing=QUESTIONS.findIndex(q=>!answers[q.field]);
    const requested=draft.questionId?journeyIndex(draft.questionId):firstMissing;
    const index=requested<0?QUESTIONS.length-1:requested;
    if (draft.questionId && QUESTIONS.slice(0,index).some(q=>!answers[q.field])) return null;
    return { index, answers, ...(cleanStoryReflection(draft.storyContext)?{storyContext:cleanStoryReflection(draft.storyContext)}:{}), ...(cleanDaySurveyContext(draft.dayContext)?{dayContext:cleanDaySurveyContext(draft.dayContext)}:{}) };
  } catch { return null; }
}

export function saveSurveyDraft(index, answers, storage, scope = '', storyContext, dayContext) {
  try {
    (storage ?? globalThis.sessionStorage)?.setItem(scope ? `${SURVEY_DRAFT_KEY}:${scope}` : SURVEY_DRAFT_KEY, JSON.stringify({ version: MATRIX_VERSION, index, questionId: QUESTIONS[index]?.id, answers, ...(cleanStoryReflection(storyContext)?{storyContext:cleanStoryReflection(storyContext)}:{}), ...(cleanDaySurveyContext(dayContext)?{dayContext:cleanDaySurveyContext(dayContext)}:{}) }));
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
