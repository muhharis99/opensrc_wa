export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "opensrc_wa Gateway API",
    version: "0.1.0",
    description: "Safe mock-first clean-room interoperability research gateway. Live WhatsApp protocol connectivity is BLOCKED until validated."
  },
  servers: [{ url: "http://localhost:3000" }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" }
    }
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/health": { get: { security: [], responses: { "200": { description: "Liveness" } } } },
    "/ready": { get: { security: [], responses: { "200": { description: "Readiness" } } } },
    "/version": { get: { security: [], responses: { "200": { description: "Version" } } } },
    "/api/v1/sessions": {
      get: { responses: { "200": { description: "List sessions" } } },
      post: { responses: { "201": { description: "Create session" } } }
    },
    "/api/v1/sessions/{sessionId}": {
      get: { responses: { "200": { description: "Get session" } } },
      delete: { responses: { "204": { description: "Delete session" } } }
    },
    "/api/v1/sessions/{sessionId}/connect": { post: { responses: { "200": { description: "Connect session" } } } },
    "/api/v1/sessions/{sessionId}/disconnect": { post: { responses: { "200": { description: "Disconnect session" } } } },
    "/api/v1/sessions/{sessionId}/logout": { post: { responses: { "200": { description: "Logout session" } } } },
    "/api/v1/sessions/{sessionId}/qr": { get: { responses: { "200": { description: "Current mock pairing challenge" } } } },
    "/api/v1/sessions/{sessionId}/status": { get: { responses: { "200": { description: "Session status" } } } },
    "/api/v1/messages/text": { post: { responses: { "202": { description: "Queue mock text message" } } } },
    "/api/v1/messages/{messageId}": { get: { responses: { "200": { description: "Message status" } } } },
    "/api/v1/webhooks": {
      get: { responses: { "200": { description: "List webhooks" } } },
      post: { responses: { "201": { description: "Create webhook" } } }
    },
    "/api/v1/webhooks/{webhookId}": { delete: { responses: { "204": { description: "Delete webhook" } } } },
    "/api/v1/events": { get: { responses: { "101": { description: "WebSocket upgrade" } } } }
  }
} as const;
