import type { FileNode } from '../types/core.js';

export interface TreeInputFile {
  /** POSIX-style relative path */
  path: string;
  bytes?: number;
  selectable?: boolean;
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return nodes
    .toSorted((a, b) =>
      a.type !== b.type ? (a.type === 'directory' ? -1 : 1) : a.name.localeCompare(b.name),
    )
    .map((node) => (node.children ? { ...node, children: sortNodes(node.children) } : node));
}

export function buildTree(files: TreeInputFile[]): FileNode[] {
  const root: FileNode[] = [];
  const dirNodes = new Map<string, FileNode>();

  const ensureDir = (dirPath: string): FileNode[] => {
    if (dirPath === '') {
      return root;
    }
    const existing = dirNodes.get(dirPath);
    if (existing) {
      return existing.children as FileNode[];
    }
    const parentPath = dirPath.includes('/') ? dirPath.slice(0, dirPath.lastIndexOf('/')) : '';
    const node: FileNode = {
      path: dirPath,
      name: dirPath.slice(dirPath.lastIndexOf('/') + 1),
      type: 'directory',
      children: [],
    };
    ensureDir(parentPath).push(node);
    dirNodes.set(dirPath, node);
    return node.children as FileNode[];
  };

  for (const file of files) {
    const dirPath = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
    ensureDir(dirPath).push({
      path: file.path,
      name: file.path.slice(file.path.lastIndexOf('/') + 1),
      type: 'file',
      bytes: file.bytes,
      selectable: file.selectable,
    });
  }

  return sortNodes(root);
}
