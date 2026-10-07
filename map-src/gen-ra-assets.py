# -*- coding: utf-8 -*-
# 生成 tower-13-assets.js：
#   RA_KAY  —— KayKit 楼/家具 gltf JSON（bin 内联为 data-URI；贴图剥掉，全模型共享 RA_KAY_TEX）
#   RA_KAY_TEX —— 共享图集 data-URI（citybits_texture.png，只此一份）
#   RA_GLB  —— Quaternius 树 GLB base64（自带贴图）
#   RA_KAY_LIST / RA_TREE_LIST —— 清单
# 全部资产 CC0 1.0（KayKit City Builder Bits / Quaternius@poly.pizza）
import json, base64, os

KAY = os.path.expandvars(r"%LOCALAPPDATA%\Temp\kaykit\KayKit-City-Builder-Bits-1.0-main\addons\kaykit_city_builder_bits\Assets")
GLTF = os.path.join(KAY, "gltf")
TEX  = os.path.join(KAY, "texture", "citybits_texture.png")
GLB  = os.path.expandvars(r"%LOCALAPPDATA%\Temp\glb-small")   # shrink-glb.py 重压后的 256² 贴图版
OUT  = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\.workbuddy-gen\rebuild\tower-13-assets.js"

KAY_MODELS = ["building_A", "building_B", "building_C", "building_D",
              "building_E", "building_F", "building_G", "building_H",
              "bench", "streetlight", "bush", "car_sedan", "firehydrant",
              "trash_A", "watertower"]
TREES = {
    "tree1": "t9KbsfYdXz.glb",
    "tree2": "aVOxaHRPWe.glb",
    "tree3": "QVOop92WmG.glb",
    "tree5": "YWjGDJ9F7g.glb",
    "tree6": "qZtx0AHhcy.glb",
    "pine":  "Zt62gceKXZ.glb",
}

def b64(b): return base64.b64encode(b).decode("ascii")

tex_uri = "data:image/png;base64," + b64(open(TEX, "rb").read())

kay = {}
for m in KAY_MODELS:
    doc = json.load(open(os.path.join(GLTF, m + ".gltf"), encoding="utf-8"))
    for buf in doc.get("buffers", []):
        uri = buf.get("uri", "")
        if uri.endswith(".bin"):
            buf["uri"] = "data:application/octet-stream;base64," + b64(open(os.path.join(GLTF, uri), "rb").read())
    # 剥掉贴图引用：RA 在运行时给所有材质统一挂共享图集
    doc.pop("images", None)
    doc.pop("samplers", None)
    doc.pop("textures", None)
    for mt in doc.get("materials", []):
        pbr = mt.get("pbrMetallicRoughness", {})
        pbr.pop("baseColorTexture", None)
    kay[m] = json.dumps(doc, separators=(",", ":"))

glbs = {name: b64(open(os.path.join(GLB, fn), "rb").read()) for name, fn in TREES.items()}

src = []
src.append("/* tower-13-assets.js —— 真人美术资产数据（CC0 1.0）")
src.append("   KayKit City Builder Bits 1.0: github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0")
src.append("   Quaternius 树: poly.pizza/u/Quaternius（绿树 6 个，经缩略图拼图目检选定）")
src.append("   ⚠️ 本文件是**纯数据**，build-campus.py 已把它排除在色号 lint 之外 */")
src.append("var RA_KAY = " + json.dumps(kay, separators=(",", ":")) + ";")
src.append("var RA_KAY_TEX = " + json.dumps(tex_uri) + ";")
src.append("var RA_GLB = " + json.dumps(glbs, separators=(",", ":")) + ";")
src.append("var RA_KAY_LIST = " + json.dumps(KAY_MODELS) + ";")
src.append("var RA_TREE_LIST = " + json.dumps(list(TREES.keys())) + ";")

out = "\n".join(src) + "\n"
open(OUT, "w", encoding="utf-8").write(out)
print("OK %d bytes -> %s" % (len(out.encode("utf-8")), OUT))
print("KayKit JSON 合计 %.1f KB；树 GLB 合计 %.1f MB" % (
    sum(len(v) for v in kay.values()) / 1024,
    sum(len(v) for v in glbs.values()) / 1048576 * 0.75))
