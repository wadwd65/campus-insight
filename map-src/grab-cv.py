# -*- coding: utf-8 -*-
"""抓页面里的地表 canvas 到本地 PNG（诊断"画了却看不见"）。
用法: python grab-cv.py <page.html> <out.png> [zoom]
"""
import asyncio, base64, io, json, os, subprocess, sys, time
from urllib.request import ProxyHandler, build_opener

OPENER = build_opener(ProxyHandler({}))
PORT = 9333
PAGE = sys.argv[1] if len(sys.argv) > 1 else 'campus.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'ground.png'
ZOOM = int(sys.argv[3]) if len(sys.argv) > 3 else 1024

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
NODE = r"C:\Users\123\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
HERE = os.path.dirname(os.path.abspath(__file__))


async def main():
    import websockets
    # 起一个只用来跑页面的浏览器
    proc = subprocess.Popen([
        EDGE, '--headless=new', '--disable-gpu-sandbox',
        '--remote-debugging-port=%d' % PORT, '--remote-allow-origins=*',
        '--user-data-dir=%s' % os.path.join(HERE, '__cvprofile'),
        '--no-first-run', '--no-default-browser-check',
        '--window-size=1600,1000',
        'file:///' + os.path.abspath(PAGE).replace('\\', '/'),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        t0 = time.time()
        tg = None
        while time.time() - t0 < 40:
            try:
                with OPENER.open('http://127.0.0.1:%d/json/list' % PORT, timeout=3) as r:
                    lst = json.load(r)
                tg = [t for t in lst if t.get('type') == 'page'
                      and not (t.get('url') or '').startswith('chrome-extension')]
                if tg:
                    break
            except Exception:
                pass
            time.sleep(0.6)
        if not tg:
            print('!! 拿不到页面 target')
            return
        async with websockets.connect(tg[0]['webSocketDebuggerUrl'],
                                      max_size=200 * 1024 * 1024) as ws:
            mid = [0]

            async def call(method, params=None):
                mid[0] += 1
                i = mid[0]
                await ws.send(json.dumps({'id': i, 'method': method, 'params': params or {}}))
                while True:
                    m = json.loads(await asyncio.wait_for(ws.recv(), timeout=180))
                    if m.get('id') == i:
                        if 'error' in m:
                            raise RuntimeError(m['error'])
                        return m.get('result', {})

            await call('Runtime.enable')
            await asyncio.sleep(26)      # 等场景建完
            expr = ("(function(){var cv=window.__CAMP_GROUND_CV;if(!cv)return 'NO_CANVAS '"
                    "+Object.keys(window).filter(function(k){return k.indexOf('CAMP')>=0;}).join(',');"
                    "var t=document.createElement('canvas');t.width=%d;t.height=%d;"
                    "t.getContext('2d').drawImage(cv,0,0,%d,%d);"
                    "return t.toDataURL('image/png');})()" % (ZOOM, ZOOM, ZOOM, ZOOM))
            r = await call('Runtime.evaluate', {
                'expression': expr, 'returnByValue': True, 'awaitPromise': True})
            v = r.get('result', {}).get('value') or ''
            if not v.startswith('data:image'):
                print('!! 未拿到图像：', str(v)[:300])
                return
            b64 = v.split(',', 1)[1]
            open(OUT, 'wb').write(base64.b64decode(b64))
            print('已保存 %s  %d KB' % (OUT, os.path.getsize(OUT) // 1024))
    finally:
        proc.terminate()


asyncio.run(main())
