import test = require("node:test");
import assert = require("node:assert/strict");
import { BaileysProvider } from "../packages/provider-baileys/src/baileys-provider";

interface HandlerMap { [event: string]: Array<(payload: any) => unknown>; }

test("Baileys adapter maps connection, pairing, and text send without leaking provider types", async () => {
  const handlers: HandlerMap = {};
  const sent: Array<{ jid: string; content: unknown }> = [];
  let saved = 0;

  const socket = {
    authState: { creds: { registered: false } },
    ev: {
      on(event: string, handler: (payload: any) => unknown) {
        (handlers[event] ??= []).push(handler);
      }
    },
    requestPairingCode: async () => "1234-5678",
    sendMessage: async (jid: string, content: unknown) => {
      sent.push({ jid, content });
      return { key: { id: "message-1", remoteJid: jid } };
    },
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

  const provider = new BaileysProvider({
    sessionId: "utama",
    authRootDir: "/tmp/opensrc-wa-test",
    moduleLoader: async () => ({
      default: () => socket,
      useMultiFileAuthState: async () => ({ state: { creds: {}, keys: {} }, saveCreds: async () => { saved += 1; } }),
      Browsers: { ubuntu: () => ["opensrc_wa", "Chrome", "1"] },
      DisconnectReason: { loggedOut: 401, connectionReplaced: 440 },
      fetchLatestBaileysVersion: async () => ({ version: [2, 3000, 1], isLatest: true }),
      downloadMediaMessage: async () => Buffer.from("media")
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

  await handlers["creds.update"]?.[0]?.({});
  assert.equal(saved, 1);
});

test("Baileys adapter exposes group and contact operations", async () => {
  const handlers: HandlerMap = {};
  const socket = {
    authState: { creds: { registered: true } },
    ev: { on(event: string, handler: (payload: any) => unknown) { (handlers[event] ??= []).push(handler); } },
    sendMessage: async (jid: string) => ({ key: { id: "m", remoteJid: jid } }),
    sendPresenceUpdate: async () => undefined,
    groupCreate: async (subject: string, participants: string[]) => ({ id: "g@g.us", subject, participants }),
    groupParticipantsUpdate: async () => [{ status: "200" }],
    groupUpdateSubject: async () => undefined,
    groupUpdateDescription: async () => undefined,
    groupSettingUpdate: async () => undefined,
    groupInviteCode: async () => "abc",
    groupRevokeInvite: async () => "def",
    groupAcceptInvite: async () => "g@g.us",
    updateBlockStatus: async () => undefined,
    updateProfileName: async () => undefined,
    updateProfileStatus: async () => undefined,
    updateProfilePicture: async () => undefined,
    onWhatsApp: async (...numbers: string[]) => numbers,
    ws: { close: () => undefined }
  };
  const provider = new BaileysProvider({
    sessionId: "s2",
    authRootDir: "/tmp/opensrc-wa-test",
    moduleLoader: async () => ({ default: () => socket, useMultiFileAuthState: async () => ({ state: { creds: {}, keys: {} }, saveCreds: async () => undefined }) })
  });
  await provider.connect();
  assert.deepEqual(await provider.createGroup({ subject: "Tim", participants: ["1@s.whatsapp.net"] }), { id: "g@g.us", subject: "Tim", participants: ["1@s.whatsapp.net"] });
  assert.equal(await provider.getGroupInviteCode("g@g.us"), "abc");
  assert.deepEqual(await provider.checkNumbers(["6281234567890"]), ["6281234567890"]);
});
