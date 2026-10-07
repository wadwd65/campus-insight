# -*- coding: utf-8 -*-
"""量「分格缝」本身的深度：先去掉大尺度明暗趋势（滚动中位），
再看残差的负向分布 —— 这才只反映缝，不受阴影/渐变干扰。

用法: python joint-depth.py <渲染图>

判据：残差 2% 分位 < -6（缝有可见的暗线），且 < -6 的像素占比 > 2%（线确实成网）
"""
import sys
from PIL import Image
import statistics

im = Image.open(sys.argv[1]).convert("RGB")
name = sys.argv[1].replace("\\", "/").split("/")[-1]
W, H = im.size
WIN = 21          # 滚动窗（要显著大于缝间距 2.1m*7.56px/m≈16px，取 21）


def lum(p):
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]


res = []
for y in range(int(H * 0.58), int(H * 0.88), 8):
    if y - WIN < 0 or y + WIN >= H:
        continue
    row = []
    for x in range(int(W * 0.20), int(W * 0.64)):
        q = im.getpixel((x, y))
        r, g, b = q
        if not (abs(r - g) < 10 and abs(g - b) < 12):
            continue
        row.append(lum(q))
    if len(row) < WIN * 2:
        continue
    for i in range(WIN, len(row) - WIN):
        med = statistics.median(row[i - WIN:i + WIN])
        if 150 < med < 210:                     # 只在铺装带上统计
            res.append(row[i] - med)

if not res:
    print(name, "没采到样本")
else:
    res.sort()
    n = len(res)
    p2 = res[int(n * 0.02)]
    p10 = res[int(n * 0.10)]
    neg = sum(1 for v in res if v < -6) / n * 100
    deep = sum(1 for v in res if v < -12) / n * 100
    print("=== %s  铺装缝去趋势残差（样本 %d）===" % (name, n))
    print("   2%% 分位 %+.1f   (缝最深处)      10%% 分位 %+.1f   中位 %+.1f"
          % (p2, p10, res[n // 2]))
    print("   残差 < -6  占比 %.1f%%          残差 < -12 占比 %.1f%%" % (neg, deep))
