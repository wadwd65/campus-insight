import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream';
import { constants, createBrotliCompress, createGzip } from 'node:zlib';

/** Negotiate only static text. API responses and already compressed media stay separate. */
export function staticEncoding(header = '') {
  const preferences = new Map();
  for (const part of String(header).split(',')) {
    const [name, ...parameters] = part.trim().toLowerCase().split(';');
    if (!name) continue;
    const quality = parameters.find(value => value.trim().startsWith('q='));
    const raw = quality?.trim().slice(2);
    const q = raw === undefined ? 1 : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(raw) ? Number(raw) : 0;
    preferences.set(name, q);
  }
  const qualityOf = name => preferences.get(name) ?? preferences.get('*') ?? 0;
  const br = qualityOf('br'), gzip = qualityOf('gzip');
  const identity = preferences.get('identity');
  if (identity !== undefined && identity > Math.max(br, gzip)) return 'identity';
  if (br > 0 && br >= gzip) return 'br';
  if (gzip > 0) return 'gzip';
  return identity === 0 || (identity === undefined && preferences.get('*') === 0) ? null : 'identity';
}

export function streamStaticFile(request, response, file, { contentType, cacheControl, bytes }) {
  const compressible = bytes >= 1024 && /^(?:text\/|application\/(?:json|javascript))/.test(contentType);
  const encoding = compressible ? staticEncoding(request.headers['accept-encoding']) : 'identity';
  if (encoding === null) {
    response.writeHead(406, { Vary: 'Accept-Encoding', 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : 'No acceptable content encoding');
    return;
  }
  response.writeHead(200, {
    'Content-Type': contentType, 'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
    ...(compressible ? { Vary: 'Accept-Encoding' } : {}),
    ...(encoding !== 'identity' ? { 'Content-Encoding': encoding } : {}),
  });
  if (request.method === 'HEAD') { response.end(); return; }
  const source = createReadStream(file);
  const done = error => { if (error) response.destroy(error); };
  if (encoding === 'br') pipeline(source, createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }), response, done);
  else if (encoding === 'gzip') pipeline(source, createGzip({ level: 6 }), response, done);
  else pipeline(source, response, done);
}
