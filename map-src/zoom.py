# -*- coding: utf-8 -*-
"""裁一块并放大，用于真读截图细节"""
import sys
from PIL import Image
src = Image.open(sys.argv[1]).convert("RGB")
W, H = src.size
print("原图:", src.size)
# 参数: out x0 y0 x1 y1 zoom
out = sys.argv[2]
x0, y0, x1, y1, z = [float(v) for v in sys.argv[3:8]]
box = (int(W*x0), int(H*y0), int(W*x1), int(H*y1))
c = src.crop(box)
c = c.resize((int(c.width*z), int(c.height*z)), Image.NEAREST)
c.save(out)
print("裁 %s -> %s (放大 %.1fx)" % (str(box), str(c.size), z))
