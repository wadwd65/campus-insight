/** A device preference only: never stores accounts, answers, or invitation codes. */
export const GETTING_STARTED_KEY = 'campus:getting-started:v1';

function browserStorage() {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

/** Each instance represents one page lifetime, including when storage is blocked. */
export function createGettingStartedPreference() {
  let sessionOutcome = null;
  return {
    read(storage = browserStorage()) {
      if (sessionOutcome) return sessionOutcome;
      try {
        const value = JSON.parse(storage?.getItem(GETTING_STARTED_KEY) || 'null');
        return value?.version === 1 && ['completed', 'skipped'].includes(value.outcome)
          ? value.outcome : null;
      } catch { return null; }
    },
    remember(outcome, storage = browserStorage()) {
      if (!['completed', 'skipped'].includes(outcome)) return false;
      sessionOutcome = outcome;
      try {
        if (!storage) return false;
        storage.setItem(GETTING_STARTED_KEY, JSON.stringify({ version: 1, outcome }));
        return true;
      } catch { return false; }
    },
  };
}

const pagePreference = createGettingStartedPreference();
export function readGettingStarted(storage = browserStorage()) { return pagePreference.read(storage); }
export function shouldOfferGettingStarted(storage = browserStorage()) { return readGettingStarted(storage) === null; }
export function rememberGettingStarted(outcome, storage = browserStorage()) { return pagePreference.remember(outcome, storage); }
