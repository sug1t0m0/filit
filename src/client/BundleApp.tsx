import { useEffect, useMemo, useState } from 'react';

import type { BundleDetailResponse } from '@/types/core.js';
import { formatBytes, utf8ByteLength } from '@/utils/byteCount.js';
import { buildTree } from '@/utils/tree.js';

import { BundleTree } from './components/BundleTree.js';
import { FileCode } from './components/FileCode.js';

interface BundleAppProps {
  id: string;
}

export function BundleApp({ id }: BundleAppProps) {
  const [bundle, setBundle] = useState<BundleDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bundles/${id}`)
      .then((res) => {
        if (!res.ok)
          throw new Error(res.status === 404 ? 'bundle not found' : `HTTP ${res.status}`);
        return res.json() as Promise<BundleDetailResponse>;
      })
      .then(setBundle)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  // Keep the server alive while this tab is open too
  useEffect(() => {
    const source = new EventSource('/api/heartbeat');
    return () => source.close();
  }, []);

  const tree = useMemo(
    () =>
      buildTree(
        (bundle?.files ?? []).map((file) => ({
          path: file.path,
          bytes: utf8ByteLength(file.content),
        })),
      ),
    [bundle],
  );

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-red-400">
        {error === 'bundle not found'
          ? 'Bundle not found — unknown bundle id. Re-open from the filit tab.'
          : `Failed to load bundle: ${error}`}
      </div>
    );
  }
  if (!bundle) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-500">
        Loading bundle...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center gap-4 border-b border-slate-700 bg-slate-900 px-4 py-2">
        <h1 className="text-lg font-bold text-slate-100">filit bundle</h1>
        <span className="text-sm tabular-nums text-slate-400">
          {bundle.files.length} files / {formatBytes(bundle.bytes)}
        </span>
        {bundle.rev ? (
          <span
            title={`コミット ${bundle.rev} 時点の内容に固定されています`}
            className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-amber-300"
          >
            @{bundle.rev.slice(0, 7)}
          </span>
        ) : (
          <span
            title="ワーキングツリーの現在の内容を表示しています"
            className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400"
          >
            live
          </span>
        )}
        <div className="flex-1" />
        <a
          href={`/api/bundles/${id}/raw`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-sky-400 hover:text-sky-300"
        >
          raw markdown
        </a>
      </header>
      {bundle.missing.length > 0 && (
        <p className="border-b border-amber-900 bg-amber-950 px-4 py-1 text-sm text-amber-300">
          スコープ外/削除済みのため表示できないファイル: {bundle.missing.join(', ')}
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-auto border-r border-slate-700 bg-slate-900">
          <BundleTree
            tree={tree}
            onJump={(path) => {
              document.getElementById(`file-${path}`)?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </aside>
        <main className="min-w-0 flex-1 overflow-auto bg-slate-950">
          {bundle.files.map((file) => (
            <FileCode
              key={file.path}
              path={file.path}
              content={file.content}
              comments={bundle.comments}
              readOnly
            />
          ))}
        </main>
      </div>
    </div>
  );
}
