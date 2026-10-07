# -*- coding: utf-8 -*-
"""从 big_court.png 裁出左下角铺装区并放大，看清石板分格规格"""
from PIL import Image

src = Image.open(r"C:/tmp/big_court.png").convert("RGB")
W, H = src.size
print("原图:", src.size)

# 左下角铺装区（目测 x 0~32%, y 76~100%）
box = (0, int(H*0.74), int(W*0.36), H)
crop = src.crop(box)
print("裁切:", box, "->", crop.size)
crop = crop.resize((crop.width*3, crop.height*3), Image.NEAREST)
crop.save(r"C:/tmp/ref-paving-zoom.png")
print("已存 ref-paving-zoom.png", crop.size)

# 顺带量一下铺装区与草地的明度
import colorsys
def lum(p):
    return 0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2]

# 铺装采样点（左下区域中心）
px_pave = []
for y in range(int(H*0.82), int(H*0.95), 3):
    for x in range(20, int(W*0.28), 3):
        px_pave.append(src.getpixel((x, y)))
py_gr = []
for y in range(int(H*0.62), int(H*0.72), 3):
    for x in range(60, int(W*0.35), 3):
        py_gr.append(src.getpixel((x, y)))

def stat(name, px):
    n = len(px)
    l = sorted(lum(p) for p in px)
    med = l[n//2]
    avg = sum(l)/n
    r = sum(p[0] for p in px)/n; g = sum(p[1] for p in px)/n; b = sum(p[2] for p in px)/n
    print("%-8s n=%5d  明度 中位%.1f 均%.1f   RGB均值(%.0f,%.0f,%.0f)" % (name, n, med, avg, r, g, b))

stat("铺装", px_pave)
stat("草地", py_gr)
