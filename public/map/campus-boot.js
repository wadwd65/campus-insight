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
