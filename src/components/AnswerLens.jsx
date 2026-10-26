import { useMemo, useState } from 'react';
import { buildAnswerDistributions, buildAnswerDistributionCsv } from '../lib/answerDistribution.js';
import { downloadText } from '../lib/exportProfile.js';

export default function AnswerLens({ records, sourceLabel = '当前文件' }) {
  const distributions = useMemo(() => buildAnswerDistributions(records), [records]);
  const [index, setIndex] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const question = distributions[index];
  return <div className="answer-lens">
    <div className="answer-lens-toolbar">
      <label htmlFor="answer-lens-question">选择一道题
        <select id="answer-lens-question" value={index} onChange={(e) => setIndex(Number(e.target.value))}>
          {distributions.map((q, i) => <option key={q.id} value={i}>{String(i + 1).padStart(2, '0')} · {q.field}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => {
        downloadText('campus-insight-逐题作答统计.csv', buildAnswerDistributionCsv(distributions));
        setDownloaded(true);
      }}>导出十题统计 CSV ↓</button>
    </div>
    <div key={question.id} className="answer-lens-body" aria-live="polite" aria-atomic="true">
      <div className="answer-lens-heading"><span>{String(index + 1).padStart(2, '0')} / {distributions.length}</span><h3>{question.text}</h3></div>
      <p className="answer-lens-reading">{!question.total ? '这道题暂无有效作答。' : <>
        {question.leaders.length > 1 ? '并列最多' : '最多人选择'}：<strong>{question.leaders.map((o) => `「${o.text}」`).join('、')}</strong>，{question.leaders.length > 1 ? '各 ' : ''}{question.leaders[0].count} 人（{question.leaders[0].pct}%）。
      </>}</p>
      <ul className="answer-lens-bars" aria-label="本题作答分布">
        {question.options.map((o) => <li key={o.text} className={o.count > 0 && question.leaders.includes(o) ? 'is-leading' : ''}>
          <div className="answer-lens-row"><span><i aria-hidden="true">{o.letter}</i>{o.text}</span><span className="answer-lens-value"><b>{o.count}</b> 人 <small>{o.pct}%</small></span></div>
          <div className="answer-lens-track" aria-hidden="true"><span style={{ width: `${o.pct}%` }} /></div>
        </li>)}
      </ul>
      <p className="answer-lens-footnote">分母为本题 {question.total} 份有效作答，人数直接来自{sourceLabel}，与模拟基准无关。四舍五入后，占比之和可能略有偏差。</p>
    </div>
    <div className="answer-lens-navigation" aria-label="切换统计题目"><button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>← 上一题</button><span role="status">{downloaded ? '十道题的汇总统计已生成，不含个人编号。' : '了解实际选择后，再向同学确认活动需求。'}</span><button type="button" disabled={index === distributions.length - 1} onClick={() => setIndex(index + 1)}>下一题 →</button></div>
  </div>;
}
