# Streaming Media dan Object Storage

Endpoint download media dapat mengembalikan Base64 untuk kompatibilitas atau menulis stream ke object store lokal.

## Simpan sebagai object

```http
POST /api/v1/live/sessions/{sessionId}/media/download
X-API-Key: API_KEY
Content-Type: application/json
```

```json
{
  "message": {},
  "storage": "object",
  "content_type": "image/jpeg",
  "file_name": "foto.jpg"
}
```

Response memuat `objectId`, ukuran, SHA-256, MIME, dan `download_path`.

## Download object

```text
GET /api/v1/live/objects/{objectId}
```

Endpoint membutuhkan API key dan mengalirkan data tanpa mengubahnya menjadi Base64.

## Lokasi penyimpanan

```env
OPEN_SRC_WA_OBJECT_STORE_DIR=./runtime/objects
```

`LocalObjectStore` menulis ke file sementara, menghitung SHA-256 saat streaming, lalu melakukan atomic rename. Metadata disimpan berdampingan dengan file data.

Untuk produksi multi-node, implementasikan `ObjectStore` menggunakan S3-compatible storage atau layanan object storage lain. Jangan memberikan bucket publik; gunakan encryption at rest, retention policy, malware scanning, MIME validation, quota, dan signed URL berumur pendek.
