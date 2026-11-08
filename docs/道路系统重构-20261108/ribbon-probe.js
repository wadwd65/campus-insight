(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(6500);
 const scene=window.__scene;let ribbons=[],oldBoxes=0,tris=0,joints=0;
 scene.traverse(o=>{
  if(/^(road|sidewalk)-ribbon-/.test(o.name||'')){
   const g=o.geometry;const n=g.index?g.index.count/3:(g.attributes.position?g.attributes.position.count/3:0);
   ribbons.push({name:o.name,tris:n,joints:(o.userData.joints||[]).length,y:o.position.y});
   tris+=n;joints+=(o.userData.joints||[]).length;
  }
  if(o.isInstancedMesh&&/^box:(road|sidewalk)$/.test(o.name||''))oldBoxes+=o.count;
 });
 return JSON.stringify({ribbonMeshes:ribbons.length,totalTriangles:tris,totalJoints:joints,
  legacyBoxInstances:oldBoxes,ribbons:ribbons.slice(0,12)});})()
