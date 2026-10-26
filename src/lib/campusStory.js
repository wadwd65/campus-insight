import {EXTRA_EPISODES} from './storyEpisodes.js';
/** Fictional branching story. Its progress never enters survey answers or report scores. */
export const STORY_VERSION=1;
export const STORY_EVENT='campus:story-progress';
export const STORY_TITLE='晚风放映计划';
export const STORY_ENDINGS=[
  {id:'whitewall',title:'白墙首映',mark:'映',line:'换了场地，没换掉这一晚。'},
  {id:'corridor',title:'雨棚下的加映',mark:'雨',line:'雨声成了这场电影的第二条音轨。'},
  {id:'live',title:'没有电影的首映',mark:'声',line:'设备没亮，大家先开了口。'},
  {id:'ticket',title:'一张留到下次的票',mark:'约',line:'今晚没放成的，已经有人开始期待。'},
];
const option=(id,label,hint,reply,next,flags=[])=>({id,label,hint,reply,next,flags});
const NODES={
  start:{place:'操场边',time:'周五 · 17:40',chapter:'一条求救消息',speaker:'阿林',dialogue:'“人来了一半，转接头找不到，天气预报也在演我。你能先帮我救一件事吗？”',text:'社团的露天电影还有二十分钟开场。幕布已经支好，旁边写着“免费入场”。风把“免费”两个字吹得哗哗响。',choices:[
    option('equipment','去社团柜找设备','也许有备用转接头，也许只有一堆线。','你拍下社团柜的位置。阿林回了六个感叹号，又补了一句：“最上层那个盒子别信，里面全是盒子。”','equipment'),
    option('venue','先找一个能避雨的地方','保住场地，电影可以换个地方开始。','你绕向图书馆。门口的值班同学看了看天：“你也发现这片云不太礼貌了？”','venue'),
    option('friends','问问谁能来搭把手','群里的人，可能比设备清单更有用。','你在群里发出求助。一分钟不到，两个人同时回复：“我有东西，但你得选一个。”','friends'),
  ]},
  equipment:{place:'社团活动室',time:'17:46',chapter:'柜子里的二选一',speaker:'器材管理员',dialogue:'“这个转接头试过能用。音箱也能借，但我得赶去排练，只来得及帮你搬一件。”',text:'果然，最上层的盒子里面还有盒子。好消息是，最底下真的有能用的东西。',choices:[
    option('adapter','带走转接头','获得：投影设备。可以争取室内放映。','投影机终于有画面了。阿林把测试图拍来：“我从没觉得蓝色桌面这么好看。”','rain',['projector']),
    option('speaker','带走小音箱','获得：音箱。电影不成，也能有点别的。','你抱走了音箱。它第一次开机就喊了一声“蓝牙模式”，整个走廊都知道你在救场。','rain',['speaker']),
  ]},
  venue:{place:'图书馆门口',time:'17:46',chapter:'把场地先留住',speaker:'值班同学',dialogue:'“小讨论室有白墙和投影，不过坐得紧一点。旁边的连廊宽敞，雨打不进来。你想留哪边？”',text:'窗外的天色越来越像一张没调好曝光的照片。你还有时间给大家换一个集合点。',choices:[
    option('room','借下小讨论室','获得：室内放映点。要和大家挤一挤。','房间借到了。值班同学递来钥匙：“别把结局讲太大声，我还没看过。”','rain',['projector','room']),
    option('canopy','把连廊留作备用','获得：避雨连廊。露天电影还有一半算露天。','你把连廊的位置发给阿林。他看了眼屋檐：“四舍五入，这也是有顶的电影院。”','rain',['canopy']),
  ]},
  friends:{place:'校园群聊',time:'17:46',chapter:'两条同时亮起的消息',speaker:'群聊 · 未读 2',dialogue:'小周：“我有备用投影设备，十分钟到。” 阿禾：“我和吉他都在旁边。电影救不了的话，别把人遣散。”',text:'你只能先等一位同学，另一位要赶去自己的活动。消息框里的光标闪了两下。',choices:[
    option('tech','等小周带设备来','获得：备用投影。继续争取放出电影。','小周回复：“在路上。放心，转接头这次在我兜里，不在玄学里。”','rain',['projector','friend']),
    option('guitar','叫阿禾带吉他来','获得：一位会弹琴的朋友。今晚可以换个节目。','阿禾已经背着琴出现了：“先说好，我会唱的那首，可能全校都会唱。”','rain',['guitar']),
  ]},
  rain:{place:'操场入口',time:'17:55',chapter:'第一滴雨先到了',speaker:'阿林',dialogue:'“宣传写的是‘一起度过一个晚上’，倒也没说必须盯着同一块屏幕。现在，你来定吧。”',text:'雨点落在幕布上，声音比电影片头还清楚。你刚才找到的东西，现在派上用场。',choices:[
    {...option('indoor','把电影搬到室内','需要：投影设备。白墙也能当银幕。','大家卷起幕布，抱着零食转移。门口有人认真问：“换场地了，爆米花还算原价吗？”','invitation',['plan:whitewall']),requires:'projector',locked:'先从社团柜、小讨论室或小周那里找到投影设备。'},
    {...option('corridor','把连廊变成一间小影院','需要：提前留好的避雨连廊。','幕布挂进连廊，阿林从包里翻出了能放短片的小投影：“原来它这么小，不是缺点，是伏笔。”','invitation',['plan:corridor']),requires:'canopy',locked:'先去图书馆，把连廊留作备用。'},
    option('live','电影改天，今晚先来点声音','现有的人和手边的东西，就能开场。','你把“放映”两个字暂时遮住，写上“今晚节目由到场的人决定”。第一个报名的人只想讲个冷笑话。','invitation',['plan:live']),
    option('ticket','认真约好下一场，再一起收摊','今晚不硬撑，也给下一次留一个约定。','你让大家各自在空白票背面写下想看的电影。阿林收起票：“好，这回我知道下一次为什么还要来了。”','invitation',['plan:ticket']),
  ]},
  invitation:{place:'临时集合点',time:'18:00',chapter:'把最后一条消息发出去',speaker:'一个还没到场的同学',dialogue:'“我刚下课。还来得及吗？你们现在在哪？”',text:'新的安排已经定下，群里还有人没看到。最后这一句话，会决定谁陪你把这一晚过完。',choices:[
    option('broadcast','把位置和新安排发到群里','让还在路上的人，也能找到这一晚。','你发了新的集合点。群里那个一直只发“收到”的头像，这次回了：“等我，带了两包薯片。”','end',['public']),
    option('small','先接上眼前这几个人','留一个小场，也回复那位刚下课的同学。','你把位置单独回过去，顺手给眼前的人分了零食。有人说：“人数少一点，最后一排终于也是第一排。”','end',['small']),
  ]},
};
const ITEMS={projector:'可用的投影',speaker:'小音箱',room:'讨论室钥匙',canopy:'连廊备用点',friend:'小周的支援',guitar:'阿禾和吉他'};
export const STORY_EPISODES=[{id:'screening',number:'01',title:STORY_TITLE,genre:'临场救场',mark:'映',tagline:'雨要来了，转接头不见了，观众已经到场。',intro:'找设备、换场地，或者让今晚有另一种开场。',chapters:['求救消息','找来帮手','临场改计划','最后的邀请'],startPlace:'操场边',bridge:'故事里，你帮大家接住了一场意外。换成真实校园，你又会怎样安排自己的日常？',nodes:NODES,items:ITEMS,endings:STORY_ENDINGS},...EXTRA_EPISODES];
export function storyEpisode(id='screening'){return STORY_EPISODES.find(episode=>episode.id===id)||STORY_EPISODES[0];}
export function storyStorageKey(scope='guest',episodeId='screening'){return 'campus:story:v1:'+encodeURIComponent(typeof scope==='string'&&scope.length<=120?scope:'guest')+(episodeId==='screening'?'':':episode:'+storyEpisode(episodeId).id);}
export function storyShelf(storage,scope='guest'){return STORY_EPISODES.map(episode=>{const saved=readStory(storage,scope,episode.id);return {episode,...saved,view:storyView(saved.progress)};});}
export function storyReflection(progress){const view=storyView(progress);return {episodeId:view.episode.id,endingId:view.ending?.id||null};}
export function cleanStoryReflection(value){const episode=STORY_EPISODES.find(e=>e.id===value?.episodeId);if(!episode)return null;return {episodeId:episode.id,endingId:episode.endings.some(e=>e.id===value.endingId)?value.endingId:null};}
const activeKey=scope=>'campus:story-active:v1:'+encodeURIComponent(typeof scope==='string'&&scope.length<=120?scope:'guest');
export function readActiveEpisode(storage,scope='guest'){try{return storyEpisode(storage?.getItem(activeKey(scope))).id;}catch{return 'screening';}}
export function saveActiveEpisode(storage,scope,id){try{storage?.setItem(activeKey(scope),storyEpisode(id).id);}catch{/* Optional navigation memory; episode saves still work independently. */}}

export function newStory(endings=[],episodeId='screening'){const episode=storyEpisode(episodeId);return {version:STORY_VERSION,...(episode.id!=='screening'?{episodeId:episode.id}:{}),history:[],pending:false,endings:[...new Set((Array.isArray(endings)?endings:[]).filter(id=>episode.endings.some(e=>e.id===id)))]};}
function traverse(history,episode){
  let nodeId='start';const flags=new Set(),steps=[];
  if(!Array.isArray(history)||history.length>4)throw Error('剧情进度格式不正确');
  for(const id of history){
    const node=episode.nodes[nodeId],choice=node?.choices.find(c=>c.id===id&&(!c.requires||flags.has(c.requires)));
    if(!choice)throw Error('这一段剧情已经更新');
    steps.push({place:node.place,chapter:node.chapter,choice});choice.flags.forEach(flag=>flags.add(flag));nodeId=choice.next;
  }
  return {nodeId,flags,steps};
}
export function storyView(progress){
  const episode=storyEpisode(progress.episodeId);if(progress.episodeId&&episode.id!==progress.episodeId)throw Error('未知剧场');
  const run=traverse(progress.history,episode),node=episode.nodes[run.nodeId];
  const ending=run.nodeId==='end'?episode.endings.find(e=>run.flags.has('plan:'+e.id)):null;
  return {...run,episode,node,ending,items:Object.entries(episode.items).filter(([flag])=>run.flags.has(flag)).map(([,label])=>label),choices:node?.choices.map(choice=>({...choice,available:!choice.requires||run.flags.has(choice.requires)}))||[],last:run.steps.at(-1)||null,pending:Boolean(progress.pending&&run.steps.length&&!ending)};
}
export function chooseStory(progress,id){
  const view=storyView(progress);if(view.ending||view.pending)throw Error('请先继续当前剧情');
  if(!view.choices.some(choice=>choice.id===id&&choice.available))throw Error('这条路线暂时不可用');
  const next={...progress,history:[...progress.history,id],pending:true};const result=storyView(next);
  if(result.ending){next.pending=false;next.endings=[...new Set([...progress.endings,result.ending.id])];}
  return next;
}
export function continueStory(progress){return {...progress,pending:false};}
export function readStory(storage,scope='guest',episodeId='screening'){
  const fresh=()=>newStory([],episodeId);
  let raw;try{raw=storage.getItem(storyStorageKey(scope,episodeId));}catch{return {progress:fresh(),available:false,recovered:false};}
  try{
    if(!raw)return {progress:fresh(),available:true,recovered:false};
    const data=JSON.parse(raw);if(data?.version!==STORY_VERSION||!Array.isArray(data.endings))throw Error('Unknown version');
    if((data.episodeId||'screening')!==storyEpisode(episodeId).id)throw Error('Wrong episode');
    const progress={...newStory(data.endings,episodeId),history:data.history,pending:!!data.pending};const view=storyView(progress);
    if(view.ending)progress.endings=[...new Set([...progress.endings,view.ending.id])];
    progress.pending=view.pending;return {progress,available:true,recovered:false};
  }catch{return {progress:fresh(),available:!!storage,recovered:!!storage};}
}
export function saveStory(storage,scope,progress){
  try{storyView(progress);storage.setItem(storyStorageKey(scope,progress.episodeId),JSON.stringify({version:STORY_VERSION,...(progress.episodeId?{episodeId:progress.episodeId}:{}),history:progress.history,pending:progress.pending,endings:progress.endings}));return true;}catch{return false;}
}
export function endingText(view){
  const {ending,flags,episode}=view;if(!ending)return [];
  if(episode.id!=='screening')return [episode.closing[ending.id],view.last.choice.reply,'这段经历已收好。你可以换个决定再走一次，也可以去另一处校园遇见新的事。'];
  const opening={whitewall:flags.has('room')?'讨论室的白墙亮了。值班同学路过三次，第三次终于在后排坐下。':'借来的设备终于在室内投出第一个画面。小周把转接头举起来，像在展示本场最佳配角。',corridor:'雨在连廊外面下，电影在连廊里面放。有人给穿过屋檐的风留了一个座位。',live:flags.has('guitar')?'阿禾弹响第一下，发现全场都会唱副歌。今晚的字幕，写在每个人嘴边。':flags.has('speaker')?'音箱里响起第一首歌。那个蓝牙开机音，最终成了今晚最整齐的一次合唱。':'没人带专业设备，于是先从一个冷笑话开始。十分钟后，大家已经忘了原本要放什么电影。',ticket:'幕布收起来了，但没有人空着手走。每张票背面都留了下一次的片名，还有一个有点歪的签名。'}[ending.id];
  return [opening,flags.has('public')?'后来赶到的人沿着新位置找来，带来了薯片、折凳，以及一句“还好你们发了消息”。':'那位刚下课的同学也赶上了。小小的一圈人，把今晚坐成了一排熟悉的座位。','阿林把这一晚存进相册，标题只有四个字：“幸好有你。”'];
}
