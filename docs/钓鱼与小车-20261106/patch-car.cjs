/* 按轮次替换 createCampusCar 整段（第一遍形体 / 第二遍细节）
 * 用法：node patch-car.cjs 1   → latest3d-car1.html
 *       node patch-car.cjs 2   → latest3d-car2.html
 * 基线：latest3d-fps.html（已含 11-06 钓鱼帧率改造 + 11-05 按楼贴图）
 */
const fs = require('fs');
const stage = Number(process.argv[2] || 1);
if (![1, 2].includes(stage)) throw new Error('stage 只能是 1 或 2');

const SRC = 'D:/repro-test/latest3d-fps.html';
const DST = `D:/repro-test/latest3d-car${stage}.html`;
const BODY = `D:/repro-test/car-v${stage}.js`;

let s = fs.readFileSync(SRC, 'utf8');
const body = fs.readFileSync(BODY, 'utf8').trimEnd();
const startMark = 'function createCampusCar(T,car){';
const endMark = '\nfunction createCampusInterior(';
const a = s.indexOf(startMark);
const b = s.indexOf(endMark, a);
if (a < 0 || b < 0 || b <= a) throw new Error('找不到 createCampusCar 的起止边界');
const oldLen = b - a;
s = s.slice(0, a) + body + s.slice(b);

function sub(from, to, label) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`[${label}] 期望 1 处，实际 ${n} 处`);
  s = s.replace(from, to);
  console.log('  ✓', label);
}

/* 第二遍顺手修钓鱼视模型的视角错位：跟车/第三人称时不该出现第一人称鱼竿。
   ★ 视角状态必须由外层 getter 直接传：#runtime.dataset.personView 是在 render 末尾
     才写的，updateViewmodel 在 render 中部就读 → 慢一帧；静止不续帧后永远停在旧值。 */
if (stage === 2) {
  sub(
`  function updateViewmodel(dt) {
    if (!holder) return;
    holder.position.copy(camera.position);
    holder.quaternion.copy(camera.quaternion);`,
`  function updateViewmodel(dt) {
    if (!holder) return;
    /* 11-06：跟车视角 / 第三人称时不该出现第一人称鱼竿。 */
    const third=!!(ctx.getThirdPerson&&ctx.getThirdPerson());
    holder.visible = !third;
    holder.position.copy(camera.position);
    holder.quaternion.copy(camera.quaternion);`,
    '第三人称隐藏鱼竿（无滞后 getter）'
  );
  sub(
`      const show = bobber && bobber.visible;
      lineObj.visible = !!show;`,
`      const show = bobber && bobber.visible && !third;
      lineObj.visible = !!show;`,
    '第三人称隐藏鱼线'
  );
  sub(
`      proxClock = 0;
      if (active) updateProximity();
      if (!active) {`,
`      proxClock = 0;
      /* 退出漫游时立刻收起鱼竿/鱼线，别把它留在场景里 */
      if(holder)holder.visible=!!active;
      if(lineObj&&!active)lineObj.visible=false;
      if (active) updateProximity();
      if (!active) {`,
    'setActive 同步可见性'
  );
  sub(
`    fishing=createFishing(T,{scene,camera,getPlayer:()=>walking,lakeWorld});window.__fish=fishing;`,
`    fishing=createFishing(T,{scene,camera,getPlayer:()=>walking,lakeWorld,
      getThirdPerson:()=>driving?carView==='third':(!!walking&&walkView==='third')});window.__fish=fishing;`,
    '外层传入视角 getter'
  );
}

fs.writeFileSync(DST, s, 'utf8');
console.log(`stage ${stage}: 替换 ${oldLen} → ${body.length} 字符`);
console.log('输出', DST, s.length, '字符');
