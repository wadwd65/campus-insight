/* 排除覆盖平面/阴影层后的真实实体地面检测 */
(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(6500);
 const T=window.__T,scene=window.__scene,campus=window.__campus;
 const skip=/^(road-network|static-sun-shadow|ground|continuous-site-surfaces|water|lake)/;
 const rc=new T.Raycaster(),down=new T.Vector3(0,-1,0);
 const out=[];
 for(const t of campus.targets||[]){
  rc.set(new T.Vector3(t.x,12,t.z),down);
  const hits=rc.intersectObjects(scene.children,true).filter(h=>h.object.visible&&h.object.geometry&&!skip.test(h.object.name||''));
  const solid=hits.find(h=>/^(box:|facade:|panel:|track|podium|terrace:|portal:|screen:|hip:)/.test(h.object.name||''));
  out.push({id:t.id,x:+t.x.toFixed(1),z:+t.z.toFixed(1),
   solidTop:solid?+solid.point.y.toFixed(3):null,solidName:solid?(solid.object.name||'').slice(0,30):null,
   hitCount:hits.length,firstNames:[...new Set(hits.slice(0,3).map(h=>h.object.name||h.object.type))]});
 }
 return JSON.stringify({count:out.length,places:out});})()
