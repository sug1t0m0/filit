import { formatBytes } from '@/utils/byteCount.js';

interface HeaderProps {
  selectedCount: number;
  totalBytes: number;
  onOpenTab: () => void;
  /** Omit to hide the pinned-open button (not a git repo) */
  onOpenPinned?: (() => void) | undefined;
  openDisabled: boolean;
}

export function Header({
  selectedCount,
  totalBytes,
  onOpenTab,
  onOpenPinned,
  openDisabled,
}: HeaderProps) {
  return (
    <header className="flex items-center gap-4 border-b border-slate-700 bg-slate-900 px-4 py-2">
      <h1 className="text-lg font-bold text-slate-100">filit</h1>
      <span className="text-sm tabular-nums text-slate-400">
        {selectedCount} files / {formatBytes(totalBytes)}
      </span>
      <div className="flex-1" />
      {onOpenPinned && (
        <button
          type="button"
          onClick={onOpenPinned}
          disabled={openDisabled}
          title="HEAD コミット時点の内容で開く (URL が内容まで固定される)"
          className="rounded border border-sky-700 px-3 py-1 text-sm font-medium text-sky-300 hover:bg-sky-950 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
        >
          HEAD 固定で開く
        </button>
      )}
      <button
        type="button"
        onClick={onOpenTab}
        disabled={openDisabled}
        title="現在のワーキングツリーの内容で開く"
        className="rounded bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
      >
        タブに開く
      </button>
    </header>
  );
}
