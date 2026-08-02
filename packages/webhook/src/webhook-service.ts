import crypto = require("node:crypto");
import { retry } from "../../core/src/retry";
import { DeduplicationWindow } from "../../core/src/deduplication";
import { WebhookSigner } from "./signing";

export interface WebhookSubscription {
  webhookId: string;
  url: string;
  secret: string;
  events: string[];
  createdAt: string;
}

export interface WebhookDelivery {
  deliveryId: string;
  webhookId: string;
  event: string;
  status: "delivered" | "dead-letter";
  attempts: number;
  lastError?: string;
  timestamp: string;
}

export class WebhookService {
  private readonly subscriptions = new Map<string, WebhookSubscription>();
  private readonly deliveries: WebhookDelivery[] = [];
  private readonly dedupe = new DeduplicationWindow(24 * 60 * 60 * 1000);
  private readonly signer = new WebhookSigner();

  public constructor(private readonly timeoutMs = 5_000, private readonly maxRetries = 4) {}

  public create(input: { url: string; secret: string; events: string[] }): WebhookSubscription {
    const subscription: WebhookSubscription = { webhookId: crypto.randomUUID(), url: input.url, secret: input.secret, events: [...new Set(input.events)], createdAt: new Date().toISOString() };
    this.subscriptions.set(subscription.webhookId, subscription);
    return subscription;
  }

  public list(): WebhookSubscription[] { return [...this.subscriptions.values()].map(({ secret: _secret, ...safe }) => ({ ...safe, secret: "[REDACTED]" })); }
  public delete(webhookId: string): boolean { return this.subscriptions.delete(webhookId); }
  public history(): WebhookDelivery[] { return [...this.deliveries]; }

  public async publish(event: string, payload: unknown): Promise<void> {
    const body = JSON.stringify(payload);
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.events.includes(event) && !subscription.events.includes("*")) continue;
      const deliveryId = crypto.randomUUID();
      if (!this.dedupe.accept(deliveryId)) continue;
      let attempts = 0;
      try {
        await retry(async (attempt) => {
          attempts = attempt;
          const timestamp = new Date().toISOString();
          const headers = this.signer.sign(subscription.secret, event, deliveryId, timestamp, body);
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), this.timeoutMs);
          try {
            const response = await fetch(subscription.url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body, signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
          } finally { clearTimeout(timer); }
        }, { maxAttempts: this.maxRetries, baseDelayMs: 250, maxDelayMs: 5_000, jitterRatio: 0.2 });
        this.deliveries.push({ deliveryId, webhookId: subscription.webhookId, event, status: "delivered", attempts, timestamp: new Date().toISOString() });
      } catch (error) {
        this.deliveries.push({ deliveryId, webhookId: subscription.webhookId, event, status: "dead-letter", attempts, lastError: error instanceof Error ? error.message : "unknown", timestamp: new Date().toISOString() });
      }
    }
  }
}
