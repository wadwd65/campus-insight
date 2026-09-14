/**
 * 大模型接入 —— OpenAI 兼容接口 + SSE 流式输出（任务 T-18）。
 *
 * 这个文件的全部难度不在"怎么调接口"，而在**接口不通的时候会发生什么**。
 *
 * 四条设计：
 *
 *   1. **失败不是异常，是一种正常返回。** 所有失败路径都返回同一形状的结果
 *      （degraded + 一段内置文案），调用方永远不需要 try/catch。
 *      理由是：这个产品线上那一版**大概率就是不带密钥的**（见第 3 条），
 *      所以"降级"是主路径之一，不是兜底。
 *
 *   2. **超时 25 秒。** 不设超时的话，一个卡住的请求会让结果页永远停在一段
 *      慢慢爬的字上 —— 用户不会等，他会关掉页面。
 *
 *   3. **密钥不进仓库、也不进线上版。** 用的是 VITE_ 前缀的环境变量，
 *      意味着它会被打进浏览器 bundle —— 任何打开开发者工具的人都拿得到。
 *      所以正式部署的那一版**刻意不配密钥**，走内置文案；
 *      真流式输出的效果在演示视频里用本地 `.env` 跑。
 *      把密钥塞进静态站点换"看起来更智能"，代价是密钥泄露，不值。
 *
 *   4. **收尾要完整。** 生成到一半断网，会拿到一句写到一半的话。
 *      半句话看起来像产品坏了，而内置文案至少是完整的 ——
 *      所以结尾不是句末标点的一律判为截断，整段降级。
 *
 * 事件解析与逐块读取都在 sse.js（纯函数，Node 里可测）；这里只剩 fetch 与 abort。
 * 为了让这些真的能被测到，传输配置走 endpoint 注入 —— 生产不传，读环境变量。
 */

import { buildSummaryRequest } from './buildSummary.js';
import { fallbackText } from './fallback.js';
import { consumeSseStream } from './sse.js';

const DEFAULT_TIMEOUT_MS = 25000;
/** 上限只防跑飞：正常输出 320 字，900 字已经是很长的余量。 */
const MAX_CHARS = 900;

/**
 * 读环境变量。
 *
 * 写成 try/catch 而不是直接取，是为了让这个文件在 **Node 里也能被 import** ——
 * Vite 里 `import.meta.env` 一定存在（构建时被静态替换成字面量），
 * Node 里它一定不存在，取属性会直接抛。包起来之后，Node 拿到空配置，
 * 于是自检可以用"注入 endpoint + 假服务端"把网络路径真跑一遍（见自检 H 节）。
 * 一个纯浏览器才敢 import 的模块，等于一块永远验不了的代码。
 */
function envConfig() {
  try {
    return {
      baseUrl: (import.meta.env.VITE_LLM_BASE_URL || '').trim().replace(/\/+$/, ''),
      apiKey: (import.meta.env.VITE_LLM_API_KEY || '').trim(),
      model: (import.meta.env.VITE_LLM_MODEL || '').trim(),
    };
  } catch {
    return { baseUrl: '', apiKey: '', model: '' };
  }
}

/** 配置状态，界面上要如实说明「当前是内置文案还是实时生成」。 */
export function llmStatus() {
  const { baseUrl, apiKey, model } = envConfig();
  let host = '';
  try {
    host = baseUrl ? new URL(baseUrl).host : '';
  } catch {
    host = baseUrl;
  }
  return { configured: !!(baseUrl && apiKey && model), model: model || null, host };
}

/** 段落规整：统一换行、折叠多余空行、去首尾空白。两条路径共用，版式才一致。 */
function tidy(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 收尾完整性：中文写段落，最后一定是句末标点。
 * 结尾不是标点的，几乎只有一个原因 —— 话没说完就断了。
 * 引号与省略号也算，因为它们就是句中结尾的合法写法。
 */
function looksComplete(text) {
  return /[。！？…」』”"]$/.test(text);
}

/**
 * 流式生成个性化总结。
 *
 * @param {object} params
 * @param {object} params.report buildReport 的返回值
 * @param {string} [params.name] 称呼
 * @param {(delta: string) => void} [params.onDelta] 每收到一小段就回调（用于逐字显示）
 * @param {AbortSignal} [params.signal] 组件卸载时中断
 * @param {{baseUrl?: string, apiKey?: string, model?: string, timeoutMs?: number}} [params.endpoint]
 *        传输配置覆盖项。**只有自检会传**，页面永远不传（读环境变量）。
 * @returns {Promise<{text: string, degraded: boolean, reason: string|null, aborted?: boolean}>}
 */
export async function streamSummary({ report, name = '', onDelta, signal, endpoint = {} }) {
  const cfg = { ...envConfig(), ...endpoint };
  const degrade = (reason) => ({ text: fallbackText(report, { name }), degraded: true, reason });

  if (!(cfg.baseUrl && cfg.apiKey && cfg.model)) return degrade('not-configured');

  const { system, user } = buildSummaryRequest(report, { name });

  // 外部中断（组件卸载）与自身超时合成一个信号 —— fetch 只接受一个 signal
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: true,
        temperature: 0.9,
        max_tokens: 700,
      }),
      signal: ctrl.signal,
    });

    if (!res.ok || !res.body) return degrade(`http-${res.status}`);

    const acc = await consumeSseStream(res.body, { onDelta, maxChars: MAX_CHARS });
    const text = tidy(acc);

    if (!text) return degrade('empty');
    // 组件卸载导致的中断：正文已经有了但不该再显示，交给调用方丢掉
    if (signal?.aborted) return { text, degraded: false, reason: null, aborted: true };
    if (!looksComplete(text)) return degrade('truncated');

    return { text, degraded: false, reason: null };
  } catch (e) {
    if (signal?.aborted) return { text: '', degraded: false, reason: null, aborted: true };
    return degrade(timedOut ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
