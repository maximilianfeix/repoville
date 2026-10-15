import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

/** Minimal NBT encoder: just the tags Repoville emits, streamed in chunks. */
export const TAG = {
  end: 0, byte: 1, short: 2, int: 3, long: 4, float: 5, double: 6,
  byteArray: 7, string: 8, list: 9, compound: 10, intArray: 11, longArray: 12,
} as const;
type TagName = keyof typeof TAG;

export type Tag =
  | { type: 'byte' | 'short' | 'int' | 'float' | 'double'; value: number }
  | { type: 'long'; value: bigint }
  | { type: 'string'; value: string }
  | { type: 'list'; of: TagName; value: Tag[] }
  | { type: 'compound'; value: Record<string, Tag> }
  | { type: 'byteArray'; value: Uint8Array }
  | { type: 'intArray'; value: ArrayLike<number> }
  | { type: 'longArray'; value: BigInt64Array | bigint[] }
  /** Large arrays produced on the fly: header first, then the payload chunks. */
  | { type: 'stream'; of: 'byteArray' | 'longArray'; length: number; chunks: () => Iterable<Uint8Array> };

export const nbt = {
  byte: (value: number): Tag => ({ type: 'byte', value }),
  short: (value: number): Tag => ({ type: 'short', value }),
  int: (value: number): Tag => ({ type: 'int', value }),
  long: (value: bigint | number): Tag => ({ type: 'long', value: BigInt(value) }),
  float: (value: number): Tag => ({ type: 'float', value }),
  double: (value: number): Tag => ({ type: 'double', value }),
  string: (value: string): Tag => ({ type: 'string', value }),
  list: (of: TagName, value: Tag[]): Tag => ({ type: 'list', of: value.length ? of : 'end', value }),
  compound: (value: Record<string, Tag>): Tag => ({ type: 'compound', value }),
  intArray: (value: ArrayLike<number>): Tag => ({ type: 'intArray', value }),
  longArray: (value: BigInt64Array | bigint[]): Tag => ({ type: 'longArray', value }),
  byteArray: (value: Uint8Array): Tag => ({ type: 'byteArray', value }),
};

/** Java "modified UTF-8": NUL is two bytes and supplementary characters are encoded as surrogate pairs. */
export function modifiedUtf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 1 && c <= 0x7f) out.push(c);
    else if (c <= 0x7ff) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return Uint8Array.from(out);
}

const CHUNK = 1 << 16;

class Out {
  private buf = Buffer.allocUnsafe(CHUNK);
  private pos = 0;
  readonly ready: Uint8Array[] = [];

  private ensure(n: number) {
    if (this.pos + n > this.buf.length) {
      this.flush();
      if (n > this.buf.length) this.buf = Buffer.allocUnsafe(n);
    }
  }
  flush() {
    if (this.pos > 0) {
      this.ready.push(Buffer.from(this.buf.subarray(0, this.pos)));
      this.pos = 0;
    }
  }
  u8(v: number) { this.ensure(1); this.buf.writeUInt8(v & 0xff, this.pos); this.pos += 1; }
  i8(v: number) { this.ensure(1); this.buf.writeInt8(v, this.pos); this.pos += 1; }
  i16(v: number) { this.ensure(2); this.buf.writeInt16BE(((v << 16) >> 16), this.pos); this.pos += 2; }
  u16(v: number) { this.ensure(2); this.buf.writeUInt16BE(v, this.pos); this.pos += 2; }
  i32(v: number) { this.ensure(4); this.buf.writeInt32BE(v | 0, this.pos); this.pos += 4; }
  i64(v: bigint) { this.ensure(8); this.buf.writeBigInt64BE(BigInt.asIntN(64, v), this.pos); this.pos += 8; }
  f32(v: number) { this.ensure(4); this.buf.writeFloatBE(v, this.pos); this.pos += 4; }
  f64(v: number) { this.ensure(8); this.buf.writeDoubleBE(v, this.pos); this.pos += 8; }
  bytes(b: Uint8Array) { this.ensure(b.length); this.buf.set(b, this.pos); this.pos += b.length; }
  str(s: string) {
    const b = modifiedUtf8(s);
    if (b.length > 0xffff) throw new RangeError('NBT string too long');
    this.u16(b.length);
    this.bytes(b);
  }
}

function tagId(t: Tag): number {
  return t.type === 'stream' ? TAG[t.of] : TAG[t.type];
}

function* payload(out: Out, t: Tag): Generator<Uint8Array> {
  switch (t.type) {
    case 'byte': out.i8(t.value); break;
    case 'short': out.i16(t.value); break;
    case 'int': out.i32(t.value); break;
    case 'long': out.i64(t.value); break;
    case 'float': out.f32(t.value); break;
    case 'double': out.f64(t.value); break;
    case 'string': out.str(t.value); break;
    case 'byteArray': out.i32(t.value.length); out.bytes(t.value); break;
    case 'intArray': out.i32(t.value.length); for (let i = 0; i < t.value.length; i++) out.i32(t.value[i]!); break;
    case 'longArray': out.i32(t.value.length); for (const v of t.value) out.i64(v); break;
    case 'list':
      out.u8(TAG[t.of]);
      out.i32(t.value.length);
      for (const item of t.value) yield* payload(out, item);
      break;
    case 'compound':
      for (const [k, v] of Object.entries(t.value)) {
        out.u8(tagId(v));
        out.str(k);
        yield* payload(out, v);
      }
      out.u8(TAG.end);
      break;
    case 'stream': {
      out.i32(t.length);
      out.flush();
      yield* out.ready.splice(0);
      let written = 0;
      for (const c of t.chunks()) {
        written += c.length;
        yield c;
      }
      const expected = t.of === 'byteArray' ? t.length : t.length * 8;
      if (written !== expected) throw new Error(`stream wrote ${written} bytes, expected ${expected}`);
      return;
    }
  }
  if (out.ready.length) yield* out.ready.splice(0);
}

/** Encodes a named root tag as uncompressed NBT chunks. */
export function* encode(name: string, root: Tag): Generator<Uint8Array> {
  const out = new Out();
  out.u8(tagId(root));
  out.str(name);
  yield* payload(out, root);
  out.flush();
  yield* out.ready.splice(0);
}

export function encodeToBuffer(name: string, root: Tag): Buffer {
  return Buffer.concat([...encode(name, root)]);
}

/** Streams a gzip-compressed NBT file to disk. */
export async function writeGzipNbt(file: string, name: string, root: Tag): Promise<void> {
  await pipeline(Readable.from(encode(name, root), { objectMode: false }), createGzip({ level: 6 }), createWriteStream(file));
}
