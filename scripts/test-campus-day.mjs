import assert from 'node:assert/strict';
import {newDay,dayView,chooseDay,continueDay,rewindDay,readDay,saveDay,dayKey,dayTrail,dayText} from '../src/lib/campusDay.js';
import {PLACE_INDEX} from '../src/data/mapPlaces.js';
import {BASE_ATTR_KEYS} from '../src/lib/surveySchema.js';
import {CAMPUS_POSITIONS} from '../src/lib/campusJourney.js';
let passed=0,paths=0;const test=(name,fn)=>{fn();passed++;console.log('  ✓ '+name);};
const walk=(ids,variant=0)=>ids.reduce((p,id)=>chooseDay(continueDay(p),id),newDay(variant));
test('两种天气的所有合法路线都能完成十个决定，资源不为负，不会出现唯一强制去处',()=>{
 const choices=new Set(),memoryPlaces=new Set();function visit(progress){const view=dayView(progress);assert.ok(view.energy>=0&&view.energy<=5);assert.ok(view.coins>=0&&view.coins<=6);assert.ok(CAMPUS_POSITIONS[view.place]);if(view.complete){paths++;assert.equal(progress.history.length,10);assert.equal(view.visits.length,9);assert.ok(view.visits.some(v=>v.place===view.keepsake));memoryPlaces.add(view.keepsake);return;}const options=view.task.choices.filter(c=>c.available);assert.ok(options.length>=2,view.task.id+': '+progress.history.join('/'));for(const choice of view.task.choices){assert.ok(PLACE_INDEX.has(choice.place));assert.ok(CAMPUS_POSITIONS[choice.place]);if(choice.available){choices.add(choice.id);visit(chooseDay(continueDay(progress),choice.id));}}}
 visit(newDay(0));visit(newDay(1));assert.ok(paths>10000);assert.ok(choices.has('repair')&&choices.has('pavilion')&&choices.has('sunclub')&&choices.has('team'));assert.ok(memoryPlaces.size>=8);
});
test('同一后续问题由之前准备改变，而非只显示不同措辞；锁定方案不能越过',()=>{
 const tool=walk(['slow','tinker','canteen','rehearsal','rainclub']),noTool=walk(['slow','wander','canteen','camera','pavilion']);
 assert.equal(dayView(continueDay(tool)).task.choices.find(c=>c.id==='repair').available,true);assert.equal(dayView(continueDay(noTool)).task.choices.find(c=>c.id==='repair').available,false);assert.throws(()=>chooseDay(continueDay(noTool),'repair'));
 const energy=walk(['front','tinker','snack','rehearsal','rainclub','repair']);assert.equal(dayView(continueDay(energy)).task.choices.find(c=>c.id==='team').available,false);assert.ok(dayView(continueDay(energy)).task.title.includes('电量'));
});
test('每个决定先呈现后果，重复点击不能跨越；回退会重算资源并清掉不再可能的后续',()=>{
 const p=walk(['slow','tinker']);assert.equal(dayView(p).pending,true);assert.throws(()=>chooseDay(p,'canteen'));const rewind=rewindDay(p,1);assert.deepEqual(rewind.history,['slow']);assert.equal(dayView(rewind).flags.has('tool'),false);assert.equal(dayView(rewind).energy,4);assert.equal(dayView(rewind).task.id,'detour');assert.throws(()=>rewindDay(p,99));
});
test('最后一题只盖实际去过地点的章，不添加第十次虚构移动；轨迹与属性完全同源',()=>{
 let p=walk(['slow','tinker','canteen','rehearsal','rainclub','repair','team','market','seeoff']);const view=dayView(continueDay(p));assert.equal(view.task.kind,'memory');for(const c of view.task.choices)assert.ok(view.visits.some(v=>v.place===c.place));p=chooseDay(continueDay(p),view.task.choices[0].id);const done=dayView(p);assert.equal(done.complete,true);assert.equal(done.visits.length,9);assert.equal(dayTrail(p).length,9);const attrs=Object.fromEntries(BASE_ATTR_KEYS.map(k=>[k,0]));for(const entry of dayTrail(p))for(const key of BASE_ATTR_KEYS)attrs[key]+=entry.delta[key]||0;assert.deepEqual(done.attributes,attrs);assert.match(dayText(p),/模拟行程/);assert.match(dayText(p),/纪念章/);
});
test('仅保存版本、天气、动作ID和后果阶段；账号与匿名隔离，原问卷及剧场存档不动',()=>{
 const values=new Map([['campus-insight:survey-draft','ORIGINAL_SURVEY'],['campus:story:v1:guest','ORIGINAL_STORY']]),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const p=walk(['slow','tinker']);assert.equal(saveDay(storage,'guest',{...p,answers:{secret:'NO'},user:{email:'NO'}}),true);assert.deepEqual(readDay(storage).progress,p);assert.deepEqual(readDay(storage,'other').progress,newDay());assert.deepEqual(Object.keys(JSON.parse(values.get(dayKey()))).sort(),['history','pending','variant','version']);assert.equal(values.get('campus-insight:survey-draft'),'ORIGINAL_SURVEY');assert.equal(values.get('campus:story:v1:guest'),'ORIGINAL_STORY');
});
test('损坏、过长、跳锁、未知天气的存档安全回开场；禁用存储仍能当次走完整条路线',()=>{
 for(const raw of ['{',JSON.stringify({version:9,variant:0,history:[]}),JSON.stringify({version:1,variant:2,history:[]}),JSON.stringify({version:1,variant:0,history:Array(11).fill('slow')}),JSON.stringify({version:1,variant:0,history:['slow','wander','canteen','camera','rainclub']})]){const loaded=readDay({getItem:()=>raw});assert.equal(loaded.recovered,true);assert.deepEqual(loaded.progress,newDay());}
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};assert.equal(readDay(blocked).available,false);assert.equal(saveDay(blocked,'guest',newDay()),false);let p=newDay();while(!dayView(p).complete){const view=dayView(continueDay(p));p=chooseDay(continueDay(p),view.task.choices.find(c=>c.available).id);}assert.equal(dayView(p).complete,true);
});
console.log(`地图十决定：${passed}项通过，穷举${paths}条可完成路线`);
