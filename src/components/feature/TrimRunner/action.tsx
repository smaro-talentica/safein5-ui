import { deleteTrimJob, saveTrimJob, saveVideoAndQueueUpload } from '@/pages/worker/Capture/action'
import type { TrimJob } from '@/pages/worker/Capture/model'

/**
 * Runs a single queued trim job to completion: decodes+re-encodes the selected range from an
 * off-DOM <video> (TrimRunner has no visible player to reuse, unlike VideoTrimmer itself), then
 * hands the trimmed blob to the normal save-and-upload path and removes the job. On failure, the
 * job is marked `error` so Feed can surface it instead of leaving a stuck "Processing…" card.
 *
 * `recordTrimmedRange` (and the mediabunny dependency it pulls in) is imported dynamically —
 * TrimRunner itself is mounted unconditionally in AppRoute (like VideoUploader/AudioUploader), so
 * a static import here would ship mediabunny in the main bundle for every page load instead of
 * only when a trim actually needs to run.
 */
export async function runTrimJob(job: TrimJob): Promise<void> {
  const url = URL.createObjectURL(job.sourceBlob)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.src = url

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('Could not read this video file.'))
    })

    const { recordTrimmedRange } = await import('@/components/feature/VideoTrimmer/helper')
    const blob = await recordTrimmedRange(video, job.sourceBlob, job.range)
    await saveVideoAndQueueUpload(blob, job.name)
    await deleteTrimJob(job.id)
  } catch (err) {
    await saveTrimJob({
      ...job,
      status: 'error',
      error: err instanceof Error ? err.message : 'Could not trim this video.',
      updatedAt: Date.now(),
    })
    throw err
  } finally {
    URL.revokeObjectURL(url)
  }
}
