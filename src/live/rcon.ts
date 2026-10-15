import { Socket } from 'node:net';

const AUTH = 3;
const COMMAND = 2;
const MAX_FRAGMENT = 4096;

/** Minimal Source RCON client (as used by Minecraft servers). */
interface Pending {
  kind: 'auth' | 'command';
  parts: string[];
  resolve: (body: string) => void;
  reject: (err: Error) => void;
}

/** Minimal Source RCON client (as spoken by Minecraft servers). */
export class Rcon {
  private socket: Socket | null = null;
  private nextId = 1;
  private buffer = Buffer.alloc(0);
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly host: string, private readonly port: number) {}

  async connect(password: string, timeoutMs = 5000): Promise<void> {
    this.socket = await new Promise<Socket>((resolve, reject) => {
      const s = new Socket();
      const timer = setTimeout(() => {
        s.destroy();
        reject(new Error(`RCON connect to ${this.host}:${this.port} timed out`));
      }, timeoutMs);
      s.once('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      s.connect(this.port, this.host, () => {
        clearTimeout(timer);
        resolve(s);
      });
    });
    this.socket.on('data', (d: Buffer) => this.onData(d));
    this.socket.on('error', (e) => this.failAll(e));
    this.socket.on('close', () => this.failAll(new Error('RCON connection closed')));
    await this.request('auth', AUTH, password);
  }

  /** Runs a command (no leading slash) and resolves with the full reply. */
  async send(command: string): Promise<string> {
    if (!this.socket) throw new Error('RCON not connected');
    return this.request('command', COMMAND, command);
  }

  close(): void {
    this.socket?.end();
    this.socket = null;
  }

  private request(kind: Pending['kind'], type: number, body: string): Promise<string> {
    const id = this.nextId++;
    const p = new Promise<string>((resolve, reject) => this.pending.set(id, { kind, parts: [], resolve, reject }));
    const payload = Buffer.from(body, 'utf8');
    const packet = Buffer.alloc(14 + payload.length);
    packet.writeInt32LE(10 + payload.length, 0);
    packet.writeInt32LE(id, 4);
    packet.writeInt32LE(type, 8);
    payload.copy(packet, 12);
    this.socket!.write(packet);
    return p;
  }

  private failAll(err: Error): void {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  private onData(d: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, d]);
    while (this.buffer.length >= 4) {
      const len = this.buffer.readInt32LE(0);
      if (this.buffer.length < 4 + len) return;
      const id = this.buffer.readInt32LE(4);
      const body = this.buffer.toString('utf8', 12, 4 + len - 2);
      this.buffer = this.buffer.subarray(4 + len);
      if (id === -1) {
        this.failAll(new Error('RCON authentication failed (check MC_RCON_PW)'));
        continue;
      }
      const p = this.pending.get(id);
      if (!p) continue;
      if (p.kind === 'command') {
        // Minecraft splits replies into 4096-byte fragments; a shorter one is the last.
        // (Marker packets with an unknown type make the server drop the connection.)
        p.parts.push(body);
        if (len - 10 < MAX_FRAGMENT) {
          this.pending.delete(id);
          p.resolve(p.parts.join(''));
        }
      } else {
        this.pending.delete(id);
        p.resolve(body);
      }
    }
  }
}
