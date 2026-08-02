import { OpenSrcWaError } from "../../core/src/errors";

export interface BinaryNode {
  tag: string;
  attributes: Record<string, string>;
  content?: Uint8Array;
}

interface SerializableNode {
  tag: string;
  attributes: Record<string, string>;
  content?: string;
}

export class BinaryNodeCodec {
  public encode(node: BinaryNode): Uint8Array {
    const serializable: SerializableNode = {
      tag: node.tag,
      attributes: node.attributes,
      ...(node.content ? { content: Buffer.from(node.content).toString("base64") } : {})
    };
    return new TextEncoder().encode(JSON.stringify(serializable));
  }

  public decode(payload: Uint8Array): BinaryNode {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(payload)) as unknown;
      if (!parsed || typeof parsed !== "object") throw new Error("not object");
      const value = parsed as Record<string, unknown>;
      if (typeof value.tag !== "string" || !value.attributes || typeof value.attributes !== "object") throw new Error("invalid shape");
      const attributes: Record<string, string> = {};
      for (const [key, child] of Object.entries(value.attributes as Record<string, unknown>)) {
        if (typeof child !== "string") throw new Error("invalid attribute");
        attributes[key] = child;
      }
      return {
        tag: value.tag,
        attributes,
        ...(typeof value.content === "string" ? { content: new Uint8Array(Buffer.from(value.content, "base64")) } : {})
      };
    } catch {
      throw new OpenSrcWaError({ code: "INVALID_BINARY_NODE", category: "PROTOCOL_ERROR", message: "Binary node payload is invalid" });
    }
  }
}
