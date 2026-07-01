import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const distDir = 'dist';
const routes = ['fuel', 'baby-story', 'ledger', 'guides', 'image-remover'];

await Promise.all(
  routes.map(async route => {
    const targetDir = join(distDir, route);
    await mkdir(targetDir, { recursive: true });
    await copyFile(join(distDir, 'index.html'), join(targetDir, 'index.html'));
  }),
);
