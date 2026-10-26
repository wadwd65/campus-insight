import { readLlmPayload } from '../src/lib/llmPayload.js';
import { consumeSseStream } from '../src/lib/sse.js';
import { publicLlmStatus } from './config.mjs';

const MAX_BODY_BYTES = 16384;
const json = (response, status, value) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(JSON.stringify(value)); };
const frame = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

export function createAiHandler(config, { fetchImpl = fetch } = {}) {
  const buckets = new Map();
  let active = 0;
  return async function handleAi(request, response, next = () => json(response, 404, { error: 'not-found' })) {
    const route = request.url?.split('?')[0];
    if (!route?.startsWith('/api/llm/')) return next();
    if (route === '/api/llm/status' && request.method === 'GET') return json(response, 200, publicLlmStatus(config));
    if (route !== '/api/llm/summary') return json(response, 404, { error: 'not-found' });
    if (request.method !== 'POST') return json(response, 405, { error: 'method-not-allowed' });
    let sameOrigin = true;
    try { if (request.headers.origin) { const origin = new URL(request.headers.origin); sameOrigin = ['http:', 'https:'].includes(origin.protocol) && origin.host === request.headers.host; } } catch { sameOrigin = false; }
    if (!sameOrigin || request.headers['sec-fetch-site'] === 'cross-site') return json(response, 403, { error: 'cross-origin' });
    if (!config.configured) return json(response, 503, { error: 'not-configured' });
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) return json(response, 415, { error: 'json-required' });
    if (Number(request.headers['content-length']) > MAX_BODY_BYTES) return json(response, 413, { error: 'too-large' });
    const now = Date.now(), address = request.socket.remoteAddress;
    for (const [key, bucket] of buckets) if (now - bucket.started >= 60000) buckets.delete(key);
    const bucket = buckets.get(address) ?? { started: now, count: 0, active: 0 };
    if (bucket.count >= (config.requestsPerMinute ?? 6) || bucket.active >= 2 || active >= 8 || buckets.size > 2000) {
      response.setHeader('Retry-After', '60'); return json(response, 429, { error: 'rate-limit' });
    }
    bucket.count++; bucket.active++; active++; buckets.set(address, bucket);
    const controller = new AbortController();
    let bodyComplete = false;
    const cancel = () => { if (!response.writableEnded) controller.abort(); };
    request.once('aborted', cancel); response.once('close', cancel);
    const timer = setTimeout(() => {
      controller.abort();
      if (!bodyComplete) request.destroy();
    }, config.timeoutMs ?? 25000);
    try {
      const chunks = []; let bytes = 0;
      for await (const chunk of request) { bytes += chunk.length; if (bytes > MAX_BODY_BYTES) { json(response, 413, { error: 'too-large' }); return; } chunks.push(chunk); }
      bodyComplete = true;
      let prompt;
      try { prompt = readLlmPayload(JSON.parse(Buffer.concat(chunks).toString('utf8'))).request; }
      catch { return json(response, 400, { error: 'invalid-summary-payload' }); }
      const upstream = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], stream: true, temperature: 0.7, max_tokens: 900, ...(new URL(config.baseUrl).hostname === 'api.deepseek.com' ? { thinking: { type: 'disabled' } } : {}) }),
      });
      if (!upstream.ok || !upstream.body || !/text\/event-stream/i.test(upstream.headers.get('content-type') ?? '')) {
        await upstream.body?.cancel();
        return json(response, [401, 402, 403, 429].includes(upstream.status) ? upstream.status : 502, { error: 'upstream-unavailable' });
      }
      response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
      // Forward text only; provider metadata and reasoning stay on the server.
      await consumeSseStream(upstream.body, { maxChars: 900, requireDone: true, onDelta: (delta) => response.write(frame(delta)) });
      if (!response.destroyed) response.end('data: [DONE]\n\n');
    } catch {
      if (response.destroyed) return;
      if (!response.headersSent) json(response, controller.signal.aborted ? 504 : 502, { error: controller.signal.aborted ? 'timeout' : 'upstream-unavailable' });
      else response.destroy(); // An interrupted stream must not be accepted as a complete summary.
    } finally {
      clearTimeout(timer); controller.abort();
      request.removeListener('aborted', cancel); response.removeListener('close', cancel);
      bucket.active--; active--;
    }
  };
}
