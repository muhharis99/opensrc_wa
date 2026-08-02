import http from "node:http";
import crypto from "node:crypto";
const secret = process.env.WEBHOOK_SECRET ?? "replace-with-strong-secret";
http.createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    const timestamp = String(request.headers["x-opensrc-wa-timestamp"] ?? "");
    const delivery = String(request.headers["x-opensrc-wa-delivery"] ?? "");
    const event = String(request.headers["x-opensrc-wa-event"] ?? "");
    const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${delivery}.${event}.${body}`).digest("hex");
    const actual = String(request.headers["x-opensrc-wa-signature"] ?? "").replace(/^sha256=/, "");
    const valid = actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
    response.writeHead(valid ? 204 : 401);
    response.end();
  });
}).listen(4000, "127.0.0.1");
