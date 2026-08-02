export type SessionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "AWAITING_PAIRING"
  | "PAIRING"
  | "AUTHENTICATED"
  | "SYNCING"
  | "READY"
  | "RECONNECTING"
  | "LOGGED_OUT"
  | "ERROR";

export type ErrorCategory =
  | "TRANSPORT_ERROR"
  | "AUTH_ERROR"
  | "PAIRING_ERROR"
  | "PROTOCOL_ERROR"
  | "CRYPTO_ERROR"
  | "SESSION_ERROR"
  | "MESSAGE_ERROR"
  | "MEDIA_ERROR"
  | "WEBHOOK_ERROR"
  | "RATE_LIMIT_ERROR"
  | "VALIDATION_ERROR"
  | "STORAGE_ERROR"
  | "CONFIGURATION_ERROR";

export interface BaseEvent {
  eventId: string;
  eventName: string;
  eventVersion: number;
  sessionId: string;
  timestamp: string;
  correlationId?: string;
}

export interface ApiMeta {
  request_id: string;
  timestamp: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  error: null;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  meta: ApiMeta;
}
