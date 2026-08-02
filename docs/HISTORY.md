# History Snapshot

Runtime mock dapat membuat snapshot domain:

```text
POST /api/v1/history/snapshots
GET  /api/v1/history/snapshots?session_id=...
GET  /api/v1/history/snapshots/:snapshotId?session_id=...
POST /api/v1/history/import
```

Snapshot mencakup message, chat, contact, group, status, channel, community, catalog, label, call, dan privacy state.

Import menyimpan fixture sebagai snapshot terverifikasi. Import tidak mengklaim memulihkan app-state atau history dari jaringan live.
