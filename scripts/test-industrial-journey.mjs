import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {JOURNEY_CHAPTERS,JOURNEY_QUESTIONS} from '../src/lib/surveyJourney.js';
import {QUESTIONS,MATRIX_VERSION} from '../src/lib/surveySchema.js';
import {readSurveyDraft,saveSurveyDraft,SURVEY_DRAFT_KEY} from '../src/lib/surveyDraft.js';
import {buildProfileCsv} from '../src/lib/exportProfile.js';
import {toAttributes} from '../src/lib/matrix.js';
import {motionAllowed,AMBIENT_TRACKS,nextTrackIndex,sceneTrackIndex,musicScene,sceneTrackIndices,nextSceneTrackIndex,MUSIC_SCENES,playbackVolume} from '../src/lib/ambience.js';
let count=0;function test(name,fn){fn();count++;console.log('  ✓ '+name);}
test('五站十题无重复遗漏，每题问的切面不同，存储字段选项和向量未换义',()=>{
  assert.equal(JOURNEY_CHAPTERS.length,5);assert.equal(JOURNEY_QUESTIONS.length,10);assert.equal(new Set(JOURNEY_QUESTIONS.map(q=>q.id)).size,10);
  assert.equal(new Set(JOURNEY_QUESTIONS.map(q=>q.focus)).size,10);
  for(const q of JOURNEY_QUESTIONS){const source=QUESTIONS.find(x=>x.id===q.id);assert.equal(q.field,source.field);assert.deepEqual(q.options.map(({text,vec})=>({text,vec})),source.options);assert.equal(q.text,source.text);assert.ok(q.focusHint);assert.ok(q.prompt);assert.equal(q.options.length,source.options.length);for(const option of q.options)assert.ok(option.contextHint);}
});
test('新展示顺序不改变相同答卷的属性和可回读CSV',()=>{
  const canonical=Object.fromEntries(QUESTIONS.map((q,i)=>[q.field,q.options[i%q.options.length].text]));
  const journey=Object.fromEntries(JOURNEY_QUESTIONS.map(q=>[q.field,canonical[q.field]]));
  assert.deepEqual(toAttributes(canonical),toAttributes(journey));assert.equal(buildProfileCsv(canonical,{id:'same'}),buildProfileCsv(journey,{id:'same'}));assert.equal(MATRIX_VERSION,1);
});
test('A版草稿迁移保留已选原文，从新路线第一道未答题继续',()=>{
  const answers=Object.fromEntries(QUESTIONS.slice(0,5).map(q=>[q.field,q.options[0].text]));
  const store={getItem:()=>JSON.stringify({version:MATRIX_VERSION,index:5,answers})};
  const restored=readSurveyDraft(store);assert.deepEqual(restored.answers,answers);assert.equal(restored.index,0);assert.equal(JOURNEY_QUESTIONS[0].id,'Q7');
});
test('B版草稿按题目ID恢复，匿名与圈子作用域隔离',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const answers=Object.fromEntries(JOURNEY_QUESTIONS.slice(0,4).map(q=>[q.field,q.options[0].text]));
  saveSurveyDraft(4,answers,storage,'user:circle');assert.equal(readSurveyDraft(storage),null);assert.deepEqual(readSurveyDraft(storage,'user:circle'),{index:4,answers});
  const saved=JSON.parse(values.get(`${SURVEY_DRAFT_KEY}:user:circle`));assert.equal(saved.questionId,JOURNEY_QUESTIONS[4].id);
});
test('暂停、后台、窄屏、减少动态任一状态都停止背景动画',()=>{
  assert.equal(motionAllowed(),true);for(const key of ['hidden','reduced','compact','paused'])assert.equal(motionAllowed({[key]:true}),false);
  const css=fs.readFileSync(new URL('../src/industrial-edition.css',import.meta.url),'utf8');assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.doesNotMatch(css,/backdrop-filter:\s*blur|animation:.*(?:filter|background-position)/);
});
test('九首国内外现成录音与公开署名清单逐字节一致，CC BY与CC0分别标注，首屏不请求音频',()=>{
  const meta=JSON.parse(fs.readFileSync(new URL('../public/audio/music-credits.json',import.meta.url),'utf8'));
  assert.deepEqual(AMBIENT_TRACKS,meta.tracks);assert.equal(AMBIENT_TRACKS.length,9);assert.equal(new Set(meta.tracks.map(t=>t.sha256)).size,9);assert.equal(meta.tracks.filter(t=>t.collection==='国内来源').length,4);assert.equal(meta.tracks.filter(t=>t.collection==='国际曲库').length,5);
  for(const track of AMBIENT_TRACKS){const file=new URL('../public/'+track.file,import.meta.url),bytes=fs.readFileSync(file);assert.equal(bytes.length,track.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),track.sha256);assert.equal(track.license,track.collection==='国内来源'?'CC BY 4.0':'CC0 1.0 Universal');assert.ok(track.source.startsWith('https://'));if(track.collection==='国内来源'){assert.match(track.attribution,/黑耀耀/);assert.ok(track.licenseEvidence&&track.artistUrl);}assert.ok(track.seconds>30&&track.decodedRms>.005);}
  const source=fs.readFileSync(new URL('../src/components/ExperienceSettings.jsx',import.meta.url),'utf8');assert.match(source,/preload="none"/);assert.doesNotMatch(source,/<audio[^>]*(?:autoPlay|src=)/);assert.match(source,/visibilitychange/);
});
test('主页轻快、答题安静、报告温暖、地图活泼；未知页面回到主页曲',()=>{
  assert.equal(AMBIENT_TRACKS[sceneTrackIndex('entry')].id,'heiyao-sunlight');assert.equal(AMBIENT_TRACKS[sceneTrackIndex('circles')].id,'heiyao-sunlight');assert.equal(AMBIENT_TRACKS[sceneTrackIndex('quiz')].id,'heiyao-dawn');assert.equal(AMBIENT_TRACKS[sceneTrackIndex('report')].id,'vaporware');assert.equal(AMBIENT_TRACKS[sceneTrackIndex('map')].id,'lofi-jam');assert.equal(sceneTrackIndex('unknown'),sceneTrackIndex('entry'));assert.equal(musicScene('cohort'),'focus');
});
test('顺序播放会换曲，随机不连播同一首，单曲模式保留当前曲',()=>{
  for(let i=0;i<AMBIENT_TRACKS.length;i++){assert.equal(nextTrackIndex(i,'cycle'),(i+1)%AMBIENT_TRACKS.length);assert.equal(nextTrackIndex(i,'single'),i);for(const seed of [0,.2,.5,.99,1])assert.notEqual(nextTrackIndex(i,'shuffle',()=>seed),i);}
});
test('每种场景有至少两首授权曲目轮播，播完不会被场景默认曲拉回；曲间音量仅做衰减',()=>{
  for(const [key,scene] of Object.entries(MUSIC_SCENES)){const pool=sceneTrackIndices(key);assert.equal(pool.length,scene.tracks.length);assert.ok(pool.length>=2);for(let i=0;i<pool.length;i++)assert.equal(nextSceneTrackIndex(pool[i],key),pool[(i+1)%pool.length]);}
  for(let i=0;i<AMBIENT_TRACKS.length;i++){assert.ok(playbackVolume(i,.18)<=.18&&playbackVolume(i,.18)>0);assert.equal(playbackVolume(i,0),0);assert.ok(playbackVolume(i,1)<=.5);}
});
test('同行与页尾采用独立样式，原立绘保留且不引入逐帧定时器',()=>{
  const css=fs.readFileSync(new URL('../src/refinement.css',import.meta.url),'utf8'),source=fs.readFileSync(new URL('../src/components/CampusCompanion.jsx',import.meta.url),'utf8');assert.match(css,/survey-draft-note\{background:transparent/);assert.match(css,/companion-breathe/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(source,/art\/mascot.webp/);assert.doesNotMatch(source,/setInterval|requestAnimationFrame/);
});
console.log(`B版行迹与低开销氛围：${count} 项通过`);

