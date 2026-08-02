# Session Lifecycle

State yang didukung:

```text
DISCONNECTED -> CONNECTING -> AWAITING_PAIRING -> PAIRING
-> AUTHENTICATED -> SYNCING -> READY
```

Recovery dapat melalui `RECONNECTING`; terminal/pemulihan lain adalah `ERROR`, `LOGGED_OUT`, dan `DISCONNECTED`.

Setiap transisi divalidasi oleh `SessionStateMachine`. Record memiliki version, timestamp, credential version, dan metadata. Mode mock membuat challenge terjadwal serta menyimpan perubahan state. Mode research gagal tertutup dengan `LIVE_PROTOCOL_BLOCKED`.
