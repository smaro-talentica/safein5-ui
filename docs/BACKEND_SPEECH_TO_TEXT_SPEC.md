# Backend Spec — Speech-to-Text (AWS Transcribe)

This document is the contract the SafeIn5 UI frontend is built against for the transcription
path of the text capture flow (`/capture` → **Text** → **Transcribe**). A backend developer
should be able to implement a working server using only this file.

**Provider: AWS Transcribe**, chosen for this workforce (UK now, expanding to US/Europe only —
no India requirement) given the project's priorities of fast, accurate, low-cost, multi-lingual
transcription, and because the team already has an AWS subscription (see the provider evaluation
that led to this choice — Google Cloud STT was the architecturally simpler alternative for
short inline clips, but AWS was chosen to avoid onboarding a second cloud vendor).

**AWS Transcribe is an async, S3-based service** — it does not accept raw audio bytes inline in
a request. It transcribes an object that is **already sitting in S3**. This shapes the flow into
three stages, not a single "upload and get text back" call:

1. **Upload the clip to S3** via a presigned URL — same direct-to-S3 pattern as
   [`BACKEND_AUDIO_UPLOAD_SPEC.md`](./BACKEND_AUDIO_UPLOAD_SPEC.md).
2. **Start an AWS Transcribe job** against that S3 object.
3. **Poll for the job's completion**, then show the transcript to the worker.

**Important — what happens after transcription is different from the plain Audio capture flow:**
the source audio uploaded to S3 here exists **only to get a transcript out of AWS Transcribe** —
it is not the thing being archived. Once the worker reviews/edits the transcript and taps
**Confirm**, only the **text** is saved (currently to local IndexedDB — see
[`src/pages/worker/Capture/model.tsx`](../src/pages/worker/Capture/model.tsx)'s `StoredTextEntry`
— a real backend/database for text entries is a separate, not-yet-built concern; see §6). The
audio clip and the S3 object it was uploaded to are **not referenced by that saved record at
all** — there is currently no "keep the audio too" option in this flow, unlike Capture's plain
**Audio** tab, which does archive its clip to S3 permanently (see `BACKEND_AUDIO_UPLOAD_SPEC.md`).
Whether the transcription S3 object should be deleted/expired after the job completes, or kept
around, is a backend infrastructure decision — the frontend does not depend on it either way,
since it never references that `s3Key` again after getting the transcript back.

---

## 1. Current frontend state (important context)

**No backend call is wired up yet.** `transcribeAudio()` in
[`src/components/feature/Transcription/action.tsx`](../src/components/feature/Transcription/action.tsx)
currently calls a mock that waits ~1.2s and returns a fixed placeholder string. This lets the
record → transcribe → review → confirm UI be built and tested end to end without a live backend.

The real call is written out **commented, in the same file**, ready to uncomment once
`VITE_STT_ENDPOINT_URL` points at a live service:

```ts
// async function requestPresignedUrl(audio: Blob): Promise<AudioPresignResponse> { ... }
// async function uploadToS3(presigned: AudioPresignResponse, audio: Blob): Promise<void> { ... }
// async function startTranscriptionJob(s3Key: string, options?: TranscribeOptions) { ... }
// async function getTranscriptionJob(jobId: string): Promise<TranscriptionJobResponse> { ... }
// async function pollTranscriptionJob(jobId: string): Promise<TranscriptionResult> { ... }
// async function remoteTranscribe(audio: Blob, options?: TranscribeOptions) { ... }
```

To go live: implement the two endpoints below (presign + jobs), set `VITE_STT_ENDPOINT_URL`,
uncomment the block, and flip `activeTranscribe` from `mockTranscribe` to `remoteTranscribe`. No
other frontend file needs to change — every caller goes through the `TranscriptionClient`
interface in
[`model.tsx`](../src/components/feature/Transcription/model.tsx), not a concrete provider.

Once a transcript is returned, saving the worker's reviewed/edited text is a **separate, already
fully local concern** — `saveTextEntry()` in
[`src/pages/worker/Capture/action.tsx`](../src/pages/worker/Capture/action.tsx) — that does not
call this or any other backend endpoint today. See §6.

---

## 2. High-level flow

```
Frontend                         Backend                    S3                  AWS Transcribe
   │                                │                         │                        │
   │  record memo (≤ 2 min)         │                         │                        │
   │                                │                         │                        │
   │  POST {VITE_STT_ENDPOINT_URL}/presign                    │                        │
   │  {mime, size} ────────────────▶│  choose S3 key           │                        │
   │                                │  presign PUT ──────────▶│                        │
   │◀── {s3Key, url} ────────────────│                         │                        │
   │                                │                         │                        │
   │  PUT audio bytes → url ──────────────────────────────────▶│                        │
   │◀──────────────────────────────────────── 200 ─────────────│                        │
   │                                │                         │                        │
   │  POST {VITE_STT_ENDPOINT_URL}/jobs                        │                        │
   │  {s3Key, language?} ──────────▶│  StartTranscriptionJob ─────────────────────────▶│
   │◀── {jobId, status:"queued"} ────│                         │                        │
   │                                │                         │                        │
   │  GET .../jobs/{jobId} (poll) ──▶│  GetTranscriptionJob ────────────────────────────▶│
   │◀── {status:"in_progress"} ──────│                         │                        │
   │  … repeats every ~2s …          │                         │                        │
   │◀── {status:"completed",text} ───│◀──────────── transcript ──────────────────────────│
   │                                │                         │                        │
   │  show transcript, worker edits  │                         │                        │
   │  worker taps Confirm            │                         │                        │
   │  → text saved LOCALLY only      │                         │                        │
   │    (no further backend call)    │                         │                        │
```

The backend's job for this document is only to wrap AWS's `StartTranscriptionJob` /
`GetTranscriptionJob` calls behind a simple job-status API the frontend can poll. It has **no
role in persisting the final text** at this stage of the project.

---

## 3. Endpoint: `POST {VITE_STT_ENDPOINT_URL}/presign`

Identical in shape to `BACKEND_AUDIO_UPLOAD_SPEC.md` §3 — a separate presign endpoint exists
here (rather than reusing `/audio-clips/presign`) so the two flows can use different S3
prefixes/lifecycle rules if useful (e.g. a `transcribe-clips/` prefix that's short-lived, versus
`audio-clips/` which is the permanently-archived Audio-tab bucket) — since, per §1, this flow's
source audio has no long-term purpose once a transcript comes back. Backends that want one
shared presign endpoint for both flows may do so — the frontend does not require them to be
distinct.

**Request**

```jsonc
{ "mime": "audio/webm;codecs=opus", "size": 214532 }
```

**Response `200`**

```jsonc
{ "s3Key": "transcribe-clips/...", "url": "https://bucket.s3...&X-Amz-Signature=..." }
```

Same server responsibilities as `BACKEND_AUDIO_UPLOAD_SPEC.md` §3: validate MIME/size, choose
the key, presign a `PutObject` URL. The client then `PUT`s the raw bytes directly to S3, same as
that document's §4.

**Recommended (not required):** put these objects under a short lifecycle-expiry rule (e.g. a
few days) rather than the permanent retention used for the Audio tab's clips, since nothing in
the frontend ever reads this object again after the transcription job completes.

---

## 4. Endpoint: `POST {VITE_STT_ENDPOINT_URL}/jobs`

Starts an AWS Transcribe job against an S3 object that has already been uploaded via §3.

**Request**

```jsonc
{
  "s3Key": "transcribe-clips/1730000000000-214532-583920184",
  "language": "en-GB", // optional BCP-47/AWS language code hint; omit to auto-detect
}
```

Authentication: `Authorization: Bearer <token>` (same app auth token as every other API call).

**Response `200`**

```jsonc
{ "jobId": "job_abc123", "status": "queued" }
```

**Server responsibilities**

- Call AWS `StartTranscriptionJob` with:
  - `Media.MediaFileUri` pointing at the uploaded S3 object.
  - `LanguageCode` set to the request's `language` if provided; otherwise use
    `IdentifyLanguage: true` with a `LanguageOptions` candidate list appropriate to this
    workforce (e.g. `en-GB` at minimum; add more as the workforce expands into other
    countries/languages — see §7).
  - `MediaFormat` inferred from the object's MIME (`webm` → not natively an AWS MediaFormat
    value; transcode to a supported format first if the AWS SDK/API version in use requires it,
    or confirm current AWS support for WebM/Opus containers before relying on it directly).
- Generate and return an internal `jobId` (can be AWS's own `TranscriptionJobName`, or your own
  identifier mapped to it — the frontend treats it as opaque).
- Persist enough state (job name, S3 key) to answer §5 lookups.

---

## 5. Endpoint: `GET {VITE_STT_ENDPOINT_URL}/jobs/{jobId}`

Polled by the frontend every ~2 seconds (`TRANSCRIPTION_JOB_POLL_INTERVAL_MS`,
`src/components/feature/Transcription/constant.tsx`) until it returns a terminal status. The
frontend gives up after ~60 seconds (`TRANSCRIPTION_JOB_POLL_TIMEOUT_MS`) and shows an error —
tune both constants if AWS Transcribe's real turnaround for these clip lengths runs longer.

**Response `200`** (in progress)

```jsonc
{ "jobId": "job_abc123", "status": "in_progress" }
```

**Response `200`** (completed)

```jsonc
{ "jobId": "job_abc123", "status": "completed", "text": "Full transcript of the memo." }
```

**Response `200`** (failed)

```jsonc
{ "jobId": "job_abc123", "status": "failed", "error": "Human-readable failure reason." }
```

**Server responsibilities**

- Call AWS `GetTranscriptionJob`, map its `TranscriptionJobStatus` (`IN_PROGRESS` → `in_progress`,
  `COMPLETED` → `completed`, `FAILED` → `failed`) to the shape above.
- On `COMPLETED`, fetch the transcript JSON from the S3 location AWS Transcribe wrote it to, and
  return just the flattened transcript text in `text` (the frontend has no use for AWS
  Transcribe's full JSON — word timings, confidence, etc.).
- `queued` is an acceptable additional non-terminal status if useful, matching AWS's own
  `QUEUED` state before `IN_PROGRESS`.

**Error responses** for both endpoints in this document — any non-2xx is treated identically by
the current client (shown as a generic "Could not transcribe the memo"). Still, return:

```jsonc
{ "code": "MACHINE_READABLE_CODE", "message": "Human readable text" }
```

so a future client version can branch on specific failures.

---

## 6. What happens to the transcript after this (no backend call today)

Once `GET .../jobs/{jobId}` returns `completed`, the frontend shows the transcript in an editable
textarea. When the worker taps **Confirm**:

- `saveTextEntry(text, 'transcribed')` (`src/pages/worker/Capture/action.tsx`) saves the final
  text to a local IndexedDB store (`text-entries`, in the `safein5-videos` database) — **no
  network call happens at this step**.
- The recorded audio blob and the S3 object it was uploaded to in §3 are **not referenced
  again** — they are not linked to the saved text record in any way today.
- This is a **deliberately temporary, local-only state** — "later we will store it in
  [a real backend] db" is the current plan, but that endpoint does not exist yet and is out of
  scope for this document. When that backend is built, it will need its own spec (a simple
  "create text entry" endpoint, likely `POST {VITE_API_BASE_URL}/text-entries` or similar,
  probably not tied to `VITE_STT_ENDPOINT_URL` at all since a written-directly text entry, see
  Capture's **Text → Write** mode, never touches this speech-to-text pipeline).

If a future requirement emerges to keep the source audio alongside the transcript (unlike
today), that would need this document's presign flow to point at a **permanent** S3
location/lifecycle (like the Audio tab's) instead of the short-lived one recommended in §3, plus
a new endpoint analogous to the old `/approve` step this document previously specified. That is
**not** the current contract — do not build it speculatively.

---

## 7. Language configuration for this workforce

Per current scope: **UK now**, expanding later to **US and Europe only** (not India or other
regions). Configure AWS Transcribe accordingly:

- Start with `en-GB` as the default/primary language.
- When starting a job without an explicit `language` hint, use AWS's `IdentifyLanguage` with a
  `LanguageOptions` candidate list covering the workforce's actual languages (e.g. `en-GB`,
  `en-US` once US rollout begins, plus relevant European languages as needed) — AWS Transcribe
  does **not** allow mixing multiple dialects of the same language in one candidate list (e.g.
  don't combine `en-GB` and `en-US` with `en-IN`), so keep the list scoped to what this
  workforce actually needs.
- Region: run the backend/AWS calls in `eu-west-2` (London) for UK data residency now; add
  `us-east-1` (or the relevant US region) when the US rollout happens. This is an infrastructure
  decision for the backend team, not something the frontend contract depends on.

---

## 8. Audio format handling

Same as `BACKEND_AUDIO_UPLOAD_SPEC.md` §4 — clips are `audio/webm;codecs=opus` (Chrome/Android)
or `audio/mp4` (Safari/iOS), capped at 2 minutes, no client-side transcoding. Confirm AWS
Transcribe's supported `MediaFormat` values against whatever the actual uploaded container is;
transcode server-side (e.g. to a confirmed-supported format) before calling
`StartTranscriptionJob` if needed, rather than pushing that requirement onto the client.

---

## 9. Minimal endpoint checklist for the backend developer

- [ ] `POST {VITE_STT_ENDPOINT_URL}/presign` — validates request, returns a presigned S3
      `PutObject` URL (same shape/behavior as `BACKEND_AUDIO_UPLOAD_SPEC.md`'s presign endpoint).
      Consider a short-lived lifecycle rule for this prefix (§3) — this audio is not meant to be
      kept.
- [ ] `POST {VITE_STT_ENDPOINT_URL}/jobs` — starts an AWS `StartTranscriptionJob` against the
      uploaded S3 object, returns `{ jobId, status }`.
- [ ] `GET {VITE_STT_ENDPOINT_URL}/jobs/{jobId}` — proxies AWS `GetTranscriptionJob`, returns
      `{ jobId, status, text?, error? }`; on completion, flattens AWS's transcript JSON to plain
      `text`.
- [ ] Auth (`Authorization: Bearer <token>`) required on both non-S3 calls; the presigned S3
      `PUT` itself needs no `Authorization` header.
- [ ] AWS credentials/IAM permissions for `transcribe:StartTranscriptionJob` and
      `transcribe:GetTranscriptionJob`, scoped appropriately, live only on the backend.
- [ ] Language configuration per §7 (UK-first, `en-GB` default, region `eu-west-2` now).
- [ ] Returns `{ code, message }` on error for both endpoints (contract for a future client;
      current client treats all errors the same).
- [ ] **No approval/persistence endpoint needed from this document** — saving the final text is
      currently a local-only frontend concern (§6); do not build a text-persistence endpoint
      speculatively.
