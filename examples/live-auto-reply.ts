const baseUrl = process.env.OPEN_SRC_WA_LIVE_URL ?? "http://localhost:3001";
const apiKey = process.env.OPEN_SRC_WA_API_KEY ?? "";
const sessionId = process.env.OPEN_SRC_WA_SESSION_ID ?? "utama";

if (!apiKey) throw new Error("OPEN_SRC_WA_API_KEY wajib diisi");

/**
 * Contoh ini menunjukkan pola reply melalui live gateway.
 * Incoming event sebaiknya diterima dari webhook milik aplikasi Anda, lalu
 * hanya dibalas apabila pengirim telah memberikan persetujuan.
 */
export async function replyToConsentedSender(input: { to: string; text: string; quoted: unknown; consented: boolean }): Promise<unknown> {
  if (!input.consented) throw new Error("Penerima belum memberikan persetujuan");
  const response = await fetch(`${baseUrl}/api/v1/live/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ kind: "text", to: input.to, text: input.text, quoted: input.quoted })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Live gateway error ${response.status}: ${JSON.stringify(body)}`);
  return body;
}
