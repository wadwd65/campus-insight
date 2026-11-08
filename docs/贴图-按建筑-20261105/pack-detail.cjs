/* 把 104 张 AI 材质图压成「每栋专属的高频细节层」字节包
 *
 * 为什么要高通：实测 Realistic_Vision 出的纯材质图仍带大尺度斜向明暗和接缝，
 * 直接贴到楼上会被误读成楼层线，正是用户说的"下面对不上"。
 * 高通后只留零均值颗粒，斜纹/接缝（低频）被减掉；楼层线与勒脚改由程序
 * 按每栋真实层高精确绘制。AI 图仍真实参与：每栋的颗粒、色偏都来自自己那张图。
 *
 * 产物：D:/repro-test/pb-detail.json
 *   b64  = 灰度细节字节（104 格 × 32×32，base64，约 140KB）
 *   slots= "key/part" -> 格索引
 *   avg  = "key/part" -> 该图平均 RGB（给基色一点真实色偏）
 *   grain= "key/part" -> 颗粒强度
 *
 * 用法：node D:/repro-test/pack-detail.cjs
 */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const OUT = 'D:/repro-test/tex-out';
const PLACES = 'D:/repro-test/places.json';
const DEST = 'D:/repro-test/pb-detail.json';
const WALL_TYPES = new Set(['teaching', 'library', 'dorm', 'canteen', 'shop', 'gym']);
const PARTS = ['wall', 'base', 'roof', 'trim'];
const CELL = 32;

/* ---- 最小 PNG 解码器：8bit RGB/RGBA、非隔行（SD WebUI 输出即此格式） ---- */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let off = 8, w = 0, h = 0, colorType = 0, bitDepth = 0, interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0 || ![2, 6].includes(colorType)) {
    throw new Error(`unsupported png: depth=${bitDepth} color=${colorType} interlace=${interlace}`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const row = raw.subarray(rp, rp + stride); rp += stride;
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  /* 统一成 RGBA */
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0, n = w * h; i < n; i++) {
    rgba[i * 4] = px[i * bpp]; rgba[i * 4 + 1] = px[i * bpp + 1]; rgba[i * 4 + 2] = px[i * bpp + 2];
    rgba[i * 4 + 3] = colorType === 6 ? px[i * bpp + 3] : 255;
  }
  return { w, h, rgba };
}

/* 512 → 32 盒式降采样，同时统计平均色 */
function downsample(img) {
  const { w, h, rgba } = img;
  const gray = new Float32Array(CELL * CELL);
  const sum = [0, 0, 0];
  const bx = w / CELL, by = h / CELL;
  for (let cy = 0; cy < CELL; cy++) for (let cx = 0; cx < CELL; cx++) {
    let r = 0, g = 0, b = 0, n = 0;
    const x0 = Math.floor(cx * bx), x1 = Math.floor((cx + 1) * bx);
    const y0 = Math.floor(cy * by), y1 = Math.floor((cy + 1) * by);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++;
    }
    r /= n; g /= n; b /= n;
    gray[cy * CELL + cx] = 0.299 * r + 0.587 * g + 0.114 * b;
    sum[0] += r; sum[1] += g; sum[2] += b;
  }
  return { gray, avg: sum.map(v => Math.round(v / (CELL * CELL))) };
}

/* 3×3 均值模糊做低通，原图减低通 = 零均值细节；再映射到 128 附近 */
function highpass(gray) {
  const blur = new Float32Array(CELL * CELL);
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || yy >= CELL || xx < 0 || xx >= CELL) continue;
      s += gray[yy * CELL + xx]; n++;
    }
    blur[y * CELL + x] = s / n;
  }
  const out = new Uint8Array(CELL * CELL);
  let energy = 0;
  for (let i = 0; i < out.length; i++) {
    const d = (gray[i] - blur[i]) * 2.2;      /* 颗粒增益 */
    energy += Math.abs(d);
    out[i] = Math.max(0, Math.min(255, Math.round(128 + d)));
  }
  return { bytes: out, grain: +(energy / out.length).toFixed(2) };
}

(async () => {
  const places = JSON.parse(fs.readFileSync(PLACES, 'utf8')).filter(p => WALL_TYPES.has(p.type));
  const slots = {}, avg = {}, grain = {};
  const chunks = [];
  let idx = 0, missing = 0, bad = 0;
  for (const p of places) for (const part of PARTS) {
    const key = p.key + '/' + part;
    const file = path.join(OUT, p.key + '__' + part + '.png');
    let bytes;
    if (!fs.existsSync(file)) { missing++; bytes = new Uint8Array(CELL * CELL).fill(128); }
    else {
      try {
        const img = decodePNG(fs.readFileSync(file));
        const ds = downsample(img);
        const hp = highpass(ds.gray);
        bytes = hp.bytes; avg[key] = ds.avg; grain[key] = hp.grain;
      } catch (e) { bad++; console.warn('  解码失败', key, e.message); bytes = new Uint8Array(CELL * CELL).fill(128); }
    }
    slots[key] = idx++;
    chunks.push(Buffer.from(bytes));
  }
  const all = Buffer.concat(chunks);
  const pack = {
    version: 1, date: '2026-11-05', cell: CELL, count: idx,
    b64: all.toString('base64'), slots, avg, grain,
    note: '每栋×部位一格 32×32 灰度高通细节层；低频斜纹/接缝已去除',
  };
  fs.writeFileSync(DEST, JSON.stringify(pack));
  console.log('格数 =', idx, '缺失 =', missing, '解码失败 =', bad);
  console.log('细节字节 =', all.length, 'B，base64 =', pack.b64.length, 'B');
  console.log('平均色示例 =', JSON.stringify(Object.entries(avg).slice(0, 3)));
  console.log('颗粒强度示例 =', JSON.stringify(Object.entries(grain).slice(0, 3)));
  console.log('已写', DEST);
})();
