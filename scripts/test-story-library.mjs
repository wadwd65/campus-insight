import assert from 'node:assert/strict';
import {STORY_EPISODES,newStory,storyView,chooseStory,continueStory,readStory,saveStory,storyStorageKey,storyShelf,endingText,storyReflection,cleanStoryReflection,readActiveEpisode,saveActiveEpisode} from '../src/lib/campusStory.js';
import {storyAtmosphere} from '../src/lib/storyAtmosphere.js';
import {sceneTrackIndices} from '../src/lib/ambience.js';
import {JOURNEY_QUESTIONS} from '../src/lib/surveyJourney.js';
import {surveyFrame,realLifeFrames} from '../src/lib/surveyNarrative.js';
import {saveSurveyDraft,readSurveyDraft,SURVEY_DRAFT_KEY} from '../src/lib/surveyDraft.js';
let passed=0,paths=0;const test=(name,fn)=>{fn();passed++;console.log('  ✓ '+name);};
const values=new Map(),store={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
const walk=(id,ids)=>ids.reduce((progress,choice)=>chooseStory(continueStory(progress),choice),newStory([],id));
test('四个不同题材都有完整四幕，所有合法路径有限步到达13种收尾，没有软锁',()=>{
 assert.equal(STORY_EPISODES.length,4);assert.equal(new Set(STORY_EPISODES.map(e=>e.genre)).size,4);let endings=0;
 for(const episode of STORY_EPISODES){const found=new Set();function visit(progress){const view=storyView(progress),cue=storyAtmosphere(view);assert.ok(sceneTrackIndices(cue.musicScene).length>=2);if(view.pending)assert.notEqual(cue.effect,'none');if(view.ending){paths++;found.add(view.ending.id);assert.equal(progress.history.length,4);assert.equal(endingText(view).length,3);assert.equal(progress.endings.length,1);return;}assert.ok(progress.history.length<4);const choices=view.choices.filter(c=>c.available);assert.ok(choices.length>=2);for(const choice of view.choices.filter(c=>!c.available))assert.throws(()=>chooseStory(continueStory(progress),choice.id));for(const choice of choices)visit(chooseStory(continueStory(progress),choice.id));}visit(newStory([],episode.id));assert.deepEqual([...found].sort(),episode.endings.map(e=>e.id).sort());endings+=found.size;}
 assert.equal(endings,13);assert.ok(paths>100);
});
test('失物核实、修复工具、电台素材实际改变后续方案，不能只换台词绕过条件',()=>{
 assert.equal(storyView(continueStory(walk('lost',['l_group','l_wait']))).choices.find(c=>c.id==='l_meet').available,false);
 assert.equal(storyView(continueStory(walk('lost',['l_tag','l_verify']))).choices.find(c=>c.id==='l_meet').available,true);
 assert.equal(storyView(continueStory(walk('repair',['r_owner','r_record']))).choices.find(c=>c.id==='r_revive').available,false);
 assert.equal(storyView(continueStory(walk('repair',['r_check','r_tools']))).choices.find(c=>c.id==='r_revive').available,true);
 assert.equal(storyView(continueStory(walk('radio',['b_page','b_read']))).choices.find(c=>c.id==='b_soundwalk').available,false);
 assert.equal(storyView(continueStory(walk('radio',['b_field','b_wind']))).choices.find(c=>c.id==='b_soundwalk').available,true);
});
test('旧电影存档原键原结构继续可用，三段新增剧场和账号各自保存，重开仅清本段',()=>{
 const old=walk('screening',['venue','canopy','corridor','small']);saveStory(store,'guest',old);assert.deepEqual(readStory(store).progress,old);assert.equal(storyStorageKey('guest'),'campus:story:v1:guest');
 for(const episode of STORY_EPISODES.slice(1)){const first=chooseStory(newStory([],episode.id),episode.nodes.start.choices[0].id);saveStory(store,'guest',first);assert.deepEqual(readStory(store,'guest',episode.id).progress,first);assert.equal(readStory(store,'other',episode.id).progress.history.length,0);assert.throws(()=>chooseStory(first,episode.nodes.start.choices[0].id));}
 assert.deepEqual(readStory(store).progress,old);assert.equal(storyShelf(store).filter(item=>item.progress.history.length).length,4);assert.deepEqual(newStory(old.endings).endings,['corridor']);
});
test('坏掉的一段存档不影响其他段；导航只记合法剧场ID，禁用存储可继续',()=>{
 const before=readStory(store).progress;store.setItem(storyStorageKey('guest','repair'),'{');assert.equal(readStory(store,'guest','repair').recovered,true);assert.deepEqual(readStory(store).progress,before);
 saveActiveEpisode(store,'guest','radio');assert.equal(readActiveEpisode(store),'radio');assert.equal(readActiveEpisode(store,'other'),'screening');saveActiveEpisode(store,'guest','unknown');assert.equal(readActiveEpisode(store),'screening');
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};for(const episode of STORY_EPISODES)assert.equal(readStory(blocked,'guest',episode.id).available,false);saveActiveEpisode(blocked,'guest','radio');assert.equal(readActiveEpisode(blocked),'screening');
});
test('故事到答题只传剧场和结局，身份、虚构选项和额外分数不混入真实答卷',()=>{
 const progress=walk('radio',['b_page','b_read','b_letter_end','b_thanks']),reflection=storyReflection(progress);assert.deepEqual(reflection,{episodeId:'radio',endingId:'letter'});assert.deepEqual(cleanStoryReflection({...reflection,answers:{secret:'NO'},email:'NO'}),reflection);assert.equal(cleanStoryReflection({episodeId:'unknown'}),null);assert.deepEqual(cleanStoryReflection({episodeId:'radio',endingId:'whitewall'}),{episodeId:'radio',endingId:null});
});
test('十个镜头的全部选项有不同的具体回应；四种故事每站引子不同，不代填答案',()=>{
 const headings=new Set();for(const question of JOURNEY_QUESTIONS){headings.add(surveyFrame(question).title);const lines=new Set();for(const option of question.options){const answers={[question.field]:option.text};lines.add(surveyFrame(question,null,answers).feedback);assert.deepEqual(Object.keys(answers),[question.field]);}assert.equal(lines.size,question.options.length);assert.equal(surveyFrame(question).feedback,null);const links=new Set(STORY_EPISODES.map(episode=>surveyFrame(question,{episodeId:episode.id}).scene));assert.equal(links.size,4);}assert.equal(headings.size,10);
 const first=JOURNEY_QUESTIONS[0],second=JOURNEY_QUESTIONS[1];assert.match(surveyFrame(second,null,{[first.field]:first.options[1].text}).previous,new RegExp(first.options[1].text));
});
test('稍后填写后，真实答案、题号与故事引子一起恢复；原草稿和圈子格式仍可读',()=>{
 const first=JOURNEY_QUESTIONS[0],answers={[first.field]:first.options[0].text},context={episodeId:'lost',endingId:'counter'};saveSurveyDraft(1,answers,store,'',context);assert.deepEqual(readSurveyDraft(store),{index:1,answers,storyContext:context});const raw=JSON.parse(store.getItem(SURVEY_DRAFT_KEY));assert.deepEqual(Object.keys(raw.storyContext).sort(),['endingId','episodeId']);saveSurveyDraft(1,answers,store,'member:circle');assert.deepEqual(readSurveyDraft(store,'member:circle'),{index:1,answers});
});
test('报告三帧只读有效真实答案，空白不虚构；故事收藏不进入矩阵与圈子字段',()=>{
 assert.deepEqual(realLifeFrames(null),[]);assert.deepEqual(realLifeFrames({fake:'NO'}),[]);const answers=Object.fromEntries(JOURNEY_QUESTIONS.map(q=>[q.field,q.options[0].text]));const copy=JSON.stringify(answers);const frames=realLifeFrames(answers);assert.equal(frames.length,3);assert.equal(JSON.stringify(answers),copy);for(const frame of frames)assert.equal(frame.answer,answers[JOURNEY_QUESTIONS.find(q=>q.id===frame.id).field]);
});
console.log(`多剧场与连续体验：${passed} 项通过，穷举 ${paths} 条完整路线`);
