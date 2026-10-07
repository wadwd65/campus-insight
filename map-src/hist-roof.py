"""量化屋顶区明度分布：把屋顶区裁出来做直方图，看明度是否挤在一个窄带"""
import sys
from PIL import Image
import numpy as np
src = sys.argv[1]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.float32)
# 屋顶区（放大图对应的原图区域）
x0,y0,x1,y1 = 480,200,760,420
sub = a[y0:y1, x0:x1]
lum = 0.2126*sub[:,:,0] + 0.7152*sub[:,:,1] + 0.0722*sub[:,:,2]
h, edges = np.histogram(lum, bins=16, range=(0,255))
for i,c in enumerate(h):
    lo, hi = edges[i], edges[i+1]
    print(f'  {lo:5.0f}-{hi:5.0f}  {c:7d}  {"#"*int(c/ max(1,h.max()/50))}')
print(f'min {lum.min():.0f}  max {lum.max():.0f}  均值 {lum.mean():.1f}  标准差 {lum.std():.1f}')
# 色彩饱和度（B-R 差，蓝瓦的指标）
print(f'B-R 均值 {(sub[:,:,2]-sub[:,:,0]).mean():.1f}')
