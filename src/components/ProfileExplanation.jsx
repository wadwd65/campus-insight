import { useMemo, useState } from 'react';
import { ALL_ATTR_KEYS, QUESTIONS, labelOf, vectorOf } from '../lib/surveySchema.js';
import { explainProfile, previewAnswer } from '../lib/profileExplanation.js';
import { buildReportFromAttributes } from '../lib/results.js';
import { fallbackText } from '../lib/fallback.js';
import { RadarGlyph } from './ProfilePreview.jsx';
import '../profile-explanation.css';

const signed = (number) => `${number > 0 ? '+' : ''}${number}`;

function Evidence({ source }) {
  return <li>
    <div><span className="profile-evidence-source">{source.kind === 'map' ? '地图行动 · 实际入账' : source.field}</span><p>{source.kind === 'answer' ? `你选择了「${source.label}」` : source.label}</p></div>
    <span className={`profile-points ${source.points > 0 ? 'is-positive' : 'is-negative'}`}>{signed(source.points)}<small>矩阵分</small></span>
  </li>;
}

export default function ProfileExplanation({ report, baseline, trail, onApplyAnswers }) {
  const explanations = useMemo(() => explainProfile({ answers: report.answers, attributes: report.attributes, baseline, trail }), [report, baseline, trail]);
  const [dimension, setDimension] = useState(() => [...report.radar].sort((a, b) => b.value - a.value)[0]?.key ?? 'academic');
  const questions = QUESTIONS.filter((question) => vectorOf(question.field, report.answers?.[question.field]));
  const [field, setField] = useState(() => questions[0]?.field ?? '');
  const [choice, setChoice] = useState(() => report.answers?.[questions[0]?.field] ?? '');
  const reading = explanations.find((item) => item.key === dimension);
  const question = questions.find((item) => item.field === field);
  const preview = useMemo(() => previewAnswer({ answers: report.answers, attributes: report.attributes, baseline, field, value: choice }), [report, baseline, field, choice]);
  const changed = choice !== report.answers?.[field];
  const candidate = useMemo(() => changed && preview ? buildReportFromAttributes(preview.attributes, baseline, { answers: { ...report.answers, [field]: choice } }) : null, [changed, preview, baseline, report.answers, field, choice]);

  return <div className="profile-explanation" aria-label="画像结果解释">
    <div className="profile-explanation-heading"><div><p className="profile-reading-kicker">FOLLOW THE CHOICES</p><h3>这些选择，怎样写进画像？</h3></div><label htmlFor="profile-explain-dimension">查看维度<select id="profile-explain-dimension" value={dimension} onChange={(event) => setDimension(event.target.value)}>{ALL_ATTR_KEYS.map((key) => <option key={key} value={key}>{labelOf(key)}</option>)}</select></label></div>
    <div className="profile-explanation-body" key={dimension}>
      <div className="profile-calculation"><div><span>{labelOf(dimension)} · 矩阵原始分</span><b>{reading.raw}</b><p>推高 {signed(reading.positive)} / 拉低 {signed(reading.negative)}{reading.unexplained !== 0 && <><br />另有 {signed(reading.unexplained)} 分缺少可追溯记录</>}</p></div><span className="profile-calculation-arrow" aria-hidden="true">→</span><div><span>与模拟基准比较</span><b>{reading.percentile}<small>百分位</small></b><p>原始分先相加，再换算相对位置。</p></div></div>
      {reading.formula && <p className="profile-formula">本项由基础属性组合：{Object.entries(reading.formula).map(([key, coefficient], index) => `${index ? (coefficient < 0 ? ' − ' : ' + ') : (coefficient < 0 ? '−' : '')}${Math.abs(coefficient) !== 1 ? `${Math.abs(coefficient)} × ` : ''}${labelOf(key)}`).join('')}。下方增量已按相同公式换算。</p>}
      {reading.influences.length > 0 ? <><ul className="profile-evidence-list">{reading.influences.slice(0, 3).map((source) => <Evidence key={source.id} source={source} />)}</ul>{reading.influences.length > 3 && <details className="profile-evidence-more"><summary>查看其余 {reading.influences.length - 3} 条影响</summary><ul className="profile-evidence-list">{reading.influences.slice(3).map((source) => <Evidence key={source.id} source={source} />)}</ul></details>}</> : <p className="profile-explanation-empty">这一维没有找到非零的选择增量。零分仍会与模拟基准比较，因此百分位不一定为零。</p>}
      <p className="profile-explanation-note">这里解释的是选项在固定规则中的作用。矩阵分可相加，百分位不可相加；正负表示数值方向，不表示选择的好坏。地图使用实际入账增量，含重复访问的衰减。</p>
    </div>
    {question && <div className="profile-whatif"><h4>换个回答，会怎样？</h4><p>先看改答后的完整计算预览；确认应用，才更新上方报告。</p><div className="profile-whatif-controls"><label htmlFor="profile-preview-question">题目<select id="profile-preview-question" value={field} onChange={(event) => { setField(event.target.value); setChoice(report.answers[event.target.value]); }}>{questions.map((item) => <option key={item.id} value={item.field}>{item.field}</option>)}</select></label><label htmlFor="profile-preview-answer">临时答案<select id="profile-preview-answer" value={choice} onChange={(event) => setChoice(event.target.value)}>{question.options.map((option) => <option key={option.text} value={option.text}>{option.text}</option>)}</select></label></div><p className="profile-preview-result" role="status">{changed && preview ? <>{labelOf(dimension)}：<b>{reading.percentile} → {preview.percents[dimension]}</b> 百分位{reading.percentile === preview.percents[dimension] ? '（这一个维度未变，不等于整份报告未变）' : ''}。预览已同时重算全部维度、时间倾向和规则解读。</> : <>选一个不同的答案开始预览；也可以切换上方维度查看。</>}</p>
      {candidate && <section className="profile-report-preview" aria-label="改答后的完整报告预览">
        <p className="profile-reading-kicker">临时预览 · 尚未修改原报告</p><h5>{candidate.facts.title}</h5>
        <div className="profile-preview-grid"><RadarGlyph data={candidate.radar} labelPrefix="改答预览雷达图"/><div><p>时间分配倾向 · 合计 100%</p><ul>{candidate.timeSplit.map(item => <li key={item.name}><span>{item.name}</span><b>{item.value}%</b><meter min="0" max="100" value={item.value} aria-label={`${item.name}规则估算占比`} /></li>)}</ul></div></div>
        <p className="profile-preview-mood">四年曲线（规则叙事）：{candidate.moodCurve.map(item => `${item.stage} ${item.value}`).join(' → ')}</p>
        <p className="profile-preview-reading">{fallbackText(candidate)}</p>
        {onApplyAnswers ? <><button type="button" className="profile-apply-answer" onClick={() => onApplyAnswers(candidate.answers)}>应用这个回答，更新整份报告 →</button><p>会更新个人档案、全部图表和可导出的文字。已交到圈子的答卷不会自动修改；需要重新确认提交。</p></> : <p>这份报告包含地图行动，这里仅做计算预览；要修改真实问卷，请返回问卷填写。</p>}
      </section>}
      <small>百分位表示模拟基准中的相对位置，各维度不相加；时间图才是合计 100% 的规则估算。这里不是改变习惯后的效果预测。</small></div>}
  </div>;
}
