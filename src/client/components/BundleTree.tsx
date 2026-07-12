import type { FileNode } from '@/types/core.js';

interface BundleTreeProps {
  tree: FileNode[];
  onJump: (path: string) => void;
}

function NodeRow({
  node,
  depth,
  onJump,
}: {
  node: FileNode;
  depth: number;
  onJump: (path: string) => void;
}) {
  const indent = { paddingLeft: `${depth * 16 + 8}px` };

  if (node.type === 'directory') {
    return (
      <div>
        <div className="py-0.5 text-slate-400" style={indent}>
          {node.name}/
        </div>
        {(node.children ?? []).map((child) => (
          <NodeRow key={child.path} node={child} depth={depth + 1} onJump={onJump} />
        ))}
      </div>
    );
  }

  return (
    <div className="py-0.5 hover:bg-slate-800" style={indent}>
      <button
        type="button"
        onClick={() => onJump(node.path)}
        title={node.path}
        className="w-full truncate text-left text-slate-100 hover:text-sky-400"
      >
        {node.name}
      </button>
    </div>
  );
}

/** Read-only directory tree for the bundle page; clicking a file scrolls to it */
export function BundleTree({ tree, onJump }: BundleTreeProps) {
  return (
    <div className="py-2 text-sm">
      {tree.map((node) => (
        <NodeRow key={node.path} node={node} depth={0} onJump={onJump} />
      ))}
    </div>
  );
}
