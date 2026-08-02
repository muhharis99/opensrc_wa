import test = require("node:test");
import assert = require("node:assert/strict");
import { BaileysProvider } from "../packages/provider-baileys/src/baileys-provider";

interface HandlerMap { [event: string]: Array<(payload: any) => unknown>; }

test("Baileys adapter maps connection, pairing, and text send without leaking provider types", async () => {
  const handlers: HandlerMap = {};
  const sent: Array<{ jid: string; content: unknown }> = [];
  let saved = 0;

  const socket = baseSocket(handlers, async (jid: string, content: unknown) => {
    sent.push({ jid, content });
    return { key: { id: "message-1", remoteJid: jid } };
  });
  socket.authState = { creds: { registered: false } };
  socket.requestPairingCode = async () => "1234-5678";

  const provider = new BaileysProvider({
    sessionId: "utama",
    authRootDir: "/tmp/opensrc-wa-test",
    moduleLoader: async () => ({
      default: () => socket,
      useMultiFileAuthState: async () => ({ state: { creds: {}, keys: {} }, saveCreds: async () => { saved += 1; } }),
      Browsers: { ubuntu: () => ["opensrc_wa", "Chrome", "1"] },
      DisconnectReason: { loggedOut: 401, connectionReplaced: 440 },
      fetchLatestBaileysVersion: async () => ({ version: [2, 3000, 1], isLatest: true }),
      downloadMediaMessage: async (_message: unknown, mode: string) => mode === "stream" ? chunks([Buffer.from("media")]) : Buffer.from("media")
    })
  });

  const events: string[] = [];
  provider.onEvent((event) => { events.push(event.type); });

  await provider.connect();
  await handlers["connection.update"]?.[0]?.({ qr: "qr-token" });
  assert.ok(events.includes("pairing.qr"));

  assert.equal(await provider.requestPairingCode("+62 812-3456-7890"), "1234-5678");
  assert.ok(events.includes("pairing.code"));

  const result = await provider.send({ kind: "text", to: "6281234567890@s.whatsapp.net", text: "halo" });
  assert.equal(result.messageId, "message-1");
  assert.deepEqual(sent[0], { jid: "6281234567890@s.whatsapp.net", content: { text: "halo" } });

  const media = await provider.downloadMedia({ message: true });
  assert.equal(Buffer.from(media).toString("utf8"), "media");
  await handlers["creds.update"]?.[0]?.({});
  assert.equal(saved, 1);
});

test("Baileys adapter exposes group and contact operations", async () => {
  const handlers: HandlerMap = {};
  const socket = baseSocket(handlers);
  socket.authState = { creds: { registered: true } };
  socket.groupCreate = async (subject: string, participants: string[]) => ({ id: "g@g.us", subject, participants });
  socket.groupParticipantsUpdate = async () => [{ status: "200" }];
  socket.groupInviteCode = async () => "abc";
  socket.groupRevokeInvite = async () => "def";
  socket.groupAcceptInvite = async () => "g@g.us";
  socket.onWhatsApp = async (...numbers: string[]) => numbers;
  socket.getBroadcastListInfo = async (jid: string) => ({ id: jid, name: "Pelanggan", recipients: ["1@s.whatsapp.net"] });

  const provider = new BaileysProvider({
    sessionId: "s2",
    authRootDir: "/tmp/opensrc-wa-test",
    moduleLoader: async () => ({ default: () => socket, useMultiFileAuthState: async () => ({ state: { creds: {}, keys: {} }, saveCreds: async () => undefined }) })
  });
  await provider.connect();
  assert.deepEqual(await provider.createGroup({ subject: "Tim", participants: ["1@s.whatsapp.net"] }), { id: "g@g.us", subject: "Tim", participants: ["1@s.whatsapp.net"] });
  assert.equal(await provider.getGroupInviteCode("g@g.us"), "abc");
  assert.deepEqual(await provider.checkNumbers(["6281234567890"]), ["6281234567890"]);
  assert.deepEqual(await provider.getBroadcastListInfo("1234@broadcast"), { id: "1234@broadcast", name: "Pelanggan", recipients: ["1@s.whatsapp.net"] });
});

test("Baileys adapter sends buttons, lists, broadcast and distinguishes delete scopes", async () => {
  const handlers: HandlerMap = {};
  const sent: Array<{ jid: string; content: any; options: any }> = [];
  const relayed: Array<{ jid: string; message: unknown }> = [];
  const modified: unknown[] = [];
  const socket = baseSocket(handlers, async (jid: string, content: unknown, options: unknown) => {
    sent.push({ jid, content, options });
    return { key: { id: `sent-${sent.length}`, remoteJid: jid } };
  });
  socket.authState = { creds: { registered: true } };
  socket.user = { id: "self@s.whatsapp.net" };
  socket.relayMessage = async (jid: string, message: unknown) => { relayed.push({ jid, message }); };
  socket.chatModify = async (modification: unknown) => { modified.push(modification); };

  const provider = new BaileysProvider({
    sessionId: "interactive",
    authRootDir: "/tmp/opensrc-wa-test",
    moduleLoader: async () => ({
      default: () => socket,
      useMultiFileAuthState: async () => ({ state: { creds: {}, keys: {} }, saveCreds: async () => undefined }),
      proto: { Message: { fromObject: (value: unknown) => value } },
      generateWAMessageFromContent: (_jid: string, message: unknown) => ({ key: { id: `interactive-${relayed.length + 1}` }, message })
    })
  });
  await provider.connect();

  const buttons = await provider.send({ kind: "buttons", to: "1@s.whatsapp.net", text: "Pilih", buttons: [{ id: "yes", text: "Ya" }] });
  assert.equal(buttons.messageId, "interactive-1");
  assert.equal(relayed.length, 1);

  await provider.send({ kind: "list", to: "1@s.whatsapp.net", text: "Menu", buttonText: "Buka", sections: [{ rows: [{ id: "a", title: "A" }] }] });
  assert.equal(relayed.length, 2);

  await provider.send({ kind: "broadcast", to: "1234@broadcast", text: "Pengumuman" });
  assert.equal(sent[0]?.options.broadcast, true);

  const key = { remoteJid: "1@s.whatsapp.net", id: "message-x", fromMe: true };
  await provider.send({ kind: "delete", to: "1@s.whatsapp.net", key, scope: "me", timestamp: 1234, deleteMedia: true });
  assert.deepEqual(modified[0], { deleteForMe: { key, timestamp: 1234, deleteMedia: true } });
  await provider.send({ kind: "delete", to: "1@s.whatsapp.net", key, scope: "everyone" });
  assert.deepEqual(sent[1]?.content, { delete: key });
});

function baseSocket(handlers: HandlerMap, sendMessage?: (jid: string, content: unknown, options?: unknown) => Promise<unknown>): any {
  return {
    authState: { creds: { registered: true } },
    ev: { on(event: string, handler: (payload: any) => unknown) { (handlers[event] ??= []).push(handler); } },
    sendMessage: sendMessage ?? (async (jid: string) => ({ key: { id: "m", remoteJid: jid } })),
    sendPresenceUpdate: async () => undefined,
    groupCreate: async () => ({ id: "group@g.us" }),
    groupParticipantsUpdate: async () => [],
    groupUpdateSubject: async () => undefined,
    groupUpdateDescription: async () => undefined,
    groupSettingUpdate: async () => undefined,
    groupInviteCode: async () => "invite-code",
    groupRevokeInvite: async () => "new-invite-code",
    groupAcceptInvite: async () => "group@g.us",
    updateBlockStatus: async () => undefined,
    updateProfileName: async () => undefined,
    updateProfileStatus: async () => undefined,
    updateProfilePicture: async () => undefined,
    onWhatsApp: async (...numbers: string[]) => numbers.map((number) => ({ jid: `${number}@s.whatsapp.net`, exists: true })),
    ws: { close: () => undefined }
  };
}

async function* chunks(values: Uint8Array[]): AsyncIterable<Uint8Array> {
  for (const value of values) yield value;
}
