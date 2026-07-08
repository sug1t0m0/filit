import { Fragment, useEffect, useState } from 'react';

import type { Comment, FileContentResponse } from '@/types/core.js';

import { CommentCard } from './CommentCard.js';
import { CommentForm } from './CommentForm.js';

interface FileViewerProps {
  path: string | null;
  comments: Comment[];
  onAddComment: (file: string, startLine: number, endLine: number, body: string) => Promise<void>;
  onRemoveComment: (id: string) => void;
}

export function FileViewer({ path, comments, onAddComment, onRemoveComment }: FileViewerProps) {
  const [file, setFile] = useState<FileContentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formLine, setFormLine] = useState<number | null>(null);

  useEffect(() => {
    setFormLine(null);
    if (!path) {
      setFile(null);
      return;
    }
    setError(null);
    fetch(`/api/file/${encodeURI(path)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<FileContentResponse>;
      })
      .then(setFile)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [path]);

  if (!path) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Select a file from the tree to preview
      </div>
    );
  }
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

  const lines = file.content.split('\n');
  // Drop the phantom empty line after a trailing newline
  if (lines.length > 1 && lines.at(-1) === '') {
    lines.pop();
  }

  const fileComments = comments.filter((comment) => comment.file === path);
  const commentsEndingAt = (line: number) =>
    fileComments.filter((comment) => Math.min(comment.endLine, lines.length) === line);

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 border-b border-slate-700 bg-slate-900 px-4 py-2 font-mono text-sm text-slate-300">
        {file.path}
        {fileComments.length > 0 && (
          <span className="ml-2 text-xs text-amber-400">
            {fileComments.length} comment{fileComments.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <table className="w-full border-collapse font-mono text-xs leading-5">
        <tbody>
          {lines.map((line, index) => {
            const lineNumber = index + 1;
            const attached = commentsEndingAt(lineNumber);
            return (
              <Fragment key={lineNumber}>
                <tr className="group hover:bg-slate-800/50">
                  <td className="w-6 select-none align-top">
                    <button
                      type="button"
                      onClick={() => setFormLine(lineNumber)}
                      title={`L${lineNumber} にコメント`}
                      className="hidden w-full rounded-sm bg-sky-600 text-center font-bold leading-5 text-white hover:bg-sky-500 group-hover:block"
                    >
                      +
                    </button>
                  </td>
                  <td className="w-10 select-none pr-3 text-right align-top tabular-nums text-slate-600">
                    {lineNumber}
                  </td>
                  <td className="whitespace-pre-wrap break-all text-slate-200">{line}</td>
                </tr>
                {(attached.length > 0 || formLine === lineNumber) && (
                  <tr>
                    <td colSpan={3}>
                      {attached.map((comment) => (
                        <CommentCard
                          key={comment.id}
                          comment={comment}
                          onDelete={onRemoveComment}
                        />
                      ))}
                      {formLine === lineNumber && (
                        <CommentForm
                          startLine={lineNumber}
                          endLine={lineNumber}
                          maxLine={lines.length}
                          onSubmit={async (body, startLine, endLine) => {
                            await onAddComment(path, startLine, endLine, body);
                            setFormLine(null);
                          }}
                          onCancel={() => setFormLine(null)}
                        />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
