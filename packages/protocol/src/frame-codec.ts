import { OpenSrcWaError } from "../../core/src/errors";

export class LengthPrefixedFrameCodec {
  public constructor(private readonly maxFrameBytes = 1_048_576) {}

  public encode(payload: Uint8Array): Uint8Array {
    if (payload.byteLength > this.maxFrameBytes) throw this.tooLarge(payload.byteLength);
    const output = new Uint8Array(4 + payload.byteLength);
    new DataView(output.buffer).setUint32(0, payload.byteLength, false);
    output.set(payload, 4);
    return output;
  }

  public decode(frame: Uint8Array): Uint8Array {
    if (frame.byteLength < 4) throw this.malformed("Frame header incomplete");
    const length = new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getUint32(0, false);
    if (length > this.maxFrameBytes) throw this.tooLarge(length);
    if (frame.byteLength !== length + 4) throw this.malformed("Frame length mismatch");
    return frame.slice(4);
  }

  private malformed(message: string): OpenSrcWaError {
    return new OpenSrcWaError({ code: "MALFORMED_FRAME", category: "PROTOCOL_ERROR", message });
  }

  private tooLarge(size: number): OpenSrcWaError {
    return new OpenSrcWaError({ code: "FRAME_TOO_LARGE", category: "PROTOCOL_ERROR", message: "Frame exceeds configured limit", details: { size, max: this.maxFrameBytes } });
  }
}
