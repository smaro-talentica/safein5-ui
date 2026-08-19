/**
 * Renders an ISO build timestamp in the viewer's local time, trimmed to
 * minute precision — enough to tell two deploys apart without the noise of
 * seconds and milliseconds. Returns the raw input unchanged if it isn't a
 * parseable date, so a missing or malformed stamp degrades gracefully instead
 * of rendering "Invalid Date".
 */
export function formatBuildTime(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp)
  if (Number.isNaN(parsed.getTime())) return isoTimestamp

  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
