import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

/**
 * Stateless bundle URL codec (docs/bundle-url-spec.md).
 * payload := <version char><base64url(deflate-raw(canonical JSON))>
 */

export interface BundleParams {
  /** Repo-relative paths, order = output order */
  files: string[];
  /** Git commit SHA (7-40 hex chars); absent = live working tree */
  rev?: string;
}

const VERSION_CHAR = '1';
export const PAYLOAD_WARN_LENGTH = 2000;
export const PAYLOAD_MAX_LENGTH = 8000;
const DECODED_MAX_BYTES = 256 * 1024;
const REV_PATTERN = /^[0-9a-f]{7,40}$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isSafeRelativePath(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\\') || /^[a-zA-Z]:/.test(path)) {
    return false;
  }
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function validate(params: BundleParams): void {
  if (!Array.isArray(params.files) || params.files.length === 0) {
    throw new Error('bundle must contain at least one file');
  }
  for (const path of params.files) {
    if (typeof path !== 'string' || !isSafeRelativePath(path)) {
      throw new Error(`invalid file path in bundle: ${String(path)}`);
    }
  }
  if (params.rev !== undefined && !REV_PATTERN.test(params.rev)) {
    throw new Error(`invalid rev in bundle: ${params.rev}`);
  }
}

export function encodeBundleParams(params: BundleParams): string {
  validate(params);
  // Canonical key order (f, then r) so identical params yield identical payloads
  const json = JSON.stringify({ f: params.files, ...(params.rev ? { r: params.rev } : {}) });
  const payload = VERSION_CHAR + toBase64Url(deflateSync(strToU8(json)));
  if (payload.length > PAYLOAD_MAX_LENGTH) {
    throw new Error(
      `bundle URL is too long (${payload.length} chars > ${PAYLOAD_MAX_LENGTH}); select fewer files`,
    );
  }
  return payload;
}

export function decodeBundleParams(payload: string): BundleParams {
  if (payload.length > PAYLOAD_MAX_LENGTH) {
    throw new Error('invalid bundle URL: too long');
  }
  if (!payload.startsWith(VERSION_CHAR)) {
    throw new Error(`invalid bundle URL: unsupported version "${payload.slice(0, 1)}"`);
  }
  let json: string;
  try {
    const inflated = inflateSync(fromBase64Url(payload.slice(1)));
    if (inflated.byteLength > DECODED_MAX_BYTES) {
      throw new Error('decoded payload too large');
    }
    json = strFromU8(inflated);
  } catch {
    throw new Error('invalid bundle URL: cannot decode');
  }
  let raw: { f?: unknown; r?: unknown };
  try {
    raw = JSON.parse(json) as { f?: unknown; r?: unknown };
  } catch {
    throw new Error('invalid bundle URL: not valid JSON');
  }
  const params: BundleParams = {
    files: raw.f as string[],
    ...(raw.r !== undefined ? { rev: raw.r as string } : {}),
  };
  validate(params);
  return params;
}
