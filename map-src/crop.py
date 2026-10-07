import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
x0,y0,x1,y1 = [int(v) for v in sys.argv[3:7]]
scale = float(sys.argv[7])
im = Image.open(src).crop((x0,y0,x1,y1))
im = im.resize((int(im.width*scale), int(im.height*scale)), Image.LANCZOS)
im.save(dst)
print(dst, im.size)
