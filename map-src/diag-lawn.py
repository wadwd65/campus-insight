# -*- coding: utf-8 -*-
"""草坪区像素诊断：把「草坪像一张糊面」变成可数量。
分三个环带采样（草坪内圈 / 草坪外带 / 远处兜底灰地），每带输出
  均值 / 标准差 / 唯一色数 / 色相跨度 —— 判断是「渐变糊」还是「有质感」。"""
import os, sys, colorsys
from PIL import Image
from collections import Counter

os.chdir(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else 'v15-now.png'
im = Image.open(SRC).convert('RGB')
W, H = im.size
print('图像 %dx%d' % (W, H))

px = im.load()

# 建筑群中心约在 (555, 380)，草坪环带以它为圆心换算屏幕半径
CX, CY = 555.0, 380.0

def sample(x0, y0, x1, y1, step=2):
    """矩形内采样，返回统计 dict"""
    vals = []
    for y in range(y0, y1, step):
        for x in range(x0, x1, step):
            vals.append(px[x, y])
    if not vals:
        return None
    n = len(vals)
    lum = [0.299*r + 0.587*g + 0.114*b for (r, g, b) in vals]
    m = sum(lum) / n
    var = sum((v - m) ** 2 for v in lum) / n
    sd = var ** 0.5
    cols = Counter(vals)
    # 色相分布（只统计有饱和度的）
    hues = []
    for (r, g, b) in vals:
        h, s, v = colorsys.rgb_to_hsv(r/255.0, g/255.0, b/255.0)
        if s > 0.05:
            hues.append(h * 360)
    hspan = (max(hues) - min(hues)) if hues else 0
    return dict(n=n, mean=m, sd=sd, uniq=len(cols),
                top=cols.most_common(3), hspan=hspan, sat=sum(1 for h in hues)/n)

BANDS = [
    ('草坪内圈 34~52m', 300, 210, 810, 560, 3),
    ('草坪外带 52~95m', 150, 90, 960, 690, 5),
    ('四角远处', 20, 20, 200, 200, 3),
]

# 先按「距中心屏幕距离」把像素分环，比矩形更准
import math
ring = {}
for y in range(0, H, 3):
    for x in range(0, W, 3):
        d = math.hypot(x - CX, y - CY)
        b = None
        if 100 <= d < 195: b = '环A  100~195px(≈草坪内圈)'
        elif 195 <= d < 330: b = '环B  195~330px(≈草坪外带)'
        elif d >= 330: b = '环C  >330px(远离中心)'
        if b:
            ring.setdefault(b, []).append(px[x, y])

print()
for k in sorted(ring):
    vals = ring[k]
    # 排除建筑/树（非绿色）——只留绿色像素，看草坪本身
    greens = [(r, g, b) for (r, g, b) in vals if g > r + 6 and g > b + 6]
    if not greens:
        print('%-28s 无绿色像素' % k); continue
    n = len(greens)
    lum = [0.299*r + 0.587*g + 0.114*b for (r, g, b) in greens]
    m = sum(lum)/n
    sd = (sum((v-m)**2 for v in lum)/n) ** 0.5
    cols = Counter(greens)
    gn = Counter([(r//8*8, g//8*8, b//8*8) for (r, g, b) in greens])
    print('%-28s 绿像素 %6d(%4.1f%%)  明度 %.1f±%.1f  唯一色 %5d  量化色 %4d  最深/最亮 %.0f/%.0f'
          % (k, n, 100.0*n/len(vals), m, sd, len(cols), len(gn),
             min(lum), max(lum)))
    print('    最常见 3 色: %s' % ', '.join('#%02X%02X%02X×%d' % (c[0], c[1], c[2], cnt) for c, cnt in cols.most_common(3)))

# 全图（排除建筑白/砖红/屋顶蓝）看地面
print()
allv = [px[x, y] for y in range(0, H, 4) for x in range(0, W, 4)]
def cls(c):
    r, g, b = c
    mx, mn = max(c), min(c)
    if mx - mn < 14 and 150 < (r+g+b)/3 < 205: return '浅灰(地面/铺装)'
    if r > g + 22 and r > b + 30 and r > 120: return '砖红(立面)'
    if b > r + 18: return '蓝(屋顶)'
    if g > r + 8 and g > b + 8: return '绿(草坪/树)'
    if mx > 215 and mx-mn < 26: return '白(窗套/云影)'
    return '其它'
c2 = Counter([cls(c) for c in allv])
print('全图粗分类（%d 采样点）:' % len(allv))
for k, v in c2.most_common():
    print('  %-18s %7d  %5.1f%%' % (k, v, 100.0*v/len(allv)))
