# -*- coding: utf-8 -*-
"""标定已确认：17.96 px/m（由品红禁区 88px / 4.9m 得出，网球场 296px/16.45m 交叉验证）。
现在用它测屋面竖棱、阳台开间、楼层高度的真实尺寸。
"""
from PIL import Image
import math

PX_PER_M = 17.959
BASE = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\map-assets\official-360\outdoor"

def load(n):
    return Image.open(BASE + "\\" + n).convert("RGB")

def scan(im, x0, y0, x1, y1, n=400):
    px = im.load(); W, H = im.size
    out = []
    for i in range(n):
        t = i / (n - 1.0)
        x = max(0, min(W - 1, int(round(x0 + (x1 - x0) * t))))
        y = max(0, min(H - 1, int(round(y0 + (y1 - y0) * t))))
        r, g, b = px[x, y]
        out.append(0.2126 * r + 0.7152 * g + 0.0722 * b)
    return out

def zero_cross_period(sig):
    m = sum(sig) / len(sig)
    c = [v - m for v in sig]
    cross = sum(1 for i in range(1, len(c)) if c[i - 1] < 0 <= c[i])
    return cross

print("=" * 94)
print("PX_PER_M = %.3f" % PX_PER_M)
print("=" * 94)

im84 = load("27836784_d.jpg")

print()
print("【1】坡屋顶竖向棱（直立锁边）—— 多线扫描取中位")
print("-" * 94)
# 右侧浅蓝坡屋顶，图上约 x 1050~1500, y 1000~1250
tests = [
    ("右上坡面", 1060, 1020, 1450, 1010),
    ("右中坡面", 1060, 1060, 1450, 1050),
    ("右下坡面", 1100, 1140, 1480, 1130),
    ("下坡面2", 1000, 1180, 1400, 1170),
]
res = []
for nm, x0, y0, x1, y1 in tests:
    sig = scan(im84, x0, y0, x1, y1, 500)
    L = math.hypot(x1 - x0, y1 - y0)
    cr = zero_cross_period(sig)
    per = (2.0 * L / cr) if cr else 0
    amp = max(sig) - min(sig)
    if per:
        res.append(per)
    print("  %-10s 长 %.0fpx  零交叉 %3d  周期 %6.2f px = %5.3f m  振幅 %5.1f"
          % (nm, L, cr, per, per / PX_PER_M if per else 0, amp))
if res:
    res.sort()
    med = res[len(res) // 2]
    print("  ★ 中位周期 %.2f px = %.3f m" % (med, med / PX_PER_M))

print()
print("【2】楼层高度（横向带窗的层间距）—— 数窗带条数")
print("-" * 94)
# 左上那栋卡其楼立面，图上 x 60~450, y 0~230。立面是斜的，沿垂直方向扫
# 改用「竖直扫描线」穿过楼立面
def vscan(im, x, y0, y1, n=500):
    px = im.load()
    out = []
    for i in range(n):
        t = i / (n - 1.0)
        y = max(0, min(im.size[1] - 1, int(round(y0 + (y1 - y0) * t))))
        r, g, b = px[x, y]
        out.append(0.2126 * r + 0.7152 * g + 0.0722 * b)
    return out

for x in (150, 220, 300, 380):
    sig = vscan(im84, x, 0, 240, 400)
    cr = zero_cross_period(sig)
    print("  x=%-4d 零交叉 %3d  → 若有 %d 个窗带，层高约 %.3f m"
          % (x, cr, cr, (240 / max(cr, 1)) / PX_PER_M * (cr / max(cr, 1)) if cr else 0))
    # 直接给：240px 跨度内有多少个明暗周期，每周期 = 1 层
    if cr:
        per = 2.0 * 240 / cr
        print("          周期 %.2f px = %.3f m/层" % (per, per / PX_PER_M))

print()
print("【3】阳台开间（每间一个阳台，横向节奏）")
print("-" * 94)
# 左上楼沿横向量阳台节奏
for y in (40, 90, 140):
    sig = scan(im84, 60, y, 450, y, 500)
    L = 390
    cr = zero_cross_period(sig)
    per = (2.0 * L / cr) if cr else 0
    print("  y=%-4d 零交叉 %3d  周期 %6.2f px = %5.3f m/开间" % (y, cr, per, per / PX_PER_M if per else 0))
