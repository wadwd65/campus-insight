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
  return coarse || memory<=4 || reduced ? 'low' : memory>=8 ? 'high' : 'balanced';
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

// A shared cross-section at each bend keeps adjacent walking surfaces flush.
export function closedRibbon(points,width){
  const left=[],right=[],half=width/2;
  for(let i=0;i<points.length;i++){
    const a=points[(i+points.length-1)%points.length],p=points[i],b=points[(i+1)%points.length];
    const al=Math.hypot(p[0]-a[0],p[1]-a[1]),bl=Math.hypot(b[0]-p[0],b[1]-p[1]);
    const n1=[-(p[1]-a[1])/al,(p[0]-a[0])/al],n2=[-(b[1]-p[1])/bl,(b[0]-p[0])/bl];
    const length=Math.hypot(n1[0]+n2[0],n1[1]+n2[1]);
    const normal=length>1e-6?[(n1[0]+n2[0])/length,(n1[1]+n2[1])/length]:n2;
    const reach=Math.min(half*2,half/Math.max(.5,normal[0]*n2[0]+normal[1]*n2[1]));
    left.push([p[0]+normal[0]*reach,p[1]+normal[1]*reach]);right.push([p[0]-normal[0]*reach,p[1]-normal[1]*reach]);
  }
  return {left,right};
}
export function stadiumOutline(x,z,width,depth){
  const radius=width/2,straight=(depth-width)/2,out=[];
  for(const [center,start]of [[-straight,Math.PI],[straight,0]])for(let i=0;i<=16;i++){
    const a=start+i*Math.PI/16;out.push([x+Math.cos(a)*radius,z+center+Math.sin(a)*radius]);
  }
  return out;
}
export function polygonRoadClearance(points,data){
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  let margin=Infinity;
  for(const road of data.roads)for(let j=1;j<road.pts.length;j++){
    const world=p=>[(p[0]-data.transform.ox)*data.transform.k,(p[1]-data.transform.oz)*data.transform.k];
    const a=world(road.pts[j-1]),b=world(road.pts[j]);
    if(insidePolygon(...a,points)||insidePolygon(...b,points))return -road.w/2;
    for(let i=0;i<points.length;i++){
      const c=points[i],d=points[(i+1)%points.length];
      const intersects=cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
      const distance=intersects?0:Math.min(segmentDistance(...a,c,d),segmentDistance(...b,c,d),segmentDistance(...c,a,b),segmentDistance(...d,a,b));
      margin=Math.min(margin,distance-road.w/2);
    }
  }
  return margin;
}
export function stadiumPlan(data){
  const x=(data.track.px-data.transform.ox)*data.transform.k,z=(data.track.py-data.transform.oz)*data.transform.k;
  const rect=(cx,cz,w,d)=>[[cx-w/2,cz-d/2],[cx+w/2,cz-d/2],[cx+w/2,cz+d/2],[cx-w/2,cz+d/2]];
  const make=scale=>{
    const width=data.track.L*data.transform.k*scale,depth=data.track.W*data.transform.k*scale;
    const podium=stadiumOutline(x,z,width+7,depth+7),fixtures=[];
    for(const side of [-1,1])fixtures.push(rect(x+side*(width/2+2),z,2,depth*.68));
    for(let row=0;row<4;row++)fixtures.push(rect(x-width/2-3.3-row*1.1,z,1.05,depth*.52));
    return {x,z,width,depth,podium,outline:stadiumOutline(x,z,width,depth),fixtures,scale};
  };
  // Keep the calibrated centre and road network; fit the illustrative envelope.
  const clearance=plan=>Math.min(...[plan.podium,...plan.fixtures].map(p=>polygonRoadClearance(p,data)));
  let low=0,high=1;if(clearance(make(0))<3.6)throw new Error('No safe stadium envelope at calibrated centre');
  if(clearance(make(1))>=3.6)low=1;else for(let i=0;i<24;i++){const mid=(low+high)/2;if(clearance(make(mid))>=3.6)low=mid;else high=mid;}
  const plan=make(low);return {...plan,clearance:clearance(plan)};
}
