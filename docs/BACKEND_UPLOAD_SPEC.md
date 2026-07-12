# Backend Spec — Resumable Video Upload (S3 Multipart)

This document is the **contract** the SafeIn5 UI frontend is built against. A backend
developer should be able to implement a working server using only this file. Nothing here
is optional unless explicitly marked so.

The frontend records/selects a short (≤30s) video, splits the file into parts, and uploads
each part **directly to S3** using presigned URLs. The backend only (a) mints presigned
URLs, (b) finalizes/aborts the multipart upload, and (c) stores metadata. The large video
bytes never pass through your application server.

---

## 1. Why this design

The UI must satisfy four hard requirements:

| Requirement                    | How the design meets it                                                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Non-blocking**               | Parts upload in the background from a Web Worker / Service Worker; the app stays interactive.                                                                                                                          |
| **Survives app close**         | Upload state (incl. per-part ETags) is persisted in IndexedDB; on reopen the client resumes from the first missing part. On Android/Chrome the Background Fetch API continues the upload even while the app is closed. |
| **Never fails (no data loss)** | Each part is retried independently with exponential backoff. A completed part is never re-uploaded. A permanently offline device simply resumes when it reconnects.                                                    |
| **Extremely fast**             | Parts are uploaded in parallel directly to S3 (default 4 concurrent × ~6 MB parts), bypassing the app server.                                                                                                          |

This maps exactly to the **S3 Multipart Upload** flow:
`CreateMultipartUpload` → `UploadPart` (×N, presigned) → `CompleteMultipartUpload` / `AbortMultipartUpload`.

---

## 2. High-level flow

```
Frontend                         Backend                         S3
   │                                │                             │
   │  POST /uploads/init  ─────────▶│                             │
   │  {filename,size,mime,          │  CreateMultipartUpload ────▶│
   │   partSize,durationSec}        │◀──── uploadId ──────────────│
   │                                │  presign UploadPart ×N      │
   │◀── {uploadId,key,parts[],…} ──│                             │
   │                                                              │
   │  PUT part 1 (presigned URL) ────────────────────────────────▶│
   │◀──────────────────────────────────────── 200 + ETag header ─│
   │  PUT part 2 …(parallel, retried on failure)…                 │
   │                                                              │
   │  POST /uploads/complete ──────▶│                             │
   │  {uploadId,key,parts:[{n,eTag}]}  CompleteMultipartUpload ──▶│
   │◀── {location,videoId} ─────────│◀──── final object ──────────│
   │                                                              │
   │  (on cancel/expiry)                                          │
   │  POST /uploads/abort ─────────▶│  AbortMultipartUpload ─────▶│
```

The client may also request **fresh presigned URLs mid-upload** (see `/uploads/parts`)
because presigned URLs expire — a paused/backgrounded upload that resumes hours later needs
new URLs for the parts it hasn't finished.

---

## 3. Endpoints

Base path: `${VITE_API_BASE_URL}` (configured per environment on the frontend).
All request/response bodies are JSON (`Content-Type: application/json`) **except** the direct
part `PUT`s, which go to S3 with the raw binary body.

Authentication: whatever scheme the rest of the API uses (e.g. `Authorization: Bearer <token>`).
Apply it to all four backend endpoints below. The presigned S3 URLs carry their own auth in
the query string — do **not** require an `Authorization` header on the S3 `PUT`.

### 3.1 `POST /uploads/init` — start a multipart upload

Creates the S3 multipart upload and returns presigned URLs for every part.

**Request**

```jsonc
{
  "filename": "clip.mp4", // original/desired filename
  "size": 18874368, // total bytes (integer)
  "mime": "video/mp4", // MIME type of the recording
  "partSize": 6291456, // bytes per part the client will use (see §5)
  "durationSec": 22.4, // measured clip duration; REJECT if > 30 (see §6)
}
```

**Response `200`**

```jsonc
{
  "uploadId": "2~abcdef...", // S3 multipart upload id
  "key": "videos/2026/07/uuid.mp4", // S3 object key the server chose
  "partSize": 6291456, // echo back the authoritative part size
  "partCount": 3, // ceil(size / partSize)
  "parts": [
    // presigned PUT URL per part
    { "partNumber": 1, "url": "https://bucket.s3...&X-Amz-Signature=..." },
    { "partNumber": 2, "url": "https://bucket.s3...&X-Amz-Signature=..." },
    { "partNumber": 3, "url": "https://bucket.s3...&X-Amz-Signature=..." },
  ],
  "urlExpiresInSec": 3600, // how long the presigned URLs are valid
}
```

**Server responsibilities**

- Validate `mime` is an allowed video type and `durationSec <= 30` → else `422` (see §6/§7).
- Validate `size` against a max (recommend ≥ 50 MB headroom for a 30s clip).
- Choose the S3 `key` (do not trust client paths).
- `CreateMultipartUpload` with `ContentType: mime`.
- Presign one `UploadPart` URL per part (`partNumber` 1..N, `PartNumber` + `UploadId` in the signature).
- Persist an `upload` metadata row: `{ videoId?, key, uploadId, size, mime, durationSec, status: "initiated", createdAt }`.

### 3.2 `POST /uploads/parts` — re-presign expired part URLs (resume support)

Called by the client when it resumes an upload whose presigned URLs may have expired. Returns
fresh URLs **only for the parts the client still needs**.

**Request**

```jsonc
{
  "uploadId": "2~abcdef...",
  "key": "videos/2026/07/uuid.mp4",
  "partNumbers": [2, 3], // parts not yet completed on the client
}
```

**Response `200`**

```jsonc
{
  "parts": [
    { "partNumber": 2, "url": "https://bucket.s3...&X-Amz-Signature=..." },
    { "partNumber": 3, "url": "https://bucket.s3...&X-Amz-Signature=..." },
  ],
  "urlExpiresInSec": 3600,
}
```

- Verify the `uploadId`/`key` belong to the caller and are still `initiated` (not completed/aborted).
- If the multipart upload no longer exists (expired/aborted server-side) → `410 Gone` so the
  client can discard the job and restart cleanly.

> **Optional but recommended:** also support `GET /uploads/:uploadId/parts` returning the parts
> S3 already has (`ListParts`) so the client can reconcile after losing local state. If you skip
> this, the client relies solely on its IndexedDB record of ETags.

### 3.3 `POST /uploads/complete` — finalize

**Request**

```jsonc
{
  "uploadId": "2~abcdef...",
  "key": "videos/2026/07/uuid.mp4",
  "parts": [
    // MUST be sorted ascending by partNumber
    { "partNumber": 1, "eTag": "\"d41d8cd98f00b204e9800998ecf8427e\"" },
    { "partNumber": 2, "eTag": "\"ab56b4d92b40713acc5af89985d4b786\"" },
    { "partNumber": 3, "eTag": "\"1b2f...\"" },
  ],
}
```

**Response `200`**

```jsonc
{
  "videoId": "vid_01H...", // your canonical id for the stored video
  "key": "videos/2026/07/uuid.mp4",
  "location": "https://cdn.example.com/videos/2026/07/uuid.mp4", // optional playable URL
  "status": "completed",
}
```

- Call `CompleteMultipartUpload` with the exact `PartNumber`+`ETag` list (S3 requires ascending order).
- Update metadata row `status: "completed"`, record final size/location.
- **Idempotency:** if called again for an already-completed `uploadId`, return the same `200`
  result (don't error). The client may retry `complete` after a flaky network.
- On S3 `InvalidPart`/`NoSuchUpload` → return `409` with `{ "code": "PART_MISMATCH" }` so the
  client re-checks parts and retries.

### 3.4 `POST /uploads/abort` — cancel / cleanup

**Request**

```jsonc
{ "uploadId": "2~abcdef...", "key": "videos/2026/07/uuid.mp4" }
```

**Response `200`** `{ "status": "aborted" }`

- Call `AbortMultipartUpload` (frees the uploaded parts in S3 — important for cost).
- Mark metadata `status: "aborted"`.
- Idempotent: aborting an unknown/already-aborted upload returns `200`.

---

## 4. S3 bucket configuration (required)

The browser uploads parts **directly** to S3, so the bucket must allow cross-origin `PUT`
from the app origins **and expose the `ETag` response header** to JavaScript. Without the
`ExposeHeaders: ETag`, the browser cannot read the per-part ETag and `complete` is impossible.

**CORS configuration**

```json
[
  {
    "AllowedOrigins": [
      "https://localhost:5173",
      "https://staging.example.com",
      "https://app.example.com"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**Lifecycle rule (strongly recommended):** auto-abort incomplete multipart uploads so
abandoned parts don't accumulate cost.

```json
{
  "Rules": [
    {
      "ID": "abort-incomplete-multipart",
      "Status": "Enabled",
      "Filter": { "Prefix": "videos/" },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
    }
  ]
}
```

**IAM** for the presigning role: `s3:CreateMultipartUpload`, `s3:UploadPart`,
`s3:CompleteMultipartUpload`, `s3:AbortMultipartUpload`, `s3:ListParts` on the bucket/prefix.

> Same contract works for **GCS** (XML multipart / resumable) and **Azure Blob** (Put Block /
> Put Block List) — keep the endpoint shapes above and swap the presigning implementation.

---

## 5. Part sizing rules (must match the client)

- **S3 hard rules:** every part except the last must be **≥ 5 MB**; max **10,000 parts**.
- **Frontend default:** `partSize = 6 MB (6 * 1024 * 1024 = 6291456)`, **4 concurrent** PUTs.
- The client sends its intended `partSize` in `/uploads/init`; the server **echoes the
  authoritative `partSize` back** and the client uses the returned value. If the server needs
  a different size, return it and the client will re-chunk. `partCount = ceil(size / partSize)`.
- For a ≤30s clip this is typically 1–5 parts, so the 5 MB minimum rarely forces a single part —
  but if `size < 5 MB`, use a **single part** (`partCount = 1`), which is valid.

---

## 6. Duration enforcement (≤ 30 seconds)

The client measures duration and (a) hard-stops in-app recording at 30s and (b) validates
selected files before upload. **The server must also enforce it** — never trust the client:

- Reject `/uploads/init` when `durationSec > 30` (allow a small tolerance, e.g. `30.5`) → `422`
  `{ "code": "DURATION_EXCEEDED", "maxSec": 30 }`.
- Optionally re-verify with `ffprobe` after `complete` (async) and quarantine/delete if the
  actual media exceeds 30s, since `durationSec` is client-reported.

---

## 7. Error model

All error responses use this shape:

```jsonc
{ "code": "MACHINE_READABLE_CODE", "message": "Human readable text" }
```

| HTTP        | `code`              | Meaning                                      | Client behavior                  |
| ----------- | ------------------- | -------------------------------------------- | -------------------------------- |
| `422`       | `DURATION_EXCEEDED` | Clip longer than 30s                         | Show error, do not upload        |
| `422`       | `UNSUPPORTED_MIME`  | Not an allowed video type                    | Show error                       |
| `413`       | `FILE_TOO_LARGE`    | Over max size                                | Show error                       |
| `410`       | `UPLOAD_GONE`       | Multipart upload expired/aborted server-side | Discard job, restart             |
| `409`       | `PART_MISMATCH`     | ETag/part list rejected by S3                | Re-check parts, retry `complete` |
| `401`/`403` | `UNAUTHORIZED`      | Auth failed/expired                          | Refresh auth, retry              |
| `5xx`       | `SERVER_ERROR`      | Transient                                    | Client retries with backoff      |

For the **direct S3 part PUTs**, the client treats these as retryable and re-presigns via
`/uploads/parts` if needed:

- `403` (often an **expired presigned URL**) → re-presign, retry.
- `5xx` / network error → exponential backoff, retry the same part.
- `200` with an `ETag` response header → part done; client stores the ETag.

---

## 8. Data model (suggested)

```
uploads
  id            (pk)
  video_id      (nullable until completed)
  s3_key
  s3_upload_id
  filename
  mime
  size_bytes
  duration_sec
  part_size
  part_count
  status        enum: initiated | completed | aborted
  owner_id      (from auth)
  created_at
  completed_at  (nullable)
```

---

## 9. Sequence the client actually performs (reference)

1. `POST /uploads/init` with file metadata → store `{uploadId, key, parts, partSize}` in IndexedDB.
2. For each part not yet marked done: `PUT` bytes to its presigned URL.
   - On success, read `ETag` header → persist `{partNumber, eTag, status:"done"}` to IndexedDB.
   - On `403`/expiry → `POST /uploads/parts` for the missing parts, retry.
   - On network/5xx → backoff + retry the same part.
3. When all parts have ETags → `POST /uploads/complete` with the sorted part list.
4. On success → clear the job from IndexedDB, show "Uploaded".
5. On user cancel → `POST /uploads/abort` and clear IndexedDB.
6. On app reopen with an unfinished job → re-presign missing parts and resume at step 2.

---

## 10. Minimal endpoint checklist for the backend developer

- [ ] `POST /uploads/init` → `CreateMultipartUpload` + presign N part URLs, validate duration/mime/size.
- [ ] `POST /uploads/parts` → re-presign requested part numbers (resume), `410` if gone.
- [ ] `POST /uploads/complete` → `CompleteMultipartUpload` (idempotent), return `videoId`.
- [ ] `POST /uploads/abort` → `AbortMultipartUpload` (idempotent).
- [ ] S3 CORS with `ExposeHeaders: ["ETag"]` for all app origins.
- [ ] S3 lifecycle rule to abort incomplete multipart uploads.
- [ ] Server-side duration (≤30s), MIME, and size validation.
- [ ] Auth on all four `/uploads/*` endpoints.
