const encoder = new TextEncoder();

export function utf8ByteLength(text: string): number {
  return encoder.encode(text).length;
}

export function formatBytes(bytes: number): string {
  return `${bytes.toLocaleString('en-US')} bytes`;
}
