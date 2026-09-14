/**
 * 六步问卷表单 —— 一屏一题。
 *
 * 两个刻意的设计：
 *   1. **点选项即作答，自动进下一题**，不设「确定」按钮。目标是全程 30 秒内，
 *      每一次多余的点击都在消耗评委的耐心。
 *   2. **可以回上一题**。不做这点的问卷，会让人在第 5 题时因为「前面好像选错了」
 *      而直接关掉页面。
 *
 * 措辞与选项一律从 surveySchema 取（源头是 src/data/matrix.json），
 * 这里不重抄一遍 —— 抄一遍就意味着将来改了矩阵、忘了改界面。
 */

import { useState } from 'react';
import { QUESTIONS } from '../lib/surveySchema.js';

export default function SurveyForm({ onComplete, onCancel }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flash, setFlash] = useState(null);

  const question = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;

  function pick(text) {
    if (flash) return; // 防连点：动画期间忽略后续点击，否则会跳过一题
    setFlash(text);

    const next = { ...answers, [question.field]: text };

    window.setTimeout(() => {
      setFlash(null);
      setAnswers(next);
      if (isLast) onComplete(next);
      else setIndex((i) => i + 1);
    }, 160);
  }

  const progress = (index / QUESTIONS.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      {/* 进度 */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex-1 h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: 'var(--brand)' }}
          />
        </div>
        <span className="text-xs text-[var(--ink-soft)] tabular-nums shrink-0">
          {index + 1} / {QUESTIONS.length}
        </span>
      </div>

      <p className="text-xs tracking-widest text-[var(--ink-soft)] mb-2">
        第 {index + 1} 题
      </p>
      <h2 className="text-2xl font-semibold tracking-tight leading-snug mb-2">
        {question.text}
      </h2>
      <p className="text-sm text-[var(--ink-soft)] mb-8">{question.hint}</p>

      <div className="space-y-2.5">
        {question.options.map((opt) => {
          const active = flash === opt.text;
          return (
            <button
              key={opt.text}
              type="button"
              onClick={() => pick(opt.text)}
              className={[
                'w-full text-left rounded-xl border px-5 py-3.5 text-[15px] transition-all duration-150',
                active
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-[var(--line)] bg-[var(--surface)] hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
              style={active ? { background: 'var(--brand)' } : undefined}
            >
              {opt.text}
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => (index === 0 ? onCancel?.() : setIndex((i) => i - 1))}
          className="text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition"
        >
          {index === 0 ? '返回' : '← 上一题'}
        </button>
        <span className="text-xs text-[var(--ink-soft)]">
          选一个就好，没有对错
        </span>
      </div>
    </div>
  );
}
