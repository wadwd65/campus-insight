import { useMemo, useState } from 'react';
import { QUESTIONS } from '../lib/surveySchema.js';
import { previewAnswers } from '../lib/previewProfiles.js';
import { buildReport } from '../lib/results.js';
import { chooseDay, dayView, newDay } from '../lib/campusDay.js';
import { buildDaySurveyBridge } from '../lib/daySurveyBridge.js';
import CampusMapArt from './CampusMapArt.jsx';
import { CAMPUS_POSITIONS } from '../lib/campusJourney.js';

const NIGHT_QUESTION = QUESTIONS.find(question => question.id === 'Q1');
const SAMPLE_ANSWERS = previewAnswers('study');
const DAY_OPENING = dayView(newDay());

export function HomeSectionNav() {
  function openSection(id) {
    const section = document.getElementById(id);
    section?.focus({ preventScroll: true });
    section?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }

  return <nav className="home-section-nav" aria-label="了解作品与寻找功能">
    <span>继续了解</span>
    <button type="button" onClick={() => openSection('home-report')}><small>01</small> 个人档案 <span aria-hidden="true">↓</span></button>
    <button type="button" onClick={() => openSection('home-campus')}><small>02</small> 地图里的选择 <span aria-hidden="true">↓</span></button>
    <button type="button" onClick={() => openSection('home-circles')}><small>03</small> 班级与社团 <span aria-hidden="true">↓</span></button>
  </nav>;
}

export default function HomeShowcase({ baseline, onGoQuiz, onStartDay }) {
  const [night, setNight] = useState(SAMPLE_ANSWERS[NIGHT_QUESTION.field]);
  const report = useMemo(() => baseline ? buildReport({ ...SAMPLE_ANSWERS, [NIGHT_QUESTION.field]: night }, baseline) : null, [baseline, night]);
  const [opening, setOpening] = useState(DAY_OPENING.task.choices[0].id);
  const progress = useMemo(() => chooseDay(newDay(), opening), [opening]);
  const day = useMemo(() => dayView(progress), [progress]);
  const bridge = useMemo(() => buildDaySurveyBridge(progress), [progress]);
  const suggestion = bridge.links[0];

  return <>
    <section className="home-feature home-report" id="home-report" tabIndex={-1} aria-labelledby="home-report-title">
      <div className="home-feature-copy">
        <p className="home-section-kicker"><span>01 / 个人档案</span> 把日常看得更清楚</p>
        <h2 id="home-report-title">你选的每一项，<br />都在留下自己的形状。</h2>
        <p className="home-feature-lead">常去的地方、恢复心情的办法、最舍不得的回忆。十个回答放在一起，看看这些日常怎样互相呼应。</p>
        <ul className="home-result-list">
          <li><b>看见生活的侧面</b><span>五维雷达与个人解读，回看自己的校园节奏。</span></li>
          <li><b>追得回每个回答</b><span>报告中可查看回答依据，修改后重新计算。</span></li>
          <li><b>留下一份记录</b><span>导出档案卡或答卷，分享前由你确认。</span></li>
        </ul>
        <button type="button" className="home-text-action" onClick={onGoQuiz}>用自己的回答，写一份档案 <span aria-hidden="true">↗</span></button>
      </div>
      <div className="home-answer-lab" role="group" aria-label="修改一个示例回答，查看报告变化">
        <div className="home-lab-top"><span>试改一个回答</span><small>交互示例</small></div>
        <label htmlFor="home-night-answer">{NIGHT_QUESTION.text}</label>
        <select id="home-night-answer" value={night} onChange={event => setNight(event.target.value)}>
          {NIGHT_QUESTION.options.map(option => <option key={option.text} value={option.text}>{option.text}</option>)}
        </select>
        <p className="home-lab-context">固定另外九个示例回答，只改变这一题。</p>
        <div className="home-lab-result" aria-live="polite" aria-atomic="true" aria-busy={!report}>
          <small>日常重心 · 趣味推演</small>
          <h3>{report?.facts.title ?? '正在准备示例…'}</h3>
          <div className="home-time-bars">{report?.timeSplit.map((item, index) => <div key={item.name} className="home-time-row">
            <span>{item.name}</span><div className={`home-time-track home-time-track-${index}`}><i style={{ width: `${item.value}%` }} /></div><b>{item.value.toFixed(1)}<small>%</small></b>
          </div>)}</div>
        </div>
        <p className="home-demo-note">占比由答卷规则估算，合计100%，非真实时间记录。本区示例独立预览，你的答卷由问卷填写。</p>
      </div>
    </section>

    <section className="home-feature home-campus" id="home-campus" tabIndex={-1} aria-labelledby="home-campus-title">
      <div className="home-campus-visual">
        <div className="home-map-caption"><span>07:50 / 今天的第一站</span><small>地图联动示例</small></div>
        <div className="home-map-stage">
          <CampusMapArt journey={day.journey} />
          <span className="home-map-pin" style={{ left: `${CAMPUS_POSITIONS[day.place][0]}%`, top: `${CAMPUS_POSITIONS[day.place][1]}%` }} aria-label={`当前示例去处，${day.visits[0].name}`}>你在这里</span>
        </div>
        <p className="home-map-reply" aria-live="polite">{day.last.choice.reply}</p>
      </div>
      <div className="home-feature-copy">
        <p className="home-section-kicker"><span>02 / 校园情境</span> 让选择有一个发生的地方</p>
        <h2 id="home-campus-title">先走进校园，<br />再回头认识自己。</h2>
        <p className="home-feature-lead">空堂、饭点、忽然落下的雨。你的去向会改变路线、精力和后续机会，也会为问卷留下一条待核对的线索。</p>
        <fieldset className="home-route-choices"><legend>还有十分钟，你想先去哪儿？</legend>
          {DAY_OPENING.task.choices.map(choice => <button key={choice.id} type="button" aria-pressed={opening === choice.id} onClick={() => setOpening(choice.id)}>{choice.label}<span aria-hidden="true">{opening === choice.id ? '✓' : '→'}</span></button>)}
        </fieldset>
        <div className="home-bridge-preview" aria-live="polite" aria-atomic="true">
          <small>这一步，怎样连到问卷</small>
          <p>{suggestion.value ? <>带出「{suggestion.field}」的建议<br /><b>{suggestion.value}</b></> : <>「{suggestion.field}」仍由你自己填写<br /><b>这次行动没有对应的答案建议</b></>}</p>
          <span>进入正式问卷后逐题核对，确认的回答才计入个人档案。</span>
        </div>
        <button type="button" className="home-text-action" onClick={onStartDay}>开始我的地图一天 <span aria-hidden="true">↗</span></button>
        <p className="home-demo-note">这里试玩第一步。完整行程会保存进度，可在问卷中继续核对。</p>
      </div>
    </section>
  </>;
}
