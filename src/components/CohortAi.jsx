/**
 * CohortAi.jsx —— 群体画像页的大模型解读区块（10-08 补齐第三段链路）
 *
 * 交互与个人版 AiSummary 一致（流式 + 状态提示 + 重新写一遍），但走的是**群体链路**：
 *   buildCohortRequest(cohort) → streamSummary({ request, fallback })
 * 状态提示是官方用户体验项的明确考察点（"AI 响应状态提示友好（流式、思考可视化）"），
 * 所以三种状态都写清楚：正在写 / 已完成（含模型名）/ 本地兜底（并说明原因）。
 */
import { useEffect, useState } from 'react';
import TermPanel from './TermPanel.jsx';
import { streamSummary, llmStatus } from '../lib/llm.js';
import { buildCohortRequest, cohortFallbackText } from '../lib/cohortSummary.js';
import { BRAND } from '../lib/theme.js';

function reasonText(reason) {
  if (reason === 'not-configured') return '未配置大模型密钥，这段由本地规则生成';
  if (reason === 'timeout') return '大模型超时，这段由本地规则生成';
  return '大模型暂时不可用，这段由本地规则生成';
}

export default function CohortAi({ cohort, className = '' }) {
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(true);
  const [reason, setReason] = useState(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!cohort || !cohort.size) return undefined;
    let alive = true;
    const ctrl = new AbortController();
    setBody('');
    setPending(true);
    setReason(null);

    streamSummary({
      report: null,                                   // 群体链路不用个人报告
      request: buildCohortRequest(cohort, { className }),
      fallback: () => cohortFallbackText(cohort),
      onDelta: (d) => { if (alive) setBody((b) => b + d); },
      signal: ctrl.signal,
    }).then((res) => {
      if (!alive) return;
      setBody(res.text);
      setReason(res.degraded ? (res.reason ?? 'network') : null);
      setPending(false);
    }).catch(() => {
      if (!alive) return;
      setBody(cohortFallbackText(cohort));
      setReason('network');
      setPending(false);
    });

    return () => { alive = false; ctrl.abort(); };
  }, [cohort, className, round]);

  const paragraphs = body.split(/\n{2,}/).filter(Boolean);
  const status = llmStatus();

  return (
    <TermPanel style={{ padding: '20px 22px' }}>
      {/* 标头：让"这段是 AI 写的"一眼成立（官方体验项要求的"状态可感知"）*/}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="term-mono text-[10px] tracking-[0.2em] px-1.5 py-0.5"
          style={{ color: '#fff', background: BRAND }}
        >
          AI
        </span>
        <span className="term-mono text-[10px] tracking-[0.18em] text-[var(--ink-soft)]">
          群体解读 · COHORT SUMMARY
        </span>
        <span
          className="ml-auto inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: pending ? BRAND : reason ? '#c9a227' : '#2f9e6b' }}
          title={pending ? '生成中' : reason ? '本地兜底' : '大模型生成'}
        />
      </div>
      {paragraphs.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)] flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          正在读这个班的分布…
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
            ? '正在写这个班的解读…'
            : reason
              ? `${reasonText(reason)}；图表与统计不受影响。`
              : `由大模型实时生成${status.model ? `（${status.model}）` : ''}。只发送算好的分布与分位，不发送任何原始作答。`}
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
    </TermPanel>
  );
}
