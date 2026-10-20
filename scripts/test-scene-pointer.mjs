import assert from 'node:assert/strict';
import { bindScenePointer } from '../src/lib/scenePointer.js';

class Target {
  events = new Map();
  addEventListener(name, fn) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name).add(fn); }
  removeEventListener(name, fn) { this.events.get(name)?.delete(fn); }
  emit(name, event = {}) { for (const fn of this.events.get(name) ?? []) fn(event); }
  get listeners() { return [...this.events.values()].reduce((sum, set) => sum + set.size, 0); }
}
const previous = {window:globalThis.window, document:globalThis.document};
const fine = Object.assign(new Target(), {matches:true});
const reduced = Object.assign(new Target(), {matches:false});
const frames = new Map();
let frameId = 0, passed = 0;
const win = Object.assign(new Target(), {
  matchMedia:q=>q.includes('prefers-reduced') ? reduced : fine,
  requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},
  cancelAnimationFrame:id=>frames.delete(id),
});
const doc = Object.assign(new Target(), {hidden:false});
const root = Object.assign(new Target(), {
  values:new Map(), attributes:new Map(),
  getBoundingClientRect:()=>({left:100,top:50,width:800,height:600}),
  setAttribute(name,value){this.attributes.set(name,value);},
  removeAttribute(name){this.attributes.delete(name);},
});
root.style={setProperty:(name,value)=>root.values.set(name,value)};
const mouse = (x,y) => root.emit('pointermove',{pointerType:'mouse',clientX:x,clientY:y});
const paint = () => { const pending=[...frames.values()]; frames.clear(); for(const fn of pending)fn(); };
function check(name,fn){fn();passed++;console.log(`  ✓ ${name}`);}

try {
  globalThis.window=win; globalThis.document=doc;
  const stop=bindScenePointer(root);
  check('没有鼠标操作时不启动动画循环',()=>assert.equal(frames.size,0));
  check('同一帧多次移动仅绘制最新位置一次',()=>{
    mouse(100,50); mouse(900,650); assert.equal(frames.size,1); paint();
    assert.equal(root.values.get('--pointer-dx'),'12.00px');
    assert.equal(root.values.get('--pointer-dy'),'10.00px');
    assert.equal(frames.size,0);
  });
  check('视差有界，越出范围的坐标不会把装饰甩飞',()=>{
    mouse(-10000,10000); paint();
    assert.equal(root.values.get('--pointer-dx'),'-12.00px');
    assert.equal(root.values.get('--pointer-dy'),'10.00px');
  });
  check('离开页面清除待处理帧，装饰回中且光晕消失',()=>{
    mouse(500,100); root.emit('pointerleave');
    assert.equal(frames.size,0); assert.equal(root.attributes.has('data-pointer-active'),false);
    assert.equal(root.values.get('--pointer-dx'),'0px');
  });
  check('触摸和粗指针不产生鼠标视差',()=>{
    root.emit('pointermove',{pointerType:'touch',clientX:900,clientY:650}); assert.equal(frames.size,0);
    fine.matches=false; mouse(900,650); assert.equal(frames.size,0); fine.matches=true;
  });
  check('运行中开启减少动态效果，立即重置并停止后续更新',()=>{
    mouse(900,650); paint(); reduced.matches=true; reduced.emit('change');
    assert.equal(root.attributes.has('data-pointer-active'),false);
    mouse(900,650); assert.equal(frames.size,0); reduced.matches=false;
  });
  check('切到后台重置，卸载移除全部监听和待处理帧',()=>{
    mouse(900,650); doc.hidden=true; doc.emit('visibilitychange'); assert.equal(frames.size,0);
    doc.hidden=false; mouse(900,650); stop();
    assert.equal(frames.size,0);
    assert.equal(root.listeners+win.listeners+doc.listeners+fine.listeners+reduced.listeners,0);
  });
} finally {
  if(previous.window===undefined) delete globalThis.window; else globalThis.window=previous.window;
  if(previous.document===undefined) delete globalThis.document; else globalThis.document=previous.document;
}
check('没有DOM的环境可安全调用',()=>bindScenePointer(null)());
console.log(`场景鼠标互动：${passed} 项通过`);
