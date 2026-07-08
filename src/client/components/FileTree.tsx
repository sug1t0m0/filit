import type { FileNode } from '@/types/core.js';

import { Checkbox } from './Checkbox.js';

interface FileTreeProps {
  tree: FileNode[];
  selected: Set<string>;
  previewPath: string | null;
  onToggleFile: (path: string) => void;
  onToggleFiles: (paths: string[], select: boolean) => void;
  onPreview: (path: string) => void;
}

function selectableDescendants(node: FileNode): string[] {
  if (node.type === 'file') {
    return node.selectable ? [node.path] : [];
  }
  return (node.children ?? []).flatMap(selectableDescendants);
}

function formatKb(bytes: number): string {
  return bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`;
}

interface NodeRowProps extends Omit<FileTreeProps, 'tree'> {
  node: FileNode;
  depth: number;
}

function NodeRow({ node, depth, ...rest }: NodeRowProps) {
  const { selected, previewPath, onToggleFile, onToggleFiles, onPreview } = rest;
  const indent = { paddingLeft: `${depth * 16 + 8}px` };

  if (node.type === 'directory') {
    const descendants = selectableDescendants(node);
    const selectedCount = descendants.filter((path) => selected.has(path)).length;
    const allSelected = descendants.length > 0 && selectedCount === descendants.length;
    return (
      <div>
        <div className="flex items-center gap-2 py-0.5 hover:bg-slate-800" style={indent}>
          <Checkbox
            checked={allSelected}
            indeterminate={selectedCount > 0 && !allSelected}
            disabled={descendants.length === 0}
            onChange={() => onToggleFiles(descendants, !allSelected)}
          />
          <span className="select-none text-slate-300">{node.name}/</span>
        </div>
        {(node.children ?? []).map((child) => (
          <NodeRow key={child.path} node={child} depth={depth + 1} {...rest} />
        ))}
      </div>
    );
  }

  const isPreviewed = previewPath === node.path;
  return (
    <div
      className={`flex items-center gap-2 py-0.5 hover:bg-slate-800 ${isPreviewed ? 'bg-slate-800' : ''}`}
      style={indent}
    >
      <Checkbox
        checked={selected.has(node.path)}
        disabled={!node.selectable}
        onChange={() => onToggleFile(node.path)}
      />
      <button
        type="button"
        onClick={() => onPreview(node.path)}
        title={node.selectable ? node.path : `${node.path} (too large to select)`}
        className={`flex-1 truncate text-left ${
          isPreviewed ? 'text-sky-400' : node.selectable ? 'text-slate-100' : 'text-slate-500'
        }`}
      >
        {node.name}
      </button>
      <span className="pr-2 text-xs tabular-nums text-slate-500">{formatKb(node.bytes ?? 0)}</span>
    </div>
  );
}

export function FileTree({ tree, ...rest }: FileTreeProps) {
  if (tree.length === 0) {
    return <p className="p-4 text-sm text-slate-500">No files in scope</p>;
  }
  return (
    <div className="py-2 text-sm">
      {tree.map((node) => (
        <NodeRow key={node.path} node={node} depth={0} {...rest} />
      ))}
    </div>
  );
}
