(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(6500);
 const T=window.__T,scene=window.__scene;const m=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();
 const big=[];scene.traverse(o=>{if(!o.isInstancedMesh||o.name!=='box:road')return;
  for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);m.decompose(p,q,s);
   if(Math.abs(s.x-s.z)<0.01&&s.x>10)big.push({i,x:+p.x.toFixed(1),z:+p.z.toFixed(1),side:+s.x.toFixed(1)});}});
 return JSON.stringify({bigCount:big.length,sample:big.slice(0,12),maxSide:big.length?Math.max(...big.map(b=>b.side)):0});})()
