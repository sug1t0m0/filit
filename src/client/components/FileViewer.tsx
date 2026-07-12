import type { Comment } from '@/types/core.js';

import { FileSection } from './FileSection.js';

export type ViewMode = 'single' | 'selected';

interface FileViewerProps {
  mode: ViewMode;
  previewPath: string | null;
  /** Checked files in tree display order */
  selectedPaths: string[];
  comments: Comment[];
  onAddComment: (file: string, startLine: number, endLine: number, body: string) => Promise<void>;
  onRemoveComment: (id: string) => void;
}

export function FileViewer({
  mode,
  previewPath,
  selectedPaths,
  comments,
  onAddComment,
  onRemoveComment,
}: FileViewerProps) {
  const paths = mode === 'single' ? (previewPath ? [previewPath] : []) : selectedPaths;

  if (paths.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        {mode === 'single'
          ? 'Select a file from the tree to preview'
          : 'Check files in the tree to view them here'}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {paths.map((path) => (
        <FileSection
          key={path}
          path={path}
          comments={comments}
          onAddComment={onAddComment}
          onRemoveComment={onRemoveComment}
        />
      ))}
    </div>
  );
}
