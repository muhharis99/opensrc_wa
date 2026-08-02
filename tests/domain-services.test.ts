import test = require("node:test");
import assert = require("node:assert/strict");
import { ChannelService, ChatService, CommunityService, ContactService, GroupService, PresenceService, StatusService } from "../packages/domain/src";

test("contacts track consent and blocking", () => {
  const contacts = new ContactService();
  contacts.upsert({ sessionId: "s1", phone: "6281234567890", name: "Test" });
  assert.equal(contacts.grantConsent("s1", "6281234567890", "opt-in form").consentStatus, "granted");
  assert.equal(contacts.setBlocked("s1", "6281234567890", true).blocked, true);
  assert.throws(() => contacts.assertCanMessage("s1", "6281234567890"), /diblokir/);
  contacts.setBlocked("s1", "6281234567890", false);
  contacts.revokeConsent("s1", "6281234567890");
  assert.throws(() => contacts.assertCanMessage("s1", "6281234567890"), /dicabut/);
});

test("chat, group, presence, status, channel, and community services work in mock runtime", () => {
  const chats = new ChatService();
  chats.ensure({ sessionId: "s1", chatId: "6281@s.whatsapp.net", title: "Customer" });
  chats.update("s1", "6281@s.whatsapp.net", { pinned: true, archived: true });
  assert.equal(chats.get("s1", "6281@s.whatsapp.net").pinned, true);

  const groups = new GroupService();
  const group = groups.create({ sessionId: "s1", subject: "Team", participants: ["a@s.whatsapp.net"] });
  groups.addParticipants("s1", group.groupId, ["b@s.whatsapp.net"]);
  groups.setRole("s1", group.groupId, ["b@s.whatsapp.net"], "admin");
  assert.equal(groups.get("s1", group.groupId).participants.find((item) => item.jid === "b@s.whatsapp.net")?.role, "admin");
  const rotated = groups.revokeInvite("s1", group.groupId);
  assert.notEqual(rotated.inviteCode, group.inviteCode);

  const presence = new PresenceService();
  assert.equal(presence.set("s1", "a@s.whatsapp.net", "composing").state, "composing");
  assert.deepEqual(presence.subscribe("s1", "a@s.whatsapp.net"), ["a@s.whatsapp.net"]);

  const statuses = new StatusService();
  const status = statuses.create({ sessionId: "s1", ownerJid: "self", type: "text", text: "hello" });
  statuses.view("s1", status.statusId, "a@s.whatsapp.net");
  statuses.react("s1", status.statusId, "a@s.whatsapp.net", "👍");
  assert.equal(statuses.list("s1")[0]?.reactions.length, 1);

  const channels = new ChannelService();
  const channel = channels.create({ sessionId: "s1", name: "News", ownerJid: "self" });
  channels.follow("s1", channel.channelId, "a@s.whatsapp.net", true);
  const published = channels.publish("s1", channel.channelId, { text: "Update" });
  channels.react("s1", channel.channelId, published.updates[0]?.updateId ?? "", "🔥");
  assert.equal(channels.list("s1")[0]?.followers.length, 1);

  const communities = new CommunityService();
  const community = communities.create({ sessionId: "s1", subject: "Community", ownerJid: "self" });
  assert.deepEqual(communities.attach("s1", community.communityId, group.groupId, true).subgroupIds, [group.groupId]);
});
