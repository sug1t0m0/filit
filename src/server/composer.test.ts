import { describe, expect, it } from 'vitest';

import type { Comment } from '../types/core.js';

import { composeMarkdown } from './composer.js';

function comment(overrides: Partial<Comment>): Comment {
  return {
    id: 'id',
    file: 'a.ts',
    startLine: 1,
    endLine: 1,
    body: 'body',
    createdAt: '2026-07-08T00:00:00Z',
    ...overrides,
  };
}

describe('composeMarkdown', () => {
  it('renders numbered lines inside a fenced block per file', () => {
    const { markdown } = composeMarkdown(
      [{ path: 'a.ts', content: 'const a = 1;\nconst b = 2;\n' }],
      [],
    );

    expect(markdown).toContain('# filit bundle (1 file)');
    expect(markdown).toContain('## a.ts');
    expect(markdown).toContain('1: const a = 1;');
    expect(markdown).toContain('2: const b = 2;');
  });

  it('inserts annotations before their start line without shifting line numbers', () => {
    const { markdown } = composeMarkdown(
      [{ path: 'a.ts', content: 'l1\nl2\nl3\nl4\n' }],
      [comment({ startLine: 2, endLine: 3, body: 'ここは何?' })],
    );

    const lines = markdown.split('\n');
    const annotationIndex = lines.findIndex((line) => line.includes('[注釈 L2-3: ここは何?]'));
    expect(annotationIndex).toBeGreaterThan(-1);
    expect(lines[annotationIndex + 1]).toBe('2: l2');
    expect(lines[annotationIndex - 1]).toBe('1: l1');
    // Real line numbers stay contiguous
    expect(markdown).toContain('4: l4');
  });

  it('formats single-line annotations as L{n}', () => {
    const { markdown } = composeMarkdown(
      [{ path: 'a.ts', content: 'l1\n' }],
      [comment({ startLine: 1, endLine: 1, body: 'これは?' })],
    );
    expect(markdown).toContain('[注釈 L1: これは?]');
  });

  it('only attaches comments belonging to the file', () => {
    const { markdown } = composeMarkdown(
      [
        { path: 'a.ts', content: 'a\n' },
        { path: 'b.ts', content: 'b\n' },
      ],
      [comment({ file: 'b.ts', body: 'b専用' })],
    );

    const sectionA = markdown.slice(markdown.indexOf('## a.ts'), markdown.indexOf('## b.ts'));
    expect(sectionA).not.toContain('b専用');
    expect(markdown).toContain('b専用');
  });

  it('widens the fence when content contains backtick runs', () => {
    const { markdown } = composeMarkdown([{ path: 'doc.md', content: '```js\ncode\n```\n' }], []);
    expect(markdown).toContain('````\n');
  });

  it('pads line numbers to a uniform width', () => {
    const content = `${Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n')}\n`;
    const { markdown } = composeMarkdown([{ path: 'a.ts', content }], []);
    expect(markdown).toContain(' 1: line1');
    expect(markdown).toContain('10: line10');
  });

  it('includes a directory tree section after the header', () => {
    const { markdown } = composeMarkdown(
      [
        { path: 'src/a.ts', content: 'a\n' },
        { path: 'src/deep/b.ts', content: 'b\n' },
        { path: 'top.md', content: 'c\n' },
      ],
      [],
    );
    expect(markdown).toContain('src/\n  deep/\n    b.ts\n  a.ts\ntop.md');
    expect(markdown.indexOf('src/\n')).toBeLessThan(markdown.indexOf('## src/a.ts'));
  });

  it('reports UTF-8 byte size of the whole markdown', () => {
    const result = composeMarkdown([{ path: 'a.ts', content: '注\n' }], []);
    expect(result.bytes).toBe(Buffer.byteLength(result.markdown, 'utf8'));
  });
});
