import assert from 'node:assert/strict';
import {PLACES} from '../src/data/mapPlaces.js';
import {CAMPUS_POSITIONS} from '../src/lib/campusJourney.js';
import {CAMPUS_ACCESS,CAMPUS_STREETS,campusLeg,campusRoute,walkingFrames} from '../src/lib/campusPaths.js';
let passed=0,legs=0;const test=(name,fn)=>{fn();passed++;console.log('  ✓ '+name);};
const near=(a,b)=>Math.abs(a-b)<1e-6,pointEqual=(a,b)=>near(a[0],b[0])&&near(a[1],b[1]);
const anchor=id=>[CAMPUS_POSITIONS[id][0]*10,CAMPUS_POSITIONS[id][1]*6.4];
function on(p,[a,b]){return near(a[0],b[0])?near(p[0],a[0])&&p[1]>=Math.min(a[1],b[1])-1e-6&&p[1]<=Math.max(a[1],b[1])+1e-6:near(p[1],a[1])&&p[0]>=Math.min(a[0],b[0])-1e-6&&p[0]<=Math.max(a[0],b[0])+1e-6;}
function crosses(a,b,[left,top,right,bottom]){return near(a[0],b[0])?a[0]>left&&a[0]<right&&Math.max(Math.min(a[1],b[1]),top)<Math.min(Math.max(a[1],b[1]),bottom):a[1]>top&&a[1]<bottom&&Math.max(Math.min(a[0],b[0]),left)<Math.min(Math.max(a[0],b[0]),right);}
test('十六个实际地点都有入口和接入道路，坐标与现有主玩法/旧地图一致',()=>{assert.deepEqual(Object.keys(CAMPUS_ACCESS).sort(),PLACES.map(p=>p.id).sort());for(const [id,access] of Object.entries(CAMPUS_ACCESS)){assert.ok(CAMPUS_POSITIONS[id]);assert.ok(CAMPUS_STREETS.some(road=>on(access,road)),id);}});
test('全部256对地点均可沿路到达，内部路段落在道路图上，不走斜线穿湖',()=>{
 for(const from of Object.keys(CAMPUS_ACCESS))for(const to of Object.keys(CAMPUS_ACCESS)){const points=campusLeg(from,to);legs++;assert.ok(points.length);assert.ok(pointEqual(points[0],anchor(from)));assert.ok(pointEqual(points.at(-1),anchor(to)));for(const p of points)assert.ok(p.every(Number.isFinite)&&p[0]>=0&&p[0]<=1000&&p[1]>=0&&p[1]<=640);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];assert.ok(near(a[0],b[0])||near(a[1],b[1]),from+' to '+to);assert.equal(crosses(a,b,[720,360,875,465]),false,'route through lake: '+from+' to '+to);}for(let i=2;i<points.length-1;i++)assert.ok(CAMPUS_STREETS.some(road=>on(points[i-1],road)&&on(points[i],road)));}
});
test('主道路路线不会穿过图书馆、教学楼、宿舍、食堂等第三方建筑占地',()=>{
 const roofs={library:[194,51,286,111],lab:[388,59,472,104],late_class:[338,166,422,219],gym:[835,202,925,251],dorm:[98,270,182,321],club:[288,278,372,321],intern:[108,392,192,430],printshop:[318,393,402,424],canteen:[516,445,584,488],convenience:[378,521,462,558]};
 for(const from of Object.keys(CAMPUS_ACCESS))for(const to of Object.keys(CAMPUS_ACCESS)){const points=campusLeg(from,to);for(let i=1;i<points.length;i++)for(const [id,box] of Object.entries(roofs))if(id!==from&&id!==to)assert.equal(crosses(points[i-1],points[i],box),false,from+' to '+to+' crosses '+id);}
});
test('路线串接包含真实起点与中途到访，重复停留/未知地点不制造虚线或NaN',()=>{const route=campusRoute(['dorm','library','lake','lake']);assert.ok(pointEqual(route[0],anchor('dorm')));assert.ok(route.some(p=>pointEqual(p,anchor('library'))));assert.ok(pointEqual(route.at(-1),anchor('lake')));assert.deepEqual(campusRoute(['unknown']),[]);assert.deepEqual(campusLeg('unknown','lake'),[]);assert.deepEqual(campusRoute(['lake','lake']),[anchor('lake')]);const copy=campusLeg('dorm','lake');copy[0][0]=-999;assert.ok(pointEqual(campusLeg('dorm','lake')[0],anchor('dorm')));});
test('小人百分比关键帧使用同一沿路坐标，起终点与路线一致，响应尺寸无需逐帧测量',()=>{const route=campusLeg('dorm','gym'),frames=walkingFrames('dorm','gym');assert.ok(frames.startsWith('0.000%'));assert.match(frames,/100\.000%/);assert.equal((frames.match(/transform:/g)||[]).length,route.length);assert.match(frames,/translate\(88\.000%,40\.000%\)/);assert.doesNotMatch(frames,/NaN|Infinity|undefined/);});
console.log(`校园沿路路径：${passed}项通过，${legs}对入口可达`);
