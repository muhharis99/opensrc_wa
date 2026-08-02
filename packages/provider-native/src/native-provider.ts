import type {
  ProviderConnectOptions,
  ProviderEvent,
  ProviderEventListener,
  ProviderGroupCreateInput,
  ProviderSendRequest,
  ProviderSendResult,
  WhatsAppProvider
} from "../../provider-contract/src/types";

export interface NativeProviderEvidence {
  endpointValidated: boolean;
  handshakeValidated: boolean;
  noiseValidated: boolean;
  signalValidated: boolean;
  testedAt: string | null;
  evidenceReference: string | null;
}

export class NativeProvider implements WhatsAppProvider {
  public readonly name = "native" as const;
  private readonly listeners = new Set<ProviderEventListener>();

  public constructor(
    public readonly sessionId: string,
    private readonly evidence: NativeProviderEvidence = {
      endpointValidated: false,
      handshakeValidated: false,
      noiseValidated: false,
      signalValidated: false,
      testedAt: null,
      evidenceReference: null
    }
  ) {}

  public async connect(_options?: ProviderConnectOptions): Promise<void> {
    await this.emit({ type: "connection.update", sessionId: this.sessionId, state: "connecting" });
    const reason = this.blocker();
    await this.emit({ type: "connection.update", sessionId: this.sessionId, state: "error", reason, retryable: false });
    throw new Error(reason);
  }

  public async requestPairingCode(_phone: string): Promise<string> { return this.blocked(); }
  public async disconnect(): Promise<void> { await this.emit({ type: "connection.update", sessionId: this.sessionId, state: "disconnected", reason: "manual_disconnect", retryable: false }); }
  public async logout(): Promise<void> { await this.emit({ type: "connection.update", sessionId: this.sessionId, state: "logged_out", reason: "manual_logout", retryable: false }); }
  public async send(_request: ProviderSendRequest): Promise<ProviderSendResult> { return this.blocked(); }
  public async downloadMedia(_message: unknown): Promise<Uint8Array> { return this.blocked(); }
  public async downloadMediaStream(_message: unknown): Promise<AsyncIterable<Uint8Array>> { return this.blocked(); }
  public async getContacts(): Promise<unknown[]> { return this.blocked(); }
  public async getChats(): Promise<unknown[]> { return this.blocked(); }
  public async checkNumbers(_numbers: string[]): Promise<unknown[]> { return this.blocked(); }
  public async getBroadcastListInfo(_jid: string): Promise<unknown> { return this.blocked(); }
  public async setPresence(_state: "available" | "unavailable" | "composing" | "recording" | "paused", _jid?: string): Promise<void> { return this.blocked(); }
  public async createGroup(_input: ProviderGroupCreateInput): Promise<unknown> { return this.blocked(); }
  public async updateGroupParticipants(_groupJid: string, _participants: string[], _action: "add" | "remove" | "promote" | "demote"): Promise<unknown> { return this.blocked(); }
  public async updateGroupSubject(_groupJid: string, _subject: string): Promise<void> { return this.blocked(); }
  public async updateGroupDescription(_groupJid: string, _description: string): Promise<void> { return this.blocked(); }
  public async updateGroupSetting(_groupJid: string, _setting: "announcement" | "not_announcement" | "locked" | "unlocked"): Promise<void> { return this.blocked(); }
  public async getGroupInviteCode(_groupJid: string): Promise<string> { return this.blocked(); }
  public async revokeGroupInvite(_groupJid: string): Promise<string> { return this.blocked(); }
  public async acceptGroupInvite(_code: string): Promise<string> { return this.blocked(); }
  public async blockContact(_jid: string, _action: "block" | "unblock"): Promise<void> { return this.blocked(); }
  public async updateProfileName(_name: string): Promise<void> { return this.blocked(); }
  public async updateProfileStatus(_status: string): Promise<void> { return this.blocked(); }
  public async updateProfilePicture(_jid: string, _image: Uint8Array): Promise<void> { return this.blocked(); }

  public onEvent(listener: ProviderEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public status(): { status: "BLOCKED"; evidence: NativeProviderEvidence; reason: string } {
    return { status: "BLOCKED", evidence: { ...this.evidence }, reason: this.blocker() };
  }

  private blocker(): string {
    const missing = Object.entries(this.evidence)
      .filter(([key, value]) => key.endsWith("Validated") && value !== true)
      .map(([key]) => key);
    return `NATIVE_PROTOCOL_BLOCKED: missing reproducible clean-room evidence for ${missing.join(", ") || "live interoperability"}`;
  }

  private blocked<T>(): Promise<T> { return Promise.reject(new Error(this.blocker())); }

  private async emit(event: ProviderEvent): Promise<void> {
    for (const listener of [...this.listeners]) await listener(event);
  }
}
