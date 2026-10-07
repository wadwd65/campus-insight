# -*- coding: utf-8 -*-
"""color-lint.py —— 扫描 JS 源里"颜色字面量被写坏"的情况。

为什么需要它：本项目在 v21 连续两次把 `0x6A5F48` 误打成
`0x6A5F४8`（混入天城文数字）、`0xB08A६8`（混入天城文数字），
**都是肉眼极难发现的**（在编辑器里看着就像普通数字），
而且 JS 会解析成 `0x6A5F4` + `8`（或直接 NaN），颜色静默出错。

判据：所有 `0x` 开头的十六进制字面量必须是标准 [0-9A-Fa-f]，长度为偶数
（6 位色号 / 8 位含 alpha）。注释里的说明性片段（如 "0x84/0xC0"）要放行。

用法： python color-lint.py <文件1> [文件2 ...]
"""
import re, io, sys, os

# 匹配 0x 后面的 token（含可能的非法字符）
TOK = re.compile(r'0x[0-9A-Za-z\u0080-\uffff]*')

def strip_comments(src):
    """把 /* */ 与 // 注释替换成等长空白，保持偏移不变。"""
    out = list(src)
    i = 0
    n = len(src)
    while i < n:
        if src.startswith('/*', i):
            j = src.find('*/', i + 2)
            j = n if j < 0 else j + 2
            for k in range(i, j):
                if out[k] != '\n':
                    out[k] = ' '
            i = j
        elif src.startswith('//', i):
            j = src.find('\n', i)
            j = n if j < 0 else j
            for k in range(i, j):
                out[k] = ' '
            i = j
        else:
            i += 1
    return ''.join(out)

def check(path):
    src = io.open(path, encoding='utf-8').read()
    code = strip_comments(src)
    bad = []
    for m in TOK.finditer(code):
        tok = m.group(0)
        body = tok[2:]
        if body == '':
            continue                       # 裸 "0x"（极少见，放过）
        if not re.fullmatch(r'[0-9A-Fa-f]+', body):
            # 把非法字符挑出来
            illegal = ''.join(c for c in body if c not in '0123456789abcdefABCDEF')
            # 只报"数字里混进怪字符"的情况（真正的色号写坏）
            if illegal:
                bad.append((m.start(), tok, illegal))
        elif len(body) not in (6, 8, 3, 4):
            # 长度异常（例如 0x6A5F4 是 5 位）—— 也可能是写坏
            bad.append((m.start(), tok, '长度 %d 非标准' % len(body)))
    return bad

def main():
    files = sys.argv[1:]
    if not files:
        print('用法: python color-lint.py <文件...>')
        return 2
    total = 0
    for f in files:
        if not os.path.exists(f):
            print('  ✗ 文件不存在:', f)
            total += 1
            continue
        bad = check(f)
        if bad:
            print('  ✗ %s —— %d 处可疑色号' % (os.path.basename(f), len(bad)))
            for pos, tok, why in bad:
                line = io.open(f, encoding='utf-8').read()[:pos].count('\n') + 1
                print('      line %d: %r  ← 含非法字符 %r' % (line, tok, why))
            total += len(bad)
        else:
            print('  ✓ %s' % os.path.basename(f))
    print('可疑色号合计 = %d' % total)
    return 1 if total else 0

if __name__ == '__main__':
    sys.exit(main())
