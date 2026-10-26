import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'map-src'),target=path.join(root,'public/map');
// Do not import positions from the legacy tower map: the user rejected that layout.
const layout=JSON.parse(fs.readFileSync(path.join(source,'campus-layout.json'),'utf8'));
const references=JSON.parse(fs.readFileSync(path.join(source,'building-reference.json'),'utf8'));
const places=layout.places.map(p=>{
  const style=p.type==='dorm'?'dorm':p.id==='cscenter'?'technology':p.id==='tuoxin'?'tuoxin':p.id.startsWith('teach-')?'teaching':p.id.startsWith('lab-')?'lab':p.type==='teaching'?'complex':p.type;
  const architecture=['dorm','teaching','library','gym','canteen','shop'].includes(p.type)?{style,mode:references.mode,...references.profiles[style],...references.overrides?.[p.id]}:null;
  return {rotation:0,floors:5,shape:null,wingLength:32,courtWidth:16,...p,key:p.id,architecture};
});
if(new Set(places.map(p=>p.key)).size!==places.length)throw new Error('Duplicate campus place id');
if(!layout.reference||layout.boundary.length<3||layout.lake.length<3)throw new Error('Missing layout reference or polygon');
for(const p of places)if(!Number.isFinite(p.px)||!Number.isFinite(p.py))throw new Error('Invalid place position: '+p.id);
fs.mkdirSync(target,{recursive:true});
for(const name of ['campus-boot.js','campus-app.js','campus-scene.js','campus-model.js','campus-lighting.js','campus-water.js','campus-walk.js','campus-play.js','campus-character.js','campus-visibility.js','campus-performance.js','campus-detail.js','campus-atmosphere.js','campus-textures.js','campus.css'])fs.copyFileSync(path.join(source,'web',name),path.join(target,name));
fs.copyFileSync(path.join(source,'web','index.html'),path.join(target,'校园地图-3D实景.html'));
fs.copyFileSync(path.join(source,'three-packed.js'),path.join(target,'three-r149.min.js'));
fs.writeFileSync(path.join(target,'campus-data.json'),JSON.stringify({...layout,places}));
console.log(`3D web map: ${places.length} reference-marked places + lake + track; no legacy layout.`);
