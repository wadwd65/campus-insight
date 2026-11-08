/* 把「按建筑×部位贴图」注入桌面 3D 唯一版
 * 输入：C:/Users/123/Desktop/校园3D-唯一版.html（只读）
 * 输出：D:/repro-test/latest3d-pb.html（验证通过后再由人工/后续脚本写回桌面）
 * 用法：node D:/repro-test/patch-per-building.cjs
 */
const fs = require('fs');

const SRC = 'C:/Users/123/Desktop/校园3D-唯一版.html';
const DST = 'D:/repro-test/latest3d-pb.html';
const RUNTIME = 'D:/repro-test/pb-runtime.js';
const DETAIL = 'D:/repro-test/pb-detail.json';

let s = fs.readFileSync(SRC, 'utf8');
const origLen = s.length;
const runtime = fs.readFileSync(RUNTIME, 'utf8');
const detail = JSON.parse(fs.readFileSync(DETAIL, 'utf8'));

/* 细节层用 base64 + atob 同步解码，避免 Image.onload 异步导致首帧空白 */
const detailExpr = `(()=>{const o=JSON.parse(\`${JSON.stringify(detail)}\`);` +
  `o.bytes=Uint8Array.from(atob(o.b64),ch=>ch.charCodeAt(0));delete o.b64;return o;})()`;
if (!runtime.includes('PB_DETAIL_JSON')) throw new Error('runtime 缺少 PB_DETAIL_JSON 占位');
const runtimeReady = runtime.replace('PB_DETAIL_JSON', detailExpr);

/* 每个替换都做唯一性断言 —— 静默替换错位置比报错危险得多 */
function sub(from, to, label) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`[${label}] 期望 1 处，实际 ${n} 处：${from.slice(0, 70)}`);
  s = s.replace(from, to);
  console.log('  ✓', label);
}

/* ① 全局 runtime 插到 buildCampusScene 定义之前 */
sub(
  'function buildCampusScene(T,data,textures={}) {',
  runtimeReady + '\nfunction buildCampusScene(T,data,textures={}) {\n  const PB_SPEC=new Map(); /* 11-05 每栋楼的真实层高/开间参数，由 wing() 回填 */',
  '注入 runtime + PB_SPEC'
);

/* ② wing() 里记录真实几何参数（单一真源：不重算、不猜） */
sub(
  'const nL=Math.max(2,Math.round(bd/bayW));',
  'const nL=Math.max(2,Math.round(bd/bayW));\n    /* 11-05：贴图要按这栋楼真实层高画，参数在此登记，不另起一套计算 */\n    if(!PB_SPEC.has(p.key))PB_SPEC.set(p.key,{h,floors,gH,upH,nL,bw,bd,zone});',
  'wing() 回填 PB_SPEC'
);

/* ③ 批次按「建筑 owner」分槽（只对 4 类部位材质，其他构件仍共用） */
sub(
  'const id=kind+\':\'+material;',
  'const PB_part=PB_MAT2PART[material];\n    const id=kind+\':\'+material+((PB_part&&key)?\':\'+key:\'\');',
  '批次 id 带 owner'
);

/* ④ 所有 add() 跑完后、InstancedMesh 构建前，生成图集与材质克隆 */
sub(
  'const pickables=[],shadowCasters=[];',
  `/* 11-05：每栋楼 4 张专属贴图。图集一份 source，材质克隆用 offset/repeat 取格，
     既不新增 shader 变体也不额外上传纹理。 */
  const PB_places=data.places.filter(p=>PB_TYPES.has(p.type));
  const PB_atlas=PB_buildAtlas(T,PB_places,PB_SPEC);
  const PB_tex=new Map();
  for(const p of PB_places)for(const part of PB_PARTS){
    const uv=PB_atlas.slot.get(p.key+'/'+part);if(!uv)continue;
    const t=PB_atlas.tex.clone();
    t.offset.set(uv[0],uv[1]);t.repeat.set(uv[2],uv[3]);t.needsUpdate=true;
    PB_tex.set(p.key+'/'+part,t);
  }
  const PB_matCache=new Map();
  function PB_material(baseName,key){
    const part=PB_MAT2PART[baseName];
    if(!part)return materials[baseName];
    const t=PB_tex.get(key+'/'+part);
    if(!t)return materials[baseName];
    const ck=baseName+'@'+key;
    let m=PB_matCache.get(ck);
    if(!m){
      m=materials[baseName].clone();
      m.map=t;m.normalMap=null;
      m.color.setHex(0xffffff); /* 贴图×color 双重相乘会洗色 ⇒ 有贴图必须白 */
      m.needsUpdate=true;
      PB_matCache.set(ck,m);
    }
    return m;
  }
  const pickables=[],shadowCasters=[];`,
  '生成图集与材质克隆'
);

/* ⑤ InstancedMesh 按 owner 取专属材质；阴影/白名单判断仍用第 2 段 material */
sub(
  'const[kind,material]=id.split(\':\'),geometry=',
  'const[kind,material,owner]=id.split(\':\'),geometry=',
  '解构 owner'
);
sub(
  'mesh=new T.InstancedMesh(geometry,materials[material],objects.length);',
  'mesh=new T.InstancedMesh(geometry,owner?PB_material(material,owner):materials[material],objects.length);',
  '按 owner 取材质'
);

/* ⑥ 释放克隆出来的 texture / material，避免反复切画质时泄漏 */
sub(
  'dispose(){visibility.dispose();',
  'dispose(){visibility.dispose();PB_tex.forEach(t=>t.dispose());PB_atlas.tex.dispose();PB_matCache.forEach(m=>m.dispose());',
  '补 dispose'
);

fs.writeFileSync(DST, s, 'utf8');
console.log('---');
console.log('源文件', origLen, 'B → 输出', s.length, 'B（+', s.length - origLen, 'B）');
console.log('细节层格数 =', detail.count, '，建筑 =', detail.count / 4);
console.log('已写', DST);
