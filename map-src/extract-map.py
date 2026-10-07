# -*- coding: utf-8 -*-
"""extract-map.py —— 从用户提供的 Apple 地图照片里**抠出真实**的湖面与建筑轮廓。

方法（避免"看图目测"的老坑）：
  ① 蓝阈值取湖面 → 最大连通域 → 按 48 扇区取轮廓（数值化）
  ② 米色校园底 → 校园外接框 → 与切片坐标 (24,28)-(181,172) 线性对齐（标定）
  ③ 近白建筑块 → 连通域 → 逐个 bbox → 换算成切片坐标
输出：真实湖轮廓（切片）+ 建筑清单（切片）+ 米/px 尺度
"""
import numpy as np
from PIL import Image

SRC = r"C:\Users\123\.workbuddy\clipboard-images\clipboard-2026-10-07T12-44-05-327Z-17a0f512.jpg"
OUT = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\.workbuddy-gen\rebuild\map-extracted.txt"

im = Image.open(SRC).convert("RGB")
A = np.asarray(im).astype(np.int16)
H, W, _ = A.shape
r, g, b = A[:, :, 0], A[:, :, 1], A[:, :, 2]

# ── ① 湖面：Apple 水体蓝（b 明显高、g 中等、r 低）──
lake = (b > 140) & (b - r > 28) & (g - r > 10) & (b - g > 8)
# 去掉顶部状态栏/搜索卡的绿色与高光
lake[:230, :] = False
label = np.zeros_like(lake, dtype=np.int32)
comps = []
step = 2
ys, xs = np.where(lake)
pts = set(zip((ys // step).tolist(), (xs // step).tolist()))
seen = set()
for p0 in list(pts):
    if p0 in seen:
        continue
    stack = [p0]
    seen.add(p0)
    comp = []
    while stack:
        cy, cx2 = stack.pop()
        comp.append((cy, cx2))
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                q = (cy + dy, cx2 + dx)
                if q in pts and q not in seen:
                    seen.add(q)
                    stack.append(q)
    comps.append(comp)
comps.sort(key=len, reverse=True)
big = comps[0]
cy0 = np.array([p[0] for p in big]) * step
cx0 = np.array([p[1] for p in big]) * step
lk_cx, lk_cy = cx0.mean(), cy0.mean()
# 48 扇区轮廓
N = 48
far = np.zeros(N)
for x, y in zip(cx0, cy0):
    a = np.arctan2(y - lk_cy, x - lk_cx)
    k = int((a + np.pi) / (2 * np.pi) * N) % N
    d = np.hypot(x - lk_cx, y - lk_cy)
    far[k] = max(far[k], d)
lake_poly_img = []
for k in range(N):
    a = -np.pi + (k + 0.5) / N * 2 * np.pi
    lake_poly_img.append((lk_cx + np.cos(a) * far[k], lk_cy + np.sin(a) * far[k]))

# ── ② 校园底（米色/奶油色，比外部街区的白更暖）──
cream = (r > 200) & (g > 195) & (b > 170) & (r - b > 12) & (r - g < 22)
cream[:230, :] = False
cys, cxs = np.where(cream)
# 取主体：用分位数去掉零星噪点
x0i, x1i = np.percentile(cxs, 1), np.percentile(cxs, 99)
y0i, y1i = np.percentile(cys, 1), np.percentile(cys, 99)

# 标定：图像校园框 ↔ 切片框 (24,28)-(181,172)
SX = (x1i - x0i) / (181 - 24)
SY = (y1i - y0i) / (172 - 28)
def to_slice(x, y):
    return (24 + (x - x0i) / SX, 28 + (y - y0i) / SY)

# ── ③ 建筑块：校园内的近白块 ──
bld = (r > 232) & (g > 228) & (b > 218)
bld[:230, :] = False
bld[cream & ~cream] = False
mask_in = np.zeros_like(bld)
mask_in[int(y0i):int(y1i), int(x0i):int(x1i)] = True
bld &= mask_in
# 连通域（缩小取样步长 3）
ys, xs = np.where(bld)
pts = set(zip((ys // 3).tolist(), (xs // 3).tolist()))
seen = set()
rects = []
for p0 in list(pts):
    if p0 in seen:
        continue
    stack = [p0]; seen.add(p0); comp = []
    while stack:
        cy, cx2 = stack.pop(); comp.append((cy, cx2))
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                q = (cy + dy, cx2 + dx)
                if q in pts and q not in seen:
                    seen.add(q); stack.append(q)
    if len(comp) < 60:
        continue
    a = np.array(comp) * 3
    rects.append((a[:, 1].min(), a[:, 0].min(), a[:, 1].max(), a[:, 0].max()))
rects.sort(key=lambda t: -(t[2] - t[0]) * (t[3] - t[1]))

lines = []
lines.append("图像 %dx%d" % (W, H))
lines.append("校园框（图像 px）: x %.0f~%.0f  y %.0f~%.0f" % (x0i, x1i, y0i, y1i))
lines.append("标定: 1 切片px = %.2f 图像px（东西） / %.2f 图像px（南北）" % (SX, SY))
lines.append("尺度: 1 切片px = 3.5m ⇒ 1 图像px ≈ %.2f m（东西）/ %.2f m（南北）" % (3.5 / SX, 3.5 / SY))
lc = to_slice(lk_cx, lk_cy)
lines.append("")
lines.append("【真实湖】中心 切片(%.1f, %.1f)   蓝色域 %d 个采样点" % (lc[0], lc[1], len(big)))
poly = [to_slice(x, y) for (x, y) in lake_poly_img]
xs2 = [p[0] for p in poly]; ys2 = [p[1] for p in poly]
lines.append("真实湖 bbox 切片 x %.1f~%.1f (%.1f)  y %.1f~%.1f (%.1f)  ⇒ %.0fm × %.0fm" % (
    min(xs2), max(xs2), max(xs2) - min(xs2), min(ys2), max(ys2), max(ys2) - min(ys2),
    (max(xs2) - min(xs2)) * 3.5, (max(ys2) - min(ys2)) * 3.5))
lines.append("真实湖轮廓（切片，48 点）:")
for i in range(0, N, 4):
    lines.append("  " + ", ".join("[%.1f,%.1f]" % p for p in poly[i:i + 4]) + ",")
lines.append("")
lines.append("【真实建筑】按面积排序，共 %d 块（切片坐标，%.0f×%.0f 起）：" % (len(rects), 0, 0))
for (rx0, ry0, rx1, ry1) in rects[:26]:
    a = to_slice(rx0, ry0); c = to_slice(rx1, ry1)
    w_m = (c[0] - a[0]) * 3.5; d_m = (c[1] - a[1]) * 3.5
    lines.append("  x %.0f~%.0f  y %.0f~%.0f   ≈ %.0f×%.0f m  中心(%.1f,%.1f)" % (
        a[0], c[0], a[1], c[1], w_m, d_m, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2))

txt = "\n".join(lines)
open(OUT, "w", encoding="utf-8").write(txt)
print(txt)
