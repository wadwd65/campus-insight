# -*- coding: utf-8 -*-
"""用已知尺寸地物标定航拍图的 px/m，再反推屋面竖棱真实间距。
标定物：网球场（单打场地 23.77m x 10.97m，双打 23.77m x 10.97m；
       连围网区约 36m x 18m）、篮球场 28m x 15m。
做法：找地物边界（颜色突变），量像素跨度，除以真实米数。
"""
import sys
from PIL import Image

SRC = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\map-assets\official-360\outdoor\27836784_d.jpg"
im = Image.open(SRC).convert("RGB")
px = im.load()
W, H = im.size
print("图尺寸 %dx%d" % (W, H))

def is_court(c):
    """网球场底色：淡蓝灰 #A8C0D4 附近（B 明显大于 R，且较亮）"""
    r, g, b = c
    return b > 150 and b - r > 15 and g > 140

def is_green_court(c):
    """绿色场地：G 最大"""
    r, g, b = c
    return g > 120 and g - r > 30 and g - b > 30

def scan_row(y, pred):
    """扫描一行，返回所有满足 pred 的连续段 [(x_start, x_end)]"""
    segs, cur = [], None
    for x in range(W):
        if pred(px[x, y]):
            if cur is None:
                cur = x
        else:
            if cur is not None:
                if x - cur > 8:
                    segs.append((cur, x - 1))
                cur = None
    if cur is not None and W - cur > 8:
        segs.append((cur, W - 1))
    return segs

def scan_col(x, pred):
    segs, cur = [], None
    for y in range(H):
        if pred(px[x, y]):
            if cur is None:
                cur = y
        else:
            if cur is not None:
                if y - cur > 8:
                    segs.append((cur, y - 1))
                cur = None
    if cur is not None and H - cur > 8:
        segs.append((cur, H - 1))
    return segs

print()
print("=" * 90)
print("网球场（淡蓝灰）区域横向扫描")
print("=" * 90)
best = []
for y in range(0, H, 20):
    segs = scan_row(y, is_court)
    tot = sum(e - s for s, e in segs)
    if tot > 60:
        best.append((y, segs, tot))
for y, segs, tot in best[:6]:
    print("y=%-5d 段数 %d  合计宽 %d px  段: %s" % (y, len(segs), tot, segs[:4]))

if best:
    y0 = best[0][0]
    segs = best[0][1]
    # 取最宽段作为场地宽度
    widest = max(segs, key=lambda s: s[1] - s[0])
    wpx = widest[1] - widest[0] + 1
    print()
    print("★ 最宽网球场横向段：x %d~%d  = %d px" % (widest[0], widest[1], wpx))
    print("  若为双打场地宽 10.97m  → %.2f px/m" % (wpx / 10.97))
    print("  若为含围网区 18m      → %.2f px/m" % (wpx / 18.0))

print()
print("=" * 90)
print("网球场纵向扫描（场地长 23.77m）")
print("=" * 90)
if best:
    y0 = best[0][0]
    widest = max(best[0][1], key=lambda s: s[1] - s[0])
    xc = (widest[0] + widest[1]) // 2
    segs = scan_col(xc, is_court)
    print("x=%d 纵向段: %s" % (xc, segs))
    if segs:
        longest = max(segs, key=lambda s: s[1] - s[0])
        hpx = longest[1] - longest[0] + 1
        print("★ 最长纵向段 = %d px" % hpx)
        print("  若为场地长 23.77m → %.2f px/m" % (hpx / 23.77))
