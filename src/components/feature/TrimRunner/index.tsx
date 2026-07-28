import { useEffect, useRef } from 'react'
import { listTrimJobs } from '@/pages/worker/Capture/action'
import { runTrimJob } from './action'
import { registerTrimJobTrigger, unregisterTrimJobTrigger } from './helper'

export function TrimRunner() {
  const inFlight = useRef<Set<string>>(new Set())

  useEffect(() => {
    const resumeAll = () => {
      void (async () => {
        const jobs = await listTrimJobs()

        for (const job of jobs) {
          if (job.status !== 'processing') continue
          if (inFlight.current.has(job.id)) continue

          inFlight.current.add(job.id)
          void runTrimJob(job)
            .catch(() => {
              // Error state is already persisted to the job record by runTrimJob.
            })
            .finally(() => {
              inFlight.current.delete(job.id)
            })
        }
      })()
    }

    registerTrimJobTrigger(resumeAll)
    resumeAll()

    return () => {
      unregisterTrimJobTrigger()
    }
  }, [])

  return null
}
