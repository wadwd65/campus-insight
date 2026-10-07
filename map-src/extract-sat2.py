# -*- coding: utf-8 -*-
"""extract-sat2.py —— 卫星影像 → 真实建筑清单（切片坐标）

标定（两条独立依据，互为校验）：
  ① 绝对尺度：z18 @ lat30.3975 = 0.5151 m/图像px —— Web Mercator 精确值
  ② 项目尺度：1 切片px = 3.5m ⇒ **1 切片px = 6.80 图像px**
  ③ 锚点：跑道中心 图像(711,384) ↔ 切片(92,56)（跑道连通域已隔离，长宽比 1.76 = 标准跑道）
  ④ 旋转：对跑道像素做 PCA 取主轴角（校园整体可能相对正北有偏角）
"""
import numpy as np, math
from PIL import Image

A = np.asarray(Image.open('sat-campus.png').convert('RGB')).astype(np.int16)
r, g, b = A[:, :, 0], A[:, :, 1], A[:, :, 2]
mx = np.maximum(np.maximum(r, g), b)

def comps(mask, min_px, step=2):
    ys, xs = np.where(mask)
    pts = set(zip((ys // step).tolist(), (xs // step).tolist()))
    seen = set(); out = []
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
        if len(comp) * step * step >= min_px:
            out.append(np.array(comp) * step)
    return out

# ① 跑道（红色最大连通域）→ 中心 + 主轴角
red = (r > 110) & (r - g > 18) & (r - b > 8)
rc = sorted(comps(red, 4000), key=len, reverse=True)
track_pts = rc[0]
tcx, tcy = track_pts[:, 1].mean(), track_pts[:, 0].mean()
X = track_pts[:, 1] - tcx; Y = track_pts[:, 0] - tcy
cov = np.cov(np.vstack([X, Y]))
w, v = np.linalg.eigh(cov)
axis = v[:, np.argmax(w)]                       # 主轴（长轴）
ang = math.degrees(math.atan2(axis[1], axis[0]))  # 相对图像 y 轴的方向
rot = math.radians(ang - 90)                     # 主轴相对竖直的**偏差**（校园整体偏角）
print("跑道中心 图像(%.0f,%.0f)；主轴方向 %.1f° ⇒ 校园相对正北偏 %.1f°" % (tcx, tcy, ang, math.degrees(rot)))

MPP = 0.5151
PX_PER_SLICE = 3.5 / MPP                          # 6.80
def to_slice(x, y):
    dx, dy = x - tcx, y - tcy
    # 先反旋转，再缩放
    ca, sa = math.cos(-rot), math.sin(-rot)
    rx = dx * ca - dy * sa
    ry = dx * sa + dy * ca
    return (92 + rx / PX_PER_SLICE, 56 + ry / PX_PER_SLICE)

# ② 屋顶 → 连通域 → 合并同栋碎片（bbox 邻近者用两轮并查集；此处用"先粗筛+去小碎块"）
roof = (mx < 95) & (b >= g) & (g >= r - 6)
rcomp = comps(roof, 200, 2)
rcomp.sort(key=len, reverse=True)
rects = []
for a in rcomp:
    x0, y0, x1, y1 = a[:, 1].min(), a[:, 0].min(), a[:, 1].max(), a[:, 0].max()
    w, h = x1 - x0, y1 - y0
    if w < 12 or h < 12: continue
    fill = len(a) / max(1.0, w * h / 4.0)        # step=2 ⇒ 面积为 1/4
    if fill < 0.35: continue                     # 太散的点阵不是屋顶
    p0 = to_slice(x0, y0); p1 = to_slice(x1, y1)
    xs_ = [p0[0], p1[0]]; ys_ = [p0[1], p1[1]]
    rects.append({
        'cx': (min(xs_) + max(xs_)) / 2, 'cy': (min(ys_) + max(ys_)) / 2,
        'w': abs(max(xs_) - min(xs_)) * 3.5, 'd': abs(max(ys_) - min(ys_)) * 3.5,
        'px': len(a) * 4
    })
rects.sort(key=lambda t: -(t['w'] * t['d']))
print("\n真实建筑候选 %d 栋（按面积排序，切片中心 + 米制尺寸）:" % len(rects))
for i, t in enumerate(rects[:30]):
    print("  %2d) 中心(%6.1f,%6.1f)  %5.0f×%-5.0f m  屋顶%6dpx" % (i + 1, t['cx'], t['cy'], t['w'], t['d'], t['px']))

# ③ 可视化验证
im = Image.open('sat-campus.png').convert('RGB'); pi = im.load(); W2, H2 = im.size
for a in rcomp:
    x0, y0, x1, y1 = int(a[:, 1].min()), int(a[:, 0].min()), int(a[:, 1].max()), int(a[:, 0].max())
    if (x1 - x0) < 12 or (y1 - y0) < 12: continue
    for x in range(max(0, x0), min(W2, x1)):
        pi[x, max(0, y0)] = (255, 60, 0); pi[x, min(H2 - 1, y1)] = (255, 60, 0)
    for y in range(max(0, y0), min(H2, y1)):
        pi[max(0, x0), y] = (255, 60, 0); pi[min(W2 - 1, x1), y] = (255, 60, 0)
im.crop((470, 40, 1330, 1200)).resize((619, 835), Image.LANCZOS).save('sat-detect2.png')
print("\n已保存 sat-detect2.png（橙框 = 程序认定的屋顶）")
