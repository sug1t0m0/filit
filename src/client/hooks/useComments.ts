import { useCallback, useEffect, useState } from 'react';

import type { Comment } from '@/types/core.js';

export interface NewCommentInput {
  file: string;
  startLine: number;
  endLine: number;
  body: string;
}

export interface CommentsState {
  comments: Comment[];
  addComment: (input: NewCommentInput) => Promise<void>;
  removeComment: (id: string) => Promise<void>;
  error: string | null;
}

export function useComments(): CommentsState {
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/comments')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ comments: Comment[] }>;
      })
      .then((data) => setComments(data.comments))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const addComment = useCallback(async (input: NewCommentInput) => {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? `HTTP ${res.status}`);
    }
    const comment = (await res.json()) as Comment;
    setComments((prev) => [...prev, comment]);
  }, []);

  const removeComment = useCallback(async (id: string) => {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      throw new Error(`HTTP ${res.status}`);
    }
    setComments((prev) => prev.filter((comment) => comment.id !== id));
  }, []);

  return { comments, addComment, removeComment, error };
}
