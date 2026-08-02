export interface OpenSrcWaClientOptions { baseUrl: string; apiKey: string; fetchImpl?: typeof fetch; }
export interface ApiEnvelope<T> { success: boolean; data: T; error: { code: string; message: string; details: Record<string, unknown> } | null; meta: { request_id: string; timestamp: string }; }

export class OpenSrcWaClient {
  private readonly fetchImpl: typeof fetch;
  public constructor(private readonly options: OpenSrcWaClientOptions) { this.fetchImpl = options.fetchImpl ?? fetch; }

  public capabilities(): Promise<unknown> { return this.request("GET", "/api/v1/capabilities"); }
  public createSession(sessionId: string): Promise<unknown> { return this.request("POST", "/api/v1/sessions", { session_id: sessionId }); }
  public connectSession(sessionId: string): Promise<unknown> { return this.request("POST", `/api/v1/sessions/${encodeURIComponent(sessionId)}/connect`); }
  public completeMockPairing(sessionId: string): Promise<unknown> { return this.request("POST", `/api/v1/sessions/${encodeURIComponent(sessionId)}/mock-complete-pairing`); }
  public sendText(input: { sessionId: string; to: string; text: string; idempotencyKey: string; quotedMessageId?: string }): Promise<unknown> {
    return this.request("POST", "/api/v1/messages/text", { session_id: input.sessionId, to: input.to, text: input.text, idempotency_key: input.idempotencyKey, quoted_message_id: input.quotedMessageId });
  }
  public sendMedia(input: { sessionId: string; to: string; mediaId: string; mediaType: string; caption?: string; idempotencyKey: string }): Promise<unknown> {
    return this.request("POST", "/api/v1/messages/media", { session_id: input.sessionId, to: input.to, media_id: input.mediaId, media_type: input.mediaType, caption: input.caption, idempotency_key: input.idempotencyKey });
  }
  public listChats(sessionId: string): Promise<unknown> { return this.request("GET", `/api/v1/chats?session_id=${encodeURIComponent(sessionId)}`); }
  public listContacts(sessionId: string): Promise<unknown> { return this.request("GET", `/api/v1/contacts?session_id=${encodeURIComponent(sessionId)}`); }
  public listGroups(sessionId: string): Promise<unknown> { return this.request("GET", `/api/v1/groups?session_id=${encodeURIComponent(sessionId)}`); }

  public async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
      method,
      headers: { "X-API-Key": this.options.apiKey, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const payload = await response.json() as ApiEnvelope<unknown>;
    if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
    return payload.data;
  }
}
