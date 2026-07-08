import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { Comment, CommentsFile } from '../types/core.js';

export interface NewComment {
  file: string;
  startLine: number;
  endLine: number;
  body: string;
}

/** Walk up from startDir to find the repository root (directory containing .git) */
export function findStoreRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, '.git'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return startDir;
    }
    dir = parent;
  }
}

const EMPTY: CommentsFile = { version: 1, comments: [] };

export class CommentStore {
  private readonly filePath: string;

  constructor(storeRoot: string) {
    this.filePath = join(storeRoot, '.filit', 'comments.json');
  }

  async load(): Promise<CommentsFile> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as CommentsFile;
      if (parsed.version !== 1 || !Array.isArray(parsed.comments)) {
        throw new Error(`Unsupported comments file format: ${this.filePath}`);
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return structuredClone(EMPTY);
      }
      throw error;
    }
  }

  async add(input: NewComment): Promise<Comment> {
    const comment: Comment = {
      id: randomUUID(),
      file: input.file,
      startLine: input.startLine,
      endLine: input.endLine,
      body: input.body,
      createdAt: new Date().toISOString(),
    };
    const data = await this.load();
    data.comments.push(comment);
    await this.save(data);
    return comment;
  }

  async delete(id: string): Promise<boolean> {
    const data = await this.load();
    const before = data.comments.length;
    data.comments = data.comments.filter((comment) => comment.id !== id);
    if (data.comments.length === before) {
      return false;
    }
    await this.save(data);
    return true;
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }

  private async save(data: CommentsFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.filePath);
  }
}
