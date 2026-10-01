import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(['index.html', 'styles.css', 'app.js', 'assets'].map((name) =>
  cp(fileURLToPath(new URL(name, root)), fileURLToPath(new URL(name, output)), { recursive: true })
));
console.log('Static website built → dist/');
