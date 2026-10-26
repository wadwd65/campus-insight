/** Same-origin model relay. Provider credentials are server-only; endpoint injection is for transport tests. */
import { buildSummaryRequest, buildSummaryFacts } from './buildSummary.js';
import { buildLlmPayload } from './llmPayload.js';
import { fallbackText } from './fallback.js';
import { consumeSseStream } from './sse.js';
import { validateSummary } from './validateSummary.js';
import { validateCohortSummary, COHORT_HARD_ISSUE_TYPES } from './validateCohortSummary.js';

const DEFAULT_TIMEOUT_MS = 25000;
const MAX_CHARS = 900;
const HARD_ISSUE_TYPES = new Set(['empty', 'invented-number', 'diagnosis', 'invented-answer', 'ungrounded-narrative']);
let cachedStatus = { checked: false, configured: false, model: null, host: null };
let statusTime = 0;
let statusUrl = '';

export function llmStatus() { return { ...cachedStatus }; }

export async function readLlmStatus({ signal, url = '/api/llm/status' } = {}) {
  if (typeof window === 'undefined' && !/^https?:\/\//.test(url)) return { checked: true, configured: false, model: null, host: null };
  if (statusUrl === url && Date.now() - statusTime < 15000) return llmStatus();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), 1800);
  try {
    if (signal?.aborted) controller.abort();
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('no-relay');
    const value = await response.json();
    cachedStatus = { checked: true, configured: value.configured === true, model: typeof value.model === 'string' ? value.model : null, host: typeof value.host === 'string' ? value.host : null };
    statusUrl = url; statusTime = Date.now();
    return llmStatus();
  } catch {
    return { checked: true, configured: false, model: null, host: null };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function tidy(text) { return String(text ?? '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); }
function looksComplete(text) { return /[。！？…」』”"]$/.test(text); }

export async function streamSummary({ report, name = '', className = '', onDelta, onStatus, signal, endpoint = {}, request, fallback, cohort = null }) {
  const degrade = (reason) => ({ text: typeof fallback === 'function' ? fallback() : fallbackText(report, { name }), degraded: true, reason });
  if (signal?.aborted) return { text: '', aborted: true, degraded: false, reason: null };
  const direct = Boolean(endpoint.baseUrl && endpoint.apiKey && endpoint.model);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, endpoint.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const status = direct ? { checked: true, configured: true, model: endpoint.model, host: new URL(endpoint.baseUrl).host } : await readLlmStatus({ signal: controller.signal, url: endpoint.statusUrl });
    onStatus?.(status);
    if (signal?.aborted) return { text: '', aborted: true, degraded: false, reason: null };
    if (!status.configured) return degrade('not-configured');
    let url, headers, body;
    if (direct) {
      const prompt = request ?? buildSummaryRequest(report, { name });
      url = endpoint.baseUrl.replace(/\/+$/, '') + '/chat/completions';
      headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${endpoint.apiKey}` };
      body = { model: endpoint.model, messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], stream: true, temperature: 0.9, max_tokens: 700 };
    } else {
      url = endpoint.relayUrl ?? '/api/llm/summary';
      headers = { 'Content-Type': 'application/json' };
      body = buildLlmPayload({ report, cohort, name, className });
    }
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal, credentials: 'same-origin' });
    if (!response.ok || !response.body) return degrade(response.status === 504 ? 'timeout' : `http-${response.status}`);
    const text = tidy(await consumeSseStream(response.body, { onDelta, maxChars: MAX_CHARS, requireDone: !direct }));
    if (signal?.aborted) return { text, aborted: true, degraded: false, reason: null };
    if (!text) return degrade('empty');
    if (!looksComplete(text)) return degrade('truncated');
    const verdict = report ? validateSummary(text, { facts: buildSummaryFacts(report) }) : cohort ? validateCohortSummary(text, { cohort }) : validateSummary(text, {});
    const hardTypes = cohort && !report ? COHORT_HARD_ISSUE_TYPES : HARD_ISSUE_TYPES;
    if (verdict.issues.some((issue) => hardTypes.has(issue.type))) return degrade('invalid-summary');
    return { text, degraded: false, reason: null, model: status.model, issues: verdict.issues };
  } catch {
    if (signal?.aborted) return { text: '', aborted: true, degraded: false, reason: null };
    return degrade(timedOut ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer); controller.abort();
    signal?.removeEventListener('abort', onAbort);
  }
}
