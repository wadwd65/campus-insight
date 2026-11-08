/* 11-06 钓鱼帧率改造
 * 病根：createFishing 内部有一条无条件 rAF（loop），active 时每帧 update()；
 *       updateViewmodel() 末尾又 requestRender() → 主 render()；
 *       主 render() 里再调一次 fishing.update(dtF) → 又一次 updateViewmodel + requestRender。
 *       结果：一次状态推进跑两遍、updateProximity 的湖多边形遍历跑两遍，
 *       且只要在第一人称，整场景就被按满帧顶着渲染（11-04 的水面节流被完全绕过）。
 * 改法：单一时钟（只由主 render 推进）+ 按状态限频 30fps + 待机不续帧。
 *
 * 输入：C:/Users/123/Desktop/校园3D-唯一版.html（只读）
 * 输出：D:/repro-test/latest3d-fps.html
 */
const fs = require('fs');
const SRC = 'C:/Users/123/Desktop/校园3D-唯一版.html';
const DST = 'D:/repro-test/latest3d-fps.html';

let s = fs.readFileSync(SRC, 'utf8');
const orig = s.length;
function sub(from, to, label) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`[${label}] 期望 1 处，实际 ${n} 处：${from.slice(0, 80)}`);
  s = s.replace(from, to);
  console.log('  ✓', label);
}

/* ① 视模型不再反向请求渲染 */
sub(
`    /* 视模型每帧变化，必须主动请求重绘（应用默认是"按需绘制"） */
    if (typeof requestRender === 'function') requestRender();
    else if (ctx.requestRender) ctx.requestRender();
  }`,
`    /* 11-06 帧率：不再自行 requestRender。渲染统一由主循环的钓鱼节拍调度，
       否则钓鱼 rAF 与主 render 互相喂帧，静止时也满帧渲染整个校园。 */
  }`,
  '去掉 updateViewmodel 的反向 requestRender'
);

/* ② 删掉钓鱼自带的无条件 rAF 循环 */
sub(
`  /* 10-31 自带 rAF：应用是静止·按需绘制，渲染循环不保证每帧都跑，
     钓鱼的浮漂/涟漪必须自己驱动，否则状态机会卡在 flying。 */
  let rafLast = 0;
  function loop(t) {
    if (active) {
      const dt = rafLast ? Math.min(.05, (t - rafLast) / 1000) : 0;
      rafLast = t;
      update(dt);
    } else rafLast = 0;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);`,
`  /* 11-06：删掉这条无条件 rAF。它让 update() 被钓鱼与主 render 各推一次，
     且 update 内还 requestRender —— 是"静止也满帧"的根因。
     现在状态机只由主 render() 的钓鱼节拍驱动。 */`,
  '删除钓鱼自带 rAF'
);

/* ③ 湖边距离判定降频（原来每帧遍历整个湖多边形，还跑两遍） */
sub(
`  function update(dt) {
    if (!active) return;
    updateViewmodel(dt);
    updateProximity();
    timer += dt;`,
`  let proxClock = 0;
  function update(dt) {
    if (!active) return;
    updateViewmodel(dt);
    /* 11-06：distToLake 要遍历湖多边形，5Hz 足够判断"是否到湖边" */
    proxClock += dt;
    if (proxClock >= .2) { proxClock = 0; updateProximity(); }
    timer += dt;`,
  'updateProximity 降到 5Hz'
);

/* ④ 激活瞬间立即算一次距离，避免进水后 0.2s 才出现甩杆 UI */
sub(
`    setActive(v) {
      active = !!v;
      ui.style.display = active ? 'block' : 'none';
      if (!active) {`,
`    setActive(v) {
      active = !!v;
      ui.style.display = active ? 'block' : 'none';
      proxClock = 0;
      if (active) updateProximity();
      if (!active) {`,
  'setActive 立即判定'
);

/* ⑤ 对外暴露"是否还有动画要跑"，主循环据此决定续不续帧 */
sub(
`    update,
    spawnPreview(color){`,
`    update,
    /* 11-06：纯待机返回 false ⇒ 主循环不续帧，恢复"静止·按需绘制" */
    needsFrame(){
      if(!active)return false;
      if(animMode!=='idle')return true;
      if(state!=='idle')return true;
      if(typeof ripple!=='undefined'&&ripple&&ripple.visible)return true;
      if(previewFish)return true;
      if(dropped&&dropped.length)return true;
      return false;
    },
    spawnPreview(color){`,
  '暴露 needsFrame'
);

/* ⑥ 主 render 开头：钓鱼节拍闸门（无其它交互时最多 30fps） */
sub(
`function render(time){
  state.frame=0;if(state.disposed||document.hidden||state.contextLost)return;
  const moving=state.auto||state.flight||state.benchmark||walkNeedsFrame()||(walking&&time<state.interactionUntil);`,
`function render(time){
  state.frame=0;if(state.disposed||document.hidden||state.contextLost)return;
  /* 11-06 钓鱼节拍闸门：没有其它交互时，钓鱼动画最多 30fps 出帧；
     纯待机 needsFrame()=false，不续帧 ⇒ 静止时 0 帧。 */
  const fishBusy=!!(fishing&&fishing.needsFrame());
  const interactive=state.auto||state.flight||state.benchmark||walkNeedsFrame()||state.dragging||time<state.interactionUntil;
  if(fishBusy&&!interactive&&time-(state.lastFishPaint||0)<33){requestRender();return;}
  if(fishBusy&&!interactive)state.lastFishPaint=time;
  const moving=state.auto||state.flight||state.benchmark||walkNeedsFrame()||(walking&&time<state.interactionUntil);`,
  '主 render 加钓鱼节拍闸门'
);

/* ⑦ 钓鱼状态机收归单一驱动 */
sub(
`  /* 10-31 钓鱼：漫游时才激活；每帧推进状态机 */
  if(fishing){
    const nowF=performance.now();const dtF=fishLastT?Math.min(.05,(nowF-fishLastT)/1000):0;fishLastT=nowF;
    if(fishingAct!==!!walking){fishingAct=!!walking;fishing.setActive(fishingAct);}
    if(fishingAct)fishing.update(dtF);
  }`,
`  /* 11-06 钓鱼：状态机只在这里推进一次；出帧间隔已由开头闸门限到 33ms。
     旧代码这里推一次、钓鱼自己的 rAF 再推一次，浮漂/涟漪实际是双倍速。 */
  if(fishing){
    if(fishingAct!==!!walking){fishingAct=!!walking;fishing.setActive(fishingAct);fishLastT=0;}
    if(fishingAct){
      const nowF=performance.now();
      const dtF=fishLastT?Math.min(.05,(nowF-fishLastT)/1000):0;
      fishLastT=nowF;
      fishing.update(dtF);
    }else fishLastT=0;
  }`,
  '钓鱼状态机单一驱动'
);

/* ⑧ 续帧条件：末尾重新读 needsFrame（不能复用开头算的，setActive 可能在本次才生效） */
sub(
`  if(state.auto||state.flight||state.benchmark||walkNeedsFrame())requestRender();`,
`  if(state.auto||state.flight||state.benchmark||walkNeedsFrame()||(fishing&&fishing.needsFrame()))requestRender();`,
  '末尾按需续帧'
);

fs.writeFileSync(DST, s, 'utf8');
console.log('---');
console.log('源文件', orig, '字符 → 输出', s.length, '字符（', s.length - orig, '）');
console.log('已写', DST);
