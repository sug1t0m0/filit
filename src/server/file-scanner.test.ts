import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildTree, MAX_SELECTABLE_BYTES, scanFiles } from './file-scanner.js';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'filit-scan-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function write(relPath: string, content: string | Buffer) {
  const abs = join(root, relPath);
  await fs.mkdir(join(abs, '..'), { recursive: true });
  await fs.writeFile(abs, content);
}

describe('scanFiles', () => {
  it('scans files under a directory scope', async () => {
    await write('src/a.ts', 'aaa');
    await write('src/deep/b.ts', 'bb');
    await write('top.md', 'c');

    const { files } = await scanFiles(root, ['.']);
    expect(files.map((f) => f.path)).toEqual(['src/a.ts', 'src/deep/b.ts', 'top.md']);
    expect(files[0]?.bytes).toBe(3);
  });

  it('narrows scope to given paths and globs', async () => {
    await write('src/a.ts', 'a');
    await write('src/b.md', 'b');
    await write('other/c.ts', 'c');

    const { files } = await scanFiles(root, ['src/**/*.ts']);
    expect(files.map((f) => f.path)).toEqual(['src/a.ts']);

    const dirScope = await scanFiles(root, ['other']);
    expect(dirScope.files.map((f) => f.path)).toEqual(['other/c.ts']);
  });

  it('respects .gitignore and always-ignored directories', async () => {
    await write('.gitignore', 'ignored.txt\n');
    await write('ignored.txt', 'x');
    await write('kept.txt', 'x');
    await write('node_modules/pkg/index.js', 'x');
    await write('.filit/comments.json', '{}');

    const { files } = await scanFiles(root, ['.']);
    expect(files.map((f) => f.path)).toEqual(['.gitignore', 'kept.txt']);
  });

  it('excludes binary files', async () => {
    await write('binary.bin', Buffer.from([0x89, 0x00, 0x01]));
    await write('text.txt', 'hello');

    const { files } = await scanFiles(root, ['.']);
    expect(files.map((f) => f.path)).toEqual(['text.txt']);
  });

  it('marks oversized files as unselectable', async () => {
    await write('big.txt', 'x'.repeat(MAX_SELECTABLE_BYTES + 1));
    await write('small.txt', 'x');

    const { files } = await scanFiles(root, ['.']);
    expect(files.find((f) => f.path === 'big.txt')?.selectable).toBe(false);
    expect(files.find((f) => f.path === 'small.txt')?.selectable).toBe(true);
  });
});

describe('buildTree', () => {
  it('nests files into directories, directories first', () => {
    const tree = buildTree([
      { path: 'zz.md', bytes: 1, selectable: true },
      { path: 'src/deep/b.ts', bytes: 2, selectable: true },
      { path: 'src/a.ts', bytes: 3, selectable: true },
    ]);

    expect(tree.map((n) => n.name)).toEqual(['src', 'zz.md']);
    const src = tree[0];
    expect(src?.children?.map((n) => n.name)).toEqual(['deep', 'a.ts']);
    expect(src?.children?.[0]?.children?.[0]?.path).toBe('src/deep/b.ts');
  });
});
