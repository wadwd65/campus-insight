"""放大右上方那栋楼的立面，看窗户与砖墙细节。"""
import os
from PIL import Image
os.chdir(os.path.dirname(os.path.abspath(__file__)))
SRC = '../../map-assets/official-360/outdoor/27837116_d.jpg'
im = Image.open(SRC).convert('RGB')

# 右上方那栋楼（正立面斜视）
box = (700, 0, 1536, 470)
c = im.crop(box)
c = c.resize((c.width * 2, c.height * 2), Image.LANCZOS)
c.save('q-facade.png', quality=95)
print('q-facade.png', c.size)

# 左侧那栋带四坡顶的楼（同时看屋顶+立面）
box2 = (0, 380, 560, 900)
c2 = im.crop(box2)
c2 = c2.resize((c2.width * 2, c2.height * 2), Image.LANCZOS)
c2.save('q-corner.png', quality=95)
print('q-corner.png', c2.size)
