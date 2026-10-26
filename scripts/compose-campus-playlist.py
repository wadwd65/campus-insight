"""Original offline synthesized ambience. Optional build tool: numpy + soundfile==0.13.1.
MP3 files are prebuilt and do not require Python in the deployed website.
"""
from pathlib import Path
import sys,json,hashlib
import numpy as np
root=Path(__file__).resolve().parent.parent
try:import soundfile as sf
except ModuleNotFoundError:
    sys.path.insert(0,str(root.parent/'audio-tools'));import soundfile as sf
SR=22050
specs=[
 {'id':'night','title':'校园夜航','file':'campus-after-hours.mp3','seconds':144,'seed':391,'segment':12,'kind':'glass','chords':[[50,57,60,64,69],[46,53,57,60,65],[53,60,64,67,72],[48,55,60,62,67],[43,50,57,60,65],[46,53,57,62,69]],'rhythm':[1.5,5,8.5],'pads':.018,'keys':.035},
 {'id':'morning','title':'晨光刻度','file':'morning-lines.mp3','seconds':132,'seed':392,'segment':11,'kind':'mallet','chords':[[50,57,61,64,69],[55,62,66,69,73],[47,54,57,62,66],[45,52,57,59,64],[52,59,62,66,69],[55,62,66,71,74]],'rhythm':[.6,2.8,5.2,7.6,9.3],'pads':.009,'keys':.043},
 {'id':'library','title':'图书馆慢页','file':'library-pages.mp3','seconds':156,'seed':393,'segment':13,'kind':'felt','chords':[[48,55,59,62,67],[45,52,55,59,64],[53,60,64,67,71],[50,57,60,64,69],[55,62,65,69,72],[48,55,60,64,67]],'rhythm':[1,4.8,9.1],'pads':.004,'keys':.053},
 {'id':'breeze','title':'晚风回廊','file':'evening-breeze.mp3','seconds':140,'seed':394,'segment':10,'kind':'pluck','chords':[[52,59,62,66,69],[48,55,59,62,67],[55,62,66,69,74],[50,57,62,64,69],[47,54,57,62,66],[48,55,60,62,67],[45,52,57,59,64]],'rhythm':[.5,2,3.7,6.4,8.2],'pads':.012,'keys':.036},
]
output=root/'public/audio';output.mkdir(exist_ok=True)
metadata=[]
for spec in specs:
    length=int(spec['seconds']*SR);result=np.zeros(length,dtype=np.float64);rng=np.random.default_rng(spec['seed'])
    def voice(start,duration,note,gain,kind):
        samples=int(duration*SR);t=np.arange(samples)/SR;frequency=440*2**((note-69)/12)
        if kind=='pad':
            env=np.minimum(t/2.4,1)*np.minimum((duration-t)/3,1)
            signal=.65*np.sin(2*np.pi*frequency*t)+.13*np.sin(2*np.pi*frequency*1.998*t)+.09*np.sin(2*np.pi*frequency*.998*t)
        elif kind=='mallet':
            env=(1-np.exp(-t*90))*np.exp(-t/1.6)
            signal=np.sin(2*np.pi*frequency*t)+.16*np.sin(2*np.pi*frequency*3*t)*np.exp(-t/.3)
        elif kind=='felt':
            env=(1-np.exp(-t*35))*np.exp(-t/2.6)
            signal=np.sin(2*np.pi*frequency*t)+.19*np.sin(2*np.pi*frequency*2*t)*np.exp(-t/.8)+.045*np.sin(2*np.pi*frequency*3*t)
        elif kind=='pluck':
            env=(1-np.exp(-t*65))*np.exp(-t/1.8)
            signal=np.sin(2*np.pi*frequency*t+.9*np.sin(2*np.pi*frequency*t)*np.exp(-t/.22))+.07*np.sin(2*np.pi*frequency*4*t)*np.exp(-t/.16)
        else:
            env=(1-np.exp(-t*42))*np.exp(-t/2.3)
            signal=np.sin(2*np.pi*frequency*t+.45*np.sin(2*np.pi*frequency*2*t)*np.exp(-t/.8))
        signal*=env*gain
        for delay,attenuation in [(0,1),(.31,.10),(.69,.045),(1.12,.023)]:
            offset=int((start+delay)*SR);end=min(length,offset+samples)
            if end>offset:result[offset:end]+=signal[:end-offset]*attenuation
    segments=int(np.ceil(spec['seconds']/spec['segment']))
    for block in range(segments):
        start=block*spec['segment'];chord=spec['chords'][block%len(spec['chords'])]
        section=block//4;intensity=[.72,1,.84,.6][section%4]
        if spec['pads']:
            for n in chord[1:]:voice(start,spec['segment']+3,n,spec['pads']*intensity,'pad')
        voice(start+.1,5,chord[0],.023*intensity,'felt')
        # Change register, density and voicing between phrases; quiet gaps are intentional.
        order=[2,3,1,4,2] if block%2==0 else [3,1,4,2,3]
        for i,beat in enumerate(spec['rhythm']):
            if (block+i)%7==5:continue
            octave=12 if spec['kind'] in ['glass','mallet'] and (i+block)%3==0 else 0
            voice(start+beat+float(rng.uniform(-.08,.08)),4.7,chord[order[i]]+octave,spec['keys']*intensity*float(rng.uniform(.72,1)),spec['kind'])
            if spec['kind']=='felt' and i==0:voice(start+beat+.06,5,chord[1],spec['keys']*.34,'felt')
        if spec['kind']=='breeze' or spec['id']=='breeze':
            for beat in [1.1,4.3,7.4]:voice(start+beat,1,chord[0]+12,.006,'mallet')
    fade=np.minimum(np.arange(length)/(SR*2.5),1)*np.minimum((length-np.arange(length))/(SR*4),1)
    result*=fade;result*=.52/max(float(np.max(np.abs(result))),1e-9)
    target=output/spec['file'];sf.write(target,result,SR,format='MP3',subtype='MPEG_LAYER_III',bitrate_mode='VARIABLE',compression_level=.65)
    decoded,rate=sf.read(target);assert rate==SR and len(decoded)==length and np.max(np.abs(decoded))<.99
    info={k:v for k,v in spec.items() if k not in ['chords','rhythm']}
    info.update({'sampleRate':rate,'format':'MP3','channels':1,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'decodedPeak':float(np.max(np.abs(decoded))),'decodedRms':float(np.sqrt(np.mean(decoded**2)))})
    metadata.append(info);print(json.dumps(info,ensure_ascii=True),flush=True)
    del result,decoded
(root/'docs/配乐技术信息-v39.json').write_text(json.dumps({'generator':'scripts/compose-campus-playlist.py','codec':'soundfile 0.13.1 / libsndfile MP3','tracks':metadata,'totalSeconds':sum(s['seconds'] for s in specs),'totalBytes':sum(s['bytes'] for s in metadata)},ensure_ascii=False,indent=2),encoding='utf-8')
(output/'README-配乐说明.md').write_text('# 校园行迹配乐集 v39\n\n四首项目自制、无人声的程序化环境配乐：校园夜航2:24、晨光刻度2:12、图书馆慢页2:36、晚风回廊2:20，总长9:32。不同和声、音色和节奏密度，不是同一小节换速度。无外部采样，未引用游戏旋律。\n\n默认关闭，点击才加载当前曲目；曲库支持上一首、下一首、顺序轮播、随机轮播、单曲循环及音量。切到后台自动暂停，回来需手动继续。四首使用单个原生audio元素，不并行解码或在网页实时合成。\n\n音乐草稿由scripts/compose-campus-playlist.py生成，复现需Python的numpy与soundfile==0.13.1。站点运行不需要这两个库。MP3使用libsndfile本地编码，完整数字校验见docs/配乐技术信息-v39.json；数字检查不代表人工听感评分。此前64秒WAV已保留在封存的B-v38版本，本版不重复分发。\n',encoding='utf-8')
