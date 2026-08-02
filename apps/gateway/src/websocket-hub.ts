import crypto = require("node:crypto");

interface UpgradeRequest {
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface SocketLike {
  write(data: Uint8Array | string): void;
  end(): void;
  destroy(): void;
  on(event: string, handler: (data?: Uint8Array) => void): void;
}

export class WebSocketEventHub {
  private readonly sockets = new Set<SocketLike>();

  public accept(request: UpgradeRequest, socket: SocketLike): boolean {
    const key = header(request.headers, "sec-websocket-key");
    const upgrade = header(request.headers, "upgrade").toLowerCase();
    if (!key || upgrade !== "websocket") return false;
    const accept = crypto.createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    socket.write([
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "\r\n"
    ].join("\r\n"));
    this.sockets.add(socket);
    socket.on("close", () => this.sockets.delete(socket));
    socket.on("error", () => this.sockets.delete(socket));
    socket.on("data", (data) => { if (data) this.handleClientFrame(socket, data); });
    return true;
  }

  public publish(event: unknown): void {
    const frame = encodeTextFrame(JSON.stringify(event));
    for (const socket of this.sockets) {
      try { socket.write(frame); } catch { this.sockets.delete(socket); socket.destroy(); }
    }
  }

  public closeAll(): void {
    const frame = new Uint8Array([0x88, 0x00]);
    for (const socket of this.sockets) { socket.write(frame); socket.end(); }
    this.sockets.clear();
  }

  private handleClientFrame(socket: SocketLike, data: Uint8Array): void {
    if (data.byteLength < 2) return;
    const opcode = data[0]! & 0x0f;
    if (opcode === 0x8) { this.sockets.delete(socket); socket.end(); }
    if (opcode === 0x9) socket.write(new Uint8Array([0x8a, 0x00]));
  }
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string {
  const value = headers[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function encodeTextFrame(text: string): Uint8Array {
  const payload = new TextEncoder().encode(text);
  if (payload.byteLength < 126) {
    const frame = new Uint8Array(2 + payload.byteLength);
    frame[0] = 0x81;
    frame[1] = payload.byteLength;
    frame.set(payload, 2);
    return frame;
  }
  if (payload.byteLength <= 65_535) {
    const frame = new Uint8Array(4 + payload.byteLength);
    frame[0] = 0x81;
    frame[1] = 126;
    new DataView(frame.buffer).setUint16(2, payload.byteLength, false);
    frame.set(payload, 4);
    return frame;
  }
  throw new Error("WebSocket event too large");
}
