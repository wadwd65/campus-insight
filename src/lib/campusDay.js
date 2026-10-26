import {PLACE_INDEX} from '../data/mapPlaces.js';
import {BASE_ATTR_KEYS} from './surveySchema.js';
// Map decisions feed reviewable survey suggestions through daySurveyBridge; only confirmed answers are scored.
export const DAY_VERSION=1,DAY_EVENT='campus:day-progress';
const pick=(id,place,label,line,reply,energy=0,coins=0,gain=[],requires=null)=>({id,place,label,line,reply,energy,coins,gain,requires});
const stage=(id,time,title,text,choices,kind='route')=>({id,time,title,text,choices,kind});
const STAGES=[
 s=>stage('opening','07:50','还有十分钟，今天从哪儿开始？','闹钟响了第二遍。第一节课不点名，桌上还有昨晚没收好的笔记。先选一个去处。',[
  pick('front','late_class','去教室提前到，坐前排','少睡十分钟，换一个从容的开场。','你坐下时，窗边第一束光正好落在笔记上。老师说课后会留一段答疑。',-1,0,['notes']),
  pick('self','library','去图书馆，翻课本补进度','今天把学习节奏握在自己手里。','常坐的位置还空着。你整理了资料，夹进一张待完成清单。',-1,0,['notes']),
  pick('slow','dorm','留在宿舍，先把状态找回来','睡眠不足时，先给自己一点缓冲。','你没有立刻出门。喝完水、收好桌面之后，这一天终于有了启动的感觉。',1),
 ]),
 s=>stage('detour','10:20',s.flags.has('notes')?'清单刚列好，空堂来了。':'消息亮起：要不要一起做点什么？',s.flags.has('notes')?'刚才准备的笔记能派上用场。两小时空堂，想把它变成完成一件事的机会，还是出去走走？':'从宿舍出来，室友发来“人呢”。空堂不长，校园里却刚好有三个去处。',[
  pick('tinker','lab','去实验楼，试试那个小装置','要花一点精力，能带走一枚修理工具。','装置终于转了一下。学长借你一枚小工具：“别小看它，临时救场很有用。”',-1,0,['tool']),
  pick('finish','library',s.flags.has('notes')?'拿笔记换一次高效讨论':'去自习室，和同学拼一张桌','获得：一起行动的同伴。','你们各自讲了一道卡住的题。离开时，对方说：“下午有事可以叫我。”',-1,0,['partner']),
  pick('wander','lake','去湖边，让这一段时间留白','恢复一点精力，发现一个避雨点。','你沿着湖边走了一圈，记住了树后那个有顶的小亭子。',1,0,['shelter']),
 ]),
 s=>stage('lunch','12:10','饭点到了，六枚餐券怎么花？',`口袋里还剩${s.coins}枚模拟餐券。选的不是“你属于哪类人”，而是这一顿真的去哪儿。`,[
  pick('canteen','canteen','食堂窗口，认真吃一顿','花2枚，恢复2点精力。','窗口阿姨多舀了一勺。你坐下来吃完，连上午那点疲倦也松了。',2,-2),
  pick('snack','convenience','便利店热食，边走边聊','花1枚，恢复1点精力。','同学帮你捎了一包纸巾。你们约好，下午路上碰见了就招呼一声。',1,-1,['partner']),
  pick('newtaste','nightmarket','绕到小吃街，试一家新店','花3枚，恢复2点精力，得到一张纸质小票。','新店的老板把小票画成了小地图。你收进口袋，这也是今天独有的东西。',2,-3,['ticket']),
 ],'budget'),
 s=>stage('invitation','14:00',s.flags.has('partner')?'同伴把一张活动单推了过来。':'课后邀请，有三扇门同时打开。',s.flags.has('partner')?'上午一起行动的人问：“下午还一起吗？”你这次的决定，也会影响雨来时谁在身边。':'社团试音、球馆体验、湖边散步都不用提前报名。你想把这一段时间交给哪边？',[
  pick('rehearsal','club','推开社团活动室，试一次合奏','消耗1点精力，结识一位同伴。','你只会敲最简单的节拍，对面却认真给你数了四拍：“来，就从这里接。”',-1,0,['partner','melody']),
  pick('racket','gym','去球馆，接住第一次发球','消耗1点精力，借到一把可带走的伞。','球打到了拍框上，大家笑着重来。离开时，搭档把备用伞借给你。',-1,0,['umbrella']),
  pick('camera','lake','沿湖边走，拍一张下午的光','恢复1点精力，记下湖亭位置。','你没拍到飞走的鸟，却拍到了水面上的一道光，也找到了湖亭。',1,0,['shelter','photo']),
 ]),
 s=>s.variant===0?stage('weather','15:10','第一滴雨，比通知先到了。',`你现在在${placeName(s.place)}。${s.flags.has('umbrella')?'背包里的伞终于有了用处。':s.flags.has('shelter')?'刚才记下的湖亭，还来得及赶过去。':'雨忽然变密，露天的安排得改一改。'}这次去处由之前的准备决定。`,[
  pick('rainclub','club','回活动室，把下半场接起来','有同伴，才能接上原来那间活动室。','朋友从里面推开门：“就知道你还会回来。”窗外雨很大，屋里节拍没有断。',0,0,['melody'],'partner'),
  pick('pavilion','lake',s.flags.has('umbrella')?'撑伞去湖亭，听雨落在顶上':'去记得的湖亭，等这阵雨过去','需要提前知道避雨点，或有伞。','你把鞋边的水甩掉，坐在亭子里。下午的那条岔路，现在正好接住了你。',1,0,[],s.flags.has('umbrella')?'umbrella':'shelter'),
  pick('drynotes','library','进图书馆，把潮掉的纸摊开','不用准备也能进，顺手收好下午的笔记。','你把纸铺在桌上。雨声被窗玻璃隔远了，下一件事也能慢一点想。',1,0,['notes']),
  pick('borrow','convenience','借一把店门口的共享伞','花1枚餐券作本次模拟借用费。','伞撑开了。你沿着有檐的路走，终于不用一边护纸一边跑。',0,-1,['umbrella']),
 ],'weather'):stage('weather','15:10','阳光突然很好，原计划还照走吗？',`你在${placeName(s.place)}门口停了一下。课后难得没有下一节课追着你走。`,[
  pick('sunclub','club','和同伴回去，再练一遍开头','需要上午或下午结识的同伴。','这次节拍接得比第一次齐。没有观众，大家还是认真把整段走完。',-1,0,['melody'],'partner'),
  pick('sunlake','lake','绕到湖边，把光留在相册里','恢复1点精力，得到一张现场照片。','光落在水面上，比昨天不一样。你终于有一张只属于今天的照片。',1,0,['photo','shelter']),
  pick('sunlibrary','library','去图书馆，把清单收个尾','消耗1点精力，获得整理好的笔记。','你划掉清单上的最后一个小格。书包轻没轻不知道，心里倒是轻了一点。',-1,0,['notes']),
 ],'weather'),
 s=>stage('request','16:00',s.flags.has('tool')?'群里求助，这回你手里真有工具。':'同学的展示坏在了开场前。',s.flags.has('tool')?'“模型的接头松了，谁带了小工具？”上午从实验楼带出的那一枚，终于不只是背包里的装饰。':'同学的展示板开胶了，打印稿也出了错。你可以帮他动手处理，也可以先把内容理顺。',[
  pick('repair','lab','拿出小工具，一起修好接头','需要：上午借来的工具。','接头重新卡上了。对方松了一口气，把你的名字写进了致谢角落。',-1,0,['helped'],'tool'),
  pick('print','printshop','去打印店，补一份能用的稿','花1枚餐券；把错误页换掉。','新的一页从机器里吐出来。你们确认了标题、页码，终于可以把注意力放回展示。',0,-1,['helped']),
  pick('outline','library','坐下来，帮他把开头讲顺','不花餐券；花一点耐心。','你先当了一次听众。那句一直说不顺的开场，第三遍终于自然了。',-1,0,['helped','notes']),
  pick('breather','lake','说明自己需要休息，帮忙转达求助','恢复1点精力；不勉强接下做不到的事。','你把求助发给能帮忙的人，自己先休息了一会儿。稍后，对方发来“已经解决”。',1),
 ],'message'),
 s=>stage('movement','18:00',s.energy<=1?'电量见底，这一小时先留给自己。':'傍晚空出一小时，身体想去哪儿？',s.energy<=1?'上午到现在已经走了不少地方。有的活动现在做不了，休息后才可能重新接上。':'球声从路那头传来，宿舍离这里也不远。不是比较谁更自律，只看此刻还想怎样过这一小时。',[
  pick('team','field','叫上认识的人，踢半场球','消耗2点精力，需要一位同伴。','有人喊你站到左边，球滚过来时，你真的接住了一次配合。',-2,0,[],'partner'),
  pick('run','court','戴上耳机，沿跑道跑一圈','消耗1点精力，留一段自己的节奏。','第一圈有点慢。第二次经过看台，耳机里的那段副歌刚好响起来。',-1),
  pick('nap','dorm','回宿舍，充一小格电','恢复2点精力。','你把窗帘拉开一半，定了一个不赶人的闹钟。醒来时，晚饭还来得及。',2),
  pick('watch','court','坐在看台，看看别人怎么打','恢复1点精力，也算到场。','一颗球滚到脚边，你把它抛回去。没有下场，也有人对你说了声谢。',1),
 ],'energy'),
 s=>stage('evening','19:20',s.flags.has('partner')?'“晚饭还一起吗？”':'晚饭后，校园的灯一盏盏亮了。',`还剩${s.coins}枚模拟餐券。吃点什么、和谁待一会儿，或者只走一段路，都能继续这一晚。`,[
  pick('market','nightmarket','去小吃街，拼一张晚饭桌','花2枚，恢复1点精力。','塑料凳子多挪出来一张。有人讲起今天最离谱的事，笑声比招牌先亮了。',1,-2,['partner']),
  pick('window','canteen','回熟悉的窗口，吃点热的','花1枚，恢复1点精力。','窗口还开着。你接过热饭，感觉这个普通晚上也有个稳定的落点。',1,-1),
  pick('walk','lake','先不消费，沿湖聊一会儿','不花餐券，恢复1点精力。','你们走得很慢，没聊出什么大事，却都没有急着看时间。',1),
 ],'budget'),
 s=>stage('goodnight','21:00',s.flags.has('partner')?'朋友说：明天见，今天谢谢你。':'一天快收尾，最后一段路怎么走？',s.flags.has('helped')?'下午帮过的同学发来展示顺利的消息。你把手机放回口袋，还想给今天留一点怎样的结尾？':'没有必须打卡的地方了。这次把最后一段路留给自己决定。',[
  pick('seeoff','station','送朋友到校门口，再慢慢回来','消耗1点精力；把告别走完整一点。','末班车还没来。你们站在站牌下把话聊完，才朝两个方向挥了挥手。',-1,0,['partner']),
  pick('air','lake','坐到湖边，把今天慢慢放下','恢复1点精力。','水边只剩很轻的风。你没有立刻总结今天，先让它安静了一会儿。',1),
  pick('call','dorm','回宿舍，给家里拨个电话','恢复1点精力。','对方问“今天怎么样”。这次你发现，真的有几个片段可以讲。',1),
 ]),
 s=>{const seen=[...new Set(s.visits.map(visit=>visit.place))];const picks=[s.visits[0]?.place,(s.flags.has('photo')?'lake':s.flags.has('ticket')?'nightmarket':s.visits.find(visit=>visit.place==='club'||visit.place==='field')?.place)||seen[Math.floor(seen.length/2)],s.place];const places=[...new Set(picks)].filter(Boolean);for(const id of seen)if(places.length<3&&!places.includes(id))places.push(id);return stage('keepsake','22:15','这一天只能盖一枚纪念章，你选哪一站？','地图已经被你的选择连了起来。这次不再赶往下一处：选一个真正去过的地方，把它留作今天的封面。',places.map(id=>pick('keep-'+id,id,'留下'+placeName(id),'回看这一站，作为本次路线的纪念。','你在地图的'+placeName(id)+'上盖了一枚小章。它不代表你是什么人，只代表这一天，你在这里停过。')),'memory');},
];
export function placeName(id){return PLACE_INDEX.get(id)?.name||'校园';}
export function newDay(variant=0){return {version:DAY_VERSION,variant:variant===1?1:0,history:[],pending:false};}
function initial(variant){return {variant,energy:3,coins:6,flags:new Set(),place:'dorm',visits:[],steps:[],attributes:Object.fromEntries(BASE_ATTR_KEYS.map(key=>[key,0]))};}
function optionsAt(state,index){const item=STAGES[index]?.(state);if(!item)return null;return {...item,choices:item.choices.map(choice=>({...choice,available:state.energy+choice.energy>=0&&state.coins+choice.coins>=0&&(!choice.requires||state.flags.has(choice.requires)),locked:choice.requires&&!state.flags.has(choice.requires)?'这次还没准备好：需要'+({partner:'一位同伴',shelter:'之前找到的避雨点',umbrella:'一把伞',tool:'上午借来的小工具'}[choice.requires]||'对应准备'):state.energy+choice.energy<0?'精力不足，可以先选休息或轻松的去处。':'餐券不足，选一个不花餐券的方案也能继续。'}))};}
export function dayView(progress){
 if(progress?.version!==DAY_VERSION||![0,1].includes(progress.variant)||!Array.isArray(progress.history)||progress.history.length>10)throw Error('Invalid campus day');
 const state=initial(progress.variant);
 for(const id of progress.history){const task=optionsAt(state,state.steps.length),choice=task?.choices.find(choice=>choice.id===id&&choice.available);if(!choice)throw Error('Invalid day route');
  state.energy=Math.min(5,state.energy+choice.energy);state.coins+=choice.coins;choice.gain.forEach(flag=>state.flags.add(flag));
  if(task.kind!=='memory'){state.place=choice.place;state.visits.push({id:choice.place,place:choice.place,name:placeName(choice.place)});const vec=PLACE_INDEX.get(choice.place).vec;for(const key of BASE_ATTR_KEYS)state.attributes[key]+=vec[key]||0;}
  state.steps.push({task,choice});
 }
 const complete=state.steps.length===10,pending=!!progress.pending&&state.steps.length>0&&!complete;
 return {...state,complete,pending,task:complete?null:optionsAt(state,state.steps.length),last:state.steps.at(-1)||null,keepsake:complete?state.steps.at(-1).choice.place:null,journey:{visits:state.visits}};
}
export function chooseDay(progress,id){const view=dayView(progress);if(view.pending||view.complete)throw Error('Continue before choosing');if(!view.task.choices.some(c=>c.id===id&&c.available))throw Error('Unavailable action');const next={...progress,history:[...progress.history,id],pending:progress.history.length<9};dayView(next);return next;}
export function continueDay(progress){dayView(progress);return {...progress,pending:false};}
export function rewindDay(progress,index){dayView(progress);if(!Number.isInteger(index)||index<0||index>=progress.history.length)throw Error('Invalid rewind');return {...progress,history:progress.history.slice(0,index),pending:false};}
export function dayKey(scope='guest'){return 'campus:day:v1:'+encodeURIComponent(typeof scope==='string'&&scope.length<=120?scope:'guest');}
export function readDay(storage,scope='guest'){try{const raw=storage?.getItem(dayKey(scope));if(!raw)return {progress:newDay(),available:!!storage,recovered:false};try{const data=JSON.parse(raw),progress={version:data.version,variant:data.variant,history:data.history,pending:!!data.pending};const view=dayView(progress);progress.pending=view.pending;return {progress,available:true,recovered:false};}catch{return {progress:newDay(),available:true,recovered:true};}}catch{return {progress:newDay(),available:false,recovered:false};}}
export function saveDay(storage,scope,progress){try{dayView(progress);storage.setItem(dayKey(scope),JSON.stringify({version:DAY_VERSION,variant:progress.variant,history:progress.history,pending:progress.pending}));return true;}catch{return false;}}
export function dayTrail(progress){return dayView(progress).steps.filter(step=>step.task.kind!=='memory').map((step,index)=>({id:'day:'+step.task.id+':'+step.choice.id,label:step.task.time+' · '+placeName(step.choice.place)+' / '+step.choice.label,delta:{...PLACE_INDEX.get(step.choice.place).vec},at:index+1}));}
export function dayCaption(progress){const view=dayView(progress),places=new Set(view.visits.map(v=>v.place));return view.flags.has('helped')&&view.flags.has('partner')?'有人接住的这一天':places.has('lab')&&places.has('library')?'把想法做出来的一天':view.flags.has('melody')?'有一段合奏的这一天':places.size>=7?'绕了很多路，也没有白走':'照自己的步子过完一天';}
export function dayText(progress){const view=dayView(progress);return ['校园行迹 · 我的地图一天',dayCaption(progress),'模拟行程，不是真实问卷或心理测评。',...view.steps.map((step,index)=>`${index+1}. ${step.task.time} / ${placeName(step.choice.place)}\n${step.choice.label}\n${step.choice.reply}`),view.keepsake?'纪念章：'+placeName(view.keepsake):'尚未收尾'].join('\n\n');}
