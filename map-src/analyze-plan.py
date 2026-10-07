# -*- coding: utf-8 -*-
"""analyze-plan.py —— 从官方总平面图里**按颜色抠出**湖面与跑道，量真实形状。

坐标标定（tower-10 已验证）：切片 px = plane1_x - 580，切片 py = plane1_y - 700。
输出：① 水面轮廓多边形（切片坐标，简化后）② 跑道 bbox 与长轴朝向
"""
from PIL import Image
import math

im = Image.open(r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\.workbuddy-gen\cmp\plane1.png").convert("RGB")
W, H = im.size
px = im.load()
OX, OY = 580, 700

def slice_of(x, y):
    return (x - OX, y - OY)

# ── ① 水面：官方图水面是浅蓝/青/淡紫（低饱和冷色、明度高）──
water = []
lav = []
for y in range(700, 900):
    for x in range(580, 800):
        r, g, b = px[x, y]
        mx, mn = max(r, g, b), min(r, g, b)
        # 青蓝：b 最高、g 次之、r 明显低
        if b > 150 and b - r > 22 and g - r > 8 and mx - mn > 22:
            water.append((x, y))
        # 淡紫（西北那块）：b≈r > g
        elif b > 165 and r > 150 and b - g > 12 and r - g > 4 and abs(b - r) < 26:
            lav.append((x, y))

def bbox(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return (min(xs), min(ys), max(xs), max(ys))

def report(name, pts):
    if not pts:
        print(name, "无像素"); return
    x0, y0, x1, y1 = bbox(pts)
    sx0, sy0 = slice_of(x0, y0); sx1, sy1 = slice_of(x1, y1)
    print("%s n=%d  切片 x %.0f~%.0f (%.0f)  y %.0f~%.0f (%.0f)  中心(%.1f,%.1f)" % (
        name, len(pts), sx0, sx1, sx1 - sx0, sy0, sy1, sy1 - sy0,
        (sx0 + sx1) / 2, (sy0 + sy1) / 2))

report("水面(青蓝)", water)
report("淡紫区", lav)

# ── ② 跑道：红褐色地面 ──
track = []
for y in range(700, 900):
    for x in range(580, 800):
        r, g, b = px[x, y]
        if r > 120 and r - g > 26 and r - b > 20 and g > 60 and abs(g - b) < 45:
            track.append((x, y))
report("跑道(红褐)", track)

# ── ③ 水面轮廓多边形（按 24 扇区取最远点 → 顺序连成闭合轮廓）──
if water:
    xs = [p[0] for p in water]; ys = [p[1] for p in water]
    cx = (min(xs) + max(xs)) / 2; cy = (min(ys) + max(ys)) / 2
    N = 36
    far = [0.0] * N
    for (x, y) in water:
        a = math.atan2(y - cy, x - cx)
        k = int((a + math.pi) / (2 * math.pi) * N) % N
        d = math.hypot(x - cx, y - cy)
        if d > far[k]:
            far[k] = d
    poly = []
    for k in range(N):
        a = -math.pi + (k + 0.5) / N * 2 * math.pi
        d = far[k] if far[k] > 0 else 0.0
        poly.append((round(cx + math.cos(a) * d - OX, 1), round(cy + math.sin(a) * d - OY, 1)))
    print("\n水面轮廓（切片坐标, %d 点）:" % N)
    print("var CAMP_LAKE_POLY = [")
    for i in range(0, N, 4):
        print("  " + ", ".join("[%.1f,%.1f]" % p for p in poly[i:i + 4]) + ",")
    print("];")
