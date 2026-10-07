# -*- coding: utf-8 -*-
"""v20 交付对比图（重做：横向并排、同高、标题在图上方留白内）
   ① compare-v19-vs-v20.png  —— "坡顶不再是实验楼的复制品"
   ② compare-apt-vs-tower.png —— 公寓 vs 实验楼 形制分家证明
"""
from PIL import Image, ImageDraw, ImageFont
import os

BASE = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22"
SAMPLES = os.path.join(BASE, "map-assets", "samples")
RB = os.path.join(BASE, ".workbuddy-gen", "rebuild")

def CN(sz, bold=False):
    for c in ([r"C:\Windows\Fonts\msyhbd.ttc"] if bold else [r"C:\Windows\Fonts\msyh.ttc"]):
        if os.path.exists(c):
            try: return ImageFont.truetype(c, sz)
            except Exception: pass
    return ImageFont.load_default()

F_TITLE = CN(25, True)
F_SUB   = CN(17)
F_NOTE  = CN(16)

def load(p):
    return Image.open(p).convert("RGB") if os.path.exists(p) else None

def fit(im, h):
    return im.resize((int(im.width * h / im.height), h), Image.LANCZOS)

def panel(img, title, sub, note, color):
    """一张带标题的单栏图（标题在图上方的留白里）"""
    H = 700
    im = fit(img, H)
    HEAD = 100
    canvas = Image.new("RGB", (im.width, H + HEAD + 48), (250, 250, 252))
    d = ImageDraw.Draw(canvas)
    d.text((10, 10), title, font=F_TITLE, fill=color)
    d.text((10, 50), sub, font=F_SUB, fill=(90, 90, 96))
    canvas.paste(im, (0, HEAD))
    d.text((10, HEAD + H + 12), note, font=F_NOTE, fill=(110, 110, 116))
    return canvas

# ── ① v19 Plan-B  →  v20 ──────────────────────────────────────────
old = load(os.path.join(RB, "v19-planb-only.png"))
new = load(os.path.join(RB, "apt-v20-f.png"))
if old and new:
    a = panel(old,
              "v19  Plan-B（旧）",
              "直接复用实验楼 hipRoof 四坡顶 · 冷蓝金属 · 锁边竖棱",
              "用户判定：是实验楼的复制品　墙色 0xA85A48 偏灰",
              (150, 60, 60))
    b = panel(new,
              "v20  公寓自己的坡顶（新）",
              "双坡 gable · 33deg · 贯穿全程脊 · 三角山墙 · 老虎窗 x2",
              "暖灰石板瓦 + 暖砖红墙 0xC08466　与实验楼在形制层面分家",
              (20, 110, 60))
    GAP = 16
    out = Image.new("RGB", (a.width + b.width + GAP, max(a.height, b.height)), (255, 255, 255))
    out.paste(a, (0, 0)); out.paste(b, (a.width + GAP, 0))
    p = os.path.join(SAMPLES, "compare-v19-vs-v20.png")
    out.save(p); print("已存", p, out.size)

# ── ② 实验楼 vs 公寓 ──────────────────────────────────────────────
c = load(os.path.join(RB, "tower-ref-v18.png"))
if c and new:
    a = panel(c,
              "实验楼 v18（对照组）",
              "四坡庑殿 hip · 27.5deg · 短脊 34% · 冷蓝金属 + 锁边竖棱",
              "U 形平面 · 无山墙 · 无老虎窗",
              (40, 60, 130))
    b = panel(new,
              "公寓 v20（新）",
              "双坡 gable · 33deg · 全程脊 100% · 暖灰石板瓦",
              "一字形板楼 · 三角山墙 · 老虎窗 x2",
              (140, 70, 30))
    GAP = 16
    out = Image.new("RGB", (a.width + b.width + GAP, max(a.height, b.height)), (255, 255, 255))
    out.paste(a, (0, 0)); out.paste(b, (a.width + GAP, 0))
    p = os.path.join(SAMPLES, "compare-apt-vs-tower.png")
    out.save(p); print("已存", p, out.size)
