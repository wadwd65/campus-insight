(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(6500);
 const T=window.__T,scene=window.__scene;const m=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();
 const ys={},tops={};scene.traverse(o=>{if(!o.isInstancedMesh||!/^(box:road|box:sidewalk)$/.test(o.name||''))return;
  for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);m.decompose(p,q,s);const k=+p.y.toFixed(3);ys[o.name+':'+k]=(ys[o.name+':'+k]||0)+1;
   const t=+(p.y+s.y/2).toFixed(3);tops[o.name+':'+t]=(tops[o.name+':'+t]||0)+1;}});
 return JSON.stringify({centerY:ys,topY:tops});})()
