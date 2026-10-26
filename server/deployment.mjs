import fs from 'node:fs';
import path from 'node:path';

export function createDeploymentHandler({ root = process.cwd(), env = {} } = {}) {
  const archive = path.resolve(root, 'release-download', 'campus-insight-admin.zip');
  const mode = env.CAMPUS_DEPLOYMENT === 'shared' ? 'shared' : 'self-hosted';
  const name = String(env.CAMPUS_SITE_NAME || '校园档案').trim().slice(0, 60);
  const available = () => { try { return fs.statSync(archive).isFile() && !fs.lstatSync(archive).isSymbolicLink(); } catch { return false; } };
  return (req, res, next) => {
    const route = req.url?.split('?')[0];
    if (!['/api/deployment', '/api/deployment/download'].includes(route)) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    if (route === '/api/deployment') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ mode, siteName: name, downloadAvailable: available() })); return;
    }
    if (!available()) { res.writeHead(404); res.end('Deployment package is not provided on this instance.'); return; }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="campus-insight-admin.zip"');
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(archive);
    stream.on('error', () => { if (!res.headersSent) res.writeHead(503); res.end(); });
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  };
}
