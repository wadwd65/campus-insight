/** Retry the read-only baseline download, including reading its response body. */
export async function fetchBaselineText(url, { fetchImpl = globalThis.fetch, timeoutMs = 8000, delays = [400, 1000], wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  let cause;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let retryable = true;
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) {
        retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      cause = error;
      if (!retryable) throw new Error('网站的基准数据暂时不可用，请联系维护者，或稍后重新加载。', { cause });
    } finally { clearTimeout(timer); }
    if (attempt < delays.length) await wait(delays[attempt]);
  }
  throw new Error('基准数据暂未加载成功，已自动重试。请检查网络后点击“重新加载”。', { cause });
}
