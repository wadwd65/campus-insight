# -*- coding: utf-8 -*-
"""从 1536x1536 官方航拍图裁切并放大指定区域，用于精读取色。
用法: python crop-official.py <图名> <x0> <y0> <x1> <y1> [放大倍数]
坐标是 0~1536 像素。输出到 map-assets/samples/crop-<图名>-<x0>_<y0>.png
"""
import sys, os
from PIL import Image

SRC_DIR = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\map-assets\official-360\outdoor"
OUT_DIR = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\map-assets\samples"

if len(sys.argv) < 6:
    print(__doc__)
    sys.exit(1)

name = sys.argv[1]
x0, y0, x1, y1 = [int(v) for v in sys.argv[2:6]]
scale = int(sys.argv[6]) if len(sys.argv) > 6 else 3

src = os.path.join(SRC_DIR, name)
if not os.path.exists(src):
    print("找不到：%s" % src)
    sys.exit(2)

im = Image.open(src).convert("RGB")
print("原图尺寸：%s" % (im.size,))
box = (x0, y0, x1, y1)
crop = im.crop(box)
w, h = crop.size
big = crop.resize((w * scale, h * scale), Image.NEAREST)

tag = "%s-%d_%d-%dx" % (os.path.splitext(name)[0], x0, y0, scale)
out = os.path.join(OUT_DIR, "crop-%s.png" % tag)
big.save(out)
print("裁切框：%s  尺寸 %dx%d → %dx%d" % (box, w, h, w * scale, h * scale))
print("输出：%s" % out)

# 同时打印该区域的若干采样点均值，便于直接取色
import statistics
px = crop.load()
samples = {}
step = max(1, min(w, h) // 12)
for yy in range(0, h, step):
    for xx in range(0, w, step):
        r, g, b = px[xx, yy]
        key = "#%02X%02X%02X" % (r, g, b)
        samples[key] = samples.get(key, 0) + 1
top = sorted(samples.items(), key=lambda kv: -kv[1])[:12]
print("\n该区域高频色（前 12）：")
for k, v in top:
    r, g, b = int(k[1:3], 16), int(k[3:5], 16), int(k[5:7], 16)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    print("  %s  x%-4d  明度 %.1f" % (k, v, lum))
