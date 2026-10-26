import assert from 'node:assert/strict';
import {newStory,chooseStory,continueStory,storyView} from '../src/lib/campusStory.js';
import {storyAtmosphere,STORY_CHOICE_EFFECTS} from '../src/lib/storyAtmosphere.js';
import {sceneTrackIndices} from '../src/lib/ambience.js';
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('  ✓ '+name);};
function walk(ids){let progress=newStory();for(const id of ids)progress=chooseStory(continueStory(progress),id);return progress;}
test('全部合法分支中的15种选择都对应额外反馈，且每个剧情场景有有效配乐队列',()=>{
  const choices=new Set();function visit(progress){const view=storyView(progress),cue=storyAtmosphere(view);assert.ok(cue.label&&cue.mood&&sceneTrackIndices(cue.musicScene).length>=2);if(progress.history.length){choices.add(view.last.choice.id);assert.equal(cue.effect,STORY_CHOICE_EFFECTS[view.last.choice.id]);assert.notEqual(cue.effect,'none');}if(view.ending)return;for(const choice of view.choices.filter(c=>c.available))visit(chooseStory(continueStory(progress),choice.id));}
  visit(newStory());assert.deepEqual([...choices].sort(),Object.keys(STORY_CHOICE_EFFECTS).sort());assert.equal(choices.size,15);
});
test('走到下雨一幕才出现全屏雨；搬进室内变为窗外雨，连廊保留雨幕',()=>{
  const prepared=walk(['equipment','adapter']);assert.equal(storyAtmosphere(storyView(prepared)).effect,'projector');assert.equal(storyAtmosphere(storyView(prepared)).weather,'dry');
  const rain=continueStory(prepared);assert.equal(storyAtmosphere(storyView(rain)).weather,'rain');assert.equal(storyAtmosphere(storyView(rain)).musicScene,'story-rain');
  assert.equal(storyAtmosphere(storyView(chooseStory(rain,'indoor'))).weather,'window');
  assert.equal(storyAtmosphere(storyView(walk(['venue','canopy','corridor']))).weather,'rain');
});
test('不同资源、邀请和收尾有不同视觉反馈，剧情状态可恢复且不额外保存特效字段',()=>{
  assert.equal(storyAtmosphere(storyView(walk(['equipment','speaker']))).effect,'sound');assert.equal(storyAtmosphere(storyView(walk(['friends','guitar']))).effect,'notes');
  const a=walk(['friends','guitar','live','broadcast']),b=walk(['friends','guitar','live','small']);assert.equal(storyAtmosphere(storyView(a)).effect,'messages');assert.equal(storyAtmosphere(storyView(b)).effect,'seats');assert.deepEqual(storyAtmosphere(storyView(a)),storyAtmosphere(storyView(JSON.parse(JSON.stringify(a)))));assert.deepEqual(Object.keys(a).sort(),['endings','history','pending','version']);
});
test('视觉与音乐提示不读取或外传问卷数据',()=>{
  const view=storyView(newStory()),cue=storyAtmosphere({...view,answers:{secret:'SENTINEL'},report:{secret:'SENTINEL'}});assert.equal(JSON.stringify(cue).includes('SENTINEL'),false);
});
console.log(`剧情视觉与音乐编排：${passed} 项通过`);
