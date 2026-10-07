# -*- coding: utf-8 -*-
"""fetch-sat.py —— 拉高德卫星瓦片，拼出校园正射影像（无透视、无眩光、正北朝上）。

为什么要它：用户给的 Apple 地图**照片**有透视/眩光/降采样，建筑抠不干净。
卫星瓦片是官方影像、规矩的 Web Mercator，可程序化抠出**真实 footprint**。
坐标：114.542803E / 30.400147N（湖北省建筑市场监管平台 GIS 字段）。
⚠️ 高德瓦片是 GCJ-02（火星坐标），而政府平台字段多为 WGS84 ⇒ 先做 WGS→GCJ 纠偏，
   否则会整体偏 300~500m（一偏就出校园）。
"""
import math, os, io, sys
import urllib.request
from PIL import Image

LON, LAT, Z = 114.542803, 30.400147, 18
NX, NY = 6, 6                      # 4×4 瓦片 ≈ 1024px ≈ 530m 见方
OUT = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\.workbuddy-gen\rebuild\sat-campus.png"

def wgs2gcj(lon, lat):
    a = 6378245.0; ee = 0.00669342162296594323
    def _tlat(x, y):
        r = -100.0 + 2.0*x + 3.0*y + 0.2*y*y + 0.1*x*y + 0.2*math.sqrt(abs(x))
        r += (20.0*math.sin(6.0*x*math.pi) + 20.0*math.sin(2.0*x*math.pi)) * 2.0/3.0
        r += (20.0*math.sin(y*math.pi) + 40.0*math.sin(y/3.0*math.pi)) * 2.0/3.0
        r += (160.0*math.sin(y/12.0*math.pi) + 320*math.sin(y*math.pi/30.0)) * 2.0/3.0
        return r
    def _tlon(x, y):
        r = 300.0 + x + 2.0*y + 0.1*x*x + 0.1*x*y + 0.1*math.sqrt(abs(x))
        r += (20.0*math.sin(6.0*x*math.pi) + 20.0*math.sin(2.0*x*math.pi)) * 2.0/3.0
        r += (20.0*math.sin(x*math.pi) + 40.0*math.sin(x/3.0*math.pi)) * 2.0/3.0
        r += (150.0*math.sin(x/12.0*math.pi) + 300.0*math.sin(x/30.0*math.pi)) * 2.0/3.0
        return r
    dlat = _tlat(lon - 105.0, lat - 35.0); dlon = _tlon(lon - 105.0, lat - 35.0)
    rl = lat / 180.0 * math.pi
    m = math.sin(rl); m = 1 - ee*m*m; sm = math.sqrt(m)
    dlat = (dlat * 180.0) / ((a * (1 - ee)) / (m * sm) * math.pi)
    dlon = (dlon * 180.0) / (a / sm * math.cos(rl) * math.pi)
    return lon + dlon, lat + dlat

GLON, GLAT = wgs2gcj(LON, LAT)
print("WGS(%.6f,%.6f) → GCJ(%.6f,%.6f)" % (LON, LAT, GLON, GLAT))

n = 2 ** Z
def tile_xy(lon, lat):
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.log(math.tan(math.radians(lat)) + 1.0/math.cos(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y
tx, ty = tile_xy(GLON, GLAT)
cx, cy = int(tx), int(ty)
print("z%d tile center = (%.3f, %.3f) → 取 %d×%d 网格" % (Z, tx, ty, NX, NY))

x0 = cx - NX // 2 + 2; y0 = cy - NY // 2 + 1   # 实测校区在给定坐标以东约 500m
sheet = Image.new("RGB", (256*NX, 256*NY))
ok = 0
hdr = {"User-Agent": "Mozilla/5.0"}
for j in range(NY):
    for i in range(NX):
        url = ("https://webst0%d.is.autonavi.com/appmaptile?style=6&x=%d&y=%d&z=%d"
               % (1 + (i + j) % 4, x0 + i, y0 + j, Z))
        try:
            rq = urllib.request.Request(url, headers=hdr)
            data = urllib.request.urlopen(rq, timeout=25).read()
            tile = Image.open(io.BytesIO(data)).convert("RGB")
            sheet.paste(tile, (i*256, j*256))
            ok += 1
        except Exception as e:
            print("  瓦片失败 %d,%d: %s" % (x0+i, y0+j, e))
print("成功 %d/%d 瓦片" % (ok, NX*NY))
# 中心像素 = 校园坐标
cxp = tx - x0; cyp = ty - y0
sheet.save(OUT)
print("保存 %s  %s   校园中心在像素 (%.0f, %.0f)" % (OUT, sheet.size, cxp*256, cyp*256))
open(OUT.replace('.png', '.meta.txt'), 'w', encoding='utf-8').write(
    "z=%d x0=%d y0=%d center_px=%.2f,%.2f lon_gcj=%.6f lat_gcj=%.6f\n"
    % (Z, x0, y0, cxp*256, cyp*256, GLON, GLAT))
