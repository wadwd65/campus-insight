# -*- coding: utf-8 -*-
"""量真实铺装的：缝周期(px)、缝的暗度、板面明度起伏"""
from PIL import Image
import statistics

src = Image.open(r"C:/tmp/big_court.png").convert("RGB")
W, H = src.size
def lum(p): return 0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2]

# 在铺装区取几条水平扫描线，找"暗缝"位置
def scan(y0, x0, x1):
    vals = []
    for x in range(x0, x1):
        vals.append(lum(src.getpixel((x, y0))))
    return vals

# 目测铺装干净区：y 830~950, x 40~300
print("=== 水平扫描线（找缝）===")
allsp = []
for y in range(835, 950, 7):
    v = scan(y, 40, 300)
    m = statistics.mean(v)
    sd = statistics.pstdev(v)
    # 局部极小值 = 缝
    mins = []
    for i in range(2, len(v)-2):
        if v[i] <= v[i-1] and v[i] <= v[i+1] and v[i] < m - 0.55*sd:
            if not mins or i - mins[-1] > 3:
                mins.append(i)
    gaps = [mins[i+1]-mins[i] for i in range(len(mins)-1)]
    gaps = [g for g in gaps if 3 <= g <= 60]
    if gaps:
        allsp.extend(gaps)
        print("y=%3d  均值%.0f sd%.1f  缝数%2d  间距中位%.1f  间距=%s" %
              (y, m, sd, len(mins), statistics.median(gaps), gaps[:12]))

if allsp:
    print("\n★ 缝周期（全样本）: 中位 %.1f px  均 %.1f   n=%d" %
          (statistics.median(allsp), statistics.mean(allsp), len(allsp)))

# 缝 vs 板面 的明度差
print("\n=== 缝比板面暗多少 ===")
# 取一条线，排序后看 10 分位 vs 90 分位
v = scan(880, 40, 300)
vs = sorted(v)
lo = vs[int(len(vs)*0.10)]
hi = vs[int(len(vs)*0.85)]
print("板面(85分位) %.1f   缝(10分位) %.1f   差 %.1f  (%.1f%%)" %
      (hi, lo, hi-lo, (hi-lo)/hi*100))
