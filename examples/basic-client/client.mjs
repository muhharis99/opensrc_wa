const baseUrl = process.env.OPEN_SRC_WA_URL ?? "http://localhost:3000";
const apiKey = process.env.OPEN_SRC_WA_API_KEY;
if (!apiKey) throw new Error("OPEN_SRC_WA_API_KEY is required");
const response = await fetch(`${baseUrl}/api/v1/sessions`, { headers: { "X-API-Key": apiKey } });
process.stdout.write(`${JSON.stringify(await response.json(), null, 2)}\n`);
