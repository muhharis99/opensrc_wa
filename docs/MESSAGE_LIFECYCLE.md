# Message Lifecycle

## Outbound mock

1. Validasi session `READY`.
2. Validasi recipient/JID.
3. Periksa block dan consent revoke.
4. Periksa idempotency key.
5. Bentuk message record dan chat ID.
6. Simpan pada runtime memory.
7. Emit `message.sent`.
8. Delivery/read/played receipt dapat diperbarui secara eksplisit.

Operasi lanjutan:

- reply/quote;
- forward;
- reaction;
- edit;
- delete self/everyone;
- poll;
- location;
- contact card;
- media reference.

## Incoming mock

`POST /api/v1/messages/mock-incoming` membuat record incoming, melakukan deduplication, memperbarui unread chat, dan emit `message.received`.

## Live

Outbound dan inbound live tetap `BLOCKED`. Mock record tidak boleh dianggap sebagai receipt atau delivery dari jaringan live.
