import { dayView, DAY_VERSION } from './campusDay.js';
import { QUESTIONS, isKnownOption } from './surveySchema.js';

/** Keep a replayable route, not an arbitrary object or an invented completed answer. */
export function cleanDaySurveyContext(value) {
  try {
    const input=value?.progress ?? value;
    const progress={version:input.version,variant:input.variant,history:[...input.history],pending:false};
    if(progress.version!==DAY_VERSION || !progress.history.length) return null;
    dayView(progress);
    return {kind:'campus-day',progress};
  } catch { return null; }
}

const TASK_QUESTIONS={
  opening:['Q7'],detour:['Q2'],lunch:['Q5'],invitation:['Q4'],
  request:['Q9'],movement:['Q8'],evening:['Q3'],goodnight:['Q1','Q9'],keepsake:['Q6','Q10'],
};
// Explicit semantic links. A meal does not reveal frequency or family finances.
const CHOICE_ANSWERS={
  front:{Q7:'提前十分钟到，坐前排'},
  self:{Q2:'死磕课本'},
  rehearsal:{Q4:'乐队'},sunclub:{Q4:'乐队'},rainclub:{Q4:'乐队'},
  camera:{Q4:'摄影社',Q10:'风景和现场：演出、展览、天空'},
  sunlake:{Q4:'摄影社',Q10:'风景和现场：演出、展览、天空'},
  racket:{Q8:'羽毛球乒乓球，约人打'},
  team:{Q8:'球场，组队打一场'},run:{Q8:'跑道上，一个人戴着耳机跑'},watch:{Q8:'看台或树下，看别人动'},
  nap:{Q9:'睡一觉，第二天照常'},
  call:{Q1:'宿舍床上',Q9:'给家里打个电话'},
  'keep-library':{Q6:'图书馆那张常坐的座位'},
  'keep-dorm':{Q6:'宿舍的那群人'},
  'keep-court':{Q6:'操场的那圈跑道'},'keep-field':{Q6:'操场的那圈跑道'},'keep-gym':{Q6:'操场的那圈跑道'},
  'keep-canteen':{Q6:'食堂的那个窗口'},
};
const NOTES={
  Q7:'这次的到课选择可以作为起点，仍请按最近一个学期的真实情况核对。',
  Q2:'游戏的学习安排只是一条线索；复习习惯要由你确认。',
  Q3:'一顿饭不能推出宵夜频率。这题请补充最近一个月的实际情况。',
  Q4:'从刚才想参加的活动，带出你可能更感兴趣的社团；可以改选。',
  Q5:'游戏餐券不是现实收入。这题不能推断，请按自己的实际情况填写。',
  Q6:'把刚才留下的纪念章，和真正舍不得的毕业记忆对照一下。',
  Q8:'刚才的运动选择会带出对应选项；如果只是游戏里想试试，可以改成真实习惯。',
  Q1:'夜间去向只是一晚的选择，不代表平时总在那里。请核对最常见的情况。',
  Q9:'游戏里的休息或联系家人可以提示一种缓冲方式，实际遇到不顺时怎么做仍由你确认。',
  Q10:'游戏照片不是你真实相册的统计，请看看最近一个月哪一类最多。',
};

export function buildDaySurveyBridge(value) {
  const context=cleanDaySurveyContext(value);
  if(!context)return null;
  const view=dayView(context.progress),byQuestion=new Map();
  const add=(id,step,index,answer)=>{
    const q=QUESTIONS.find(item=>item.id===id);
    if(!q)return;
    const previous=byQuestion.get(id);
    const source={step:index+1,task:step.task.id,choice:step.choice.id,time:step.task.time,label:step.choice.label,place:step.choice.place};
    if(answer && !isKnownOption(q.field,answer))throw Error('Game/survey contract drift: '+id);
    byQuestion.set(id,{id,field:q.field,value:answer??previous?.value??null,source:answer?source:previous?.value?previous.source:source,note:NOTES[id]});
  };
  for(const [index,step] of view.steps.entries()){
    for(const id of TASK_QUESTIONS[step.task.id]??[])add(id,step,index);
    for(const [id,answer] of Object.entries(CHOICE_ANSWERS[step.choice.id]??{}))add(id,step,index,answer);
  }
  const links=QUESTIONS.map(q=>byQuestion.get(q.id)).filter(Boolean);
  const suggestions=Object.fromEntries(links.filter(link=>link.value).map(link=>[link.field,link.value]));
  return {context,links,suggestions,decisions:view.steps.length,suggestedCount:Object.keys(suggestions).length};
}

export function daySurveyLink(value, questionId) {
  return buildDaySurveyBridge(value)?.links.find(link=>link.id===questionId)??null;
}
