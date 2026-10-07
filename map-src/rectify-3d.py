# -*- coding: utf-8 -*-
"""rectify-3d.py —— 把官方 3D 校园模型（斜视）校正成**正俯视平面图**

为什么：3d-clean.png 是目前唯一"既真实又好看"的母版（院墙围合、建筑成排、湖形干净）。
但它是斜视投影 ⇒ 直接照抄尺度会全错。做法：
  ① 用"非草地区域"（校园本体：草地纯色、校园内高方差）求最大连通域 → 凸包
  ② 取凸包的 4 个极角点 = 校园四角 → 单应变换校正成矩形（长宽比按实测校园 157:144）
  ③ 输出 4px/切片px 的正俯视底图，供后续逐要素读取（湖/跑道/建筑/广场/路网）
"""
import numpy as np
from PIL import Image

im = Image.open(r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\.workbuddy-gen\cmp\3d-clean.png").convert("RGB")
A = np.asarray(im).astype(np.int16)
H, W, _ = A.shape
print("原图", W, "x", H)

# ① 场外是纯色草地：取四角中位色当"草地基准"
corners = np.vstack([A[2:20, 2:20].reshape(-1, 3), A[2:20, -20:-2].reshape(-1, 3)])
grass = np.median(corners, axis=0)
print("场外草色", grass)
diff = np.abs(A - grass).sum(axis=2)
dev = diff > 40                      # 非草地（含校园本体 + 墙 + 城外道路）
# 形态学清一下
m = dev.copy()
for _ in range(2):
    m = m & np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1)
ys, xs = np.where(m)
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
a = np.array(best) * 2
print("校园本体连通域 %d 点" % len(a))

# ② 凸包 + 四角（按 (x+y)/（x-y) 极值取，适配旋转矩形）
P = a[:, ::-1].astype(float)          # (x, y)
s = P[:, 0] + P[:, 1]; d = P[:, 0] - P[:, 1]
c_tl = P[np.argmin(s)]; c_br = P[np.argmax(s)]
c_bl = P[np.argmin(d)]; c_tr = P[np.argmax(d)]
print("四角 左上%s 右上%s 右下%s 左下%s" % (tuple(c_tl), tuple(c_tr), tuple(c_br), tuple(c_bl)))

# ③ 单应校正 → 157×144 切片px ×4 = 628×576
OUTW, OUTH = 628, 576
# PIL 的 QUAD 变换：把源图里这四个点映射到目标矩形
im2 = im.transform((OUTW, OUTH), Image.QUAD,
                   (c_tl[0], c_tl[1], c_bl[0], c_bl[1], c_br[0], c_br[1], c_tr[0], c_tr[1]),
                   resample=Image.BICUBIC)
im2.save("plan-from-3d.png")
print("已输出 plan-from-3d.png（%dx%d，4px/切片px，正俯视）" % (OUTW, OUTH))
