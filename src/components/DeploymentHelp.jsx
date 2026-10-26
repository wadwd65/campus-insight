import { useEffect, useState } from 'react';
import { useAccount } from '../lib/accounts.jsx';

const deploymentFailure = message => Object.assign(new Error(message), { deploymentMessage: message });

export default function DeploymentHelp() {
  const account = useAccount();
  const [deployment, setDeployment] = useState(null);
  const [status, setStatus] = useState('loading'), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [staticPackage, setStaticPackage] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setStatus('loading'); setDeployment(null); setStaticPackage(null); setError('');
    (async () => {
      try {
        const response = await fetch('/api/deployment', { signal: controller.signal });
        if (!response.ok) throw deploymentFailure(response.status === 404 ? '当前地址未提供部署信息接口，尚不能据此确认在线圈子或下载是否可用。请联系发布者确认。' : '部署信息暂时无法读取，请稍后重试。');
        let data;
        try { data = await response.json(); }
        catch { throw deploymentFailure('当前地址未返回可识别的部署信息，可能是预览页面或接口配置问题。请向发布者确认。'); }
        if (!data || !['shared', 'self-hosted'].includes(data.mode) || typeof data.downloadAvailable !== 'boolean') throw deploymentFailure('部署信息不完整，尚不能确认当前部署状态。请向发布者确认。');
        if (active) { setDeployment(data); setStatus('ready'); }
      } catch (cause) {
        if (active) { setStatus('unavailable'); setError(cause.deploymentMessage || '暂时无法确认部署状态，可能是网络中断或服务暂不可用。请检查网络后重新检查。'); }
        // Static publishing can offer a verified release file without an account API.
        // Its presence never changes deployment/account readiness to "ready".
        try {
          const response = await fetch('/deployment-package.json', { signal: controller.signal });
          if (response.ok) {
            const pkg = await response.json();
            if (active && pkg?.path === '/downloads/campus-insight-admin.zip' && /^[a-f0-9]{64}$/.test(pkg.sha256) && Number.isSafeInteger(pkg.bytes) && pkg.bytes > 0 && pkg.bytes < 50_000_000 && typeof pkg.version === 'string' && /^v\d+$/.test(pkg.version)) setStaticPackage(pkg);
          }
        } catch { /* Optional static download metadata is unavailable. */ }
      } finally { clearTimeout(timeout); }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);
  const local = typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  return <details className="circle-card circle-deployment"><summary>管理员工具：部署、下载与交接</summary>
    <p className="novice-deployment-note">如果你只是来填报，使用管理员发来的可用网址就可以，不需要下载、安装或配置下面的工具。</p>
    <div className={`circle-deployment-status is-${status}`} role="status"><strong>{status === 'loading' ? '正在检查部署信息…' : status === 'ready' ? '部署信息已确认' : '部署信息暂未确认'}</strong><p>{status === 'ready' ? `${local ? '本机预览' : deployment.mode === 'shared' ? '公共站点' : '独立站点'}${deployment.siteName ? ` · ${deployment.siteName}` : ''}` : status === 'loading' ? '检查完成后，才会显示本站配置和可用下载。' : error}</p><button type="button" disabled={status === 'loading'} onClick={() => { setAttempt(value => value + 1); account?.refresh?.(); }}>{status === 'loading' ? '正在检查…' : '重新检查部署与账号连接'}</button></div>
    {staticPackage && <section className="static-package-download"><h3>体验站也可以下载完整部署包</h3><p>这个下载包含账号、邀请和收卷服务，需在支持 Node.js 和持久磁盘的服务器上运行。下载包不会让当前体验网址自动开通账号。</p><a className="circle-download" href={staticPackage.path} download>下载 {staticPackage.version} 管理员部署包 ↓</a><details><summary>核对文件完整性</summary><p>文件大小：{staticPackage.bytes.toLocaleString('zh-CN')} 字节。下载后可用 SHA256 核对：</p><code>{staticPackage.sha256}</code></details></section>}
    <div className="circle-deployment-options">
      <section><h3>直接在这个网站用</h3>{account?.status === 'ready' ? <><p>账号服务已连接。第一次来，选择“注册”，设置自己的账号和6～12位密码，就能创建圈子并当管理员。</p><p>加入别人的圈子，请用对方发来的邀请。自己的圈子由自己管理，无需查找开通口令。</p></> : <><p>{account?.status === 'loading' ? '正在检查这里能否注册和收卷…' : account?.serviceError?.message || '账号服务暂未连接。请重试，或向提供网址的人确认。'}</p><p className="circle-fine">连接成功后才能保存真实答卷。模拟示例可以先体验。</p></>}<p className="circle-fine">{local ? '你现在用的是本机地址，只能在这台电脑上打开。' : '请记住这个网址，下次登录原账号即可。'}</p></section>
      <section><h3>下载一份，在自己的电脑上试</h3><ol className="deployment-beginner-steps"><li><strong>下载后，右键“全部解压缩”。</strong>不要在压缩包窗口里直接启动。</li><li><strong>Windows即用包无需安装工具。</strong>通用包需要安装一次Node.js，包内“先看这里.html”会解释。</li><li><strong>双击最外层的“开始使用”。</strong>浏览器会打开网站，不用填写端口和技术配置。</li><li><strong>网页上点“注册”。</strong>选择“创建圈子，我当管理员”，自己设置账号和密码。</li><li><strong>下次仍双击“开始使用”。</strong>保留原文件夹，登录原来的账号，不用重新注册。</li></ol>{status === 'ready' && deployment.downloadAvailable ? <a className="circle-download" href="/api/deployment/download" download>下载管理员部署包 ↓</a> : <p className="circle-fine">{staticPackage ? '从上方的下载按钮获取完整部署包。' : status === 'loading' ? '正在检查是否可以下载…' : '如果这里没有下载按钮，请向提供网站的人索取完整管理员部署包。'}</p>}<details><summary>想让其他人用手机访问？</summary><p>本机试用的网址不能发给其他设备。把完整部署包和里面的“给部署者的交接.md”交给帮助部署的人，配置好服务器和正式网址后，成员只用浏览器访问即可。</p></details><p className="circle-fine">想保留数据，双击包内“备份我的数据”。找文件位置，双击“打开数据文件夹”。</p></section>
    </div><p className="circle-notice">启用账号服务后，成员可导出自己的已交答卷，管理员可导出本圈答卷 CSV，用于离线统计。迁移整站时，由站点维护者使用私有备份恢复账号、圈子和答卷；单个圈子的 CSV 不包含登录凭据。</p>
  </details>;
}
