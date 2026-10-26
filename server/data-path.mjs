import fs from 'node:fs';
import path from 'node:path';

export function privateDataDir(root, input = '.campus-data', { create = false } = {}) {
  const within = (parent, child) => { const rel = path.relative(parent, child); return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); };
  const check = candidate => {
    for (const name of ['public', 'dist', 'src', 'release-download']) {
      const forbidden = path.resolve(root, name);
      if (within(forbidden, candidate) || (fs.existsSync(forbidden) && within(fs.realpathSync(forbidden), candidate))) throw new Error('Data directory must be outside public, dist, src and release-download.');
    }
  };
  const resolved = path.resolve(root, input);
  check(resolved);
  let parent = resolved;
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  check(path.resolve(fs.realpathSync(parent), path.relative(parent, resolved)));
  if (create) fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  return fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
}
