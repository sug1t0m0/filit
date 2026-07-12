import { useCallback, useEffect, useMemo, useState } from 'react';

import type { FileNode, GitHeadResponse } from '@/types/core.js';
import { encodeBundleParams, PAYLOAD_WARN_LENGTH } from '@/utils/bundleCode.js';
import { utf8ByteLength } from '@/utils/byteCount.js';

import { FileTree } from './components/FileTree.js';
import { FileViewer, type ViewMode } from './components/FileViewer.js';
import { Header } from './components/Header.js';
import { useComments } from './hooks/useComments.js';
import { useFileTree } from './hooks/useFileTree.js';

export function App() {
  const { tree, byteMap, loading, error } = useFileTree();
  const { comments, addComment, removeComment } = useComments();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('single');

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

  // Checked files in tree display order; drives both the bundle and the selected view
  const selectedPaths = useMemo(
    () => orderedPaths.filter((path) => selected.has(path)),
    [orderedPaths, selected],
  );

  const [openError, setOpenError] = useState<string | null>(null);
  const [isGitRepo, setIsGitRepo] = useState(false);

  useEffect(() => {
    fetch('/api/git/head')
      .then((res) => res.json() as Promise<GitHeadResponse>)
      .then((info) => setIsGitRepo(info.sha !== null))
      .catch(() => setIsGitRepo(false));
  }, []);

  // The bundle URL is stateless: encode the selection (and optional rev) right here
  const openTab = useCallback(
    async (pinToHead: boolean) => {
      setOpenError(null);
      try {
        let rev: string | undefined;
        if (pinToHead) {
          // Fetch on click so the SHA and dirty state are fresh
          const res = await fetch('/api/git/head');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const info = (await res.json()) as GitHeadResponse;
          if (!info.sha) {
            throw new Error('git リポジトリではないため HEAD 固定で開けません');
          }
          const dirtySelected = selectedPaths.filter((path) => info.dirty.includes(path));
          if (
            dirtySelected.length > 0 &&
            !window.confirm(
              `未コミット変更があるため、HEAD 固定の内容は現在の編集と異なります:\n${dirtySelected.join('\n')}\n\n続行しますか?`,
            )
          ) {
            return;
          }
          rev = info.sha;
        }
        const payload = encodeBundleParams({ files: selectedPaths, ...(rev ? { rev } : {}) });
        if (
          payload.length > PAYLOAD_WARN_LENGTH &&
          !window.confirm(
            `URL が長くなっています (${payload.length} 字)。ブラウザによっては開けないことがあります。続行しますか?`,
          )
        ) {
          return;
        }
        window.open(`/bundle/${payload}`, '_blank');
      } catch (e) {
        setOpenError(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedPaths],
  );

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <Header
        selectedCount={selected.size}
        totalBytes={totalBytes}
        onOpenTab={() => void openTab(false)}
        onOpenPinned={isGitRepo ? () => void openTab(true) : undefined}
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
              onPreview={(path) => {
                setPreviewPath(path);
                setViewMode('single');
              }}
            />
          )}
        </aside>
        <main className="flex min-w-0 flex-1 flex-col bg-slate-950">
          <div className="flex items-center gap-1 border-b border-slate-700 bg-slate-900 px-2 py-1">
            {(
              [
                ['single', 'プレビュー'],
                ['selected', `選択ファイル (${selectedPaths.length})`],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded px-2 py-0.5 text-xs ${
                  viewMode === mode
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            <FileViewer
              mode={viewMode}
              previewPath={previewPath}
              selectedPaths={selectedPaths}
              comments={comments}
              onAddComment={(file, startLine, endLine, body) =>
                addComment({ file, startLine, endLine, body })
              }
              onRemoveComment={(id) => void removeComment(id)}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
