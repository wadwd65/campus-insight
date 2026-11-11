import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { streamStaticFile } from './static-delivery.mjs';
import { loadServerConfig, loadEnvironment, publicLlmStatus } from './config.mjs';
import { createAiHandler } from './ai.mjs';
import { createAccountHandler } from './accounts.mjs';
import { createDeploymentHandler } from './deployment.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = await fs.realpath(path.join(root, 'dist'));
const config = loadServerConfig({ root });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.csv': 'text/csv; charset=utf-8', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const ai = createAiHandler(config);
const environment = loadEnvironment({ root });
const deployment = createDeploymentHandler({ root, env: environment });
const accounts = createAccountHandler({ root, dataDir: environment.CAMPUS_DATA_DIR ? path.resolve(root, environment.CAMPUS_DATA_DIR) : undefined, setupToken: environment.CAMPUS_SETUP_TOKEN, origin: environment.APP_ORIGIN, trustedProxies: environment.CAMPUS_TRUSTED_PROXIES });
const server = http.createServer((request, response) => deployment(request, response, () => accounts(request, response, () => ai(request, response, async () => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname);
    let file = path.resolve(dist, pathname.replace(/^\/+/, '') || 'index.html');
    const within = (value) => { const segment = path.relative(dist, value); return segment !== '..' && !segment.startsWith(`..${path.sep}`) && !path.isAbsolute(segment); };
    if (!within(file)) throw new Error('outside-dist');
    try { if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html'); }
    catch { if (!path.extname(pathname) && request.headers.accept?.includes('text/html')) file = path.join(dist, 'index.html'); }
    file = await fs.realpath(file);
    const stat = await fs.stat(file);
    if (!within(file) || !stat.isFile()) throw new Error('outside-dist');
    streamStaticFile(request, response, file, { contentType: types[path.extname(file)] ?? 'application/octet-stream', cacheControl: path.basename(path.dirname(file)) === 'assets' ? 'public, max-age=31536000, immutable' : 'no-cache', bytes: stat.size });
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found'); }
}))));
server.on('close', () => accounts.close());
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
server.requestTimeout = 30000;
server.headersTimeout = 10000;
const host = environment.HOST || '127.0.0.1', port = Number(environment.PORT || 5191);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
server.listen(port, host, () => console.log(`Campus Insight: http://${host}:${port} · AI ${publicLlmStatus(config).configured ? 'configured' : 'local fallback'}`));
