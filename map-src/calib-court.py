# -*- coding: utf-8 -*-
"""用 27837115（正交俯视球场图）精确标定 px/m。
标定物三选：
  A. 篮球场整块绿色区域（含 4 片 = 2x2 排列）。单片 28m x 15m
  B. 网球场淡蓝灰场地（右上 2 片）
  C. 品红禁区（三秒区）宽 4.9m x 深 5.8m
做法：找色块边界 → 量像素跨度 → 除以真实米数 → 多方交叉验证一致才算过。
"""
from PIL import Image
import math

SRC = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\map-assets\official-360\outdoor\27837115_d.jpg"
im = Image.open(SRC).convert("RGB")
px = im.load()
W, H = im.size
print("图 %dx%d" % (W, H))

def near(c, t, tol=34):
    return all(abs(c[i] - t[i]) <= tol for i in range(3))

def in_range(c, lo, hi):
    return all(lo[i] <= c[i] <= hi[i] for i in range(3))

# 篮球场绿 ~ #5FA84E  → 放宽
BK_GREEN = (95, 168, 78)
def is_bk(c):
    r, g, b = c
    return g > 120 and g - r > 25 and g - b > 35 and 90 < g < 210

# 品红禁区 ~ #D6486E
def is_magenta(c):
    r, g, b = c
    return r > 160 and r - g > 55 and b - g > 5 and b > 80

# 网球场淡蓝灰 ~ #A8C0D4
def is_tc(c):
    r, g, b = c
    return b > 155 and b - r > 12 and abs(b - g) < 30 and g > 145

def row_segs(y, pred, minw=6):
    segs, cur = [], None
    for x in range(W):
        if pred(px[x, y]):
            if cur is None: cur = x
        else:
            if cur is not None:
                if x - cur >= minw: segs.append((cur, x - 1))
                cur = None
    if cur is not None and W - cur >= minw: segs.append((cur, W - 1))
    return segs

def col_segs(x, pred, minw=6):
    segs, cur = [], None
    for y in range(H):
        if pred(px[x, y]):
            if cur is None: cur = y
        else:
            if cur is not None:
                if y - cur >= minw: segs.append((cur, y - 1))
                cur = None
    if cur is not None and H - cur >= minw: segs.append((cur, H - 1))
    return segs

def merge_close(segs, gap=4):
    if not segs: return []
    out = [list(segs[0])]
    for s, e in segs[1:]:
        if s - out[-1][1] <= gap:
            out[-1][1] = e
        else:
            out.append([s, e])
    return [tuple(v) for v in out]

print()
print("=" * 92)
print("【标定 A】篮球场绿色区域 —— 横向跨度（应为 2 片并排 = 约 30~34m 含间隔）")
print("=" * 92)
rowsA = []
for y in range(300, 800, 10):
    segs = merge_close(row_segs(y, is_bk), gap=10)
    if segs:
        big = max(segs, key=lambda s: s[1] - s[0])
        rowsA.append((y, big, big[1] - big[0] + 1))
if rowsA:
    wmax = max(rowsA, key=lambda t: t[2])
    print("最宽行 y=%d  段 x %d~%d  宽 %d px" % (wmax[0], wmax[1][0], wmax[1][1], wmax[2]))
    # 篮球场 2 片并排：每片 15m 宽 → 总约 30m + 中间间隔
    for m in (15.0, 30.0, 32.0):
        print("   若跨越 %5.1f m → %.3f px/m" % (m, wmax[2] / m))

print()
print("=" * 92)
print("【标定 A2】篮球场绿色区域 —— 纵向跨度（应为 2 片纵排 = 约 56m+）")
print("=" * 92)
colsA = []
for x in range(60, 460, 10):
    segs = merge_close(col_segs(x, is_bk), gap=10)
    if segs:
        big = max(segs, key=lambda s: s[1] - s[0])
        colsA.append((x, big, big[1] - big[0] + 1))
if colsA:
    hmax = max(colsA, key=lambda t: t[2])
    print("最高列 x=%d  段 y %d~%d  高 %d px" % (hmax[0], hmax[1][0], hmax[1][1], hmax[2]))
    for m in (28.0, 56.0, 58.0):
        print("   若跨越 %5.1f m → %.3f px/m" % (m, hmax[2] / m))

print()
print("=" * 92)
print("【标定 C】★ 品红禁区（三秒区）—— 标准 4.9m 宽 x 5.8m 深")
print("=" * 92)
print("这是最可靠的：形状规则、颜色独特、尺寸标准。")
mag = []
for y in range(300, 800, 4):
    segs = merge_close(row_segs(y, is_magenta), gap=6)
    for s, e in segs:
        mag.append((y, s, e, e - s + 1))
if mag:
    wide = max(mag, key=lambda t: t[3])
    print("最宽禁区带 y=%d  x %d~%d  宽 %d px" % (wide[0], wide[1], wide[2], wide[3]))
    print("   若宽 4.9m（FIBA 三秒区）→ %.3f px/m" % (wide[3] / 4.9))
    print("   若宽 3.6m（NBA 三秒区）→ %.3f px/m" % (wide[3] / 3.6))
    print()
    print("★ 全部禁区带（前 24 条，按 y 排序）：")
    for y, s, e, w in sorted(mag)[:24]:
        print("   y=%-5d x %4d~%4d  宽 %3d px" % (y, s, e, w))

print()
print("=" * 92)
print("【标定 B】网球场淡蓝灰 —— 单打场地 23.77m x 10.97m")
print("=" * 92)
tc = []
for y in range(150, 700, 8):
    segs = merge_close(row_segs(y, is_tc), gap=8)
    if segs:
        for s, e in segs:
            tc.append((y, s, e, e - s + 1))
if tc:
    wide = max(tc, key=lambda t: t[3])
    print("最宽行 y=%d  x %d~%d  宽 %d px" % (wide[0], wide[1], wide[2], wide[3]))
    for m in (10.97, 23.77):
        print("   若 %5.2f m → %.3f px/m" % (m, wide[3] / m))
