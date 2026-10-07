# -*- coding: utf-8 -*-
"""extract-sat3.py —— 卫星影像 → **可直接进项目的真实建筑表**

改进：① 先按校园偏角(3.6°)把像素旋转到切片坐标系，**再**求 bbox（消除旋转导致的框胀）
      ② 深色屋顶 + 亮白屋顶 两类都抓（校园里有 2 栋大白顶建筑）
      ③ 只用跑道锚点 + 绝对分辨率，不依赖任何目测
输出：real-buildings.txt（切片坐标、米制尺寸、朝向）+ 带框验证图
"""
import numpy as np, math, io
from PIL import Image

A = np.asarray(Image.open('sat-campus.png').convert('RGB')).astype(np.int16)
r, g, b = A[:, :, 0], A[:, :, 1], A[:, :, 2]
mx = np.maximum(np.maximum(r, g), b)
mn = np.minimum(np.minimum(r, g), b)
sat = mx - mn

MPP = 0.5151
PPS = 3.5 / MPP                       # 图像px / 切片px = 6.80
TCX, TCY = 725.0, 385.0               # 跑道中心（图像px）
SLICE_TRACK = (92.0, 56.0)
ROT = math.radians(3.6)               # 校园相对正北的偏角（跑道主轴测得）

def to_slice(x, y):
    dx, dy = x - TCX, y - TCY
    ca, sa = math.cos(-ROT), math.sin(-ROT)
    return (SLICE_TRACK[0] + (dx * ca - dy * sa) / PPS,
            SLICE_TRACK[1] + (dx * sa + dy * ca) / PPS)

def comps(mask, min_px, step=2):
    ys, xs = np.where(mask)
    pts = set(zip((ys // step).tolist(), (xs // step).tolist()))
    seen = set(); out = []
    for p0 in list(pts):
        if p0 in seen: continue
        st = [p0]; seen.add(p0); comp = []
        while st:
            cy, cx = st.pop(); comp.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    q = (cy + dy, cx + dx)
                    if q in pts and q not in seen:
                        seen.add(q); st.append(q)
        if len(comp) * step * step >= min_px:
            out.append(np.array(comp) * step)
    return out

dark = (mx < 95) & (b >= g) & (g >= r - 6)
bright = (mn > 196) & (sat < 16)

res = []
for name, mask, minpx, maxarea in (('dark', dark, 200, 10 ** 9), ('bright', bright, 1500, 9000)):
    for a in comps(mask, minpx, 2):
        X = a[:, 1].astype(float); Y = a[:, 0].astype(float)
        dx = X - TCX; dy = Y - TCY
        ca, sa = math.cos(-ROT), math.sin(-ROT)
        sx_ = SLICE_TRACK[0] + (dx * ca - dy * sa) / PPS
        sy_ = SLICE_TRACK[1] + (dx * sa + dy * ca) / PPS
        w_px = (X.max() - X.min()); h_px = (Y.max() - Y.min())
        area_m2 = len(a) * 4 * MPP * MPP
        if area_m2 < 120 or area_m2 > maxarea: continue
        # 只保留校园范围（切片 20~185 / 24~176），其余是村舍/厂棚
        ccx, ccy = sx_.mean(), sy_.mean()
        if not (20 < ccx < 186 and 24 < ccy < 176): continue
        res.append({
            'kind': name, 'cx': ccx, 'cy': ccy,
            'w_px': w_px, 'h_px': h_px,
            'wm': w_px * MPP, 'dm': h_px * MPP,
            'area': area_m2,
            'n': len(a),
        })

res.sort(key=lambda t: -t['area'])
lines = ["真实建筑（卫星影像提取，切片坐标；1 切片px=3.5m）",
         "共 %d 栋；旋转校正 3.6°；标定 px/切片px=%.2f" % (len(res), PPS), ""]
lines.append("  #  类型  中心切片      占地(m)     屋顶面积  切片bbox")
for i, t in enumerate(res):
    lines.append("  %2d  %-6s (%6.1f,%6.1f)  %5.0f×%-5.0f  %6.0fm²" % (
        i + 1, t['kind'], t['cx'], t['cy'], t['wm'], t['dm'], t['area']))
txt = "\n".join(lines)
io.open('real-buildings.txt', 'w', encoding='utf-8').write(txt)
print(txt)

# 验证图
im = Image.open('sat-campus.png').convert('RGB'); pi = im.load(); W2, H2 = im.size
for name, mask, minpx, maxarea in (('dark', dark, 200, 10 ** 9), ('bright', bright, 1500, 9000)):
    for a in comps(mask, minpx, 2):
        X = a[:, 1].astype(float); Y = a[:, 0].astype(float)
        dx = X - TCX; dy = Y - TCY
        ca, sa = math.cos(-ROT), math.sin(-ROT)
        sx_ = SLICE_TRACK[0] + (dx * ca - dy * sa) / PPS
        sy_ = SLICE_TRACK[1] + (dx * sa + dy * ca) / PPS
        area_m2 = len(a) * 4 * MPP * MPP
        if area_m2 < 120 or area_m2 > maxarea: continue
        if not (20 < sx_.mean() < 186 and 24 < sy_.mean() < 176): continue
        col = (255, 60, 0) if name == 'dark' else (0, 90, 255)
        x0, y0, x1, y1 = int(X.min()), int(Y.min()), int(X.max()), int(Y.max())
        for x in range(max(0, x0), min(W2, x1)):
            pi[x, max(0, y0)] = col; pi[x, min(H2 - 1, y1)] = col
        for y in range(max(0, y0), min(H2, y1)):
            pi[max(0, x0), y] = col; pi[min(W2 - 1, x1), y] = col
im.crop((450, 20, 1360, 1220)).resize((601, 792), Image.LANCZOS).save('sat-detect3.png')
print("\n已保存 sat-detect3.png（橙=深色屋顶 蓝=亮白屋顶）")
