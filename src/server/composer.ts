import type { Comment, FileNode } from '../types/core.js';
import { utf8ByteLength } from '../utils/byteCount.js';
import { buildTree } from '../utils/tree.js';

export interface BundleFile {
  path: string;
  content: string;
}

function formatAnnotation(comment: Comment): string {
  const range =
    comment.startLine === comment.endLine
      ? `L${comment.startLine}`
      : `L${comment.startLine}-${comment.endLine}`;
  return `[注釈 ${range}: ${comment.body}]`;
}

/** Pick a fence longer than any backtick run inside the content */
function pickFence(content: string): string {
  const longestRun = content.match(/`+/g)?.reduce((max, run) => Math.max(max, run.length), 0) ?? 0;
  return '`'.repeat(Math.max(3, longestRun + 1));
}

function composeFile(file: BundleFile, comments: Comment[]): string {
  const lines = file.content.split('\n');
  if (lines.length > 1 && lines.at(-1) === '') {
    lines.pop();
  }
  const width = String(lines.length).length;
  const indent = ' '.repeat(width + 2);

  const annotationsByStart = new Map<number, Comment[]>();
  for (const comment of comments) {
    const anchor = Math.min(Math.max(comment.startLine, 1), Math.max(lines.length, 1));
    const bucket = annotationsByStart.get(anchor) ?? [];
    bucket.push(comment);
    annotationsByStart.set(anchor, bucket);
  }

  const body: string[] = [];
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    // Annotations keep their own unnumbered line so real line numbers stay intact
    for (const comment of annotationsByStart.get(lineNumber) ?? []) {
      body.push(`${indent}${formatAnnotation(comment)}`);
    }
    body.push(`${String(lineNumber).padStart(width)}: ${line}`);
  });

  const fence = pickFence(body.join('\n'));
  return `## ${file.path}\n\n${fence}\n${body.join('\n')}\n${fence}\n`;
}

function treeLines(nodes: FileNode[], depth = 0): string[] {
  return nodes.flatMap((node) =>
    node.type === 'directory'
      ? [`${'  '.repeat(depth)}${node.name}/`, ...treeLines(node.children ?? [], depth + 1)]
      : [`${'  '.repeat(depth)}${node.name}`],
  );
}

/** Textual directory tree so the LLM can read the structure even from plain Markdown */
function composeTreeSection(files: BundleFile[]): string {
  const lines = treeLines(buildTree(files.map((file) => ({ path: file.path }))));
  return `\`\`\`\n${lines.join('\n')}\n\`\`\`\n`;
}

export interface ComposedBundle {
  markdown: string;
  bytes: number;
}

export function composeMarkdown(files: BundleFile[], comments: Comment[]): ComposedBundle {
  const sections = files.map((file) =>
    composeFile(
      file,
      comments
        .filter((comment) => comment.file === file.path)
        .toSorted((a, b) => a.startLine - b.startLine),
    ),
  );
  const body = sections.join('\n');
  const header = `# filit bundle (${files.length} file${files.length === 1 ? '' : 's'})\n\n`;
  const markdown = header + composeTreeSection(files) + '\n' + body;
  return { markdown, bytes: utf8ByteLength(markdown) };
}
