(async()=>{await new Promise(r=>setTimeout(r,9000));
 const r=document.getElementById('runtime'),q=document.getElementById('quality'),c=document.querySelector('#scene canvas');
 const out={quality:r?r.dataset.quality:null,qualitySelect:q?q.value:null,
  canvas:[c?c.width:null,c?c.height:null],css:[c?c.clientWidth:null,c?c.clientHeight:null],
  depthBits:r?r.dataset.depthBits:null,frames:r?r.dataset.frames:null,
  deviceMemory:navigator.deviceMemory,cores:navigator.hardwareConcurrency,
  effectiveType:(navigator.connection&&navigator.connection.effectiveType)||null};
 return JSON.stringify(out);})()
