import {CAMPUS_POSITIONS} from './campusJourney.js';
// Public map coordinates are entrance anchors. Paths follow the shared street grid.
export const CAMPUS_STREETS=[
 [[70,160],[945,160]],[[70,250],[500,250]],[[500,325],[945,325]],
 [[70,375],[500,375]],[[70,480],[500,480]],[[600,480],[945,480]],[[70,580],[945,580]],
 [[230,160],[230,580]],[[500,65],[500,580]],[[600,160],[600,580]],[[945,160],[945,580]],
];
export const CAMPUS_ACCESS={library:[240,160],lab:[430,160],late_class:[380,250],court:[730,160],gym:[880,325],field:[690,325],lake:[600,409.6],canteen:[600,492.8],nightmarket:[800,580],convenience:[420,580],printshop:[360,480],dorm:[140,375],rooftop:[130,250],club:[330,375],station:[150,580],intern:[150,480]};
const key=point=>point.join(','),equal=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const on=(p,[a,b])=>a[0]===b[0]?p[0]===a[0]&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]):p[1]===a[1]&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0]);
const points=new Map(),graph=new Map();
function add(point){points.set(key(point),point);}
for(const street of CAMPUS_STREETS)street.forEach(add);
Object.values(CAMPUS_ACCESS).forEach(add);
for(const h of CAMPUS_STREETS.filter(([a,b])=>a[1]===b[1]))for(const v of CAMPUS_STREETS.filter(([a,b])=>a[0]===b[0])){const p=[v[0][0],h[0][1]];if(on(p,h)&&on(p,v))add(p);}
for(const point of points.values())graph.set(key(point),[]);
for(const street of CAMPUS_STREETS){const stops=[...points.values()].filter(p=>on(p,street)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);for(let i=1;i<stops.length;i++){const a=stops[i-1],b=stops[i],cost=Math.hypot(a[0]-b[0],a[1]-b[1]);graph.get(key(a)).push({to:key(b),cost});graph.get(key(b)).push({to:key(a),cost});}}
const cache=new Map();
export function campusLeg(from,to){
 if(!CAMPUS_ACCESS[from]||!CAMPUS_ACCESS[to])return [];
 const cacheKey=from+'>'+to;if(cache.has(cacheKey))return cache.get(cacheKey).map(p=>[...p]);
 const start=key(CAMPUS_ACCESS[from]),end=key(CAMPUS_ACCESS[to]),distance=new Map([[start,0]]),previous=new Map(),queue=new Set(graph.keys());
 while(queue.size){let current=null;for(const candidate of queue)if(current===null||(distance.get(candidate)??Infinity)<(distance.get(current)??Infinity))current=candidate;if(!Number.isFinite(distance.get(current)))break;queue.delete(current);if(current===end)break;for(const edge of graph.get(current)){const next=distance.get(current)+edge.cost;if(next<(distance.get(edge.to)??Infinity)){distance.set(edge.to,next);previous.set(edge.to,current);}}}
 if(!distance.has(end))return [];
 const streetPoints=[];for(let current=end;current;current=previous.get(current)){streetPoints.unshift(points.get(current));if(current===start)break;}
 const anchor=id=>[CAMPUS_POSITIONS[id][0]*10,CAMPUS_POSITIONS[id][1]*6.4];
 const route=from===to?[anchor(from)]:[anchor(from),...streetPoints,anchor(to)],clean=route.filter((point,i)=>!i||!equal(point,route[i-1]));
 cache.set(cacheKey,clean);return clean.map(p=>[...p]);
}
export function campusRoute(visits=[]){const ids=visits.map(v=>typeof v==='string'?v:v.id).filter(id=>CAMPUS_ACCESS[id]);if(!ids.length)return [];if(ids.length===1)return [[CAMPUS_POSITIONS[ids[0]][0]*10,CAMPUS_POSITIONS[ids[0]][1]*6.4]];return ids.slice(1).flatMap((id,index)=>{const leg=campusLeg(ids[index],id);return index?leg.slice(1):leg;});}
export function pathPoints(points){return points.map(p=>p.join(',')).join(' ');}
export function walkingFrames(from,to){const route=campusLeg(from,to);if(!route.length)return '';const lengths=route.map((point,i)=>i?Math.hypot(point[0]-route[i-1][0],point[1]-route[i-1][1]):0),total=lengths.reduce((a,b)=>a+b,0);let done=0;return route.map((p,i)=>{done+=lengths[i];return `${total?(done/total*100).toFixed(3):100}%{transform:translate(${(p[0]/10).toFixed(3)}%,${(p[1]/6.4).toFixed(3)}%)}`;}).join('');}
