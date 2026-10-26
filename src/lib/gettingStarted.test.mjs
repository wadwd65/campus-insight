import assert from 'node:assert/strict';
import test from 'node:test';
import { GETTING_STARTED_KEY, createGettingStartedPreference } from './gettingStarted.js';

function memoryStorage(initial) {
  const data = new Map(initial ? [[GETTING_STARTED_KEY, initial]] : []);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('first visit offers help; either explicit dismissal survives a reload', () => {
  for (const outcome of ['skipped', 'completed']) {
    const storage = memoryStorage();
    const page = createGettingStartedPreference();
    assert.equal(page.read(storage), null);
    assert.equal(page.remember(outcome, storage), true);
    assert.equal(page.read(storage), outcome);
    assert.equal(createGettingStartedPreference().read(storage), outcome, 'A fresh page reads the saved choice.');
    assert.deepEqual([...storage.data.keys()], [GETTING_STARTED_KEY]);
    assert.deepEqual(JSON.parse(storage.getItem(GETTING_STARTED_KEY)), { version: 1, outcome });
  }
});

test('damaged, unknown, or old preferences safely offer help again', () => {
  for (const initial of ['broken', 'null', '1', '[]', '{"version":0,"outcome":"completed"}', '{"version":1,"outcome":"unknown"}']) {
    assert.equal(createGettingStartedPreference().read(memoryStorage(initial)), null);
  }
});

test('blocked or unavailable storage remembers dismissal for this page lifetime', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  for (const storage of [blocked, null]) {
    const page = createGettingStartedPreference();
    assert.equal(page.read(storage), null);
    assert.equal(page.remember('skipped', storage), false, 'The caller can distinguish memory-only from a durable save.');
    assert.equal(page.read(storage), 'skipped', 'Remounting the guide must not auto-open it again.');
    assert.equal(createGettingStartedPreference().read(storage), null, 'Memory-only choices do not claim to survive a page reload.');
  }
});

test('a quota-limited store with an older value does not override the latest in-page choice', () => {
  const quotaLimited = { getItem() { return '{"version":1,"outcome":"skipped"}'; }, setItem() { throw new Error('quota'); } };
  const page = createGettingStartedPreference();
  assert.equal(page.read(quotaLimited), 'skipped');
  assert.equal(page.remember('completed', quotaLimited), false);
  assert.equal(page.read(quotaLimited), 'completed');
});

test('invalid outcomes cannot overwrite a deliberate preference', () => {
  const storage = memoryStorage();
  const page = createGettingStartedPreference();
  page.remember('skipped', storage);
  assert.equal(page.remember('registered', storage), false);
  assert.equal(page.read(storage), 'skipped');
});
