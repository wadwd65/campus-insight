# -*- coding: utf-8 -*-
"""v21 交付对比图：v20（灰）vs v21c（鲜艳）
   ★ 版式沿用 v20 的 panel() 配方：横向并排、同高、标题在图上方留白内、中文字体。
"""
from PIL import Image, ImageDraw, ImageFont
import os

BASE = r"C:/Users/123/WorkBuddy/2026-09-10-15-40-22"
SAMPLES = os.path.join(BASE, "map-assets", "samples")
RB = os.path.join(BASE, ".workbuddy-gen", "rebuild")

def CN(sz, bold=False):
    for c in ([r"C:/Windows/Fonts/msyhbd.ttc"] if bold else [r"C:/Windows/Fonts/msyh.ttc"]):
        if os.path.exists(c):
            try: return ImageFont.truetype(c, sz)
            except Exception: pass
    return ImageFont.load_default()

F_TITLE = CN(25, True)
F_SUB   = CN(17)
F_NOTE  = CN(16)

def panel(img, title, sub, note, color, H=700):
    im = img.resize((int(img.width * H / img.height), H), Image.LANCZOS)
    HEAD = 100
    canvas = Image.new("RGB", (im.width, H + HEAD + 48), (250, 250, 252))
    d = ImageDraw.Draw(canvas)
    d.text((10, 10), title, font=F_TITLE, fill=color)
    d.text((10, 50), sub, font=F_SUB, fill=(90, 90, 96))
    canvas.paste(im, (0, HEAD))
    d.text((10, HEAD + H + 12), note, font=F_NOTE, fill=(110, 110, 116))
    return canvas

old = Image.open(os.path.join(RB, "apt-v20-f.png")).convert("RGB")
new = Image.open(os.path.join(RB, "apt-v21c.png")).convert("RGB")

a = panel(old,
          "v20（旧）　颜色暗淡",
          "地面 0x6E6C68 / 坡面 0x8E887C —— 大面积面接近纯灰",
          "实测饱和度：地面 0.011 ・ 坡面 0.052 ・ 墙 0.195",
          (140, 60, 60))
b = panel(new,
          "v21c（新）　鲜艳版",
          "地面 0x7A6350（暖砂）・ 坡面 0x6E7A84（冷青灰）・ 墙 0xC87148",
          "实测饱和度：地面 0.121 ・ 坡面 0.071 ・ 墙 0.304　（全画面 0.069→0.104）",
          (20, 110, 60))

GAP = 16
out = Image.new("RGB", (a.width + b.width + GAP, max(a.height, b.height)), (255, 255, 255))
out.paste(a, (0, 0)); out.paste(b, (a.width + GAP, 0))
p = os.path.join(SAMPLES, "compare-v20-vs-v21.png")
out.save(p); print("已存", p, out.size)
