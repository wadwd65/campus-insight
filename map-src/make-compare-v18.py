# -*- coding: utf-8 -*-
"""生成 v17 → v18 对比图（同机位、左旧右新）"""
from PIL import Image, ImageDraw

OLD = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\map-assets\samples\实验楼-v17-渲染.png"
NEW = r"C:\tmp\v18-final.png"

a = Image.open(OLD).convert("RGB")
b = Image.open(NEW).convert("RGB")
print("v17:", a.size, " v18:", b.size)

# 统一高度
h = 720
def fit(im):
    w = int(im.width * h / im.height)
    return im.resize((w, h), Image.LANCZOS)

a2, b2 = fit(a), fit(b)
BAR = 54
out = Image.new("RGB", (a2.width + b2.width + 12, h + BAR), (250, 250, 252))
out.paste(a2, (0, BAR))
out.paste(b2, (a2.width + 12, BAR))

d = ImageDraw.Draw(out)
d.text((16, 20), "v17  分格不可见（7 环 x 0.03m = 0.227px，掩膜可见像素 0）",
       fill=(40, 40, 45))
d.text((a2.width + 28, 20), "v18  正交方格 2.1m（剖面起伏 32.2 vs 0）",
       fill=(20, 90, 40))

out_path = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\map-assets\samples\compare-v17-vs-v18.png"
out.save(out_path)
print("已存", out_path, out.size)
