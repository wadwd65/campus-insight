import {buildDaySurveyBridge} from '../lib/daySurveyBridge.js';
import {QUESTIONS} from '../lib/surveySchema.js';

export default function DaySurveyConnection({context,answers}) {
  const bridge=buildDaySurveyBridge(context);
  if(!bridge || !answers)return null;
  const confirmed=bridge.links.filter(link=>link.value&&answers[link.field]===link.value).length;
  return <section className="day-survey-connection" aria-label="游戏选择与最终问卷的对应记录">
    <span className="survey-question-kicker">同一条链路 / GAME → QUESTIONNAIRE → REPORT</span>
    <h2>地图里的选择，怎样走进这份问卷？</h2>
    <p>{bridge.decisions} 个游戏选择带出了 {bridge.suggestedCount} 题建议，其中 {confirmed} 题由你核对后沿用。其余题目由你补充或改答；下面的个人分析统一按最终确认的十题计算。</p>
    <details><summary>查看游戏行动 → 最终回答的对应记录</summary><ol>{QUESTIONS.map(question=>{
      const link=bridge.links.find(item=>item.id===question.id);
      return <li key={question.id}><small>{question.field}{link?` · 第${link.source.step}个游戏选择`:''}</small>{link&&<span>游戏中：{link.source.label}</span>}<strong>最终回答：{answers[question.field]}</strong><em>{!link?.value?'你亲自补充，游戏未推断':answers[question.field]===link.value?'你已核对并沿用游戏建议':'你已把游戏建议改为自己的回答'}</em></li>;
    })}</ol></details>
    <small>游戏建议经过你的核对才成为问卷答案，不再额外叠加地点分数；圈子只接收你明确确认的十题答案。</small>
  </section>;
}
