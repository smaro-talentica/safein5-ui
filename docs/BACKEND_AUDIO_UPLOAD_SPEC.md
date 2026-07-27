# Backend Spec — Audio Clip Upload (Direct-to-S3, Presigned URL)

This document is the contract the SafeIn5 UI frontend is built against for the **Audio** capture
flow (`/capture` → **Audio** tab — record, review, confirm). A backend developer should be able
to implement a working server using only this file.

This is a **different concern from transcription** (see
[`BACKEND_SPEECH_TO_TEXT_SPEC.md`](./BACKEND_SPEECH_TO_TEXT_SPEC.md)): this endpoint just stores
the raw audio clip in **S3** — it does not return any text. The **Text** tab's **Transcribe**
sub-tab records audio and converts it to text via a separate flow, discarding the audio
afterward; the **Audio** tab records audio and archives the clip itself to S3 permanently, with
no transcription involved.

The frontend records a clip with `MediaRecorder`, asks the backend for a **presigned S3 PUT
URL**, then uploads the raw audio bytes **directly to S3 from the browser** — the backend never
receives the audio bytes itself. This mirrors the video upload's direct-to-S3 architecture (see
[`BACKEND_UPLOAD_SPEC.md`](./BACKEND_UPLOAD_SPEC.md)) but **without its chunked multipart
protocol** — audio clips are capped at 2 minutes and are small, so a single presigned `PUT` is
enough; there is no need for `CreateMultipartUpload`/`UploadPart`/`CompleteMultipartUpload`.

---

## 1. Current frontend state (important context)

**No backend call is wired up yet.** The real presign call is written out **commented, in the
same file**, ready to uncomment once a live backend exists:

```ts
// async function requestPresignedUrl(audio: StoredAudio): Promise<AudioPresignResponse> { ... }
// async function presignAndUploadToS3(audio: StoredAudio, signal: AbortSignal) { ... }
```

— see
[`src/components/feature/AudioUploader/action.tsx`](../src/components/feature/AudioUploader/action.tsx).
In the meantime, a mock (`mockPresignAndUpload`) simulates a **failed** presign after a short
delay (matching what a real `fetch` to a not-yet-implemented endpoint would naturally do) — the
clip is retried with backoff, lands in `error` status, and **stays in local IndexedDB** so it
remains visible/playable in Feed. This is deliberate: the local copy is only ever deleted once a
real upload actually succeeds (see `runAudioUpload`), so the mock must fail rather than
fake-succeed — a fake success would delete the local blob with no real S3 object to serve it
from afterward, making the clip vanish from Feed.

To go live: implement the endpoint below, uncomment `requestPresignedUrl` /
`presignAndUploadToS3`, and flip `uploadToS3` from calling `mockPresignAndUpload` to
`presignAndUploadToS3`. No other frontend file needs to change.

The rest of the client-side plumbing is already fully built and working:

- Recording (`AudioRecorder` feature component)
- Local-first save to IndexedDB (`safein5-videos` database, `audio` object store) so nothing is
  lost if the network is unavailable at the moment of recording
- A background uploader (`AudioUploader`, mounted once in `AppRoute`, same pattern as
  `VideoUploader`) that presigns + uploads pending clips, retries failed attempts with
  exponential backoff, and resumes automatically if the app is closed and reopened
- The Feed page's merged list, showing upload status per audio clip and a cancel/delete action
  (Feed has no tabs — video, audio, and text entries all render in one newest-first list)

---

## 2. High-level flow

```
Frontend                                   Backend                          S3
   │                                          │                              │
   │  record clip (MediaRecorder, mic only)   │                              │
   │  ≤ 2 min, webm/opus or mp4/aac           │                              │
   │  save locally to IndexedDB first          │                              │
   │                                          │                              │
   │  POST /audio-clips/presign                │                              │
   │  {filename, mime, size} ────────────────▶│  choose S3 key               │
   │                                          │  presign PUT ───────────────▶│
   │◀── {s3Key, url} ──────────────────────────│                              │
   │                                          │                              │
   │  PUT audio bytes → url ──────────────────────────────────────────────────▶│
   │◀──────────────────────────────────────────────── 200 ───────────────────│
   │                                          │                              │
   │  delete local IndexedDB copy on success   │                              │
```

Unlike the video protocol, there is **no multipart session, no chunking, and no "confirm each
part" handshake** — one presign call, one direct `PUT` to S3. If the presign or the `PUT` fails,
the frontend's existing retry-with-backoff logic (`uploadWithRetry`, called from `runAudioUpload`
in `src/components/feature/AudioUploader/action.tsx`) retries up to `MAX_AUDIO_UPLOAD_RETRIES`
times (currently 3 — i.e. 1 initial attempt plus 3 retries, 4 attempts total) — **each retry
re-presigns**, i.e. requests a fresh presigned URL rather than reusing the one from a failed
attempt, unlike the video flow's per-chunk retry (which reuses the same URL; see
`BACKEND_UPLOAD_SPEC.md` §6). After exhausting retries the clip is marked `error` and left in
IndexedDB for the user to retry manually or delete.

---

## 3. Endpoint: `POST {VITE_API_BASE_URL}/audio-clips/presign`

**Request**

```jsonc
{
  "filename": "audio-48213.webm", // client-chosen name, informational
  "mime": "audio/webm;codecs=opus", // whatever MediaRecorder.mimeType produced
  "size": 214532, // bytes
}
```

Authentication: `Authorization: Bearer <token>` (same app auth token as every other API call —
`getToken()` in `@/auth/store`).

**Response `200`**

```jsonc
{
  "s3Key": "audio-clips/1730000000000-214532-583920184", // the object key the backend chose
  "url": "https://bucket.s3...&X-Amz-Signature=...", // presigned PUT URL for this exact object
}
```

**Server responsibilities**

- Validate `mime` is an allowed audio type (`audio/webm`, `audio/mp4`, `audio/aac`, or their
  codec-qualified variants) and `size` is within a sane cap (e.g. reject anything obviously
  larger than a 2-minute clip could produce) → else `422`.
- Choose the S3 object key (do not trust a client-supplied path).
- Presign a single S3 `PutObject` URL for that key, with `ContentType` matching the request's
  `mime`.
- No session/database record is strictly required for this step alone.

**Error responses** — any non-2xx is treated identically by the client today (retried with
backoff, then surfaces as "Upload failed" in the Feed UI). Still, return a body shaped like:

```jsonc
{ "code": "MACHINE_READABLE_CODE", "message": "Human readable text" }
```

so a future client version can branch on specific failures (e.g. `422` for an unsupported
format) rather than treating every failure the same.

---

## 4. The `PUT` to S3 itself

The client issues `PUT <url>` with `Content-Type: <mime>` and the raw audio bytes as the body —
standard presigned-URL upload, no different from the video flow's per-chunk `PUT` (see
`BACKEND_UPLOAD_SPEC.md` §4 for the bucket CORS configuration this requires). The frontend does
**not** need the `ETag` response header here (unlike the chunked video protocol, there is no
multipart completion step to feed it into) — a `200`/`204` from the `PUT` is sufficient
confirmation of success.

---

## 5. Why no chunking

The video upload protocol exists specifically to handle **large files reliably over unreliable
connections** — its chunking, resumability, and multipart-completion design are all in service
of that. Audio clips here are capped at **2 minutes** and are single-channel voice
recordings — realistically a few hundred KB to a few MB. A single presigned `PUT` is simple,
sufficient, and avoids the multipart-session bookkeeping a much larger file would need. If clip
length limits ever increase significantly, revisit this decision — but do not add chunking
speculatively.

---

## 6. Relationship to the Text tab's Transcribe sub-tab

The **Text** tab's **Transcribe** sub-tab (see `BACKEND_SPEECH_TO_TEXT_SPEC.md`) uses this **same
presign + direct-S3-PUT pattern** to get its clip into S3 before starting an AWS Transcribe job
against it — AWS Transcribe requires the source audio to already be an S3 object, it cannot
accept raw bytes inline. The two flows are otherwise independent and their outcomes are
different: an **Audio** tab clip is archived permanently as-is, with no further processing; a
**Text → Transcribe** clip is fed into AWS Transcribe purely to extract text, and **the audio
itself is discarded on the client once the worker confirms the resulting transcript** — only the
text is kept (currently local-only; see `BACKEND_SPEECH_TO_TEXT_SPEC.md` §6). Do not assume the
two flows' S3 objects need the same retention policy — see that document's presign section for
why a shorter-lived prefix may make sense for the transcription path.

---

## 7. S3 bucket configuration (required)

Same requirements as the video pipeline's bucket (`BACKEND_UPLOAD_SPEC.md` §4) — CORS allowing
`PUT` from the app's origins. `ExposeHeaders: ["ETag"]` is **not required** here since this flow
doesn't need the `ETag` (no multipart completion step), but including it does no harm if the
same bucket/CORS config is shared with the video pipeline.

A lifecycle rule for abandoned/orphaned uploads (clips presigned but never actually `PUT`, e.g.
the user closed the app mid-upload) is recommended but not required in the same way as the video
flow's `AbortIncompleteMultipartUpload` — there is no multipart upload to abort here, just a
possibly-unused object key. If orphan cleanup matters, expire objects under the `audio-clips/`
prefix after a short window (e.g. `Rules: [{ Prefix: "audio-clips/", Expiration: { Days: 1 } }]`)
only if the object was never referenced by a later confirmed step; simplest is to not worry
about this until it's observed to matter in practice.

---

## 8. Minimal endpoint checklist for the backend developer

- [ ] `POST {VITE_API_BASE_URL}/audio-clips/presign` — validates the request, chooses an S3 key,
      returns a presigned `PutObject` URL for that key.
- [ ] Accepts both `audio/webm;codecs=opus` and `audio/mp4` inputs.
- [ ] Returns `{ code, message }` on error (contract for a future client; current client treats
      all errors the same).
- [ ] Auth (`Authorization: Bearer <token>`) required on the presign call, same token as the
      rest of the app's API. The presigned S3 URL itself carries its own auth in its query
      string — do **not** require an `Authorization` header on the S3 `PUT`.
- [ ] S3 CORS allowing `PUT` from the app's origins (`BACKEND_UPLOAD_SPEC.md` §4).
- [ ] No chunking/multipart-session handshake needed — this is intentionally a single
      presign-then-`PUT`, unlike the video upload protocol.
