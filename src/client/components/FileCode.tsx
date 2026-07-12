import { Fragment, useState } from 'react';

import { Highlight, themes } from 'prism-react-renderer';

import type { Comment } from '@/types/core.js';

import { CommentCard } from './CommentCard.js';
import { CommentForm } from './CommentForm.js';

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  json: 'json',
  css: 'css',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  md: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  py: 'python',
  go: 'go',
  rs: 'rust',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  toml: 'toml',
};

function languageForPath(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return LANGUAGE_BY_EXTENSION[ext] ?? 'plaintext';
}

interface FileCodeProps {
  path: string;
  content: string;
  comments: Comment[];
  readOnly?: boolean;
  onAddComment?: (file: string, startLine: number, endLine: number, body: string) => Promise<void>;
  onRemoveComment?: (id: string) => void;
}

/** One file rendered as a highlighted, numbered table with inline comments */
export function FileCode({
  path,
  content,
  comments,
  readOnly = false,
  onAddComment,
  onRemoveComment,
}: FileCodeProps) {
  const [formLine, setFormLine] = useState<number | null>(null);

  // Strip the trailing newline so it doesn't render as a phantom empty line
  const code = content.replace(/\n$/, '');
  const lineCount = code.split('\n').length;

  const fileComments = comments.filter((comment) => comment.file === path);
  const commentsEndingAt = (line: number) =>
    fileComments.filter((comment) => Math.min(comment.endLine, lineCount) === line);

  return (
    <section id={`file-${path}`}>
      <div className="sticky top-0 z-10 border-b border-slate-700 bg-slate-900 px-4 py-2 font-mono text-sm text-slate-300">
        {path}
        {fileComments.length > 0 && (
          <span className="ml-2 text-xs text-amber-400">
            {fileComments.length} comment{fileComments.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <Highlight theme={themes.vsDark} code={code} language={languageForPath(path)}>
        {({ tokens, getTokenProps }) => (
          <table className="w-full border-collapse font-mono text-xs leading-5">
            <tbody>
              {tokens.map((lineTokens, index) => {
                const lineNumber = index + 1;
                const attached = commentsEndingAt(lineNumber);
                return (
                  <Fragment key={lineNumber}>
                    <tr className="group hover:bg-slate-800/50">
                      <td className="w-6 select-none align-top">
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => setFormLine(lineNumber)}
                            title={`L${lineNumber} にコメント`}
                            className="hidden w-full rounded-sm bg-sky-600 text-center font-bold leading-5 text-white hover:bg-sky-500 group-hover:block"
                          >
                            +
                          </button>
                        )}
                      </td>
                      <td className="w-10 select-none pr-3 text-right align-top tabular-nums text-slate-600">
                        {lineNumber}
                      </td>
                      <td className="whitespace-pre-wrap break-all">
                        {lineTokens.map((token, tokenIndex) => (
                          // biome-ignore lint: token order is stable within a line
                          <span key={tokenIndex} {...getTokenProps({ token })} />
                        ))}
                      </td>
                    </tr>
                    {(attached.length > 0 || formLine === lineNumber) && (
                      <tr>
                        <td colSpan={3}>
                          {attached.map((comment) => (
                            <CommentCard
                              key={comment.id}
                              comment={comment}
                              onDelete={readOnly || !onRemoveComment ? undefined : onRemoveComment}
                            />
                          ))}
                          {!readOnly && onAddComment && formLine === lineNumber && (
                            <CommentForm
                              startLine={lineNumber}
                              endLine={lineNumber}
                              maxLine={lineCount}
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
        )}
      </Highlight>
    </section>
  );
}
