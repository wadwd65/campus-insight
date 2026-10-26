from pathlib import Path
import numpy as np
import wave, json, hashlib
root=Path(__file__).resolve().parent.parent
sr=16000;duration=64;audio=np.zeros(sr*duration,dtype=np.float64)
rng=np.random.default_rng(20261023)
def hz(m):return 440*2**((m-69)/12)
def add(start,length,note,amp,kind='pad',pan=0):
    count=int(length*sr);t=np.arange(count)/sr;f=hz(note)
    if kind=='pad':
        envelope=np.minimum(t/1.9,1)*np.minimum((length-t)/2.2,1)
        signal=(np.sin(2*np.pi*f*t)+.23*np.sin(2*np.pi*f*2.002*t)+.12*np.sin(2*np.pi*f*.999*t))*.65
    else:
        envelope=(1-np.exp(-t*55))*np.exp(-t/(1.5 if kind=='key' else 2.8))
        signal=np.sin(2*np.pi*f*t+.7*np.sin(2*np.pi*f*2*t)*np.exp(-t/0.7))+.12*np.sin(2*np.pi*f*3*t)*np.exp(-t/.6)
    signal*=envelope*amp
    for delay,gain in [(0,1),(.23,.12),(.47,.07),(.73,.035)]:
        offset=int((start+delay)*sr);last=min(offset+count,len(audio))
        if last>offset:audio[offset:last]+=signal[:last-offset]*gain
# Original restrained campus night sketch. No samples, quoted tune, or game assets.
chords=[[50,57,60,64,69],[46,53,57,60,65],[53,60,64,67,72],[48,55,60,62,67],
        [50,57,60,64,69],[46,53,57,62,65],[53,60,64,69,72],[48,55,60,62,67]]
for index,chord in enumerate(chords):
    start=index*8
    for n in chord[1:]:add(start,9,n,.014,'pad')
    add(start,6,chord[0],.029,'bass')
    # Sparse, non-looping small phrases leave room for speaking in a demo video.
    for beat,degree in [(1,2),(3.5,3),(6,1)]:add(start+beat,4.8,chord[degree]+12,.04 if degree==2 else .029,'key')
    if index in [1,4,6]:add(start+5,4,chord[-1]+12,.014,'key')
fade=np.minimum(np.arange(len(audio))/(sr*2.5),1)*np.minimum((len(audio)-np.arange(len(audio)))/(sr*3.5),1)
audio*=fade
peak=float(np.max(np.abs(audio)));audio*=.53/max(peak,1e-9)
output=root/'public/audio/campus-after-hours.wav';output.parent.mkdir(parents=True,exist_ok=True)
with wave.open(str(output),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes((np.clip(audio,-1,1)*32767).astype('<i2').tobytes())
meta={'title':'校园夜航 / Campus After Hours','kind':'project-created procedural ambient sketch','duration':duration,'sampleRate':sr,'channels':1,'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'peak':float(np.max(np.abs(audio))),'rms':float(np.sqrt(np.mean(audio**2))),'reference':'Atmosphere only: restrained industrial/ambient feeling. No third-party composition or samples used.'}
(output.parent/'README-配乐说明.md').write_text('# 校园夜航\n\n项目自制的64秒环境配乐草稿。慢速和弦、稀疏键音，无人声。由 scripts/compose-campus-ambient.py 程序化合成；无外部采样，未引用游戏旋律。仅参考用户提出的克制、空旷、工业界面氛围，不是《明日方舟》原曲或官方关联作品。\n\n页面默认关闭，点击“音乐：开启”才下载。预设18%音量，可调低或关闭；离开标签页自动暂停，回来不会自行播放。建议录制口播时试12%以下。文件16kHz单声道PCM约2.0MB，解码交给浏览器，不在页面持续合成。\n',encoding='utf-8')
print(json.dumps(meta,ensure_ascii=True))
(root/'docs/配乐技术信息.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')

