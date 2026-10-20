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
 *
 * ★ 10-14 美化：原来这一页是「一条灰进度条 + 一行题干 + 五个白框按钮」，
 *   三样东西全是同一种灰和白，读完只记得"有五个选项"。
 *   改了三处：
 *     ① 进度条 → **分段读数**。一题一格，走过的用青、当前用琥珀 ——
 *        "走到第几格"变成可以直接数出来的东西，而不是一条要估长度的线。
 *     ② 题干从 24px 提到 27px、色号用 --ink-strong（17.06）——
 *        这一页唯一要被读进去的就是这句话，它该是页面上最重的元素。
 *     ③ 选项加字母徽标 + 悬停抬起 + 选中态用渐变实底。
 *        原来选中是"整个变蓝"，现在是"徽标变实心 + 底色渐变 + 阴影"，
 *        反馈更明确，也不会像原来那样闪一下就过。
 */

import { useEffect, useRef, useState } from 'react';
import { QUESTIONS } from '../lib/surveySchema.js';
import { MonoTag } from './TermHead.jsx';
import ArkOption from './ArkOption.jsx';
import NavButton from './NavButton.jsx';
import { readSurveyDraft, saveSurveyDraft, clearSurveyDraft } from '../lib/surveyDraft.js';

export default function SurveyForm({ onComplete, onCancel, onPause = onCancel }) {
  const [draft] = useState(() => readSurveyDraft());
  const [index, setIndex] = useState(draft?.index ?? 0);
  const [answers, setAnswers] = useState(draft?.answers ?? {});
  const [flash, setFlash] = useState(null);
  const [restored, setRestored] = useState(Boolean(draft && draft.index > 0));
  const questionRef = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => { saveSurveyDraft(index, answers); }, [index, answers]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    questionRef.current?.focus({ preventScroll: true });
  }, [index]);
  useEffect(() => () => window.clearTimeout(pendingRef.current), []);

  const question = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;

  function pick(text) {
    if (flash) return; // 防连点：动画期间忽略后续点击，否则会跳过一题
    setFlash(text);
    setRestored(false);

    const next = { ...answers, [question.field]: text };

    // Briefly retain the color and check mark before moving to the next question.
    pendingRef.current = window.setTimeout(() => {
      setFlash(null);
      setAnswers(next);
      if (isLast) { clearSurveyDraft(); onComplete(next); }
      else setIndex((i) => i + 1);
    }, 420);
  }

  return (
    <div key={question.field} className="quiz-page relative max-w-3xl mx-auto" onKeyDown={(event) => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
      const key = event.key.toUpperCase();
      const optionIndex = /^[A-E]$/.test(key) ? key.charCodeAt(0) - 65 : /^[1-5]$/.test(key) ? Number(key) - 1 : -1;
      if (question.options[optionIndex]) { event.preventDefault(); pick(question.options[optionIndex].text); }
    }}>
      {/* 顶部状态行：与入场/欢迎页/报告页同一种语言。
          写的不是"答题中"，而是"COLLECTING 03/10" ——
          终端在采集，用户在提供样本，这件事在四页之间是一致的。 */}
      {/* ★ 10-15：这一行原本直接压在天空上 —— 云一过就读不清。
          给它一条半透明的底（.sky-strip），成本近乎零，
          但"这是界面、不是画面"立刻成立。 */}
      <div className="sky-strip flex items-center justify-between mb-4 px-3 py-2">
        <span className="quiz-step-meta"><MonoTag tone="amber">第 {index + 1} 题</MonoTag><span className="quiz-topic">{question.topic ?? '校园生活'}</span></span>
        <MonoTag tone="cyan">
          {index + 1} / {QUESTIONS.length}
        </MonoTag>
      </div>

      {/* 进度：从一条连续的线改成**一格一题**的读数。
          圆角是"网页控件"的形状，方头分格是"仪表读数"的形状 ——
          而且分格之后，"还剩几题"是可以数出来的，不用去估那条线走了多少。
          走过的=青（已完成），当前=琥珀（你在这里），未走=浅灰。

          ★ 10-14 二次修（**看图才发现**）："未走"原本用 --line-soft（#eef2f6），
            它在浅底上对比只有 1.08 —— 淡到几乎不存在，于是整条进度条
            看起来只走了三分之二就断了，后面的格子数不出来。
            改成 --line（#e5e7eb，1.42）：仍然明显是"空的"，但能一格一格数清。 */}
      <div className="sky-strip flex gap-1 mb-8 px-3 py-2" role="progressbar" aria-label="答题进度" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={index + 1}>
        {QUESTIONS.map((_, i) => (
          <span
            key={i}
            className="h-[3px] flex-1 transition-all duration-300"
            style={{
              background:
                i < index
                  ? 'var(--accent)'
                  : i === index
                    ? 'var(--accent-warm)'
                    : 'rgba(16, 42, 78, 0.22)',
            }}
          />
        ))}
      </div>

      {/* 题号做成徽标 —— 它和题干是同一句话的两个部分，
          但徽标让人能跳过题号直接读题，也方便说"我选了第 3 题" */}

      {/* ★ 10-15：题干区从"深色照片板"改成**浅色玻璃**。
          背景换了动漫天空之后，原来那块压暗的深色面板就变成了"贴在亮画面上的黑砖"
          （见 10-15 第一张截图）—— 它和天空的明度差太大，边缘硬，
          像另一个界面的元素掉进来了。
          这一版的做法与整页统一：**半透明白玻璃 + 一条主色左条**，
          深色文字直接落在上面。天空透过来一点点，容器仍然是容器。 */}
      <div
        className="sky-glass relative overflow-hidden px-5 py-5 mb-7 sm:px-6 sm:py-6"
        style={{
          clipPath:
            'polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))',
        }}
      >
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: 'var(--grad-ark)' }}
        />

        <div className="relative">
          <h1 ref={questionRef} tabIndex={-1} className="ci-title-hero text-[26px] sm:text-[29px] mb-2" style={{ color: 'var(--ink-strong)' }}>
            {question.text}
          </h1>
          <p className="text-sm" style={{ color: 'var(--ink-mid)' }}>
            {question.hint}
          </p>
        </div>
      </div>

      <div className="quiz-options space-y-2.5">
        {question.options.map((opt, i) => (
          <ArkOption
            key={opt.text}
            letter={String.fromCharCode(65 + i)}
            active={flash === opt.text}
            disabled={Boolean(flash)}
            onClick={() => pick(opt.text)}
          >
            {opt.text}
          </ArkOption>
        ))}
      </div>

      {/* ★ 10-15：底部这一行原样保留，但返回键换成大按钮；
          右侧那句提示套一条玻璃条 —— 它原来是裸压在天空上的，
          云一过就读不清（和顶部状态行同一个问题）。 */}
      <div className="quiz-navigation mt-5 flex items-center justify-between gap-3">
        <NavButton
          disabled={Boolean(flash)}
          onClick={() => (index === 0 ? onCancel?.() : setIndex((i) => i - 1))}
          icon="←"
          title={index === 0 ? '退出答题' : '上一题'}
        >
          {index === 0 ? '返回' : '上一题'}
        </NavButton>
        <span className="sky-strip text-xs px-3 py-2" style={{ color: 'var(--ink-mid)' }}>
          没有标准答案 · 可按 A–E 或 1–5
        </span>
      </div>
      <div className="quiz-draft-note" role="status">
        <span>{restored ? '已恢复本标签页的答题进度。' : '进度仅保存在本标签页；完成后自动清除。'}</span>
        <div className="quiz-draft-actions">
        {index > 0 && <button type="button" disabled={Boolean(flash)} onClick={() => {
          saveSurveyDraft(index, answers); onPause?.();
        }}>暂停，回到首页</button>}
        {Object.keys(answers).length > 0 && <button type="button" disabled={Boolean(flash)} onClick={() => {
          clearSurveyDraft(); setAnswers({}); setIndex(0); setRestored(false);
        }}>清空重答</button>}
        </div>
      </div>
    </div>
  );
}
