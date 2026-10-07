"""把样张 A / B 的截图并排合成一张对比图（含标题条 + 底部说明）。
用途：给用户做技术路线选择。
"""
import os, io
from PIL import Image, ImageDraw, ImageFont

os.chdir(os.path.dirname(os.path.abspath(__file__)))

A = Image.open('shot-a.png').convert('RGB')
B = Image.open('shot-b.png').convert('RGB')

# 统一到同一尺寸（截图已不含任何文字框，无需裁切）
TW = 1120
def fit(im):
    w, h = im.size
    nh = int(h * TW / w)
    return im.resize((TW, nh), Image.LANCZOS)

A, B = fit(A), fit(B)
TH = max(A.height, B.height)

PAD, GAP, BAR = 30, 22, 92
FOOT = 150
W = PAD * 2 + TW * 2 + GAP
H = BAR + PAD + TH + 76 + FOOT

out = Image.new('RGB', (W, H), (243, 241, 236))
d = ImageDraw.Draw(out)

def font(sz, bold=False):
    for name in (('msyhbd.ttc' if bold else 'msyh.ttc'),
                 ('simhei.ttf'), ('Deng.ttf')):
        for root in (r'C:\Windows\Fonts',):
            p = os.path.join(root, name)
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, sz)
                except Exception:
                    pass
    return ImageFont.load_default()

F_TITLE = font(30, True)
F_SUB   = font(17)
F_LAB   = font(26, True)
F_TAG   = font(16)
F_FOOT  = font(17)
F_FOOTB = font(18, True)

# 顶部标题条
d.rectangle([0, 0, W, BAR], fill=(38, 40, 44))
d.text((PAD, 18), '实验楼 · 两种技术路线样张对比', font=F_TITLE, fill=(255, 255, 255))
d.text((PAD + 4, 56), '同一栋楼 · 同一套实拍取色 · 同一布局参数 · 唯一变量是渲染方式',
       font=F_SUB, fill=(168, 172, 178))

# 两块画布
y0 = BAR + PAD
for i, (im, lab, tagcol) in enumerate([
    (A, '样张 A   three.js 真 3D', (58, 96, 148)),
    (B, '样张 B   Canvas 2D 等距插画', (168, 92, 56)),
]):
    x0 = PAD + i * (TW + GAP)
    d.rectangle([x0, y0, x0 + TW, y0 + im.height], fill=(255, 255, 255))
    out.paste(im, (x0, y0))
    d.rectangle([x0, y0, x0 + TW, y0 + im.height], outline=(215, 212, 205), width=1)
    # 标签胶囊（放在图下方，避开内容）。右列靠右对齐，防止越出画布
    ty = y0 + im.height + 16
    cw = 368
    cx0 = min(x0, W - PAD - cw)
    d.rounded_rectangle([cx0, ty, cx0 + cw, ty + 48], radius=24, fill=tagcol)
    d.text((cx0 + 20, ty + 9), lab, font=F_LAB, fill=(255, 255, 255))

# 底部说明
fy = y0 + TH + 86
d.text((PAD, fy), '共同点：均为独立单文件 HTML · 零依赖 · 均可点击建筑（A 弹跳 / B 可加高亮）· 均按官方 360 航拍逐栋重建',
       font=F_FOOT, fill=(78, 80, 85))
d.text((PAD, fy + 30), '关键差异：A 可自由旋转、有实时光照与阴影，但加细节靠堆几何；B 观感更「游戏/插画」，视角锁死、改视角须重画',
       font=F_FOOT, fill=(78, 80, 85))
d.text((PAD, fy + 62), '文件体积：A 634 KB   |   B 21 KB（约 1/30）·  A 仍需 three.js 库 608 KB 打底',
       font=F_FOOTB, fill=(38, 40, 44))

out.save('compare-ab.png', quality=95)
print('compare-ab.png', out.size, os.path.getsize('compare-ab.png'), 'bytes')
