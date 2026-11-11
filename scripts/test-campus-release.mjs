import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Test the actual self-contained release, independently of the older modular fixtures.
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const html = read('map-src/web/index.html');
for (const target of ['public/map/校园地图-3D实景.html', 'dist/map/校园地图-3D实景.html']) assert.ok(read(target) === html, target + ' must match the source');
assert.ok(!/<script\b[^>]*src\s*=/i.test(html));
assert.ok(!/<link\b[^>]*href\s*=/i.test(html));
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length, 3);
for (const script of scripts) {
  const result = spawnSync(process.execPath, ['--check', '--input-type=' + (/module/.test(script[1]) ? 'module' : 'commonjs')], {input:script[2], encoding:'utf8', windowsHide:true, timeout:10000});
  assert.equal(result.status, 0, result.stderr);
}
const scope = vm.createContext({console:{warn(){},log(){}},atob,btoa});
try {
  vm.runInContext(scripts[0][2], scope, {timeout:5000});
  vm.runInContext('var window={THREE};\n' + scripts[1][2].split('/* ===== campus-boot.js ===== */')[0], scope, {timeout:5000});
} catch (error) { throw new Error('实际地图内联代码载入失败：' + error.message); }
const actual = vm.runInContext('({WALK,jumpWalk,advanceWalk,shouldUse3D,data:CAMPUS_DATA_INLINE})', scope);
assert.equal(actual.data.places.length, 34);
assert.equal(actual.shouldUse3D({width:390,coarse:true}), false);
assert.equal(actual.shouldUse3D({width:1280,coarse:false}), true);
const pose={x:0,y:actual.WALK.eyeHeight+.04,z:0,yaw:0,pitch:0,settling:false};
assert.equal(actual.jumpWalk(pose),true);
assert.equal(actual.jumpWalk(pose),true);
assert.equal(actual.jumpWalk(pose),false);
const floor={canStand:()=>true,floorAt:()=>.04};
for(let i=0;i<480;i++)actual.advanceWalk(pose,floor,new Set(),1/120);
assert.equal(pose.airborne,false);assert.equal(pose.jumpsUsed,0);
assert.ok([pose.x,pose.y,pose.z].every(Number.isFinite));
assert.equal(actual.jumpWalk(pose),true);
const edition=JSON.parse(read('dist/build-edition.json'));
const map=edition.build.artifacts.find(a=>a.path==='/map/校园地图-3D实景.html');
assert.equal(map.sha256,createHash('sha256').update(html).digest('hex'));
console.log('实际自包含3D：源码/产物一致、三段脚本语法、桌面分流、真实内联二段跳及落地重置、发布摘要通过。旧模块单测不代替本项。');
