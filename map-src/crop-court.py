"""把 27837116_d.jpg 切成 4 个象限并放大，逐块精读建筑细节。
用途：核对"中庭到底有没有横穿的连廊""连廊在哪几栋之间"。
"""
import os
from PIL import Image

os.chdir(os.path.dirname(os.path.abspath(__file__)))
SRC = '../../map-assets/official-360/outdoor/27837116_d.jpg'
im = Image.open(SRC).convert('RGB')
W, H = im.size
print('src', W, H)

# 中庭核心区（原图正中偏下），放大 2x
# 从原图看，中庭大约在 x 380~1140, y 90~980
box = (360, 60, 1180, 1010)
crop = im.crop(box)
crop = crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS)
crop.save('q-court.png', quality=95)
print('q-court.png', crop.size)
