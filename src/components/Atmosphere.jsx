/**
 * Atmosphere.jsx —— 界面四周的"环境层"（10-08 新增）
 *
 * 用户要求："界面四周换成动态，加点动漫图片，再给他做点粒子效果。"
 *
 * 三件事，各用最省的做法：
 *   1. **动漫场景**：项目自己的三张场景图（天空 / 拱门废墟 / 藤蔓剪影）——
 *      入场页的视差层用的就是它们，放在入口页上等于**与入场连续**，不是另贴三张图。
 *   2. **动态**：全靠 CSS 关键帧（60~90s 一轮的极慢漂移），无 JS 定时器；
 *      `prefers-reduced-motion` 由 index.css 统一关掉（沿用项目既有约定）。
 *   3. **粒子**：用仓库里**已装但一直没用**的 @tsparticles（slim）—— 不新增依赖。
 *      数量按屏宽分档（手机 18 / 桌面 56）、无连线、极低透明度；
 *      **系统要求减少动态时根本不渲染它**（不是渲染后隐藏）。
 *
 * ⚠️ 两条约束：
 *   · SSR 安全：`npm run smoke` 在 Node 里渲染页面，那里没有 window ⇒ 粒子只在客户端挂载；
 *   · v4 的 API 与网上多数 v2 教程不同：用 `<ParticlesProvider init={...}>`，
 *     且 `init` 必须**稳定**（模块级常量），否则 provider 会直接抛错。
 */
import { useEffect, useMemo, useState } from 'react';
import Particles, { ParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

/** ★ 必须是稳定引用：provider 在生命周期里会比对它，变了就抛错 */
const initEngine = async (engine) => {
  await loadSlim(engine);
};

export default function Atmosphere({ variant = 'scene' }) {
  const [particlesOn, setParticlesOn] = useState(false);

  /* 检测软件渲染（SwiftShader 等）：软渲染下 canvas 粒子逐帧绘制极吃 CPU，
     是"浏览器关了硬件加速"时的卡顿主源 —— 这种环境直接不渲染粒子。 */
  function isSoftwareRenderer() {
    try {
      if (typeof WebGLRenderingContext === 'undefined') return true;
      var cv = document.createElement('canvas');
      var gl = cv.getContext('webgl');
      if (!gl) return true;
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      var name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
      return /swiftshader|software|llvmpipe|basic render/i.test(name);
    } catch (e) {
      return true;
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    /* ★ 10-10 自查发现的缺口：只在挂载时判断的话，用户**中途**改成"减少动态"
       粒子不会卸载（动画已被 CSS 关掉，但 canvas 还在跑）。
       这里挂监听，设置一变就跟着开/关。
       ★ 再加一条：软渲染环境（浏览器关硬件加速）也不渲染粒子。 */
    const sync = () => setParticlesOn(!mq.matches && !isSoftwareRenderer());
    sync();
    if (mq.addEventListener) mq.addEventListener('change', sync);
    else mq.addListener(sync);                       // 老 Safari
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', sync);
      else mq.removeListener(sync);
    };
  }, []);

  /* 粒子配置：颜色取场景里的淡青/浅粉，是"融进画面"而不是浮在上面 */
  const options = useMemo(() => {
    const narrow = typeof window !== 'undefined' && window.innerWidth < 720;
    return {
      fullScreen: { enable: false },
      /* ★ 10-10 性能：关 retina（canvas 面积减半）、粒子数下调、限制 30fps。
         粒子是常驻逐帧 canvas 动画，是入口页唯一的持续 CPU 开销；
         30fps 的粒子肉眼仍流畅，但逐帧绘制成本直接减半。 */
      detectRetina: false,
      fpsLimit: 30,
      particles: {
        number: { value: narrow ? 14 : 30 },
        color: { value: ['#bfe3ff', '#ffd9ea', '#ffffff'] },
        shape: { type: 'circle' },
        opacity: {
          value: { min: 0.10, max: 0.46 },
          animation: { enable: true, speed: 0.35, sync: false },
        },
        size: {
          value: { min: 0.7, max: 3.0 },
          animation: { enable: true, speed: 1.2, sync: false },
        },
        move: {
          enable: true,
          speed: 0.35,
          direction: 'top',
          random: true,
          straight: false,
          outModes: { default: 'out' },
        },
        wobble: { enable: true, distance: 12, speed: { min: -2, max: 2 } },
      },
      interactivity: { events: { onHover: { enable: false }, onClick: { enable: false } } },
      responsive: [
        { maxWidth: 720, options: { particles: { number: { value: 18 }, size: { value: { min: 0.5, max: 1.8 } } } } },
      ],
    };
  }, []);

  /* variant='scene'：完整场景（天空 + 拱门 + 藤蔓框）
     variant='plain'：只留粒子（留给将来的浅色数据页，默认不用） */
  return (
    <div className={`atmo atmo-${variant}`} aria-hidden="true">
      {variant === 'scene' && (
        <>
          <span className="atmo-layer atmo-sky" />
          <span className="atmo-layer atmo-arch" />
          <span className="atmo-layer atmo-vine" />
        </>
      )}
      <span className="atmo-scrim" />
      {particlesOn && (
        <div className="atmo-particles">
          <ParticlesProvider init={initEngine}>
            <Particles id="atmo-particles" options={options} />
          </ParticlesProvider>
        </div>
      )}
    </div>
  );
}
