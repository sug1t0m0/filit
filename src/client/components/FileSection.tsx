import { useEffect, useState } from 'react';

import type { Comment, FileContentResponse } from '@/types/core.js';

import { FileCode } from './FileCode.js';

interface FileSectionProps {
  path: string;
  comments: Comment[];
  onAddComment: (file: string, startLine: number, endLine: number, body: string) => Promise<void>;
  onRemoveComment: (id: string) => void;
}

/** Fetches a file from the workspace and renders it editable; used by both viewer modes */
export function FileSection({ path, comments, onAddComment, onRemoveComment }: FileSectionProps) {
  const [file, setFile] = useState<FileContentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    fetch(`/api/file/${encodeURI(path)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<FileContentResponse>;
      })
      .then(setFile)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [path]);

  if (error) {
    return (
      <div className="p-4 text-red-400">
        Failed to load {path}: {error}
      </div>
    );
  }
  if (!file || file.path !== path) {
    return <div className="p-4 text-slate-500">Loading {path}...</div>;
  }

  return (
    <FileCode
      path={file.path}
      content={file.content}
      comments={comments}
      onAddComment={onAddComment}
      onRemoveComment={onRemoveComment}
    />
  );
}
