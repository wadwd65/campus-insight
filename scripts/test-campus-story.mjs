import assert from 'node:assert/strict';
import {STORY_ENDINGS,newStory,storyView,chooseStory,continueStory,readStory,saveStory,storyStorageKey,endingText} from '../src/lib/campusStory.js';
let passed=0;const test=(name,fn)=>{fn();console.log('  ✓ '+name);passed++;};
const clear=progress=>continueStory(progress);
function walk(ids,progress=newStory()){for(const id of ids)progress=chooseStory(clear(progress),id);return progress;}
test('早先找来的资源真正改变后续方案，未准备的路线不能跳过条件',()=>{
  const equipment=walk(['equipment','adapter']),venue=walk(['venue','canopy']),music=walk(['friends','guitar']);
  assert.equal(storyView(clear(equipment)).choices.find(c=>c.id==='indoor').available,true);assert.equal(storyView(clear(equipment)).choices.find(c=>c.id==='corridor').available,false);
  assert.equal(storyView(clear(venue)).choices.find(c=>c.id==='corridor').available,true);assert.equal(storyView(clear(venue)).choices.find(c=>c.id==='indoor').available,false);
  assert.ok(storyView(music).items.includes('阿禾和吉他'));assert.throws(()=>chooseStory(clear(music),'indoor'));
});
test('全部合法分支都能有限步到结局，四个结局均可到达，同行邀请影响结尾原文',()=>{
  const found=new Set();let paths=0;function visit(progress){const view=storyView(progress);if(view.ending){found.add(view.ending.id);paths++;assert.equal(progress.history.length,4);assert.equal(progress.endings.length,1);assert.equal(endingText(view).length,3);return;}for(const choice of view.choices.filter(c=>c.available))visit(clear(chooseStory(clear(progress),choice.id)));}
  visit(newStory());assert.equal(found.size,STORY_ENDINGS.length);assert.ok(paths>=24);
  const publicRun=walk(['friends','guitar','live','broadcast']),small=walk(['friends','guitar','live','small']);assert.notDeepEqual(endingText(storyView(publicRun)),endingText(storyView(small)));assert.match(endingText(storyView(publicRun))[0],/阿禾/);
});
test('选择后的结果页必须确认继续，重复点击旧选项不会跨过一幕',()=>{
  const progress=chooseStory(newStory(),'equipment');assert.equal(storyView(progress).pending,true);assert.match(storyView(progress).last.choice.reply,/盒子/);assert.throws(()=>chooseStory(progress,'adapter'));assert.equal(storyView(continueStory(progress)).node.chapter,'柜子里的二选一');
});
test('离开后保存同一幕和反馈阶段，账号作用域隔离，重开保留真实已发现结局且不重复收集',()=>{
  const values=new Map(),store={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},progress=chooseStory(newStory(),'venue');
  assert.equal(saveStory(store,'user-a',progress),true);assert.deepEqual(readStory(store,'user-a').progress,progress);assert.deepEqual(readStory(store,'user-b').progress,newStory());assert.notEqual(storyStorageKey('a:b'),storyStorageKey('a/b'));
  const end=walk(['venue','canopy','corridor','small']);const restarted=newStory(end.endings);assert.deepEqual(restarted.history,[]);assert.deepEqual(restarted.endings,['corridor']);assert.deepEqual(walk(['venue','canopy','corridor','broadcast'],restarted).endings,['corridor']);
});
test('坏JSON、非法动作链、跳锁路线及过长历史安全回开场；未知结局不进入收藏',()=>{
  for(const value of ['{',JSON.stringify({version:9,endings:[]}),JSON.stringify({version:1,endings:[],history:['equipment','adapter','corridor','small']}),JSON.stringify({version:1,endings:[],history:Array(50).fill('equipment')})]){const result=readStory({getItem:()=>value},'guest');assert.deepEqual(result.progress,newStory());assert.equal(result.recovered,true);}
  const valid=readStory({getItem:()=>JSON.stringify({version:1,history:[],pending:true,endings:['unknown','live','live'],answers:{secret:'private'}})});assert.deepEqual(valid.progress,{version:1,history:[],pending:false,endings:['live']});
});
test('存储禁用或满额时仍可走完整段，只保存白名单剧情字段',()=>{
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};assert.equal(readStory(blocked).available,false);const progress=walk(['equipment','speaker','live','broadcast']);assert.equal(storyView(progress).ending.id,'live');assert.equal(saveStory(blocked,'guest',progress),false);
  let text;assert.equal(saveStory({setItem:(_,v)=>text=v},'guest',{...progress,answers:{secret:'private'},user:{email:'hidden'}}),true);assert.deepEqual(Object.keys(JSON.parse(text)).sort(),['endings','history','pending','version']);assert.ok(!text.includes('private')&&!text.includes('hidden'));
});
console.log(`可接续校园剧情：${passed} 项通过`);
