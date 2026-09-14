/**
 * SSE（Server-Sent Events）增量解析 —— 纯函数，不碰网络。
 *
 * 为什么把这块单独拆出来：
 *   流式输出最容易出错的地方**不是** fetch，而是"一条 JSON 被切成了两半"。
 *   网络分片完全不按行边界来：`{"choices":[{"delta":{"content":"大"` 和
 *   `}}]}` 很可能落在两个 chunk 里。如果每个 chunk 直接 JSON.parse，
 *   就会在中文（多字节 UTF-8）和长句子上随机丢字 —— 而且丢得没有规律，
 *   靠肉眼几乎发现不了。
 *
 *   把它做成「喂进去字符串、吐出来完整事件」的纯函数之后，这件事就能在
 *   Node 里用切碎的假数据反复验证（见 scripts/selftest-matrix.mjs F 节）。
 *   网络那一层只剩下 fetch 与 abort，没有什么能错的地方。
 */

/** 一次完整事件的结果。delta 是正文增量，done 表示服务端宣告结束。 */
export const DONE = Symbol('sse-done');

/**
 * 解析一行 SSE。
 *
 * @param {string} line 已经去掉换行符的一行
 * @returns {string|symbol|null} 正文增量 / DONE / null（这行不用管）
 */
export function parseSseLine(line) {
  const text = line.replace(/\r$/, '');
  // 空行是心跳，`:keep-alive` 是注释行（OpenAI 兼容服务偶发会发），都不用管
  if (!text || text.startsWith(':')) return null;
  if (!text.startsWith('data:')) return null;

  const payload = text.slice(5).trim();
  if (payload === '[DONE]') return DONE;
  if (!payload) return null;

  let json;
  try {
    json = JSON.parse(payload);
  } catch {
    // 半截 JSON 不会走到这里 —— 调用方只在遇到换行后才调用本函数。
    // 真出现解析不了的行，跳过比抛错好：一份报告不该被一行脏数据打断。
    return null;
  }

  // OpenAI 兼容格式。部分服务在首包会带一个只有 role 的 delta，content 为空。
  const delta = json?.choices?.[0]?.delta?.content;
  return typeof delta === 'string' && delta ? delta : null;
}

/**
 * 创建增量缓冲器。喂进任意大小的字符串块，吐出一批完整事件。
 *
 * 关键在 `while` 而不是 `if`：一个 chunk 里常常含好几行事件，
 * 用 if 只取第一条的话，模型输出会**按 chunk 边界**丢掉大半 ——
 * 表现是文字一跳一跳地少一句，很像模型本身在抽风，实际是解析器的问题。
 */
export function createSseBuffer() {
  let buf = '';

  return {
    /**
     * @param {string} chunk
     * @returns {Array<string|symbol>}
     */
    push(chunk) {
      buf += chunk;
      const out = [];
      let idx = buf.indexOf('\n');
      while (idx >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        const ev = parseSseLine(line);
        if (ev !== null) out.push(ev);
        idx = buf.indexOf('\n');
      }
      return out;
    },

    /**
     * 收尾：有些服务最后一行没有换行符，直接结束了。
     * 不读这一下，最后几个字会安静地丢掉。
     * @returns {Array<string|symbol>}
     */
    flush() {
      if (!buf) return [];
      const line = buf;
      buf = '';
      const ev = parseSseLine(line);
      return ev === null ? [] : [ev];
    },
  };
}

/** 把一批事件拼成正文增量。DONE 与空事件都被过滤掉。 */
export function joinDeltas(events) {
  return events.filter((e) => typeof e === 'string').join('');
}

/**
 * 读完整个 SSE 响应体，边读边回调。
 *
 * 参数是 `body`（一个 ReadableStream），不是 Response —— 于是这段逻辑
 * 可以脱离网络被验证：Node 里用 `new ReadableStream({ start })` 手工喂进
 * 一段被切得很碎的字节流就行（见自检 F 节）。
 *
 * 两个参数必须成对出现，缺一个都会出真问题：
 *   · `stream: true` 的解码器 —— 不加，被切断的多字节字符会变成乱码方块，
 *     而中文恰好每个字 3 字节，在 chunk 边界被切中的概率高得离谱。
 *   · `maxChars` 上限 —— 不加，一个跑飞的接口能一直往下吐，
 *     页面就永远停在"正在写"，用户只会关掉它。
 *
 * @param {ReadableStream<Uint8Array>} body
 * @param {{onDelta?: (s: string) => void, maxChars?: number}} options
 * @returns {Promise<string>} 完整正文
 */
export async function consumeSseStream(body, { onDelta, maxChars = Infinity } = {}) {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  const buffer = createSseBuffer();

  let acc = '';
  let stopped = false;

  // 逐块读，而不是 await res.text() —— 后者要等全部生成完，
  // "正在写"的效果就没了，变成单纯转圈等待，那这一步就白做了
  while (!stopped) {
    const { done, value } = await reader.read();
    if (done) break;

    for (const ev of buffer.push(decoder.decode(value, { stream: true }))) {
      if (ev === DONE) {
        stopped = true;
        break;
      }
      acc += ev;
      onDelta?.(ev);
      // 上限判断放在**回调之后**：先让人看见这一段，再收手。
      // 反过来的话，最后那一段只会出现在最终成稿里、不会出现在打字过程中，
      // 视觉上就是「字打完了又自己蹦出来一个」。
      // 代价是正文可能比上限多出最后一段的长度 —— 这个代价换得来。
      if (acc.length >= maxChars) {
        stopped = true;
        break;
      }
    }
  }

  // 被 DONE / 上限截停的，尾部不补；自然读完的，补最后一行
  // （有些服务的最后一行没有换行符，不补就安静地丢掉几个字）
  if (!stopped) {
    const tail = joinDeltas(buffer.flush());
    if (tail) {
      acc += tail;
      onDelta?.(tail);
    }
  }

  return acc;
}
