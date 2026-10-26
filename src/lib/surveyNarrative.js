import {cleanStoryReflection,storyEpisode} from './campusStory.js';
import {QUESTIONS,isKnownOption} from './surveySchema.js';
// The wording connects a fictional episode to actual self-report. Never infer answers from a plot.
const TITLES={Q7:'铃声响起，你怎样入镜？',Q2:'期末预告来了，你先翻哪一页？',Q5:'月底翻开账本，你认得哪种日常？',Q3:'正片结束，宵夜加映几次？',Q4:'课后走廊开了五扇门，你先推哪扇？',Q8:'多出来的一小时，球场把镜头交给你。',Q1:'夜色落下来，你通常在哪儿收尾？',Q9:'今天的计划掉链子了，你怎样按下缓冲键？',Q10:'相册是你的取景器，它最常对准什么？',Q6:'毕业那天，只能带走一幕。你想留住什么？'};
const FEEDBACK={
 Q7:['镜头比铃声早到。第一排的座位留在这一帧。','铃声和脚步声撞了个满怀，这次刚好赶上。','这次的入场，先由室友接住。','这一页按真实情况记下，不替你改成理想答案。','清晨没有教室镜头，你的课程从下午开场。'],
 Q2:['期末还没追上你，复习已经走在前面。','镜头从第一页慢慢推过去，重点自己圈出来。','你的导航是题型，先在往年考卷里找路。','这一段有队友，也有复习间隙的游戏声。','最后一段时间被按了快进键，这也是实际的一种节奏。'],
 Q5:['月初和月底，是同一部生活片里的两种节奏。','这份日常里，奖学金接住了主要的生活开支。','家里定期转来的生活费，是这一页账本的主要来源。','兼职的时间，也变成了你自己安排生活的底气。'],
 Q3:['正餐后的片尾，几乎每天还有一段热气。','一周里有好几晚，宵夜给日常加了一场。','偶尔路过的那一口，不必每天都出现。','最近这一个月，晚饭就是这一集的最后一餐。'],
 Q4:['门后传来试音。也许你的课后会多一段排练声。','这边正在交换观点，欢迎把“我觉得”说出口。','屏幕亮着，队友给你留了一个位置。','有人正把小事一起做完，你想加入这边。','先举起相机。校园可以从你的角度重新出现。'],
 Q8:['镜头跟着耳机和脚步，只需要你的节奏。','这一帧里，球不只落在一个人手上。','隔着一张球网，也能把一小时来回传递。','动作慢慢重复，这段时间有自己的重量。','今天把看台留给自己，观看也是一种在场。'],
 Q1:['宿舍的灯接住了这一天。最后一幕回到熟悉的位置。','这一晚的落点，是还没翻完的那一页。','晚风沿着跑道走，你的夜间镜头留在这里。','食堂窗口还在，你的一天在熟悉的味道旁收尾。','这一晚常去的地点，照实留在记录里。'],
 Q9:['电话拨出去，不用一个人把这一段讲完。','找朋友吃一顿，饭桌给坏心情留了出口。','先让身体动起来，把这次不顺留给跑道。','今晚的队友和游戏，接住了那点不痛快。','按下休息键。第二天的开场，可以明天再写。'],
 Q10:['这一卷相册，能翻出不少校园里的味道。','多数画面里有人，你留住了相处时的表情。','现场、天空和风景，轮流成为你的主角。','相册也成了一本随身的课堂笔记。','路线和装备被留下，运动有了可回看的轨迹。'],
 Q6:['那张桌子留下的不只是位置，还有你坐在那里的时间。','最想带走的是一起住过的人，片尾不必只有自己。','跑过的那一圈，想留到毕业以后。','熟悉的窗口和味道，成了舍不得删掉的一帧。','不选一件具体物品，也能把整段经历带走。'],
};
const CHAPTER_LINKS={
 screening:['电影需要准时开场。镜头转回来：你自己的学习通常怎样开场？','借设备要算资源，过日子也一样。把焦点转到自己的生活。','节目不只一种，你的课后也可以有不同方向。','故事里的雨可以换场地，真实的不顺心又怎么接住？','这一晚收好之后，你会用什么记住自己的校园？'],
 lost:['找钥匙要跟上时间，学习也有自己的节奏。先看真实的你。','失物线索藏在一顿饭里。回到现实，记录账本和饮食。','木牌把你带到球场。现实里，你愿意走进哪种课后现场？','钥匙有了去处，忙完一天的你通常又在哪里停靠？','东西领回了，记忆不会放进失物柜。你真正想留下什么？'],
 repair:['旧机器要找到起点，你自己的学习通常从哪里启动？','修东西有资源限制，真实生活里也有自己的安排。','一张工作台能遇见同伴，你的课后更想加入哪一边？','收音机没有立刻修好。面对自己的不顺，你通常怎么缓过来？','一件旧物带着很多年。你的校园又会留下什么？'],
 radio:['广播有开播时间，真实的课堂也有铃声。先听你的日常。','三分钟要分配，生活也要安排。把话筒转向你的账本与宵夜。','采声音时路过了很多地方。课后，你更愿意在哪里加入？','节目结束，灯还亮着。你自己的夜晚通常怎么收尾？','不是每段声音都会保存。你的相册和记忆把位置留给谁？'],
};
export function surveyFrame(question,context,answers={}){
 const reflection=cleanStoryReflection(context),episode=reflection?storyEpisode(reflection.episodeId):null;
 const optionIndex=question.options.findIndex(option=>option.text===answers[question.field]);
 const preceding=question.chapter.ids[0],before=QUESTIONS.find(q=>q.id===preceding);
 const previous=preceding!==question.id&&before&&isKnownOption(before.field,answers[before.field])?`刚才你选了「${answers[before.field]}」。这一题换一个镜头，${question.focusHint}`:null;
 return {title:TITLES[question.id],scene:episode?CHAPTER_LINKS[episode.id][question.chapterIndex]:['清晨与课桌，先给一天定个开场。','从账本翻到食堂，普通生活也有自己的节奏。','下课以后，校园突然多了几扇门。','一天快结束了，也给自己留一点缓冲。','镜头准备收起来，你决定留下哪一帧。'][question.chapterIndex],feedback:optionIndex<0?null:FEEDBACK[question.id][optionIndex],previous,episode};
}
export function realLifeFrames(answers){return ['Q4','Q8','Q6'].flatMap(id=>{const q=QUESTIONS.find(q=>q.id===id),index=q.options.findIndex(o=>o.text===answers?.[q.field]);return index<0?[]:[{id,label:{Q4:'想加入的现场',Q8:'愿意留下的一小时',Q6:'想带走的记忆'}[id],answer:answers[q.field],line:FEEDBACK[id][index]}];});}
