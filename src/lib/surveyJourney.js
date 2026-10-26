import { QUESTIONS } from './surveySchema.js';
import { QUESTION_PRESENTATION } from './questionPresentation.js';

// Presentation order only: original field names, answers and scoring stay intact.
export const JOURNEY_CHAPTERS = [
  { id:'start', label:'学习开场', scene:'教室 / 自习桌', ids:['Q7','Q2'] },
  { id:'daily', label:'生活选择', scene:'账本 / 食堂', ids:['Q5','Q3'] },
  { id:'after', label:'课后去向', scene:'社团 / 运动场', ids:['Q4','Q8'] },
  { id:'rest', label:'一日收尾', scene:'夜灯 / 休息站', ids:['Q1','Q9'] },
  { id:'keep', label:'留下证据', scene:'相册 / 毕业前', ids:['Q10','Q6'] },
];
const focus = {
  Q7:['到课节奏','有早课时怎么到场；没有早课也有对应选项。'],
  Q2:['复习方式','只看复习怎样展开，和上一题的到课时间分开。'],
  Q5:['生活费安排','描述目前最常见的收支情况，不比较家庭条件。'],
  Q3:['进食频率','只看最近一个月宵夜的次数，不问去哪儿吃。'],
  Q4:['兴趣方向','想体验的社团，不要求已经参加过。'],
  Q8:['运动参与','在运动场更愿意做什么，不比较谁更自律。'],
  Q1:['夜间地点','一天结束时常待的地点，不问熬夜多少次。'],
  Q9:['缓冲方式','不顺心时怎么恢复，不评判哪种方法更坚强。'],
  Q10:['当下记录','翻看最近一个月的相册，按实际多数回答。'],
  Q6:['记忆取舍','和相册里拍了什么不同，这次选最舍不得的部分。'],
};
export const JOURNEY_QUESTIONS = JOURNEY_CHAPTERS.flatMap((chapter,chapterIndex)=>chapter.ids.map(id=>{
  const question=QUESTIONS.find(q=>q.id===id);
  const presentation=QUESTION_PRESENTATION[id];
  return {...question,prompt:presentation.prompt,presentationHint:presentation.hint,options:question.options.map((option,i)=>({...option,contextHint:presentation.options[i]})),chapter,chapterIndex,focus:focus[id][0],focusHint:focus[id][1]};
}));

export function journeyIndex(questionId) { return JOURNEY_QUESTIONS.findIndex(q=>q.id===questionId); }
