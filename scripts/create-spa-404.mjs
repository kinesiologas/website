import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const docsDir = join(process.cwd(), 'docs');

await copyFile(join(docsDir, 'index.html'), join(docsDir, '404.html'));
