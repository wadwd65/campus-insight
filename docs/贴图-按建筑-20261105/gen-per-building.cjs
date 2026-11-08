/* 按「建筑 × 部位」生成专属无缝材质（绘世 SD WebUI :7860）
 *
 * 背景：旧 gen-textures.cjs 一次只出 6 张通用材质，全校园共用，
 *       贴图里的分格缝/楼层线按贴图自身 UV 走，与实际层高、开间、勒脚高度无关，
 *       所以建筑下半部分会出现"很多东西对不上"。本脚本改为逐栋、逐部位出图。
 *
 * 用法：
 *   node D:/repro-test/gen-per-building.cjs                 # 全量
 *   node D:/repro-test/gen-per-building.cjs --limit 2      # 只跑前 2 栋（验质量）
 *   node D:/repro-test/gen-per-building.cjs --keys teach-1,lib
 *   node D:/repro-test/gen-per-building.cjs --parts wall,base
 *   node D:/repro-test/gen-per-building.cjs --dry          # 只打印任务清单
 *
 * 产物：D:/repro-test/tex-out/<key>__<part>.png （512×512，tileable）
 *       已存在且 >4KB 的文件自动跳过 → 支持断点续跑。
 */
const fs = require('fs');
const path = require('path');

const API = 'http://127.0.0.1:7860';
const OUT = 'D:/repro-test/tex-out';
const PLACES = 'D:/repro-test/places.json';
/* 11-05 实测：DreamShaper_8 会把 "ribbed panel" 画成弯曲金属管（抽象物体），
   不是材质。改用 Realistic_Vision_V5.1（写实照片向）出平铺材质更稳。 */
const MODEL = 'sd1.5\\Realistic_Vision_V5.1_fp16-no-ema.safetensors [99a75a901f]';

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const eq = argv.find(a => a.startsWith('--' + name + '='));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf('--' + name);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  return def;
};
const has = name => argv.includes('--' + name);
const limit = Number(opt('limit', 0));
const onlyKeys = opt('keys', '') ? opt('keys', '').split(',') : null;
const onlyParts = opt('parts', '') ? opt('parts', '').split(',') : null;
const DRY = has('dry');

/* 只有这些类型有立面。亭子 / 广场 / 球场没有墙，不出图。 */
const WALL_TYPES = new Set(['teaching', 'library', 'dorm', 'canteen', 'shop', 'gym']);

/* 按楼型给材质基调（每栋再用独立 seed + 色相词做差异化） */
/* 11-05 实测教训：任何带 "ribbed / standing-seam / panel / coursing / tiles"
   这类**具体物件**的词，SD 会画出物体而不是表面。一律限定为"平的表面 + 细颗粒"。 */
const STYLE = {
  teaching: { wall: 'smooth matte pale cream lime plaster', roof: 'smooth matte light grey roofing surface', base: 'matte pale grey granite surface', accent: 'cool off-white' },
  library:  { wall: 'smooth matte warm pale limestone', roof: 'smooth matte pale grey concrete surface', base: 'matte darker warm limestone surface', accent: 'warm ivory' },
  dorm:     { wall: 'matte warm beige fine brickwork', roof: 'matte muted terracotta surface', base: 'matte dark brownish-grey stone surface', accent: 'soft apricot' },
  canteen:  { wall: 'matte light ochre mineral render', roof: 'matte warm grey roofing surface', base: 'matte mid-grey concrete surface', accent: 'warm sand' },
  shop:     { wall: 'matte light sand painted render', roof: 'matte light grey roofing surface', base: 'matte mid-grey concrete surface', accent: 'warm sand' },
  gym:      { wall: 'smooth matte pale silver-grey painted concrete', roof: 'matte light grey roofing surface', base: 'matte dark grey concrete surface', accent: 'cool silver' },
};

/* 明度/色相的轻微离散词，让同一楼型的不同楼真的不一样（不是复用同一张） */
const TINTS = ['slightly cooler', 'slightly warmer', 'faintly greenish grey', 'faintly pinkish beige', 'a touch lighter', 'a touch deeper', 'neutral balanced'];

/* 统一前缀/后缀：把 SD 牢牢锁在「一张平的表面特写」，而不是「一个物体」。 */
const FLAT = 'seamless tileable flat material swatch, extreme close-up of an evenly painted flat surface, ';
const FLAT_END = ', very fine uniform grain, no large shapes, no pattern, flat straight-on orthographic albedo photography, even diffuse studio light, PBR texture';

const PARTS = {
  wall: s => FLAT + s.wall + `, ${s.accent} tone` + FLAT_END,
  base: s => FLAT + s.base + ', slightly darker than the wall above' + FLAT_END,
  roof: s => FLAT + s.roof + ', top-down view' + FLAT_END,
  trim: s => FLAT + `smooth matte ${s.accent} concrete surface` + FLAT_END,
};

/* 关键：贴图里绝不能出现窗 / 门 / 楼层线 / 建筑轮廓 —— 那些是几何构件，
   一旦贴图也画，就会和真实窗格错位，正是"下面对不上"的老毛病。 */
const NEG = 'windows, window frames, doors, floor lines, storey lines, building silhouette, architecture, perspective, vanishing point, cast shadow, vignette, gradient, text, watermark, letters, people, furniture, uneven lighting, blurry, jpeg artifacts, visible border, edge seams, curved tubes, pipes, folds, sculpture, 3d render, object, macro shape, lines, stripes, ribbed, corrugated, metallic reflections, glossy highlights, organic shapes, diagonal composition, glossy';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = str => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

async function api(p, body, timeout = 180000) {
  const res = await fetch(API + p, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 120));
  return res.json();
}

async function ensureModel() {
  const models = await api('/sdapi/v1/sd-models', null, 10000);
  const cur = await api('/sdapi/v1/options', null, 10000);
  if (cur.sd_model_checkpoint === MODEL) { console.log('模型已就位:', MODEL); return; }
  const hit = models.find(m => m.title === MODEL);
  if (!hit) { console.warn('找不到指定模型，沿用当前:', cur.sd_model_checkpoint); return; }
  console.log('切换模型 →', MODEL, '(加载中)');
  await api('/sdapi/v1/options', { sd_model_checkpoint: hit.title }, 180000);
  console.log('模型已切换');
}

async function gen(key, part, prompt, seed) {
  const file = path.join(OUT, key + '__' + part + '.png');
  if (fs.existsSync(file) && fs.statSync(file).size > 4096) return 'skip';
  const data = await api('/sdapi/v1/txt2img', {
    prompt,
    negative_prompt: NEG,
    width: 512, height: 512,
    steps: 24, cfg_scale: 6,
    sampler_name: 'DPM++ 2M Karras',
    tiling: true,
    seed,
    override_settings: { CLIP_stop_at_last_layers: 2 },
  });
  const b64 = data.images && data.images[0];
  if (!b64) throw new Error('没有返回图片');
  fs.writeFileSync(file, Buffer.from(b64.split(',')[1] || b64, 'base64'));
  return 'ok';
}

(async () => {
  const places = JSON.parse(fs.readFileSync(PLACES, 'utf8'))
    .filter(p => WALL_TYPES.has(p.type))
    .filter(p => !onlyKeys || onlyKeys.includes(p.key))
    .slice(0, limit || undefined);
  const parts = Object.keys(PARTS).filter(p => !onlyParts || onlyParts.includes(p));
  const jobs = [];
  for (const p of places) for (const part of parts) jobs.push({ place: p, part });

  console.log('建筑数 =', places.length, '每栋部位 =', parts.join('/'), '总任务 =', jobs.length);
  console.log('输出目录 =', OUT);
  if (DRY) { jobs.slice(0, 12).forEach(j => console.log('  ', j.place.key, j.part)); console.log('  ...(dry run)'); return; }

  fs.mkdirSync(OUT, { recursive: true });
  await ensureModel();

  let done = 0, skipped = 0, failed = 0;
  const t0 = Date.now();
  for (const job of jobs) {
    const { place, part } = job;
    const s = STYLE[place.type] || STYLE.teaching;
    const h = hash(place.key + ':' + part);
    const tint = TINTS[h % TINTS.length];
    const prompt = PARTS[part](s) + ', ' + tint + ' overall tone';
    const seed = h % 2000000000;
    const label = `[${String(++done).padStart(3)}/${jobs.length}] ${place.key.padEnd(14)} ${part.padEnd(5)}`;
    let result = '';
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const t = Date.now();
        const r = await gen(place.key, part, prompt, seed);
        result = r === 'skip' ? 'skip' : `ok ${((Date.now() - t) / 1000).toFixed(1)}s`;
        if (r === 'skip') skipped++;
        break;
      } catch (e) {
        result = 'FAIL ' + e.message.slice(0, 90);
        if (attempt === 1) { await sleep(1500); continue; }
        failed++;
      }
    }
    console.log(label, result);
  }
  console.log(`完成：成功 ${done - skipped - failed} / 跳过 ${skipped} / 失败 ${failed}，用时 ${((Date.now() - t0) / 1000 / 60).toFixed(1)} 分钟`);
})();
