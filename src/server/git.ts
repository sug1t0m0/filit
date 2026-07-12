import { execFile } from 'node:child_process';
import { relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function git(rootDir: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', rootDir, ...args], {
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return null;
  }
}

export interface GitInfo {
  /** HEAD commit SHA, or null when not a git repo / no commits */
  sha: string | null;
  /** Paths (relative to rootDir) with uncommitted changes or untracked status */
  dirty: string[];
}

export async function gitInfo(rootDir: string): Promise<GitInfo> {
  const sha = (await git(rootDir, ['rev-parse', 'HEAD']))?.trim() ?? null;
  if (!sha) {
    return { sha: null, dirty: [] };
  }

  const dirty: string[] = [];
  const toplevelRaw = await git(rootDir, ['rev-parse', '--show-toplevel']);
  const status = await git(rootDir, ['status', '--porcelain']);
  if (toplevelRaw && status !== null) {
    const toplevel = toplevelRaw.trim();
    for (const line of status.split('\n')) {
      if (line.length < 4) {
        continue;
      }
      // Porcelain paths are repo-root relative; convert to rootDir-relative
      let path = line.slice(3);
      const renameArrow = path.indexOf(' -> ');
      if (renameArrow !== -1) {
        path = path.slice(renameArrow + 4);
      }
      if (path.startsWith('"')) {
        // Quoted paths (spaces / non-ASCII with core.quotePath) — strip quotes best-effort
        path = path.slice(1, -1);
      }
      const rel = relative(rootDir, resolve(toplevel, path)).split(sep).join('/');
      if (rel !== '' && !rel.startsWith('..')) {
        dirty.push(rel);
      }
    }
  }
  return { sha, dirty };
}

/** Read a file's content at a commit; null when the rev or path doesn't exist there */
export async function gitShow(rootDir: string, rev: string, path: string): Promise<string | null> {
  // "./" makes the path relative to rootDir instead of the repo root
  return git(rootDir, ['show', `${rev}:./${path}`]);
}
