export interface FileNode {
  /** Path relative to the scope root, POSIX separators */
  path: string;
  name: string;
  type: 'file' | 'directory';
  /** UTF-8 byte size (files only) */
  bytes?: number;
  /** Files larger than the limit are listed but not selectable */
  selectable?: boolean;
  children?: FileNode[];
}

export interface Comment {
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  body: string;
  createdAt: string;
}

export interface CommentsFile {
  version: 1;
  comments: Comment[];
}

export interface HealthResponse {
  status: 'ok';
  version: string;
}

export interface TreeResponse {
  tree: FileNode[];
  fileCount: number;
  scope: string[];
}

export interface BundleFileSnapshot {
  path: string;
  content: string;
}

export interface BundleDetailResponse {
  id: string;
  /** Pinned commit SHA, or null when the bundle shows the live working tree */
  rev: string | null;
  files: BundleFileSnapshot[];
  comments: Comment[];
  bytes: number;
  /** Bundled paths not resolvable (out of scope, deleted, or absent at the pinned rev) */
  missing: string[];
}

export interface GitHeadResponse {
  /** HEAD commit SHA, or null when not a git repo */
  sha: string | null;
  /** Paths (relative to the scope root) with uncommitted changes */
  dirty: string[];
}

export interface FileContentResponse {
  path: string;
  content: string;
  bytes: number;
}
