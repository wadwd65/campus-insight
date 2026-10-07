# -*- coding: utf-8 -*-
"""测算航拍图里屋面竖棱/阳台格栅的真实间距（像素），并换算成米。
判据：沿一条穿过竖棱的直线采样亮度，找周期性 → FFT 或零交叉计数。
"""
import sys, os, math
from PIL import Image

SRC = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\map-assets\official-360\outdoor\27836784_d.jpg"
im = Image.open(SRC).convert("RGB")
px = im.load()
W, H = im.size

def scan_line(x0, y0, x1, y1, n=200):
    """沿直线取样亮度序列"""
    out = []
    for i in range(n):
        t = i / (n - 1.0)
        x = int(round(x0 + (x1 - x0) * t))
        y = int(round(y0 + (y1 - y0) * t))
        x = max(0, min(W - 1, x)); y = max(0, min(H - 1, y))
        r, g, b = px[x, y]
        out.append(0.2126 * r + 0.7152 * g + 0.0722 * b)
    return out

def analyze(name, x0, y0, x1, y1, n=240):
    s = scan_line(x0, y0, x1, y1, n)
    avg = sum(s) / len(s)
    mean = avg
    # 去均值后数零交叉 → 周期 = 2 * 长度 / 交叉数
    centered = [v - mean for v in s]
    cross = 0
    for i in range(1, len(centered)):
        if centered[i - 1] < 0 <= centered[i]:
            cross += 1
    length = math.hypot(x1 - x0, y1 - y0)
    period_px = (2.0 * length / cross) if cross else 0
    amp = (max(s) - min(s))
    print("%-22s 长度 %6.1fpx  零交叉 %3d  周期 %6.2f px  振幅 %5.1f  均亮 %5.1f" %
          (name, length, cross, period_px, amp, mean))
    return period_px, amp

print("=" * 92)
print("扫描线测周期（周期 px = 2×线段长 / 零交叉数）")
print("=" * 92)

# 坡屋顶竖棱：右侧那栋的浅蓝坡屋顶（图上约 x=1100~1400, y=1050~1200）
analyze("坡屋顶竖棱A", 1080, 1100, 1420, 1130)
analyze("坡屋顶竖棱B", 1090, 1150, 1430, 1180)
analyze("坡屋顶竖棱C", 1150, 1200, 1450, 1230)

print()
print("=" * 92)
print("参考：整栋宽度的像素跨度（用于反推 px/m）")
print("=" * 92)
print("已知：实验楼场地已建立的 px/m = 7.564（屏幕换算），但那是 3D 场景的。")
print("这里要的是**航拍图自己的** px/m —— 需要用已知尺寸地物标定。")
print("可标定物：标准篮球场 28m×15m、网球场 23.77m×10.97m、田径跑道直道 84.39m")
