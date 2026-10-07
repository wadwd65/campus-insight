# -*- coding: utf-8 -*-
"""rectify-3d2.py —— 用**湖轮廓**做单应标定，把官方 3D 模型校正成正俯视平面图。

为什么用湖：① 湖在 3D 图与项目坐标里都有（已从 Apple 图抠出真实轮廓）；
② 湖是**平面要素**，3D 斜视下不会像建筑那样因高度产生位移 ⇒ 标定干净。
做法：3D 图里按蓝色抠出湖 → 24 点轮廓；与项目 CAMP_LAKE_POLY（28 点）按角度配对
     → 最小二乘解单应 H（切片→图像）→ 用 H 生成正俯视底图（4px/切片px）。
"""
import numpy as np, math, io
from PIL import Image

SRC = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\.workbuddy-gen\cmp\3d-clean.png"
im = Image.open(SRC).convert("RGB")
A = np.asarray(im).astype(np.int16)
H0, W0, _ = A.shape
r, g, b = A[:, :, 0], A[:, :, 1], A[:, :, 2]

# ① 3D 图里的湖：蓝（b 明显高、g 次之、r 低）
lake = (b > 150) & (b - r > 40) & (g - r > 15) & (b - g > 5)
ys, xs = np.where(lake)
print("蓝色像素", len(ys))
pts = set(zip((ys // 2).tolist(), (xs // 2).tolist()))
seen = set(); best = []
for p0 in list(pts):
    if p0 in seen: continue
    st = [p0]; seen.add(p0); comp = []
    while st:
        cy, cx = st.pop(); comp.append((cy, cx))
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                q = (cy + dy, cx + dx)
                if q in pts and q not in seen:
                    seen.add(q); st.append(q)
    if len(comp) > len(best): best = comp
lc = np.array(best) * 2
lcx, lcy = lc[:, 1].mean(), lc[:, 0].mean()
print("3D 图湖心 (%.0f,%.0f)  采样点 %d" % (lcx, lcy, len(lc)))
N = 24
far = np.zeros(N)
for y, x in lc:
    a = math.atan2(y - lcy, x - lcx)
    k = int((a + math.pi) / (2 * math.pi) * N) % N
    far[k] = max(far[k], math.hypot(x - lcx, y - lcy))
img_poly = [(lcx + math.cos(-math.pi + (k + .5) / N * 2 * math.pi) * far[k],
             lcy + math.sin(-math.pi + (k + .5) / N * 2 * math.pi) * far[k]) for k in range(N)]

# ② 项目里湖的真实轮廓（切片坐标，来自 tower-10）
th = io.open('tower-10-campus.js', encoding='utf-8').read()
P = np.array(eval('[' + th.split('var CAMP_LAKE_POLY = [')[1].split('];')[0] + ']'), dtype=float)
pcx, pcy = P[:, 0].mean(), P[:, 1].mean()
M = 28
pfar = np.zeros(M)
for x, y in P:
    a = math.atan2(y - pcy, x - pcx)
    k = int((a + math.pi) / (2 * math.pi) * M) % M
    pfar[k] = max(pfar[k], math.hypot(x - pcx, y - pcy))
proj_poly = [(pcx + math.cos(-math.pi + (k + .5) / M * 2 * math.pi) * pfar[k],
              pcy + math.sin(-math.pi + (k + .5) / M * 2 * math.pi) * pfar[k]) for k in range(M)]

# ③ 角度对齐：两套轮廓都是"从 -π 开始每份一个点"，直接按角度重采样到 16 对
def resample(poly, cx, cy, n):
    out = []
    for i in range(n):
        a = -math.pi + (i + .5) / n * 2 * math.pi
        # 找原 poly 中角度最接近的点
        bestp, bd = None, 1e9
        for (x, y) in poly:
            aa = math.atan2(y - cy, x - cx)
            dd = abs((aa - a + math.pi) % (2 * math.pi) - math.pi)
            if dd < bd: bd, bestp = dd, (x, y)
        out.append(bestp)
    return out
K = 16
srcp = resample(proj_poly, pcx, pcy, K)          # 切片坐标
dstp = resample(img_poly, lcx, lcy, K)           # 图像坐标

# ④ 解单应 H：切片(x,y) → 图像(X,Y)
Am = []; bv = []
for (x, y), (X, Y) in zip(srcp, dstp):
    Am.append([x, y, 1, 0, 0, 0, -x * X, -y * X]); bv.append(X)
    Am.append([0, 0, 0, x, y, 1, -x * Y, -y * Y]); bv.append(Y)
h = np.linalg.lstsq(np.array(Am, float), np.array(bv, float), rcond=None)[0]
print("单应系数", np.round(h, 6))

# 残差自检
def fwd(x, y):
    d = h[6] * x + h[7] * y + 1
    return ((h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d)
err = [math.hypot(fwd(x, y)[0] - X, fwd(x, y)[1] - Y) for (x, y), (X, Y) in zip(srcp, dstp)]
print("标定残差 平均 %.1f px  最大 %.1f px（图像 px，越小越好）" % (np.mean(err), np.max(err)))

# ⑤ 生成正俯视底图：输出范围 = 切片 x 20~185 / y 24~176，4px per 切片px
X0, X1, Y0, Y1 = 20.0, 185.0, 24.0, 176.0
SC = 4.0
OW, OH = int((X1 - X0) * SC), int((Y1 - Y0) * SC)
# PIL PERSPECTIVE：对每个输出像素 (u,v) 反算输入 (X,Y)
# 先算 Hinv（图像→切片），再转成"输出像素→输入像素"
Ainv = np.array([[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1.0]])
Hinv = np.linalg.inv(Ainv)          # 图像 → 切片
# 输出像素 (u,v) → 切片 (X0+u/SC, Y0+v/SC) → 图像
A2 = np.array([[1.0 / SC, 0, X0], [0, 1.0 / SC, Y0], [0, 0, 1.0]])
Htot = Ainv.dot(A2)                 # 输出像素 → 图像
c = (Htot / Htot[2, 2]).flatten()
out = im.transform((OW, OH), Image.PERSPECTIVE, c, resample=Image.BICUBIC)
out.save('plan-from-3d.png')
print("已输出 plan-from-3d.png  %dx%d（%g px/切片px；左上角=切片(%g,%g)）" % (OW, OH, SC, X0, Y0))
