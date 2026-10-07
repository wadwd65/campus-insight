# -*- coding: utf-8 -*-
"""shrink-glb.py —— 把树 GLB 里的大 PNG 贴图降到 256² 并重建 GLB。

背景：6 棵树每个 2.2~2.4MB，其中 **2.08MB 全是 PNG 贴图**（且不同树之间
前两张图字节数完全相同 = 同一套通用图集被复制了 6 份）。
低模树贴图 256² 足够（屏幕最大 200px 上下），保留 alpha（叶簇是镂空片）。

做法：解析 GLB → 逐 bufferView 重排到新 BIN（图片 bufferView 换成新 PNG 字节，
其余原样复制）→ 更新 offset/length → 重写 GLB。
用法：python shrink-glb.py <输入目录> <输出目录>
"""
import json, struct, os, sys, io
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.expandvars(r"%LOCALAPPDATA%\Temp\glb")
DST = sys.argv[2] if len(sys.argv) > 2 else os.path.expandvars(r"%LOCALAPPDATA%\Temp\glb-small")
MAXSIDE = 256

def pad4(b, ch=b"\x00"):
    while len(b) % 4:
        b += ch
    return b

os.makedirs(DST, exist_ok=True)
for fn in sorted(os.listdir(SRC)):
    if not fn.endswith(".glb"):
        continue
    raw = open(os.path.join(SRC, fn), "rb").read()
    magic, ver, total = struct.unpack("<III", raw[:12])
    assert magic == 0x46546C67, fn + " 不是 GLB"
    off = 12
    js, bin_ = None, b""
    while off < len(raw):
        clen, ctype = struct.unpack("<II", raw[off:off + 8])
        chunk = raw[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk)
        elif ctype == 0x004E4942:
            bin_ = chunk
        off += 8 + clen
    assert js is not None, fn + " 无 JSON chunk"

    img_bv = set()
    for im in js.get("images", []):
        if "bufferView" in im:
            img_bv.add(im["bufferView"])

    new_bin = bytearray()
    for bi, bv in enumerate(js["bufferViews"]):
        o, l = bv.get("byteOffset", 0), bv["byteLength"]
        data = bin_[o:o + l]
        if bi in img_bv:
            im = Image.open(io.BytesIO(data))
            im = im.convert("RGBA")
            im.thumbnail((MAXSIDE, MAXSIDE), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, format="PNG", optimize=True)
            data = buf.getvalue()
        while len(new_bin) % 4:
            new_bin.append(0)
        bv["byteOffset"] = len(new_bin)
        bv["byteLength"] = len(data)
        new_bin += data

    js["buffers"][0]["byteLength"] = len(new_bin)
    jb = pad4(json.dumps(js, separators=(",", ":")).encode("utf-8"), b" ")
    bb = pad4(bytes(new_bin))
    out = b"glTF" + struct.pack("<II", 2, 12 + 8 + len(jb) + 8 + len(bb))
    out += struct.pack("<II", len(jb), 0x4E4F534A) + jb
    out += struct.pack("<II", len(bb), 0x004E4942) + bb
    open(os.path.join(DST, fn), "wb").write(out)
    print("%-20s %6.2fMB -> %5.2fMB" % (fn, len(raw) / 1048576, len(out) / 1048576))
print("输出目录:", DST)
