/**
 * 「给你的话」—— 五件套之五。
 *
 * 这是整份报告里唯一一块**内容是现场生成的**。它有三种状态，界面必须如实区分：
 *
 *   · 正在写     → 逐字出现 + 光标，让人看见"它在想"
 *   · 实时生成   → 正文来自大模型
 *   · 内置文案   → 没配密钥 / 接口超时 / 接口报错，正文来自 fallback.js
 *
 * 第三种状态**不做成错误提示**。原因：线上那一版刻意不带密钥，
 * 也就是说大多数评委看到的就是这一步 —— 它必须看起来像设计好的样子，
 * 而不是像一个坏掉的功能。所以只在底下加一行小字说明来源。
 *
 * 逐字刷新只影响本组件：正文状态留在 AiSummary 内部，
 * 不往上抛。否则每来一个字都会重渲染上面四张 ECharts 图 ——
 * 那点流畅感会被自己吃掉。最终成稿才通过 onText 交给结果页（给"复制文字版"用）。
 */

import { useEffect, useState } from 'react';
import { streamSummary, llmStatus } from '../lib/llm.js';
import { fallbackText } from '../lib/fallback.js';

const REASON_TEXT = {
  'not-configured': '页面没有配置大模型接口，这里是内置文案',
  timeout: '大模型接口超时，已切回内置文案',
  empty: '大模型这次没写出内容，已切回内置文案',
  truncated: '大模型这次没写完，已切回内置文案',
  network: '大模型接口连接失败，已切回内置文案',
};

/** 接口报错时把 HTTP 状态码翻成人话，别让页面上出现 "http-429" 这种东西。 */
function reasonText(reason) {
  if (REASON_TEXT[reason]) return REASON_TEXT[reason];
  const m = /^http-(\d+)$/.exec(reason ?? '');
  if (m) {
    const code = Number(m[1]);
    if (code === 401 || code === 403) return '大模型接口密钥无效，已切回内置文案';
    if (code === 429) return '大模型接口限流了，已切回内置文案';
    return `大模型接口返回 ${code}，已切回内置文案`;
  }
  return '大模型接口暂时不可用，已切回内置文案';
}

export default function AiSummary({ report, name = '', onText }) {
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(true);
  const [reason, setReason] = useState(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    let alive = true;
    let acc = '';

    setBody('');
    setPending(true);
    setReason(null);

    streamSummary({
      report,
      name,
      signal: ctrl.signal,
      onDelta: (d) => {
        acc += d;
        // 只在还挂在页面上时刷新。用户中途点了「再答一次」，
        // 这个组件已经卸载，再 setState 就是一次无意义的渲染
        if (alive) setBody(acc);
      },
    })
      .then((res) => {
        if (!alive || res.aborted) return;
        setBody(res.text);
        setReason(res.degraded ? (res.reason ?? 'network') : null);
        setPending(false);
        onText?.(res.text, { degraded: res.degraded });
      })
      .catch(() => {
        // streamSummary 已经把失败都转成了正常返回，走到这里说明是意料之外的问题。
        // 依然不能停在空白：直接给内置文案，"看不到内容"比"内容不够好"严重得多
        if (!alive) return;
        const text = fallbackText(report, { name });
        setBody(text);
        setReason('network');
        setPending(false);
        onText?.(text, { degraded: true });
      });

    return () => {
      alive = false;
      ctrl.abort();
    };
    // onText 不进依赖：它每次渲染都是新函数，进去会导致无限重新生成
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, name, round]);

  const paragraphs = body.split(/\n{2,}/).filter(Boolean);
  const status = llmStatus();

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 py-5">
      {paragraphs.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)] flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          正在读你的答案…
        </p>
      ) : (
        <div className="space-y-3">
          {paragraphs.map((t, i) => (
            <p key={i} className="text-sm leading-7 text-[var(--ink)]">
              {t}
              {pending && i === paragraphs.length - 1 && (
                <span className="inline-block w-[2px] h-4 ml-0.5 align-[-2px] animate-pulse" style={{ background: 'var(--brand)' }} />
              )}
            </p>
          ))}
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-[var(--line)] flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs text-[var(--ink-soft)] flex-1 min-w-[12rem]">
          {pending
            ? '内容由大模型实时生成中…'
            : reason
              ? `${reasonText(reason)}。图表与百分位不受影响。`
              : `由大模型实时生成${status.model ? `（${status.model}）` : ''}。内容基于上面这些数字，不含你的任何上传。`}
        </span>
        {!pending && (
          <button
            type="button"
            onClick={() => setRound((r) => r + 1)}
            className="text-xs text-[var(--ink-soft)] underline decoration-dotted hover:text-[var(--ink)] transition"
          >
            重新写一遍
          </button>
        )}
      </div>
    </div>
  );
}
