export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function shouldUse3D({width,coarse=false}) {
  return width>760 && (!coarse || width>1024);
}
export const QUALITY = {
  low: { label:'省电', dpr:1, moveDpr:.85, pixels:1500000, movingPixels:1050000, shadows:false, shadowSize:0 },
  balanced: { label:'标准', dpr:1.6, moveDpr:1, pixels:4200000, movingPixels:1700000, shadows:false, shadowSize:0 },
  high: { label:'清晰', dpr:2, moveDpr:1.2, pixels:6000000, movingPixels:2400000, shadows:false, shadowSize:0 },
};
export function renderPlan({width,height,quality='balanced',moving=false,maxSide=4096}) {
  width=clamp(Number.isFinite(width)?Math.round(width):1,1,32768);
  height=clamp(Number.isFinite(height)?Math.round(height):1,1,32768);
  maxSide=clamp(Number.isFinite(maxSide)?maxSide:4096,1,4096);
  const q=QUALITY[quality]||QUALITY.low,budget=moving?q.movingPixels:q.pixels;
  const ratio=Math.min(moving?q.moveDpr:q.dpr,Math.sqrt(budget/(width*height)),maxSide/width,maxSide/height);
  const dpr=Math.max(.00001,Math.floor(ratio*100000)/100000);
  return {width,height,dpr,pixelWidth:Math.max(1,Math.floor(width*dpr)),pixelHeight:Math.max(1,Math.floor(height*dpr)),mode:moving?'moving':'still'};
}
export function clipPlanes(distance){
  distance=clamp(Number.isFinite(distance)?distance:650,95,1550);
  return {near:distance*.1,far:Math.max(1200,distance+750)};
}
export function initialQuality({ coarse=false, memory=8, reduced=false }={}) {
  return coarse || memory<=4 || reduced ? 'low' : 'balanced';
}
export function constrainView(view) {
  return { ...view, elevation:clamp(view.elevation,.28,1.45), distance:clamp(view.distance,95,1550),
    x:clamp(view.x,-260,260), z:clamp(view.z,-260,260) };
}
export function insidePolygon(x,y,points) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
export function fitDistance(aspect) {
  // Keep side clearance in a narrow pane; use the height of a wide canvas
  // instead of leaving the campus as a small object in a large empty field.
  const radius=310-50*clamp((aspect-1)/.5,0,1);
  return clamp(radius / Math.sin(Math.atan(Math.tan(Math.PI/8)*Math.min(aspect,1))),650,1500);
}
export function detailView(place,view,{roof=false}={}) {
  // Face the feature side instead of inheriting an unrelated campus orbit.
  const rearEntry=['canteen','gym'].includes(place.type)||place.id==='cscenter';
  const azimuth=place.id==='lib'?Math.PI/2+.22:(place.rotation||0)+(rearEntry?Math.PI+.35:.4);
  const distance=place.id==='lib'?145:Math.max(95,Math.max(place.width,place.depth)*2.4);
  return constrainView({...view,x:place.x,z:place.z,azimuth,distance,elevation:roof?1.24:.6});
}
export function segmentDistance(x,y,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy || 1),0,1);
  return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);
}
