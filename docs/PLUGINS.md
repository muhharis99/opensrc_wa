# Plugin System

`PluginRegistry` menyediakan hook in-process yang eksplisit:

- `session.created`
- `session.ready`
- `message.before_send`
- `message.after_send`
- `message.received`
- `webhook.before_delivery`

Plugin harus diregistrasikan oleh kode aplikasi pada startup. Gateway tidak memiliki endpoint untuk mengunggah atau mengeksekusi source code plugin dari request HTTP.

```ts
registry.register({
  id: "audit.plugin",
  version: "1.0.0",
  hooks: ["message.after_send"],
  handle(context) {
    return { hook: context.hook, timestamp: context.timestamp };
  }
});
```

Plugin tidak boleh mengakses key material, credential, QR payload, atau secret melalui context.
