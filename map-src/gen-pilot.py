# -*- coding: utf-8 -*-
# 生成「真人美术小样」单文件 pilot.html：
# 内嵌 three r149 + GLTFLoader r147 + KayKit 建筑/家具(gltf+json内联) + Quaternius 树(glb base64)
# 全部资产 CC0：KayKit City Builder Bits 1.0 / Quaternius(poly.pizza)
import json, base64, os, io

KAY = r"C:\Users\123\AppData\Local\Temp\kaykit\KayKit-City-Builder-Bits-1.0-main\addons\kaykit_city_builder_bits\Assets"
# bash /tmp 在 Windows 的真实位置
if not os.path.isdir(KAY):
    KAY = os.path.expandvars(r"%LOCALAPPDATA%\Temp\kaykit\KayKit-City-Builder-Bits-1.0-main\addons\kaykit_city_builder_bits\Assets")
GLTF = os.path.join(KAY, "gltf")
TEX  = os.path.join(KAY, "texture", "citybits_texture.png")
GLB  = r"C:\Users\123\AppData\Local\Temp\glb"
if not os.path.isdir(GLB):
    GLB = os.path.expandvars(r"%LOCALAPPDATA%\Temp\glb")
OUT  = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\map-assets\real-art-pilot\pilot.html"

KAY_MODELS = ["building_A", "building_C", "building_D", "building_F",
              "bench", "streetlight", "bush", "car_sedan", "firehydrant", "watertower"]
TREES = {  # js名: glb文件（v2：全绿，经缩略图拼图核验；红枫/红灌木/方块树/黄桦已淘汰）
    "tree1": "t9KbsfYdXz.glb",   # Tree 绿·阔叶
    "tree2": "aVOxaHRPWe.glb",   # Tree 绿·阔叶
    "tree3": "QVOop92WmG.glb",   # Tree 绿·双球高型
    "tree5": "YWjGDJ9F7g.glb",   # Tree 绿·细高双球
    "tree6": "qZtx0AHhcy.glb",   # Tree 绿·圆冠饱满
    "pine":  "Zt62gceKXZ.glb",   # Pine 绿·针叶（点缀）
}

def b64(b): return base64.b64encode(b).decode("ascii")

tex_b64 = b64(open(TEX, "rb").read())

kay_json = {}
for m in KAY_MODELS:
    doc = json.load(open(os.path.join(GLTF, m + ".gltf"), encoding="utf-8"))
    for buf in doc.get("buffers", []):
        uri = buf.get("uri", "")
        if uri.endswith(".bin"):
            buf["uri"] = "data:application/octet-stream;base64," + b64(open(os.path.join(GLTF, uri), "rb").read())
    for img in doc.get("images", []):
        if img.get("uri", "").endswith(".png"):
            img["uri"] = "data:image/png;base64," + tex_b64
    kay_json[m] = json.dumps(doc, separators=(",", ":"))

tree_b64 = {}
for name, fn in TREES.items():
    tree_b64[name] = b64(open(os.path.join(GLB, fn), "rb").read())

three_js = open(r"C:\Users\123\AppData\Local\Temp\three.min.js", encoding="utf-8", errors="ignore").read()
if not three_js.strip().startswith("/*"):
    three_js = open(os.path.expandvars(r"%LOCALAPPDATA%\Temp\three.min.js"), encoding="utf-8", errors="ignore").read()
gltf_loader = open(r"C:\Users\123\AppData\Local\Temp\GLTFLoader.js", encoding="utf-8", errors="ignore").read()
if "GLTFLoader" not in gltf_loader[:5000]:
    gltf_loader = open(os.path.expandvars(r"%LOCALAPPDATA%\Temp\GLTFLoader.js"), encoding="utf-8", errors="ignore").read()

scene_js = r"""
/* ══ 真人美术小样：KayKit(CC0) 建筑/家具 + Quaternius(CC0) 树 ══ */
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

var scene = new THREE.Scene();
scene.background = new THREE.Color(0xBFD9E8);
scene.fog = new THREE.Fog(0xBFD9E8, 180, 420);

var camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, 1000);
camera.position.set(58, 36, 104);
camera.lookAt(0, 4, 0);

/* 光照：对齐 campus 的太阳+半球光 */
var sun = new THREE.DirectionalLight(0xFFF2E0, 1.15);
sun.position.set(60, 90, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
sun.shadow.camera.far = 400;
sun.shadow.bias = -0.0008;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xCFE4F7, 0x8A9A6A, 0.55));
scene.add(new THREE.AmbientLight(0xFFFFFF, 0.18));

/* 地面 + 道路 + 人行道 */
function flat(w, h, color, x, z, y) {
  var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ color: color }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y === undefined ? 0 : y, z);
  m.receiveShadow = true;
  scene.add(m); return m;
}
flat(220, 160, 0x6E8B4A, 0, 0);            /* 草地 */
flat(220, 9, 0x4A4A4E, 0, 22, 0.02);       /* 车行道 */
flat(220, 3.2, 0xB8B4AC, 0, 15.6, 0.03);   /* 人行道 */
flat(220, 1.2, 0x8F8B83, 0, 17.9, 0.025);  /* 路缘 */
for (var dlx = -100; dlx <= 100; dlx += 8)  /* 车道虚线 */
  flat(3, 0.35, 0xE8E4D8, dlx, 22, 0.04);

/* ── 资产装配 ── */
var loader = new THREE.GLTFLoader();
var PENDING = 0, READY = false;

function shadowify(root) {
  root.traverse(function (o) {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
}
/* 按目标高度归一化并落到地面 (x,z) */
function place(root, targetH, x, z, rotY) {
  shadowify(root);
  var box = new THREE.Box3().setFromObject(root);
  var size = new THREE.Vector3(); box.getSize(size);
  var s = targetH / (size.y || 1);
  root.scale.setScalar(s);
  if (rotY) root.rotation.y = rotY;
  var box2 = new THREE.Box3().setFromObject(root);
  root.position.set(x - (box2.min.x + box2.max.x) / 2 + (root.position.x || 0),
                    -box2.min.y,
                    z - (box2.min.z + box2.max.z) / 2 + (root.position.z || 0));
  scene.add(root);
}
function loadKay(name, cb) {
  PENDING++;
  loader.parse(KAY_SRC[name], "", function (g) { cb(g.scene); if (--PENDING === 0) READY = true; });
}
function loadGlb(name, cb) {
  PENDING++;
  var bin = Uint8Array.from(atob(GLB_SRC[name]), function (c) { return c.charCodeAt(0); }).buffer;
  loader.parse(bin, "", function (g) { cb(g.scene); if (--PENDING === 0) READY = true; });
}

/* 布局：一条街—— 4 栋楼 + 行道树 + 家具 + 车 */
var BUILD = [
  ["building_A", 13, -52, -14, 0],
  ["building_C", 17, -19, -16, 0],
  ["building_D", 15,  13, -14, 0],
  ["building_F", 19,  44, -16, 0]
];
BUILD.forEach(function (b) { loadKay(b[0], function (r) { place(r, b[1], b[2], b[3], b[4]); }); });

var TREE_SPOTS = [[-58, 8, "tree1", 8.5], [-38, 8, "tree6", 9], [-18, 8, "tree3", 8],
                  [2, 8, "tree2", 9], [22, 8, "tree5", 8], [42, 8, "tree6", 9], [60, 8, "tree1", 8.5],
                  [-34, -26, "pine", 9.5], [34, -28, "tree3", 9], [70, -24, "pine", 10]];
TREE_SPOTS.forEach(function (t) {
  loadGlb(t[2], function (r) { place(r, t[3], t[0], t[1], Math.random() * 6.28); });
});

[["bench", 0.9, -8, 14.2, 3.14], ["bench", 0.9, 30, 14.2, 3.14],
 ["streetlight", 4.6, -30, 13.5, 0], ["streetlight", 4.6, 8, 13.5, 0], ["streetlight", 4.6, 46, 13.5, 0],
 ["bush", 1.1, -48, 12.5, 0], ["bush", 1.3, 56, 12.5, 0],
 ["firehydrant", 0.8, 14, 14.5, 0],
 ["car_sedan", 1.5, -20, 24.5, 0], ["car_sedan", 1.5, 26, 19.8, 3.14],
 ["watertower", 7, -70, -20, 0]
].forEach(function (f) { loadKay(f[0], function (r) { place(r, f[1], f[2], f[3], f[4]); }); });

(function loop() {
  requestAnimationFrame(loop);
  renderer.render(scene, camera);
  if (READY && !window.__READY) window.__READY = true;
})();
"""

parts = []
parts.append("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>真人美术小样 · KayKit+Quaternius (CC0)</title>"
             "<style>body{margin:0;overflow:hidden}</style></head><body>")
parts.append("<script>" + three_js + "</script>")
parts.append("<script>" + gltf_loader + "</script>")
parts.append("<script>var KAY_SRC=" + json.dumps(kay_json, separators=(",", ":")) + ";\n"
             "var GLB_SRC=" + json.dumps(tree_b64, separators=(",", ":")) + ";</script>")
parts.append("<script>" + scene_js + "</script>")
parts.append("</body></html>")

html = "\n".join(parts)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write(html)
print("OK", len(html), "bytes ->", OUT)
