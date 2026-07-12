import { deflateSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';

import { decodeBundleParams, encodeBundleParams, PAYLOAD_MAX_LENGTH } from './bundleCode.js';

describe('encode/decode roundtrip', () => {
  it('roundtrips files without rev', () => {
    const params = { files: ['src/client/App.tsx', 'src/server/server.ts'] };
    expect(decodeBundleParams(encodeBundleParams(params))).toEqual(params);
  });

  it('roundtrips files with rev', () => {
    const params = { files: ['a.ts'], rev: '9c1f2ab' };
    expect(decodeBundleParams(encodeBundleParams(params))).toEqual(params);
  });

  it('preserves file order', () => {
    const params = { files: ['z.ts', 'a.ts', 'm.ts'] };
    expect(decodeBundleParams(encodeBundleParams(params)).files).toEqual(['z.ts', 'a.ts', 'm.ts']);
  });

  it('roundtrips non-ASCII paths', () => {
    const params = { files: ['ドキュメント/設計.md'] };
    expect(decodeBundleParams(encodeBundleParams(params))).toEqual(params);
  });

  it('is deterministic for identical params', () => {
    const params = { files: ['a.ts', 'b.ts'], rev: 'abcdef0' };
    expect(encodeBundleParams(params)).toBe(encodeBundleParams(params));
  });

  it('produces URL-path-safe payloads', () => {
    const payload = encodeBundleParams({
      files: Array.from({ length: 30 }, (_, i) => `src/very/deep/dir/file${i}.ts`),
    });
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('compresses repetitive path lists', () => {
    const files = Array.from({ length: 50 }, (_, i) => `src/client/components/Component${i}.tsx`);
    const payload = encodeBundleParams({ files });
    expect(payload.length).toBeLessThan(JSON.stringify(files).length / 2);
  });
});

describe('encode validation', () => {
  it('rejects empty selections', () => {
    expect(() => encodeBundleParams({ files: [] })).toThrow(/at least one file/);
  });

  it('rejects invalid revs', () => {
    expect(() => encodeBundleParams({ files: ['a.ts'], rev: 'HEAD' })).toThrow(/invalid rev/);
    expect(() => encodeBundleParams({ files: ['a.ts'], rev: 'abc' })).toThrow(/invalid rev/);
  });

  it('rejects oversized selections', () => {
    const files = Array.from(
      { length: 4000 },
      () => `src/${Math.random().toString(36).slice(2)}/${Math.random().toString(36).slice(2)}.ts`,
    );
    expect(() => encodeBundleParams({ files })).toThrow(/too long/);
    expect(PAYLOAD_MAX_LENGTH).toBe(8000);
  });
});

describe('decode validation', () => {
  it('rejects unknown versions', () => {
    expect(() => decodeBundleParams('9abcdef')).toThrow(/unsupported version/);
  });

  it('rejects garbage payloads', () => {
    expect(() => decodeBundleParams('1!!!not-base64!!!')).toThrow(/cannot decode/);
    expect(() => decodeBundleParams('1AAAA')).toThrow(/cannot decode/);
  });

  it('rejects path traversal and absolute paths', () => {
    for (const path of ['../etc/passwd', '/etc/passwd', 'a/../../b', 'C:/windows', 'a\\b', '']) {
      const payload = encodeUnchecked({ f: [path] });
      expect(() => decodeBundleParams(payload)).toThrow(/invalid file path/);
    }
  });

  it('rejects payloads missing files', () => {
    expect(() => decodeBundleParams(encodeUnchecked({ r: 'abcdef0' }))).toThrow(
      /at least one file/,
    );
  });
});

/** Build a payload bypassing encode-side validation, to exercise decode-side checks */
function encodeUnchecked(raw: object): string {
  // Mirrors the internal format: version char + base64url(deflate(json))
  const bytes = deflateSync(strToU8(JSON.stringify(raw)));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `1${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`;
}
