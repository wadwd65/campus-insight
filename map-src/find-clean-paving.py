# -*- coding: utf-8 -*-
"""在铺装区里自动找"最干净的窗口"，放大 8 倍供人工数格子；并用球场标定比例尺"""
from PIL import Image
import statistics

src = Image.open(r"C:/tmp/big_court.png").convert("RGB")
W, H = src.size
def lum(p): return 0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2]

# ① 找最干净窗口（标准差最小 + 均值不能太暗，排除阴影）
best = None
for y0 in range(800, H-70, 10):
    for x0 in range(20, 320, 10):
        px = [src.getpixel((x, y)) for y in range(y0, y0+64, 2) for x in range(x0, x0+64, 2)]
        ls = [lum(p) for p in px]
        sd = statistics.pstdev(ls)
        m = statistics.mean(ls)
        if m < 150: continue          # 排除暗区（阴影/树）
        score = sd
        if best is None or score < best[0]:
            best = (score, x0, y0, m)
print("最干净窗口: sd=%.2f  x=%d y=%d  均值%.1f" % best)
_, bx, by, bm = best

crop = src.crop((bx, by, bx+64, by+64))
crop.resize((512, 512), Image.NEAREST).save(r"C:/tmp/ref-paving-clean.png")
print("已存 ref-paving-clean.png (64x64 -> 512x512, 放大8倍)")

# ② 在这个干净窗口上做自相关，找网格周期
px = [[lum(src.getpixel((bx+x, by+y))) for x in range(64)] for y in range(64)]
row = px[32]
mean = statistics.mean(row)
rowc = [v-mean for v in row]
def autocorr(sig, lag):
    return sum(sig[i]*sig[i+lag] for i in range(len(sig)-lag)) / (len(sig)-lag)
ac = [(lag, autocorr(rowc, lag)) for lag in range(2, 40)]
ac_sorted = sorted(ac, key=lambda t: -t[1])
print("\n=== 水平自相关（前 6 个峰）===")
for lag, v in ac_sorted[:6]:
    print("  lag %2d px  相关 %.1f" % (lag, v))

col = [px[y][32] for y in range(64)]
mc = statistics.mean(col)
colc = [v-mc for v in col]
acv = sorted([(lag, autocorr(colc, lag)) for lag in range(2, 40)], key=lambda t: -t[1])
print("=== 垂直自相关（前 6 个峰）===")
for lag, v in acv[:6]:
    print("  lag %2d px  相关 %.1f" % (lag, v))
