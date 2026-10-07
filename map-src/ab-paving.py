# -*- coding: utf-8 -*-
"""把三个格尺寸变体的同一块铺装区域裁出来纵向拼图，供人工比较"""
from PIL import Image, ImageDraw

B = (0.20, 0.50, 0.62, 0.86)     # 相对比例
Z = 2.6
labels = [("4.2m", r"C:/tmp/ab-cell4.2.png"),
          ("2.1m", r"C:/tmp/ab-cell2.1.png"),
          ("1.4m", r"C:/tmp/ab-cell1.4.png")]

tiles = []
for lab, p in labels:
    im = Image.open(p).convert("RGB")
    W, H = im.size
    box = (int(W*B[0]), int(H*B[1]), int(W*B[2]), int(H*B[3]))
    c = im.crop(box).resize((int((box[2]-box[0])*Z), int((box[3]-box[1])*Z)), Image.NEAREST)
    d = ImageDraw.Draw(c)
    d.rectangle([0, 0, 190, 46], fill=(0, 0, 0))
    d.text((12, 12), "CELL " + lab, fill=(255, 255, 255))
    tiles.append(c)

w = max(t.width for t in tiles)
h = sum(t.height for t in tiles) + 8*(len(tiles)-1)
out = Image.new("RGB", (w, h), (255, 255, 255))
y = 0
for t in tiles:
    out.paste(t, (0, y)); y += t.height + 8
out.save(r"C:/tmp/AB-paving.png")
print("已存 AB-paving.png", out.size)

# 顺带量：每版的铺装明度与全图过曝（用像素统计，不靠眼睛）
def lum(p): return 0.2126*p[0]+0.7152*p[1]+0.0722*p[2]
for lab, p in labels:
    im = Image.open(p).convert("RGB")
    W, H = im.size
    # 铺装区：以画面中心为圆心、半径 0.14W 的环带内，排除建筑（用"低饱和 + 中高明度"近似）
    px = []
    for yy in range(int(H*0.52), int(H*0.88), 2):
        for xx in range(int(W*0.22), int(W*0.48), 2):
            q = im.getpixel((xx, yy))
            r, g, b = q
            if abs(r-g) < 8 and abs(g-b) < 10 and 120 < lum(q) < 200:
                px.append(lum(q))
    if px:
        px.sort()
        print("  CELL %-4s  铺装采样 n=%5d  中位明度 %.1f" % (lab, len(px), px[len(px)//2]))
