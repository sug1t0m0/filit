import { useState } from 'react';

interface CommentFormProps {
  startLine: number;
  endLine: number;
  maxLine: number;
  onSubmit: (body: string, startLine: number, endLine: number) => Promise<void>;
  onCancel: () => void;
}

export function CommentForm({ startLine, endLine, maxLine, onSubmit, onCancel }: CommentFormProps) {
  const [body, setBody] = useState('');
  const [start, setStart] = useState(startLine);
  const [end, setEnd] = useState(endLine);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rangeValid = start >= 1 && end >= start && end <= maxLine;
  const canSubmit = body.trim() !== '' && rangeValid && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(body, start, end);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  const lineInput = (value: number, onChange: (n: number) => void) => (
    <input
      type="number"
      min={1}
      max={maxLine}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-16 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-xs text-slate-200"
    />
  );

  return (
    <div className="my-1 ml-10 mr-4 rounded border border-sky-700 bg-slate-900 p-2">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
        <span>L</span>
        {lineInput(start, setStart)}
        <span>-</span>
        {lineInput(end, setEnd)}
        {!rangeValid && <span className="text-red-400">invalid range</span>}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="ここに注目して / これは何? (Cmd+Enter で追加)"
        rows={2}
        autoFocus
        className="w-full rounded border border-slate-600 bg-slate-800 p-2 text-sm text-slate-100 placeholder:text-slate-500"
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500"
        >
          コメント追加
        </button>
      </div>
    </div>
  );
}
