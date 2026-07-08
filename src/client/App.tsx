import { useCallback, useEffect, useMemo, useState } from 'react';

import type { BundleResponse, FileNode } from '@/types/core.js';
import { utf8ByteLength } from '@/utils/byteCount.js';

import { FileTree } from './components/FileTree.js';
import { FileViewer } from './components/FileViewer.js';
import { Header } from './components/Header.js';
import { useComments } from './hooks/useComments.js';
import { useFileTree } from './hooks/useFileTree.js';

export function App() {
  const { tree, byteMap, loading, error } = useFileTree();
  const { comments, addComment, removeComment } = useComments();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  // Keep the server alive while this tab is open (server exits when all tabs close)
  useEffect(() => {
    const source = new EventSource('/api/heartbeat');
    return () => source.close();
  }, []);

  const toggleFile = useCallback((path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const toggleFiles = useCallback((paths: string[], select: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const path of paths) {
        if (select) {
          next.add(path);
        } else {
          next.delete(path);
        }
      }
      return next;
    });
  }, []);

  const totalBytes = useMemo(() => {
    let sum = 0;
    for (const path of selected) {
      sum += byteMap.get(path) ?? 0;
    }
    // Annotations for selected files are injected into the bundle, so count them too
    for (const comment of comments) {
      if (selected.has(comment.file)) {
        const range =
          comment.startLine === comment.endLine
            ? `L${comment.startLine}`
            : `L${comment.startLine}-${comment.endLine}`;
        sum += utf8ByteLength(`[注釈 ${range}: ${comment.body}]\n`);
      }
    }
    return sum;
  }, [selected, byteMap, comments]);

  // Bundle files in tree display order, not selection order
  const orderedPaths = useMemo(() => {
    const paths: string[] = [];
    const walk = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          paths.push(node.path);
        }
        if (node.children) {
          walk(node.children);
        }
      }
    };
    walk(tree);
    return paths;
  }, [tree]);

  const [openError, setOpenError] = useState<string | null>(null);

  const openTab = useCallback(async () => {
    setOpenError(null);
    try {
      const files = orderedPaths.filter((path) => selected.has(path));
      const res = await fetch('/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const bundle = (await res.json()) as BundleResponse;
      window.open(`/bundle/${bundle.id}`, '_blank');
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : String(e));
    }
  }, [orderedPaths, selected]);

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <Header
        selectedCount={selected.size}
        totalBytes={totalBytes}
        onOpenTab={() => void openTab()}
        openDisabled={selected.size === 0}
      />
      {openError && (
        <p className="border-b border-red-900 bg-red-950 px-4 py-1 text-sm text-red-300">
          タブを開けませんでした: {openError}
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-auto border-r border-slate-700 bg-slate-900">
          {loading ? (
            <p className="p-4 text-sm text-slate-500">Scanning files...</p>
          ) : error ? (
            <p className="p-4 text-sm text-red-400">Failed to load tree: {error}</p>
          ) : (
            <FileTree
              tree={tree}
              selected={selected}
              previewPath={previewPath}
              onToggleFile={toggleFile}
              onToggleFiles={toggleFiles}
              onPreview={setPreviewPath}
            />
          )}
        </aside>
        <main className="min-w-0 flex-1 bg-slate-950">
          <FileViewer
            path={previewPath}
            comments={comments}
            onAddComment={(file, startLine, endLine, body) =>
              addComment({ file, startLine, endLine, body })
            }
            onRemoveComment={(id) => void removeComment(id)}
          />
        </main>
      </div>
    </div>
  );
}
