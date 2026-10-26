/** 答题入口：只保留一个主要下一步，说明随时可跳过。 */
import { useState } from 'react';
import { QUESTIONS } from '../lib/surveySchema.js';
import { readSurveyDraft } from '../lib/surveyDraft.js';
import NavButton from './NavButton.jsx';
import './survey-guidance.css';

export default function QuizGate({ onStart, onBack, backLabel = '校园地图' }) {
  const [showHelp, setShowHelp] = useState(true);
  const [draft] = useState(() => readSurveyDraft());
  const hasDraft = Boolean(draft && Object.keys(draft.answers).length);
  const qn = QUESTIONS.length;

  return <div className="quiz-gate survey-friendly max-w-3xl mx-auto py-6">
    <div className="survey-gate-top"><NavButton onClick={onBack}>回到{backLabel}</NavButton><span>个人校园测评</span></div>
    <section className="survey-gate-panel">
      <p className="survey-question-kicker">不用准备材料 · 大约 2 分钟</p>
      <h1>用 {qn} 个日常选择，<br />拼出自己的校园故事</h1>
      <p className="survey-gate-intro">不是考试，按平时的习惯选就好。每个选择都留下一幕日常；答完看档案，也可以写一句话，做一张自己的校园纪念卡。个人体验不需要注册。</p>
      <div className="survey-gate-help">
        <div className="survey-help-heading"><h2>{showHelp ? '第一次用？照着这三步' : '答题说明'}</h2><button type="button" onClick={() => setShowHelp((visible) => !visible)} aria-controls="survey-gate-help" aria-expanded={showHelp}>{showHelp ? '跳过说明' : '重新查看说明'}</button></div>
        <ol className="survey-simple-steps" id="survey-gate-help" hidden={!showHelp}>
          <li><span>1</span><div><strong>每题选一个答案</strong><p>点最像你的那一项，选中后会有勾号。</p></div></li>
          <li><span>2</span><div><strong>点「下一题」继续</strong><p>可以回上一题修改；暂时没空也能稍后再填。</p></div></li>
          <li><span>3</span><div><strong>看报告，按需保存</strong><p>称号和图表一起生成，还能保存图片或复制文字。</p></div></li>
        </ol>
      </div>
      {hasDraft && <p className="survey-restored-note" role="status">本标签页有未完成的答案，点击下方按钮继续，不需要重填。</p>}
      <div className="survey-gate-actions"><button type="button" className="survey-next" onClick={onStart}>{hasDraft ? `继续第 ${draft.index + 1} 题` : '开始答题'} <span aria-hidden="true">→</span></button><button type="button" className="survey-later" onClick={onBack}>稍后再填</button></div>
      <details className="survey-keyboard-help"><summary>想先了解结果和隐私？</summary><p>个人报告在本机计算，模拟人群只用于展示相对位置，不是考试成绩或心理评估。选择在线 AI 解读时，仅发送报告摘要。圈子填报会在提交前单独说明共享范围，并由你确认。</p></details>
    </section>
    <p className="survey-gate-caution">如果你已经探索过行动地图，完成这份测评会用新答案重建画像，替换之前的地图轨迹。</p>
  </div>;
}
