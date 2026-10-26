import path from 'node:path';
import { loadServerConfig, loadEnvironment } from './config.mjs';
import { createAiHandler } from './ai.mjs';
import { createAccountHandler } from './accounts.mjs';
import { createDeploymentHandler } from './deployment.mjs';

export function campusAi() {
  let root;
  const attach = (server) => {
    const env = loadEnvironment({ root });
    server.middlewares.use(createDeploymentHandler({ root, env }));
    const accounts = createAccountHandler({ root, dataDir: env.CAMPUS_DATA_DIR ? path.resolve(root, env.CAMPUS_DATA_DIR) : undefined, setupToken: env.CAMPUS_SETUP_TOKEN, origin: env.APP_ORIGIN });
    server.middlewares.use(accounts);
    server.middlewares.use(createAiHandler(loadServerConfig({ root })));
    server.httpServer?.once('close', accounts.close);
  };
  return {
    name: 'campus-ai-relay',
    config(config) {
      const env = loadEnvironment({ root: config.root || process.cwd() });
      return { server: { fs: { deny: ['**/.env*', '**/*.{crt,pem}', '**/.git/**', '**/.campus-data/**', '**/*.sqlite*', '**/setup-key.txt', ...(env.CAMPUS_DATA_DIR ? [path.resolve(config.root || process.cwd(), env.CAMPUS_DATA_DIR).replaceAll('\\', '/') + '/**'] : [])] }, watch: { ignored: ['**/.campus-data/**', '**/*.sqlite*', '**/setup-key.txt'] } } };
    },
    configResolved(config) { root = config.root; }, configureServer: attach, configurePreviewServer: attach,
  };
}
