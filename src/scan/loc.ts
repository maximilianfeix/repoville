export interface SourceCount {
  binary: boolean;
  /** Non-blank lines. */
  loc: number;
  /** All lines, including blank ones. A trailing newline does not start a new line. */
  lines: number;
  todos: number;
}

const MARKER = /\b(?:TODO|FIXME|HACK|XXX)\b/g;
const SNIFF = 8192;

export function countSource(buf: Uint8Array): SourceCount {
  const sniff = Math.min(buf.length, SNIFF);
  for (let i = 0; i < sniff; i++) if (buf[i] === 0) return { binary: true, loc: 0, lines: 0, todos: 0 };

  let lines = 0;
  let loc = 0;
  let blank = true;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i]!;
    if (c === 10) {
      lines++;
      if (!blank) loc++;
      blank = true;
    } else if (blank && c !== 13 && c !== 32 && c !== 9) {
      blank = false;
    }
  }
  if (buf.length > 0 && buf[buf.length - 1] !== 10) {
    lines++;
    if (!blank) loc++;
  }

  const text = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString('latin1');
  const todos = text.match(MARKER)?.length ?? 0;
  return { binary: false, loc, lines, todos };
}
