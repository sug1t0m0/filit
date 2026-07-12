import { promises as fs } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';

import fg from 'fast-glob';
import ignoreFactory, { type Ignore } from 'ignore';

import type { FileNode } from '../types/core.js';
import { buildTree } from '../utils/tree.js';

export const MAX_SELECTABLE_BYTES = 1024 * 1024;

const ALWAYS_IGNORED_GLOBS = ['**/.git/**', '**/node_modules/**', '**/.filit/**'];
const BINARY_SNIFF_BYTES = 8192;

export interface ScannedFile {
  /** POSIX-style path relative to rootDir */
  path: string;
  bytes: number;
  selectable: boolean;
}

export interface ScanResult {
  files: ScannedFile[];
  tree: FileNode[];
}

async function loadGitignore(rootDir: string): Promise<Ignore> {
  const ig = ignoreFactory();
  try {
    const content = await fs.readFile(resolve(rootDir, '.gitignore'), 'utf8');
    ig.add(content);
  } catch {
    // No .gitignore — nothing to add
  }
  return ig;
}

async function isBinaryFile(absolutePath: string): Promise<boolean> {
  const handle = await fs.open(absolutePath, 'r');
  try {
    const buffer = Buffer.alloc(BINARY_SNIFF_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, BINARY_SNIFF_BYTES, 0);
    return buffer.subarray(0, bytesRead).includes(0);
  } finally {
    await handle.close();
  }
}

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

/** Convert CLI scope inputs (files, dirs, globs) into fast-glob patterns relative to rootDir */
async function buildPatterns(rootDir: string, scopeInputs: string[]): Promise<string[]> {
  const patterns: string[] = [];
  for (const input of scopeInputs) {
    const normalized = toPosix(input).replace(/\/+$/, '');
    if (fg.isDynamicPattern(normalized)) {
      patterns.push(normalized);
      continue;
    }
    try {
      const stat = await fs.stat(resolve(rootDir, normalized));
      patterns.push(
        stat.isDirectory() ? `${normalized === '.' ? '' : `${normalized}/`}**/*` : normalized,
      );
    } catch {
      // Nonexistent path: keep as pattern; fast-glob yields no matches
      patterns.push(normalized);
    }
  }
  return patterns;
}

export async function scanFiles(rootDir: string, scopeInputs: string[]): Promise<ScanResult> {
  const [patterns, gitignore] = await Promise.all([
    buildPatterns(rootDir, scopeInputs),
    loadGitignore(rootDir),
  ]);

  const matches = await fg(patterns, {
    cwd: rootDir,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: ALWAYS_IGNORED_GLOBS,
  });

  const relPaths = [...new Set(matches)]
    .filter((path) => !path.startsWith('..') && !isAbsolute(path))
    .filter((path) => !gitignore.ignores(path))
    .toSorted();

  const files: ScannedFile[] = [];
  for (const relPath of relPaths) {
    const absolutePath = resolve(rootDir, relPath);
    let stat;
    try {
      stat = await fs.stat(absolutePath);
    } catch {
      continue;
    }
    // Oversized files skip the binary sniff; they are unselectable anyway
    if (stat.size <= MAX_SELECTABLE_BYTES && (await isBinaryFile(absolutePath))) {
      continue;
    }
    files.push({
      path: relPath,
      bytes: stat.size,
      selectable: stat.size <= MAX_SELECTABLE_BYTES,
    });
  }

  return { files, tree: buildTree(files) };
}
