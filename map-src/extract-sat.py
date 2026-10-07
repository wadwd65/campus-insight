# -*- coding: utf-8 -*-
"""extract-sat.py —— 从卫星正射影像里抠出**真实建筑 footprint**（按屋顶色），
并用**跑道当标尺**标定到项目切片坐标系。

为什么用跑道当标尺（而不是猜校园包围盒）：
  跑道的**位置与尺寸在切片系里是已知的**（CAMP_TRACK px92/py56、28×42 切片px = 98×147m），
  且卫星图上跑道是唯一的红色大环 ⇒ 它的包围盒同时给出**尺度**（px/切片px）与**平移**。
  这比"目测校园四角"稳得多（后者我连错三轮）。
输出：真实建筑清单（切片坐标 + 米制尺寸），按面积排序。
"""
import numpy as np
from PIL import Image

A = np.asarray(Image.open('sat-campus.png').convert('RGB')).astype(np.int16)
H, W, _ = A.shape
r, g, b = A[:, :, 0], A[:, :, 1], A[:, :, 2]
mx = np.maximum(np.maximum(r, g), b)

# ── ① 屋顶：深蓝灰（亮度低、b≥g≥r-6）──
roof = (mx < 95) & (b >= g) & (g >= r - 6)
# ── ② 跑道：红褐（r 明显高）──
track = (r > 110) & (r - g > 18) & (r - b > 8)

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
            a = np.array(comp) * step
            out.append((a[:, 1].min(), a[:, 0].min(), a[:, 1].max(), a[:, 0].max(), len(comp) * step * step))
    return out

tk = comps(track, 4000)
tk.sort(key=lambda t: -t[4])
tx0, ty0, tx1, ty1, tn = tk[0]
tw, th = tx1 - tx0, ty1 - ty0
print("跑道 bbox 图像px x %d~%d (%d)  y %d~%d (%d)  面积 %d" % (tx0, tx1, tw, ty0, ty1, th, tn))

# ── 标定：跑道在切片系里 28(东西) × 42(南北) px，中心 (92, 56) ──
SL, SW = 28.0, 42.0
sx = tw / SL          # 图像px / 切片px（东西）
sy = th / SW          # 图像px / 切片px（南北）
print("标定: %.2f 图像px/切片px（东西）  %.2f（南北）  ⇒ 1 图像px ≈ %.2f m" % (
    sx, sy, 3.5 / ((sx + sy) / 2)))
tcx, tcy = (tx0 + tx1) / 2, (ty0 + ty1) / 2
def to_slice(x, y):
    return (92 + (x - tcx) / sx, 56 + (y - tcy) / sy)

# ── ③ 建筑：屋顶连通域（步长 3 降低噪点碎片）──
rects = comps(roof, 250, 3)
rects = [t for t in rects if (t[2] - t[0]) > 12 and (t[3] - t[1]) > 12]
big = []
for (x0, y0, x1, y1, n) in rects:
    a = to_slice(x0, y0); c = to_slice(x1, y1)
    wm = (c[0] - a[0]) * 3.5; dm = (c[1] - a[1]) * 3.5
    big.append((a[0], a[1], c[0], c[1], wm, dm, n))
big.sort(key=lambda t: -(t[4] * t[5]))
print("\n真实建筑 %d 栋（切片坐标；米制尺寸）—— 前 26 栋（按面积）：" % len(big))
for i, (x0, y0, x1, y1, wm, dm, n) in enumerate(big[:26]):
    print("  %2d) 中心(%6.1f,%6.1f)  %.0f×%.0f m   切片 x %.1f~%.1f y %.1f~%.1f  屋顶%6dpx" % (
        i + 1, (x0 + x1) / 2, (y0 + y1) / 2, wm, dm, x0, x1, y0, y1, n))

# 可视化：把提取结果画到图上（验证是否贴合屋顶）
im = Image.open('sat-campus.png').convert('RGB')
pi = im.load()
for (x0, y0, x1, y1, n) in rects:
    for x in range(max(0, int(x0)), min(W, int(x1)), 1):
        pi[x, int(y0)] = (255, 0, 0); pi[x, min(H - 1, int(y1))] = (255, 0, 0)
    for y in range(max(0, int(y0)), min(H, int(y1)), 1):
        pi[int(x0), y] = (255, 0, 0); pi[min(W - 1, int(x1)), y] = (255, 0, 0)
im.crop((480, 80, 1300, 1180)).resize((656, 880), Image.LANCZOS).save('sat-detect-check.png')
print("\n已保存 sat-detect-check.png（红框=程序提取的屋顶）")
