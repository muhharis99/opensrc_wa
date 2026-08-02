const baseUrl = process.env.OPEN_SRC_WA_LIVE_URL ?? "http://localhost:3001";
const apiKey = process.env.OPEN_SRC_WA_API_KEY ?? "";
const sessionId = process.env.OPEN_SRC_WA_SESSION_ID ?? "utama";

interface Recipient {
  jid: string;
  consentedAt: string | null;
}

export async function sendConsentedBroadcast(recipients: Recipient[], text: string): Promise<void> {
  if (!apiKey) throw new Error("OPEN_SRC_WA_API_KEY wajib diisi");
  const consented = recipients.filter((recipient) => recipient.consentedAt !== null);
  for (const recipient of consented) {
    const response = await fetch(`${baseUrl}/api/v1/live/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ kind: "text", to: recipient.jid, text })
    });
    if (!response.ok) throw new Error(`Gagal mengirim ke ${recipient.jid}: HTTP ${response.status}`);
    await sleep(1_500);
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
