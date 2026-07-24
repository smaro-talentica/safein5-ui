# Backend Spec — Chunked Video Upload (S3 Multipart, Lockstep Protocol)

This document is the contract the SafeIn5 UI frontend is built against. A backend developer
should be able to implement a working server using only this file.

The frontend records/selects a video, saves it locally, splits it into fixed-size chunks, and
uploads each chunk **directly to S3** using a presigned URL. The backend never receives the
video bytes — it only mints one presigned URL at a time and finalizes the S3 multipart upload
once every chunk is confirmed.

This is a deliberately different protocol from a batch/parallel multipart upload: the client
requests **one signed URL at a time**, in strict order, only after confirming the previous
chunk succeeded. There is no concurrency and no pre-issued list of URLs.

---

## 1. Why this design

| Requirement | How the design meets it |
| --- | --- |
| **Resumable** | Each chunk's confirmation is persisted client-side (IndexedDB) before requesting the next chunk. If the app closes or the network drops, the client can resume from the last confirmed chunk using the same `sessionId`. |
| **Slow/flaky network tolerant** | A failed chunk PUT is retried independently (client-side backoff) without affecting already-confirmed chunks. Only one chunk is ever "in flight" at a time, so there's nothing to reconcile across parallel requests. |
| **No custom merge step** | S3 Multipart Upload assembles the final object server-side (`CompleteMultipartUpload`) — the backend and client never handle full video bytes or re-assembly. |

This maps to the standard **S3 Multipart Upload** primitive:
`CreateMultipartUpload` → `UploadPart` (×N, one presigned URL at a time) →
`CompleteMultipartUpload`.

---

## 2. High-level flow

```
Frontend                              Backend                          S3
   │                                     │                              │
   │  POST /uploads/next                 │                              │
   │  {filename,mime,size,               │                              │
   │   chunkSize,chunkCount}             │  CreateMultipartUpload ─────▶│
   │  (no sessionId — first call)         │◀──── uploadId ───────────────│
   │                                      │  presign UploadPart #1       │
   │◀── {sessionId,status:"in_progress",  │                              │
   │     nextChunkNumber:1,url} ──────────│                              │
   │                                      │                              │
   │  PUT chunk 1 bytes → url ──────────────────────────────────────────▶│
   │◀──────────────────────────────────────── 200 + ETag header ────────│
   │                                      │                              │
   │  POST /uploads/next                  │                              │
   │  {sessionId,chunkNumber:1,eTag} ────▶│  presign UploadPart #2 ─────▶│
   │◀── {sessionId,status:"in_progress",  │                              │
   │     nextChunkNumber:2,url} ──────────│                              │
   │                                      │                              │
   │  PUT chunk 2 bytes → url ──────────────────────────────────────────▶│
   │◀──────────────────────────────────────── 200 + ETag header ────────│
   │            … repeats for every chunk …                              │
   │                                      │                              │
   │  POST /uploads/next                  │                              │
   │  {sessionId,chunkNumber:N,eTag} ────▶│  CompleteMultipartUpload ───▶│
   │◀── {sessionId,status:"completed",    │◀──── final object ───────────│
   │     videoId} ─────────────────────────│                              │
```

Note there is **no separate init/complete endpoint** — one endpoint, `POST /uploads/next`,
handles the first call (creates the multipart upload), every intermediate call (presigns the
next chunk), and the final call (completes the upload). This is a deliberate simplification
over designs with separate `/uploads/init` + `/uploads/complete` endpoints.

---

## 3. Endpoint: `POST {VITE_API_BASE_URL}/uploads/next`

Single stateful endpoint. Request/response shape differs by whether `sessionId` is present.

Authentication: `Authorization: Bearer <token>` on every call to this endpoint. The presigned
S3 URL returned in the response carries its own auth in its query string — do **not** require
an `Authorization` header on the S3 `PUT`.

### 3.1 First call — no `sessionId` (starts the upload)

**Request**

```jsonc
{
  "filename": "clip.webm", // original/desired filename
  "mime": "video/webm", // MIME type of the recording
  "size": 18874368, // total bytes (integer)
  "chunkSize": 6291456, // bytes per chunk the client will use (see §5)
  "chunkCount": 3 // ceil(size / chunkSize), computed client-side
}
```

**Response `200`**

```jsonc
{
  "sessionId": "sess_abc123", // opaque session id the client echoes on every later call
  "status": "in_progress",
  "nextChunkNumber": 1,
  "url": "https://bucket.s3...&X-Amz-Signature=..." // presigned PUT URL for chunk 1
}
```

**Server responsibilities**

- Validate `mime` is an allowed video type, `size`/`chunkSize`/`chunkCount` are consistent
  (`chunkCount === Math.ceil(size / chunkSize)`) → else `422`.
- Choose the S3 object key (do not trust client-supplied paths).
- Call S3 `CreateMultipartUpload` with `ContentType: mime`.
- Persist a session record: `{ sessionId, s3Key, s3UploadId, filename, mime, size, chunkSize, chunkCount, nextChunkNumber: 1, parts: [], status: "in_progress", ownerId, createdAt }`.
- Presign a single `UploadPart` URL for `PartNumber: 1`.

### 3.2 Subsequent calls — `sessionId` present (confirms previous chunk, returns next URL)

**Request**

```jsonc
{
  "sessionId": "sess_abc123",
  "chunkNumber": 1, // the chunk number just uploaded
  "eTag": "\"d41d8cd98f00b204e9800998ecf8427e\"" // ETag header returned by the S3 PUT
}
```

**Resume edge case — `chunkNumber: 0`:** if the app closes (or the tab is reloaded) *after* the
first call succeeded but *before* any chunk has actually been PUT and confirmed, the client's
local record has a `sessionId` but no confirmed chunk yet. On resume it re-sends this same
`sessionId` with **`chunkNumber: 0`** and no `eTag`. There is no "chunk 0" — treat this as
"nothing confirmed yet for this session, re-send the URL for chunk 1" (i.e. behave the same as
if `chunkNumber` were `nextChunkNumber - 1` with `nextChunkNumber` still `1`). Do not treat
`chunkNumber: 0` as invalid input.

**Response `200`** (any confirmation except the last chunk)

```jsonc
{
  "sessionId": "sess_abc123",
  "status": "in_progress",
  "nextChunkNumber": 2,
  "url": "https://bucket.s3...&X-Amz-Signature=..." // presigned PUT URL for chunk 2
}
```

**Response `200`** (confirmation of the **last** chunk — upload is complete, no `url`)

```jsonc
{
  "sessionId": "sess_abc123",
  "status": "completed",
  "videoId": "vid_01H..." // canonical id for the stored video
}
```

**Server responsibilities**

- Look up the session by `sessionId`. If unknown/expired (e.g. already cleaned up by the S3
  lifecycle rule, see §6) → `410 Gone` with `{ "code": "EXPIRED_SESSION" }` so the client
  discards the local job and restarts cleanly.
- Record `{ chunkNumber, eTag }` against the session's part list.
- **Idempotency (required):** if `chunkNumber` matches the session's `nextChunkNumber - 1`
  (i.e. this is a retry of an already-confirmed chunk), return the same response as the
  original confirmation rather than erroring — the client retries with backoff before
  surfacing an error, so duplicate confirmations must be handled gracefully.
- If `chunkNumber < chunkCount`: presign `UploadPart` for `PartNumber: chunkNumber + 1`,
  return `nextChunkNumber` + `url`.
- If `chunkNumber === chunkCount` (last chunk): call S3 `CompleteMultipartUpload` with the
  full sorted `{PartNumber, ETag}` list, mark the session `status: "completed"`, return
  `videoId` (no `url`).

---

## 4. S3 bucket configuration (required)

The browser uploads chunks **directly** to S3, so the bucket must allow cross-origin `PUT`
from the app's origins and **expose the `ETag` response header** to JavaScript — without
`ExposeHeaders: ETag`, the browser cannot read the per-chunk ETag and completion is impossible.

**CORS configuration**

```json
[
  {
    "AllowedOrigins": ["https://localhost:5173", "https://staging.example.com", "https://app.example.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**Lifecycle rule (required — the only cleanup mechanism for abandoned uploads):**

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

There is **no explicit `/uploads/abort` endpoint** in this design — an abandoned upload (user
closes the app and never returns, or a session simply times out) is reclaimed purely by this
lifecycle rule. A session lookup that fails because S3 already aborted the upload should
surface as `410 Gone` / `EXPIRED_SESSION` per §3.2.

**This also covers user-initiated cancellation** (see §8) — canceling an upload from the UI is
**not communicated to the backend in any way**. From the backend's point of view, a canceled
upload and an upload that was simply abandoned (network dropped, app closed, user walked away)
are **indistinguishable**: both just stop receiving `POST /uploads/next` calls for that
`sessionId`. Do not build any backend logic that expects a distinct "cancel" signal — none is
sent. Cleanup for both cases relies solely on this lifecycle rule firing.

**IAM** for the presigning role: `s3:CreateMultipartUpload`, `s3:UploadPart`,
`s3:CompleteMultipartUpload` on the bucket/prefix.

---

## 5. Chunk sizing rules (must match the client)

- **S3 hard rule:** every chunk except the last must be **≥ 5 MB**; max **10,000 chunks**.
- **Frontend default:** `chunkSize = 6 MB (6 * 1024 * 1024 = 6291456)`, one chunk in flight
  at a time (no concurrency).
- The client is responsible for clamping its configured chunk size to the 5 MB floor before
  calling `/uploads/next` (for any file where the naive chunk size would produce a non-final
  chunk under 5 MB). The server should still validate `chunkSize`/`chunkCount` consistency as
  defense in depth, but is not expected to silently correct a bad value — reject with `422`.
- `chunkCount = ceil(size / chunkSize)`. A file smaller than one chunk becomes a single chunk,
  which is valid (`chunkCount = 1`).

---

## 6. Error model

All error responses use this shape:

```jsonc
{ "code": "MACHINE_READABLE_CODE", "message": "Human readable text" }
```

| HTTP | `code` | Meaning | Client behavior (as currently implemented) |
| --- | --- | --- | --- |
| `422` | `UNSUPPORTED_MIME` | Not an allowed video type | Shown as a generic "Upload failed" in Feed; session marked `error`, no automatic retry |
| `422` | `INVALID_CHUNK_PLAN` | `chunkSize`/`chunkCount`/`size` inconsistent | Same as above |
| `410` | `EXPIRED_SESSION` | Session/multipart upload no longer exists (e.g. lifecycle rule already aborted it) | Same as above — **not yet special-cased** (see note below) |
| `401`/`403` | `UNAUTHORIZED` | Auth failed/expired | Same as above — no auth-refresh/retry loop exists |
| `5xx` | `SERVER_ERROR` | Transient | Same as above at the `/uploads/next` level (retry-with-backoff only applies to the direct S3 chunk `PUT`, not this endpoint — see below) |

**Important — current client behavior is coarser than the table above implies.**
`requestNextChunkUrl` (the call to `/uploads/next`) treats **every** non-2xx response
identically: it throws a generic error carrying just the HTTP status code, and does **not**
parse the `{ code, message }` body at all. `runUploadSession` then marks the local session
`status: "error"` and stops — there is currently **no automatic "discard and restart from chunk
1" behavior for `EXPIRED_SESSION`, no auth-refresh-and-retry for `401`/`403`, and no
backoff/retry loop for a `5xx` from `/uploads/next` itself** (backoff/retry is only implemented
for the direct S3 chunk `PUT`, via `uploadChunkWithRetry`). A failed video simply shows "Upload
failed" in the Feed UI; there is currently no user-facing retry action for it either — the video
and its (now-errored) session records stay in IndexedDB until the user manually deletes the
video.
Backend implementers should still return the documented `code`/HTTP-status combinations (this is
the contract the client *should* eventually branch on), but should not assume the client already
reacts differently per code — as of this writing it does not.

For the **direct S3 chunk PUTs** (not the backend endpoint), the client retries on **any**
failure (non-2xx response, or a 2xx missing the `ETag` header) up to a fixed retry count with
exponential backoff (`MAX_CHUNK_RETRIES`, currently 3 attempts). This is **not** error-code-aware
— a `403` (e.g. an expired presigned URL) and a `5xx` are retried identically, and the retry is
always a plain re-`PUT` to the **same URL** already in hand. The client does **not** call
`/uploads/next` again to get a fresh URL before retrying — if a presigned URL genuinely expires
mid-chunk, every retry will fail identically and the chunk (and the whole session) ends up
`status: "error"` after exhausting retries, with no automatic re-presign. In this lockstep
design a URL is only ever issued immediately before it's needed, so this should be rare in
practice — but backend implementers should set presigned URL expiry generously (the spec's own
example uses `urlExpiresInSec`-style headroom) rather than relying on the client to recover from
a too-short expiry.

On success, `200` with an `ETag` response header means the chunk is done; the client confirms it
via `/uploads/next`.

---

## 7. Data model (suggested)

```
upload_sessions
  id                (pk, = sessionId)
  owner_id          (from auth)
  s3_key
  s3_upload_id
  filename
  mime
  size_bytes
  chunk_size
  chunk_count
  next_chunk_number
  parts             (jsonb: [{chunkNumber, eTag}, ...])
  status            enum: in_progress | completed
  video_id          (nullable until completed)
  created_at
  completed_at      (nullable)
```

---

## 8. User-initiated cancellation (no backend involvement)

The frontend (Feed page) offers a **Cancel** action on any video whose upload is still
`pending`/`uploading`. This is **purely client-side**:

- The client stops its chunk-upload loop (no further `/uploads/next` calls, no further chunk
  `PUT`s for that session) as soon as it notices the cancellation, which may be mid-flight
  (after a chunk `PUT` has already started/finished but before it's been confirmed).
- The client immediately deletes its own local records for that video (both the source video
  Blob and the upload-session record) — from the user's perspective the video simply disappears
  from Feed, as if it had never been uploaded.
- **The backend is never notified.** There is no cancel/abort request sent. The backend's
  session record, the S3 multipart upload, and any parts already uploaded are left exactly as
  they were at the moment of the last confirmed chunk.

**Practical implication for the backend:** a canceled upload is indistinguishable from an
upload that simply stopped (crashed tab, lost network, user walked away and never came back).
Both eventually get cleaned up **only** by the S3 lifecycle rule in §4
(`AbortIncompleteMultipartUpload`). Do not build any backend feature that depends on knowing a
user explicitly canceled versus merely went idle — that distinction does not exist anywhere in
this protocol. If immediate reclaim of canceled uploads' storage becomes a real requirement
later, it would need a new explicit `/uploads/abort` (or similar) endpoint plus a frontend
change to call it — that is **not** part of the current contract.

---

## 9. Deployment target (informational)

Backend runs on **EC2** in **eu-west-2 (London)**, per current project decision — not Lambda.
This has no bearing on the endpoint contract above; noted here only for context on the
intended runtime environment.

---

## 10. Minimal endpoint checklist for the backend developer

- [ ] `POST /uploads/next` — handles both the first call (`CreateMultipartUpload` + presign
      chunk 1) and every subsequent call (presign next chunk, or `CompleteMultipartUpload` on
      the last chunk).
- [ ] Handles a resume confirmation with **`chunkNumber: 0`** (nothing confirmed yet for an
      existing `sessionId`) by re-presigning chunk 1 rather than rejecting it (§3.2).
- [ ] Idempotent handling of a duplicate confirmation for the same `chunkNumber`.
- [ ] `410 Gone` / `EXPIRED_SESSION` when a `sessionId` no longer resolves to a live multipart
      upload. **Note:** the current client does not yet act on this specially — it will just
      show a generic upload failure (§6) — so this is about correct server behavior per the
      contract, not about a client feature you can rely on today.
- [ ] Returns the documented `{ code, message }` error body per §6, even though the client does
      not yet parse it — future client versions are expected to.
- [ ] S3 CORS with `ExposeHeaders: ["ETag"]` for all app origins, `AllowedMethods: ["PUT"]`.
- [ ] S3 lifecycle rule to auto-abort incomplete multipart uploads (§4) — this is also the
      **only** cleanup path for user-canceled uploads (§8); no cancel/abort request is ever sent.
- [ ] Server-side MIME and chunk-plan validation.
- [ ] Auth (`Authorization: Bearer <token>`) required on `/uploads/next`.
- [ ] Set presigned URL expiry with generous headroom — the client retries a failed chunk `PUT`
      against the *same* URL up to a few times (§6) and does **not** re-presign on retry, so a
      too-short expiry will surface as a permanent chunk failure rather than a transient one.
