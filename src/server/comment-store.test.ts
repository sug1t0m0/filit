import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CommentStore, findStoreRoot } from './comment-store.js';

let root: string;
let store: CommentStore;

beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'filit-comments-'));
  store = new CommentStore(root);
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('CommentStore', () => {
  it('returns an empty file when nothing is saved yet', async () => {
    expect(await store.load()).toEqual({ version: 1, comments: [] });
  });

  it('persists added comments to .filit/comments.json', async () => {
    const comment = await store.add({
      file: 'src/auth.ts',
      startLine: 20,
      endLine: 40,
      body: 'この境界は妥当?',
    });

    expect(comment.id).toBeTruthy();
    expect(comment.createdAt).toMatch(/^\d{4}-/);

    const raw = JSON.parse(await fs.readFile(join(root, '.filit/comments.json'), 'utf8'));
    expect(raw.version).toBe(1);
    expect(raw.comments).toHaveLength(1);
    expect(raw.comments[0].body).toBe('この境界は妥当?');
  });

  it('deletes comments by id', async () => {
    const a = await store.add({ file: 'a.ts', startLine: 1, endLine: 1, body: 'A' });
    await store.add({ file: 'b.ts', startLine: 2, endLine: 3, body: 'B' });

    expect(await store.delete(a.id)).toBe(true);
    expect(await store.delete(a.id)).toBe(false);

    const data = await store.load();
    expect(data.comments.map((c) => c.body)).toEqual(['B']);
  });

  it('clears all comments', async () => {
    await store.add({ file: 'a.ts', startLine: 1, endLine: 1, body: 'A' });
    await store.clear();
    expect(await store.load()).toEqual({ version: 1, comments: [] });
  });
});

describe('findStoreRoot', () => {
  it('walks up to the directory containing .git', async () => {
    await fs.mkdir(join(root, '.git'));
    await fs.mkdir(join(root, 'nested/deep'), { recursive: true });
    expect(findStoreRoot(join(root, 'nested/deep'))).toBe(root);
  });

  it('falls back to the start directory when no .git exists', async () => {
    const nested = join(root, 'nested');
    await fs.mkdir(nested);
    expect(findStoreRoot(nested)).toBe(nested);
  });
});
