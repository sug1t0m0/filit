import { useCallback, useEffect, useMemo, useState } from 'react';

import type { FileNode, TreeResponse } from '@/types/core.js';

export interface FileTreeState {
  tree: FileNode[];
  fileCount: number;
  /** path -> bytes for every selectable file */
  byteMap: Map<string, number>;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function collectBytes(nodes: FileNode[], map: Map<string, number>) {
  for (const node of nodes) {
    if (node.type === 'file' && node.selectable) {
      map.set(node.path, node.bytes ?? 0);
    }
    if (node.children) {
      collectBytes(node.children, map);
    }
  }
}

export function useFileTree(): FileTreeState {
  const [response, setResponse] = useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/tree')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<TreeResponse>;
      })
      .then(setResponse)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const byteMap = useMemo(() => {
    const map = new Map<string, number>();
    if (response) {
      collectBytes(response.tree, map);
    }
    return map;
  }, [response]);

  return {
    tree: response?.tree ?? [],
    fileCount: response?.fileCount ?? 0,
    byteMap,
    loading,
    error,
    reload,
  };
}
