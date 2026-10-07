# -*- coding: utf-8 -*-
"""按占地面积排序旧模型 40 个条目，找出"重复批次"原型。
判据：w*d*h（体量代理），并统计同型重复次数。
"""
import re, io, sys, os

SRC = r"C:\Users\123\WorkBuddy\2026-09-10-15-40-22\校园地图3D.html"
txt = io.open(SRC, encoding="utf-8", errors="replace").read()

# 抓 SITES 数组
m = re.search(r"var SITES\s*=\s*\[(.*?)\n\];", txt, re.S)
body = m.group(1)

pat = re.compile(
    r"id:'([^']+)',\s*zone:'([^']+)',\s*name:'([^']+)',"
    r"\s*c:([\d.]+),\s*r:([\d.]+),\s*w:([\d.]+),\s*d:([\d.]+),\s*h:([\d.]+),"
    r"\s*shape:'([^']+)',\s*feat:'([^']+)',\s*paint:'([^']+)',\s*sub:(\w+|null)"
)
rows = []
for mm in pat.finditer(body):
    i = mm.groups()
    rows.append(dict(id=i[0], zone=i[1], name=i[2], c=float(i[3]), r=float(i[4]),
                     w=float(i[5]), d=float(i[6]), h=float(i[7]),
                     shape=i[8], feat=i[9], paint=i[10], sub=i[11]))

# 兜底：上面严格模式会漏掉「几何字段与 shape 之间有 line/vec」的条目，
# 改用「先切条目、再逐字段取」的方式补全。
if len(rows) < 30:
    rows = []
    # 每个条目 = '{ id:'xxx' ... 到下一个 '{ id:' 之前
    chunks = re.split(r"\n\s*\{ id:'", body)
    for ch in chunks[1:]:
        def get(k, cast=float, default=None):
            mm = re.search(k + r":\s*('[^']*'|[\d.]+|null|\w+)", ch)
            if not mm:
                return default
            v = mm.group(1)
            if cast is float:
                try:
                    return float(v)
                except ValueError:
                    return default
            return v.strip("'")
        try:
            rows.append(dict(
                id=get('id', str), zone=get('zone', str), name=get('name', str),
                c=get('c', float, 0.0), r=get('r', float, 0.0),
                w=get('w', float, 0.0), d=get('d', float, 0.0), h=get('h', float, 0.0),
                shape=get('shape', str, '?'), feat=get('feat', str, '?'),
                paint=get('paint', str, '?'), sub=get('sub', str, 'null'),
            ))
        except Exception as e:
            print("!! 跳过一条：%s" % e)

print("解析到 %d 个条目" % len(rows))
print()
print("=" * 78)
print("%-22s %-9s %5s %5s %6s %8s %-6s %-9s" % ("名称", "zone", "w", "d", "高", "占地", "形状", "feat"))
print("=" * 78)
for r in sorted(rows, key=lambda x: -(x['w'] * x['d'])):
    print("%-22s %-9s %5.2f %5.2f %6.0f %8.2f %-6s %-9s" %
          (r['name'], r['zone'], r['w'], r['d'], r['h'], r['w'] * r['d'], r['shape'], r['feat']))
print()
print("=" * 78)
print("按 zone 汇总")
print("=" * 78)
from collections import defaultdict
z = defaultdict(lambda: [0, 0.0])
for r in rows:
    z[r['zone']][0] += 1
    z[r['zone']][1] += r['w'] * r['d']
for k, v in sorted(z.items(), key=lambda x: -x[1][1]):
    print("%-10s %2d 个   占地合计 %7.2f" % (k, v[0], v[1]))
print()
print("=" * 78)
print("按 (shape + sub) 归类 —— 这就是「原型批次」")
print("=" * 78)
g = defaultdict(list)
for r in rows:
    g[(r['shape'], r['sub'])].append(r['name'])
for k, v in sorted(g.items(), key=lambda x: -len(x[1])):
    print("%-16s x%-2d  %s" % ("%s/%s" % k, len(v), "，".join(v)))
