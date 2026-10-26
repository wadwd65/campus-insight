export const WATER_INTERVAL_MS=250;

export function waterMotionAllowed({enabled=true,quality='balanced',memory=8,reduced=false,hidden=false,visible=true,disposed=false,contextLost=false,budgetPaused=false}={}){
  return enabled&&quality!=='low'&&memory>4&&!reduced&&!hidden&&visible&&!disposed&&!contextLost&&!budgetPaused;
}

// One wakeup at a time. A full camera render resets the deadline, so water never
// adds another animation loop while the user is moving around the campus.
export function createWaterClock({isAllowed,render,schedule=setTimeout,cancel=clearTimeout}){
  let timer=null,revision=0,disposed=false;
  function stop(){revision++;if(timer!==null)cancel(timer);timer=null;}
  function sync(){
    stop();if(disposed||!isAllowed())return;
    const token=revision;
    timer=schedule(()=>{if(disposed||token!==revision)return;timer=null;if(isAllowed())render();},WATER_INTERVAL_MS);
  }
  return {sync,stop,get active(){return timer!==null;},dispose(){disposed=true;stop();}};
}

// Reuse the original polygon, UVs, texture and lighting pass. Only the pigment
// changes very slightly; no reflection target, extra mesh or texture upload.
export function createWaterMaterial(T,map=null){
  const time={value:0};
  const material=new T.MeshPhongMaterial({color:0xffffff,map,shininess:48,specular:0x44483c});
  material.userData.rippleTime=time;
  material.onBeforeCompile=shader=>{
    shader.uniforms.campusWaterTime=time;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float campusWaterTime;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      #ifdef USE_UV
        float t=campusWaterTime;
        float phase=vUv.y*160.0+sin(vUv.x*23.0+t*.19)*1.3-t*.8;
        float crest=pow(.5+.5*sin(phase),10.0);
        float fragments=smoothstep(.25,.85,.5+.5*sin(vUv.x*44.0-t*.12));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.83,.79,.66),crest*fragments*.018);
        diffuseColor.rgb*=.997+.003*sin(vUv.x*27.0+vUv.y*19.0-t*.25);
      #endif`);
  };
  material.customProgramCacheKey=()=> 'campus-subtle-water-v1';
  return material;
}
