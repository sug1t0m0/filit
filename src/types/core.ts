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

export interface BundleResponse {
  id: string;
  bytes: number;
}

export interface FileContentResponse {
  path: string;
  content: string;
  bytes: number;
}
