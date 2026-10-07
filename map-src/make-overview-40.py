# -*- coding: utf-8 -*-
"""把 40 张建筑图拼成一张总览图 + 生成索引 markdown。

为什么要总览图：用户要"每栋分开发一份"，但 40 张分散的图**没有全局印象**。
总览图让"哪一栋明显不对"一眼可见，再点开单张细看。
"""
from PIL import Image, ImageDraw, ImageFont
import json, os, io

BASE = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22"
SRC = os.path.join(BASE, "map-assets", "batch-40")


def CN(sz, bold=False):
    for c in ([r"C:\Windows\Fonts\msyhbd.ttc"] if bold else [r"C:\Windows\Fonts\msyh.ttc"]):
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, sz)
            except Exception:
                pass
    return ImageFont.load_default()


man = json.load(io.open(os.path.join(SRC, "index.json"), encoding="utf-8"))

COLS = 5
TH_W, TH_H = 360, 221          # 缩略图（保持 1410:865 ≈ 1.63）
PAD, GAP = 26, 14
LBL_H = 46
ROWS = (len(man) + COLS - 1) // COLS
W = PAD * 2 + COLS * TH_W + (COLS - 1) * GAP
H = PAD * 2 + ROWS * (TH_H + LBL_H) + (ROWS - 1) * GAP

F_TITLE = CN(34, True)
F_SUB = CN(19)
F_NUM = CN(19, True)
F_NAME = CN(18)
HEAD = 104

canvas = Image.new("RGB", (W, H + HEAD), (247, 248, 250))
d = ImageDraw.Draw(canvas)
d.text((PAD, 24), "校园 34 栋 · 建筑原型总览（v25）", font=F_TITLE, fill=(28, 32, 38))
d.text((PAD, 70),
       "6 个原型批次 · 学生公寓按平面图做成 5 个 L/U 形院落 · 含中文标识",
       font=F_SUB, fill=(104, 110, 118))

BATCH_COLOR = {
    "rect/wing": (150, 60, 60),
    "rect/core": (170, 95, 40),
    "U/tower":   (40, 105, 65),
    "round":     (55, 85, 150),
    "rect/hall": (120, 70, 140),
    "rect/null": (70, 80, 92),
}

for k, it in enumerate(man):
    r, c = divmod(k, COLS)
    x = PAD + c * (TH_W + GAP)
    y = HEAD + PAD + r * (TH_H + LBL_H + GAP)
    p = os.path.join(SRC, it["file"])
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert("RGB").resize((TH_W, TH_H), Image.LANCZOS)
    canvas.paste(im, (x, y))
    d.rectangle([x, y, x + TH_W - 1, y + TH_H - 1], outline=(214, 217, 222))
    col = BATCH_COLOR.get(it["batch"], (80, 80, 80))
    d.rectangle([x, y + TH_H, x + TH_W - 1, y + TH_H + LBL_H - 1], fill=(255, 255, 255))
    d.text((x + 8, y + TH_H + 6), "%02d" % it["i"], font=F_NUM, fill=col)
    d.text((x + 44, y + TH_H + 8), it["name"], font=F_NAME, fill=(30, 34, 40))
    d.text((x + 8, y + TH_H + 28), it["batch"] + "  ·  " + it["note"][:26], font=CN(14), fill=(120, 126, 134))

out = os.path.join(SRC, "_总览-40栋.png")
canvas.save(out)
print("已存", out, canvas.size)

# ── 索引 markdown ──
lines = ["# 校园 40 栋 · 建筑原型图（v22）", "",
         "> 正交视角：方位角 36°、俯角 52°；每栋独立建、独立取景、独立出图。",
         "> 总览图：`_总览-40栋.png`", "",
         "| # | 建筑 | 原型批次 | 特征 | 构件数 | 体量 (宽×高×深 m) | 图 |",
         "|---|---|---|---|---|---|---|"]
for it in man:
    s = it["size"]
    lines.append("| %02d | %s | `%s` | %s | %d | %.1f×%.1f×%.1f | `%s` |"
                 % (it["i"], it["name"], it["batch"], it["note"],
                    it["meshes"], s[0], s[1], s[2], it["file"]))
io.open(os.path.join(SRC, "README.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("已存", os.path.join(SRC, "README.md"))
