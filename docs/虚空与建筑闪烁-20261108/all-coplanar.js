/* 全场景跨批次共面实例对统计（空间网格加速） */
(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(6500);
 const T=window.__T,scene=window.__scene;
 const m=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3(),e=new T.Euler();
 const faces=[];
 scene.traverse(o=>{if(!o.isInstancedMesh)return;
  for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);m.decompose(p,q,s);
   e.setFromQuaternion(q,'YXZ');const th=e.y;
   const hw=(Math.abs(Math.cos(th))*s.x+Math.abs(Math.sin(th))*s.z)/2;
   const hd=(Math.abs(Math.sin(th))*s.x+Math.abs(Math.cos(th))*s.z)/2;
   faces.push({n:o.name||'',i,x0:p.x-hw,x1:p.x+hw,z0:p.z-hd,z1:p.z+hd,top:p.y+s.y/2,bot:p.y-s.y/2});
  }});
 const cell=10,grid=new Map();
 faces.forEach((f,idx)=>{for(let gx=Math.floor(f.x0/cell);gx<=Math.floor(f.x1/cell);gx++)for(let gz=Math.floor(f.z0/cell);gz<=Math.floor(f.z1/cell);gz++){
  const k=gx+','+gz;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(idx);}});
 const pairs=new Map();let total=0;const seen=new Set();
 for(const arr of grid.values()){
  for(let a=0;a<arr.length;a++)for(let b=a+1;b<arr.length;b++){
   const A=faces[arr[a]],B=faces[arr[b]];if(A.n===B.n)continue;
   const key=arr[a]<arr[b]?arr[a]+'-'+arr[b]:arr[b]+'-'+arr[a];if(seen.has(key))continue;seen.add(key);
   if(Math.abs(A.top-B.top)>0.012&&Math.abs(A.bot-B.bot)>0.012)continue;
   const ox=Math.min(A.x1,B.x1)-Math.max(A.x0,B.x0),oz=Math.min(A.z1,B.z1)-Math.max(A.z0,B.z0);
   if(ox<=0.02||oz<=0.02)continue;
   const k=[A.n,B.n].sort().join(' × ');pairs.set(k,(pairs.get(k)||0)+1);total++;
  }}
 const top=[...pairs.entries()].sort((a,b)=>b[1]-a[1]).slice(0,18);
 return JSON.stringify({faceCount:faces.length,totalCoplanarPairs:total,top});})()
