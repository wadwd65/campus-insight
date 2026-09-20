/**
 * 入场动画的分层数据 —— 纯函数，没有 React、没有 DOM。
 *
 * ── 2026-09-20 重写：从"平铺四层"改成"推镜穿过场景" ──────────────
 *
 * 上一版做的是四层**平铺**淡入（底/中景/粒子/前景各自淡入，各走各的漂移）。
 * 看完参考视频（B站 BV16N41117xb）之后发现那理解错了：
 * 参考的核心机制不是"多层淡入"，是**一个镜头持续往里推**，
 * 穿过一层一层的景深。区别在于：
 *
 *   平铺：所有层都在同一个平面上漂，深度感靠"速度差"假装出来
 *   推镜：各层按真实景深缩放，近处涨得快、远处涨得慢 —— 空间是真的
 *
 * 数学上就是：**各层共享一个推进量 t，但各自的缩放系数不同**。
 * 近处 scale 变化大（压过来），远处变化小（几乎不动）。
 * 这条在下面 `layerTransform()` 里，也是本文件唯一需要断言的核心逻辑。
 *
 * 另外补了一层参考里很显眼、上一版完全没有的东西：**飘浮物**
 * （蝴蝶/花瓣）—— 它们是横向飘过画面的小元素，给"一直在动"提供细节。
 */

/**
 * 确定性伪随机：同样的小数种子永远得到同一个 [0, 1) 值。
 *
 * 用 sin 的大数取小数部分是图形学里的老把戏 —— 便宜、无依赖、
 * 且相邻种子之间足够"散"。它不是密码学随机，这里也完全不需要。
 *
 * 为什么不能用 Math.random()：浏览器任何一次 re-render（字体加载完、
 * 窗口 resize、HMR）都会让整片元素瞬移。第一屏尤其致命。
 */
export function prand(i, k) {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * 景深层定义。
 *
 * `depth` 语义（与上一版刻意反过来，这版更直观）：
 *   0 = 最远（几乎不随推镜放大，像背景画），
 *   1 = 中景，
 *   2 = 最近（推镜时涨得最快，从画面边缘压过去）。
 *
 * `zoom` = 推镜到这个时间点时，该层相对初始的额外放大倍率。
 * 近处 zoom 大 = 压过来；远处 zoom 小 = 稳如背景。
 *
 * `drift` = 层自身的缓慢横移（px/整段）。用来制造"云在飘"的错觉 ——
 * 纯缩放会显得很机械，加一点横移就活了。
 */
export const SCENE_LAYERS = [
  { id: 'sky', depth: 0, label: '天空雾层', zoom: 1.06, drift: 14, asset: 'scene-sky.webp' },
  { id: 'arch', depth: 1, label: '建筑中景', zoom: 1.22, drift: 28, asset: 'scene-arch.webp' },
  { id: 'front', depth: 2, label: '前景藤蔓', zoom: 1.52, drift: 52, asset: 'scene-front.webp' },
];

/**
 * 推镜全程参数。
 *
 * 参考的推镜是**匀速慢推**，不是"先快后慢"（那种读起来像镜头在抖）。
 * 但完全匀速也假 —— 真实镜头有极轻微的加速度。所以用接近线性的
 * cubic-bezier 而不是 ease-in-out。
 *
 * 时长 34s 是刻意的：它**比入场动画本身（4.6s）长得多**。
 * 也就是说用户看完文字、点进终端时，镜头还在推。这不是浪费 ——
 * 只要这一屏还在，它就不该停；停下来才显得是"动画播完了"。
 */
export const PUSH = {
  durationMs: 34000,
};

/**
 * 计算某层在推进量 t（0~1）时的 transform。
 *
 * 这是本文件的核心规则，也是最该被断言的一条：
 * **depth 越大（越近），同一 t 下的放大倍率必须越大。**
 * 写反了不会报错，只会让画面"看起来有点怪"，肉眼极难定位 ——
 * 上一版就是这么错的（把"近处更快"写成了"近处更慢"）。
 *
 * @param {{zoom:number}} layer 层定义
 * @param {number} t 推进量 0~1
 * @returns {{scale:number, drift:number}} 该层的缩放与横移（drift 单位 %）
 */
export function layerTransform(layer, t) {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  // 从 1 线性推到该层的 zoom
  const scale = 1 + (layer.zoom - 1) * clamped;
  // 横移同步推进，方向由层决定（远处向右、近处向左 = 视差交错）
  const dir = layer.depth % 2 === 0 ? 1 : -1;
  const drift = layer.drift * clamped * dir;
  return { scale, drift };
}

/**
 * 检验一组层是否构成合法的视差：近处的 zoom 必须严格大于远处。
 * 抽出来是为了让自检直接调它，而不是在测试里重抄一遍判据。
 */
export function isParallaxOrdered(layers = SCENE_LAYERS) {
  for (let i = 1; i < layers.length; i += 1) {
    if (layers[i].zoom <= layers[i - 1].zoom) return false;
  }
  return true;
}

/**
 * 飘浮物（蝴蝶 / 花瓣）。
 *
 * 参考里这一类东西是画面"活着"的关键 —— 它们很小、很多、各自飘。
 * 上一版只有"一起往上飘的光点"，方向单一，看起来像雪花而不是空间。
 *
 * 这一版每个飘浮物有：
 *   - 独立的横向路径（从左到右或反过来，不由 depth 决定，这样会交错）
 *   - 独立的纵向波动相位与幅度（正弦，所以是飘不是直线飞）
 *   - 独立的旋转速度（蝴蝶会翻翅膀，花瓣会转）
 */
export function buildFloaters(n) {
  return Array.from({ length: n }, (_, i) => {
    const depth = Math.floor(prand(i, 41) * 3); // 0/1/2 → 大小与速度分档
    const size = 10 + depth * 9 + prand(i, 42) * 10; // 10~47px
    const toRight = prand(i, 43) > 0.5;
    return {
      key: i,
      depth,
      // 起点沿横向铺开；反向的那批从右侧开始
      left: toRight
        ? `${(prand(i, 44) * 100).toFixed(2)}%`
        : `${(60 + prand(i, 45) * 45).toFixed(2)}%`,
      top: `${(prand(i, 46) * 88).toFixed(2)}%`,
      size: Number(size.toFixed(1)),
      toRight,
      // 近处飘得快：时长更短
      duration: `${(16 - depth * 4.5 + prand(i, 47) * 5).toFixed(1)}s`,
      delay: `${(prand(i, 48) * 12).toFixed(1)}s`,
      // 纵向波动（正弦摆幅，px）与相位
      bob: Number((8 + depth * 7 + prand(i, 49) * 10).toFixed(1)),
      phase: `${(prand(i, 50) * 6.28).toFixed(2)}rad`,
      // 旋转：花瓣转得快、蝴蝶是翻动，这里统一用 spin 表达
      spin: Number(((prand(i, 51) - 0.5) * (depth + 1) * 44).toFixed(1)),
      // 亮度分级：0.2 / 0.34 / 0.48 起步，抖动最多 +0.16。
      // 飘浮物比光雨亮（它们是"看得见的实物"），但同样要封顶 ——
      // 超过 0.8 就从"飘在空气里"变成"贴在屏幕上"了。
      opacity: Number((0.2 + depth * 0.14 + prand(i, 52) * 0.16).toFixed(3)),
      kind: prand(i, 53) > 0.55 ? 'petal' : 'butterfly',
    };
  });
}

/**
 * 光雨（参考里全程在下、贯穿整幅的那层细亮线）。
 *
 * 与上一版"竖直光柱"的区别：上一版是**原地明灭的竖条**（像光带），
 * 参考里是**持续下落的雨丝**（有速度、有方向）。这一版按后者做：
 * 每条有下落时长与倾角，落到画面外会回到顶部重来。
 */
export function buildLightRain(n) {
  return Array.from({ length: n }, (_, i) => {
    const depth = Math.floor(prand(i, 61) * 3);
    return {
      key: i,
      depth,
      left: `${(prand(i, 62) * 100).toFixed(2)}%`,
      // 近处的雨丝更长更亮
      length: Number((9 + depth * 11 + prand(i, 63) * 14).toFixed(1)),
      thickness: Number((0.5 + prand(i, 64) * 0.7).toFixed(2)),
      // 近处落得更快（时长更短）
      duration: `${(5.5 - depth * 1.2 + prand(i, 65) * 2.4).toFixed(1)}s`,
      delay: `${(prand(i, 66) * 7).toFixed(1)}s`,
      // 轻微倾斜：全部同向，读起来才是"雨"不是"一堆线"
      tilt: Number((-6 - prand(i, 67) * 8).toFixed(1)),
      // 亮度分级：0.08 / 0.17 / 0.26 起步，抖动最多 +0.14。
      // **上限必须压住** —— 光雨是"空气里的光"，不是主体。
      // 单条超过 0.45 就会在浅色天空上糊成一道白杠，把标题压花
      // （上一版没设上限，最亮的一条到了 0.52，所以有了这条断言）。
      opacity: Number((0.08 + depth * 0.09 + prand(i, 68) * 0.14).toFixed(3)),
    };
  });
}

/** 由设备能力决定各层元素数量。SSR 下给保守值。 */
export function pickSceneBudget() {
  if (typeof navigator === 'undefined') return { floaters: 14, rain: 34 };
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const small = typeof window !== 'undefined' && window.innerWidth < 768;

  let floaters = 26;
  let rain = 80;
  if (cores <= 4 || mem <= 4) {
    floaters = 14;
    rain = 34;
  }
  if (small) {
    floaters = Math.min(floaters, 10);
    rain = Math.min(rain, 26);
  }
  return { floaters, rain };
}
