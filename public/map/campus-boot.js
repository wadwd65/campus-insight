// 10-29：把未捕获的错误直接显示在页面上，避免"白屏但不知道原因"
function showError(msg){
  let el=document.getElementById('boot-error');
  if(!el){el=document.createElement('pre');el.id='boot-error';
    el.style.cssText='position:fixed;left:12px;bottom:12px;z-index:999999;max-width:70vw;max-height:40vh;overflow:auto;margin:0;padding:10px 12px;background:#fff3f2;color:#7a1d16;border:1px solid #e6b3ad;border-radius:8px;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap';
    document.body.appendChild(el);}
  el.textContent='页面出错：'+msg;
}
addEventListener('error',e=>showError((e.message||'')+' @ '+(e.filename||'').split('/').pop()+':'+e.lineno));
addEventListener('unhandledrejection',e=>showError(String(e.reason&&e.reason.message||e.reason)));

import {shouldUse3D} from './campus-model.js';

// This tiny entry point runs before importing Three.js, scene code, textures or layout data.
const coarse=matchMedia('(pointer: coarse)');
const eligible=()=>shouldUse3D({width:innerWidth,coarse:coarse.matches});
let cleanup=null,loading=false,revision=0,failed=false;
async function sync(){
  const desktop=eligible();document.body.dataset.mobile=String(!desktop);
  document.querySelector('.explorer').hidden=!desktop;
  document.getElementById('mobile-notice').hidden=desktop;
  if(!desktop){revision++;cleanup?.();cleanup=null;failed=false;return;}
  if(cleanup||loading||failed)return;
  loading=true;const token=++revision;
  try{
    const {startCampus}=await import('./campus-app.js');
    if(token!==revision||!eligible())return;
    const stop=await startCampus();
    if(token!==revision||!eligible())stop?.();else{cleanup=stop;failed=!stop;}
  }catch(error){
    failed=true;const label=document.querySelector('#loading b');if(label)label.textContent='场景资源加载失败，请刷新重试。';console.error(error);
  }finally{
    loading=false;
    if(token!==revision&&eligible())sync();
  }
}
addEventListener('resize',sync);coarse.addEventListener('change',sync);sync();
