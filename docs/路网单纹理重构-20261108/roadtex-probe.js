(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(6500);
 const scene=window.__scene;const m=scene.getObjectByName?scene.getObjectByName('road-network'):null;
 let o=null;if(!m)scene.traverse(x=>{if(x.name==='road-network')o=x;});
 const mesh=o||m;if(!mesh)return JSON.stringify({error:'no road-network mesh'});
 const cv=mesh.material.map&&mesh.material.map.image;
 if(!cv||!cv.getContext)return JSON.stringify({error:'no canvas image'});
 const g=cv.getContext('2d'),d=g.getImageData(0,0,cv.width,cv.height).data;
 let white=0,grey=0,yellow=0,opaque=0;
 for(let i=0;i<d.length;i+=4){const r=d[i],gg=d[i+1],b=d[i+2],a=d[i+3];if(a<128)continue;opaque++;
  if(r>195&&gg>195&&b>190)white++;
  else if(r<165&&gg<170&&b<170)grey++;
  else if(r>170&&gg>140&&b<175)yellow++;}
 return JSON.stringify({canvas:[cv.width,cv.height],opaque,white,grey,yellow,
  material:{type:mesh.material.type,alphaTest:mesh.material.alphaTest,transparent:mesh.material.transparent,color:mesh.material.color.getHexString(),y:mesh.position.y}});})()
