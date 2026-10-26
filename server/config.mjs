import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

/** Server-only: env values and the key file are never imported by browser modules. */
export function loadEnvironment({ root = process.cwd(), env = process.env } = {}) {
  let values = {};
  for (const filename of ['.env', '.env.local']) {
    const file = path.join(root, filename);
    if (fs.existsSync(file)) values = { ...values, ...parseEnv(fs.readFileSync(file, 'utf8')) };
  }
  return { ...values, ...env };
}

export function loadServerConfig(options = {}) {
  const root = options.root || process.cwd();
  const values = loadEnvironment(options);
  let apiKey = (values.LLM_API_KEY ?? '').trim();
  if (!apiKey && values.LLM_API_KEY_FILE) {
    try { apiKey = fs.readFileSync(path.resolve(root, values.LLM_API_KEY_FILE), 'utf8').trim(); } catch { /* Missing file means unconfigured; never expose its path. */ }
  }
  let baseUrl = (values.LLM_BASE_URL ?? '').trim().replace(/\/+$/, '');
  try {
    const url = new URL(baseUrl);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || url.username || url.password || url.search || url.hash) baseUrl = '';
  } catch { baseUrl = ''; }
  const model = (values.LLM_MODEL ?? '').trim();
  const configured = Boolean(baseUrl && apiKey && !/\s/.test(apiKey) && model);
  return { configured, baseUrl, apiKey, model, host: baseUrl ? new URL(baseUrl).host : null, timeoutMs: 25000, requestsPerMinute: 6 };
}

export function publicLlmStatus(config) {
  return { configured: config.configured, model: config.configured ? config.model : null, host: config.configured ? config.host : null };
}
