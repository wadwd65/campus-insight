# -*- coding: utf-8 -*-
"""从官方总平面公示图里**客观提取**建筑块的位置与尺寸。

思路（避开颜色阈值不可靠的问题）：
  平面图里「校园外的白底 + 灰色城市街区」是**巨大连通块**，
  而「校园内的建筑」是**被绿地/道路/铺装分割开的小块**。
  ⇒ 找浅色连通域，按面积分流：巨块 = 背景，中小块 = 建筑。
"""
import io, json, sys
import numpy as np
from PIL import Image
from collections import deque

SRC = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\.workbuddy-gen\cmp\plane1.png"
OUT = r"C:\tmp\plan\blocks.json"

im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.int16)

# 校园本体切片（含少量周边，便于识别背景巨块）
Y0, Y1, X0, X1 = 700, 890, 580, 790
sub = a[Y0:Y1, X0:X1]
H, W = sub.shape[:2]
r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]
lum = 0.299 * r + 0.587 * g + 0.114 * b
sat = sub.max(axis=2) - sub.min(axis=2)
print('切片 %dx%d' % (W, H))

# ── ① 用地红线（红虚线）范围 → 定校园像素边界 ────────────────────
red = (r > g + 28) & (r > b + 28) & (r > 120)
ys, xs = np.nonzero(red)
if len(xs):
    print('红线像素 %d 个，x %d~%d  y %d~%d' % (len(xs), xs.min(), xs.max(), ys.min(), ys.max()))

# ── ② 浅色掩膜 ────────────────────────────────────────────────
light = (lum > 192) & (sat < 40)
print('浅色占比 %.1f%%' % (100.0 * light.sum() / light.size))

# ── ③ 连通域（BFS，4 邻域足够）────────────────────────────────
lab = np.zeros((H, W), np.int32)
cur = 0
blocks = []
for y in range(H):
    for x in range(W):
        if not light[y, x] or lab[y, x]:
            continue
        cur += 1
        q = deque([(y, x)])
        lab[y, x] = cur
        pts = []
        while q:
            cy, cx = q.popleft()
            pts.append((cy, cx))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < H and 0 <= nx < W and light[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = cur
                    q.append((ny, nx))
        P = np.array(pts)
        blocks.append({
            'id': cur,
            'n': len(pts),
            'y0': int(P[:, 0].min()), 'y1': int(P[:, 0].max()),
            'x0': int(P[:, 1].min()), 'x1': int(P[:, 1].max()),
        })

print('连通块总数 %d' % len(blocks))
blocks.sort(key=lambda t: -t['n'])
print()
print('=== 最大的 8 块（应为背景）===')
for t in blocks[:8]:
    print('  n=%6d  bbox %3d,%3d - %3d,%3d' % (t['n'], t['x0'], t['y0'], t['x1'], t['y1']))

# ── ④ 建筑 = 中等面积、形状不太离谱 ────────────────────────────
bld = []
for t in blocks:
    n = t['n']
    if not (25 <= n <= 3000):
        continue
    w = t['x1'] - t['x0'] + 1
    h = t['y1'] - t['y0'] + 1
    if w < 3 or h < 3 or w > 60 or h > 60:
        continue
    fill = n / float(w * h)
    if fill < 0.30:                       # 太稀疏 = 噪声/线状物
        continue
    bld.append({'n': n, 'w': w, 'h': h, 'fill': round(fill, 2),
                'cx': (t['x0'] + t['x1']) / 2.0, 'cy': (t['y0'] + t['y1']) / 2.0,
                'x0': t['x0'], 'y0': t['y0'], 'x1': t['x1'], 'y1': t['y1']})
bld.sort(key=lambda t: -t['n'])
print()
print('=== 候选建筑块 %d 个（按面积降序，前 40）===' % len(bld))
print('%5s %4s %4s %5s  %7s %7s' % ('n', 'w', 'h', 'fill', 'cx', 'cy'))
for t in bld[:40]:
    print('%5d %4d %4d %5.2f  %7.1f %7.1f' % (t['n'], t['w'], t['h'], t['fill'], t['cx'], t['cy']))

json.dump({'slice': [X0, Y0, X1, Y1], 'blocks': bld},
          io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print()
print('已写', OUT)
