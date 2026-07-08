import { describe, expect, it } from 'vitest';

import { formatBytes, utf8ByteLength } from './byteCount.js';

describe('utf8ByteLength', () => {
  it('counts ASCII as 1 byte per character', () => {
    expect(utf8ByteLength('hello')).toBe(5);
  });

  it('counts Japanese characters as 3 bytes each', () => {
    expect(utf8ByteLength('注釈')).toBe(6);
  });

  it('counts empty string as 0', () => {
    expect(utf8ByteLength('')).toBe(0);
  });
});

describe('formatBytes', () => {
  it('adds thousands separators', () => {
    expect(formatBytes(12345)).toBe('12,345 bytes');
  });
});
