# -*- coding: utf-8 -*-
"""fit3d-sim.py —— 用"主轴对齐 + 质心平移 + 尺度比"求 3D 母版→项目坐标的**相似变换**，
并把项目里的已知要素（湖轮廓、跑道中心）反投影到 3D 图上**目视验证**。
（相似变换比单应稳：4 个自由度、不放大形配误差；斜视压缩带来的残差用实景叠图评估。）
"""
import numpy as np, math, io
from PIL import Image, ImageDraw

im = Image.open(r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\.workbuddy-gen\cmp\3d-clean.png").convert("RGB")
A = np.asarray(im).astype(np.int16)
r, g, b = A[:, :, 0], A[:, :, 1], A[:, :, 2]
blue = (b > 150) & (b - r > 40) & (g - r > 15) & (b - g > 5)
ys, xs = np.where(blue)
pts = set(zip((ys // 2).tolist(), (xs // 2).tolist())); seen = set(); best = []
for p0 in list(pts):
    if p0 in seen: continue
    st = [p0]; seen.add(p0); comp = []
    while st:
        cy, cx = st.pop(); comp.append((cy, cx))
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                q = (cy + dy, cx + dx)
                if q in pts and q not in seen: seen.add(q); st.append(q)
    if len(comp) > len(best): best = comp
I = np.array(best) * 2.0
Iimg = np.vstack([I[:, 1], I[:, 0]]).T          # (X, Y) 图像

th = io.open('tower-10-campus.js', encoding='utf-8').read()
P = np.array(eval('[' + th.split('var CAMP_LAKE_POLY = [')[1].split('];')[0] + ']'), float)

def pca(pts):
    c = pts.mean(axis=0)
    q = pts - c
    cov = np.cov(q.T)
    w, v = np.linalg.eigh(cov)
    ax = v[:, np.argmax(w)]
    ang = math.atan2(ax[1], ax[0])
    size = math.sqrt(max(w))
    return c, ang, size

ci, ai, si = pca(Iimg)
cp, ap, sp = pca(P)
print("3D 图湖: 质心(%.0f,%.0f) 主轴 %.1f° 尺度 %.1f" % (ci[0], ci[1], math.degrees(ai), si))
print("项目湖:   质心(%.1f,%.1f) 主轴 %.1f° 尺度 %.1f" % (cp[0], cp[1], math.degrees(ap), sp))
dang = ai - ap
scl = si / sp
print("⇒ 旋转 %.1f°   尺度 %.3f (图像px / 切片px)" % (math.degrees(dang), scl))

def plan2img(x, y):
    dx, dy = x - cp[0], y - cp[1]
    X = ci[0] + (dx * math.cos(dang) - dy * math.sin(dang)) * scl
    Y = ci[1] + (dx * math.sin(dang) + dy * math.cos(dang)) * scl
    return X, Y

# 叠图验证：项目湖轮廓 + 跑道中心 + 校园四角 反投影到 3D 图
dr = ImageDraw.Draw(im)
pl = [plan2img(x, y) for x, y in P] + [plan2img(*P[0])]
dr.line(pl, fill=(255, 0, 0), width=5)
tx, ty = plan2img(92, 56)
dr.ellipse([tx - 9, ty - 9, tx + 9, ty + 9], outline=(255, 255, 0), width=5)   # 跑道中心
for lbl, (px, py) in {'校园西北角': (24, 28), '东北角': (181, 28),
                      '东南角': (181, 172), '西南角': (24, 172)}.items():
    X, Y = plan2img(px, py)
    dr.ellipse([X - 7, Y - 7, X + 7, Y + 7], outline=(0, 200, 255), width=4)
im.save('verify-3d-fit.png')
print("已输出 verify-3d-fit.png（红=项目湖轮廓、黄=项目跑道中心、青=校园四角，投到 3D 图上验证）")
