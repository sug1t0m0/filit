import type { Comment } from '@/types/core.js';

interface CommentCardProps {
  comment: Comment;
  /** Omit to render read-only (no delete button) */
  onDelete?: (id: string) => void;
}

export function CommentCard({ comment, onDelete }: CommentCardProps) {
  const range =
    comment.startLine === comment.endLine
      ? `L${comment.startLine}`
      : `L${comment.startLine}-${comment.endLine}`;

  return (
    <div className="my-1 ml-10 mr-4 rounded border border-amber-700/60 bg-amber-950/40 p-2">
      <div className="flex items-start gap-2">
        <span className="shrink-0 rounded bg-amber-900/60 px-1.5 py-0.5 text-xs tabular-nums text-amber-300">
          {range}
        </span>
        <p className="flex-1 whitespace-pre-wrap text-sm text-slate-200">{comment.body}</p>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(comment.id)}
            title="コメントを削除"
            className="shrink-0 text-xs text-slate-500 hover:text-red-400"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
