import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let versionInfo = {
  gitHash: 'unknown',
  gitBranch: 'unknown',
  deployedAt: new Date().toISOString(),
  nodeVersion: process.version,
};

// Intentar obtener info de git
try {
  const hash = execSync('git rev-parse --short HEAD', {
    cwd: dirname(dirname(__dirname)),
    encoding: 'utf-8'
  }).trim();
  const branch = execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: dirname(dirname(__dirname)),
    encoding: 'utf-8'
  }).trim();

  versionInfo.gitHash = hash;
  versionInfo.gitBranch = branch;
} catch (err) {
  console.warn('No se pudo obtener info de git:', err.message);
}

export default versionInfo;
