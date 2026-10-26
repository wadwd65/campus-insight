/** 一屏一题：先选择，再确认下一步；草稿只在当前标签页暂存。 */
import { useEffect, useRef, useState } from 'react';
import { QUESTIONS } from '../lib/surveySchema.js';
import { MonoTag } from './TermHead.jsx';
import ArkOption from './ArkOption.jsx';
import NavButton from './NavButton.jsx';
import { MOMENTS } from '../lib/campusMoments.js';
import './participation.css';
import { readSurveyDraft, saveSurveyDraft, clearSurveyDraft } from '../lib/surveyDraft.js';
import './survey-guidance.css';

export default function SurveyForm({ onComplete, onCancel, onPause = onCancel, draftScope = '', contextLabel = '' }) {
  const [draft] = useState(() => readSurveyDraft(undefined, draftScope));
  const [index, setIndex] = useState(draft?.index ?? 0);
  const [answers, setAnswers] = useState(draft?.answers ?? {});
  const [restored, setRestored] = useState(Boolean(draft && Object.keys(draft.answers).length));
  const [showHelp, setShowHelp] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const questionRef = useRef(null);
  const completedRef = useRef(false);
  const question = QUESTIONS[index];
  const selected = answers[question.field];
  const moment = MOMENTS[question.id];
  const isLast = index === QUESTIONS.length - 1;
  const answeredCount = QUESTIONS.filter((item) => answers[item.field]).length;

  useEffect(() => { saveSurveyDraft(index, answers, undefined, draftScope); }, [index, answers, draftScope]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    questionRef.current?.focus({ preventScroll: true });
  }, [index]);

  function pick(text) {
    if (completedRef.current) return;
    setAnswers((previous) => ({ ...previous, [question.field]: text }));
    setRestored(false);
    setConfirmReset(false);
  }

  function next() {
    if (!selected || completedRef.current) return;
    if (!isLast) { setIndex((previous) => previous + 1); return; }
    // Report creation must never imply server submission or invent skipped answers.
    if (QUESTIONS.some((item) => !answers[item.field])) return;
    completedRef.current = true;
    if (draftScope) saveSurveyDraft(index, answers, undefined, draftScope);
    else clearSurveyDraft();
    onComplete(answers);
  }

  function pause() {
    saveSurveyDraft(index, answers, undefined, draftScope);
    onPause?.();
  }

  return (
    <div className="quiz-page survey-friendly relative max-w-3xl mx-auto" style={{'--moment-color':moment?.color}} onKeyDown={(event) => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
      const key = event.key.toUpperCase();
      const optionIndex = /^[A-E]$/.test(key) ? key.charCodeAt(0) - 65 : /^[1-5]$/.test(key) ? Number(key) - 1 : -1;
      if (question.options[optionIndex]) { event.preventDefault(); pick(question.options[optionIndex].text); }
      // Enter on a button keeps its native action; only the focused question gets a shortcut.
      if (event.key === 'Enter' && event.target === questionRef.current && selected) { event.preventDefault(); next(); }
    }}>
      {contextLabel && <p className="survey-context" role="note">{contextLabel}</p>}
      <div className="survey-progress-heading">
        <span className="quiz-step-meta"><MonoTag tone="amber">第 {index + 1} 题</MonoTag><span className="quiz-topic">{question.topic ?? '校园生活'}</span></span>
        <span className="survey-progress-count">{index + 1} / {QUESTIONS.length}</span>
      </div>
      <div className="survey-progress-track" role="progressbar" aria-label="已选择答案的题数" aria-valuemin={0} aria-valuemax={QUESTIONS.length} aria-valuenow={answeredCount} aria-valuetext={`已选择 ${answeredCount} 题，共 ${QUESTIONS.length} 题`}>
        {QUESTIONS.map((item, i) => <span key={item.field} className={`${answers[item.field] ? 'is-done' : ''} ${i === index ? 'is-current' : ''}`} />)}
      </div>
      <div className={`survey-instructions ${showHelp ? '' : 'is-collapsed'}`}>
        <p id="survey-instructions" hidden={!showHelp}><strong>点一个最符合你的选项，再点「{isLast ? '查看我的报告' : '下一题'}」。</strong><span>选错了可以重新选，也能回上一题。没有标准答案。</span></p>
        <button type="button" onClick={() => setShowHelp((visible) => !visible)} aria-controls="survey-instructions" aria-expanded={showHelp}>{showHelp ? '收起提示' : '查看答题方法'}</button>
      </div>
      <div className="survey-question">
        <p className="survey-question-kicker">{isLast ? '最后一幕 · 你的校园片段就要拼好了' : `第 ${index + 1} 幕 · ${moment?.title ?? '校园生活'}`}</p>
        <h1 ref={questionRef} tabIndex={-1} className="ci-title-hero">{question.text}</h1>
        <p>{question.hint}</p>
      </div>
      <div className="quiz-options space-y-2.5" aria-label={`第 ${index + 1} 题的选项，选择一项`}>
        {question.options.map((opt, i) => <ArkOption key={opt.text} letter={String.fromCharCode(65 + i)} active={selected === opt.text} onClick={() => pick(opt.text)}>{opt.text}</ArkOption>)}
      </div>
      <div className={`survey-selection-status survey-moment-feedback ${selected ? 'has-choice' : ''}`} role="status" aria-live="polite"><span className="moment-stamp" aria-hidden="true">{selected ? '✓' : moment?.mark}</span><div><strong>{selected ? (moment?.line ?? '这一幕，按你的方式发生。') : '这一幕，等你来选。'}</strong><p>{selected ? `已选「${selected}」` : '请先选择一个选项，下方按钮就可以继续。'}</p></div></div>
      <div className="quiz-navigation survey-navigation">
        <NavButton onClick={() => { setConfirmReset(false); if (index === 0) onCancel?.(); else setIndex((previous) => previous - 1); }} icon="←" title={index === 0 ? '返回，保留本标签页进度' : '上一题'}>{index === 0 ? '返回' : '上一题'}</NavButton>
        <button type="button" className="survey-next" disabled={!selected} onClick={next}>{isLast ? '查看我的报告' : '下一题'} <span aria-hidden="true">→</span></button>
      </div>
      <div className="quiz-draft-note survey-draft-note">
        <p>{restored ? '已恢复本标签页的进度，可接着填写。' : '进度自动暂存在当前标签页，关闭标签页可能丢失。'}<span>{draftScope ? '答完后还需确认提交给管理员。' : '答完只生成个人报告。'}</span></p>
        <div className="quiz-draft-actions">
          <button type="button" onClick={pause}>稍后填写，{draftScope ? '回到圈子' : '回到首页'}</button>
          {answeredCount > 0 && !confirmReset && <button type="button" onClick={() => setConfirmReset(true)}>清空重答</button>}
        </div>
      </div>
      {confirmReset && <div className="survey-reset-confirm" role="group" aria-label="确认清空答案">
        <p>要清空已选的 {answeredCount} 题，从第一题重新开始吗？</p>
        <button type="button" onClick={() => { clearSurveyDraft(undefined, draftScope); setAnswers({}); setIndex(0); setRestored(false); setConfirmReset(false); questionRef.current?.focus(); }}>确认清空</button>
        <button type="button" onClick={() => setConfirmReset(false)}>保留答案</button>
      </div>}
      <details className="survey-keyboard-help"><summary>键盘操作（可选）</summary><p>按 A–E 或 1–5 选择选项。按 Tab 移到「下一题」，再按回车继续；题目获得焦点且已有答案时，也可按回车继续。</p></details>
    </div>
  );
}
