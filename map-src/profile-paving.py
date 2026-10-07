# -*- coding: utf-8 -*-
"""量铺装剖面的明度起伏，确认「缝是暗的」、且起伏幅度看得见"""
from PIL import Image
import statistics

im = Image.open(r"C:\tmp\v18-final.png").convert("RGB")
W, H = im.size


def lum(p):
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]


print("=== 剖面（每行只在低饱和灰像素上统计）===")
allv = []
for y in range(int(H * 0.62), int(H * 0.84), 6):
    row = []
    for x in range(int(W * 0.22), int(W * 0.62)):
        q = im.getpixel((x, y))
        r, g, b = q
        if abs(r - g) < 9 and abs(g - b) < 11 and 150 < lum(q) < 205:
            row.append(lum(q))
    if len(row) < 60:
        continue
    vals = sorted(row)
    m = statistics.mean(vals)
    lo = vals[int(len(vals) * 0.06)]
    hi = vals[int(len(vals) * 0.94)]
    allv.extend(vals)
    print("  y=%3d  n=%3d  均%.1f  低6%%=%.1f  高94%%=%.1f  起伏 %.1f  (%.1f%%)"
          % (y, len(vals), m, lo, hi, hi - lo, (hi - lo) / hi * 100))

if allv:
    allv.sort()
    lo = allv[int(len(allv) * 0.06)]
    hi = allv[int(len(allv) * 0.94)]
    print()
    print("★ 汇总：铺装剖面 低6%%=%.1f  高94%%=%.1f  起伏 **%.1f** (%.1f%%)  样本 %d"
          % (lo, hi, hi - lo, (hi - lo) / hi * 100, len(allv)))
    print("  判据：起伏 >=8 才算 分格看得见；0 就是 没画（旧版同心环实测就是 0）")
