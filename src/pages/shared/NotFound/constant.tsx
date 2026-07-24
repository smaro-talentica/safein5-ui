import type { NotFoundContent, NotFoundVariant } from './model'

export const NOT_FOUND_CONTENT: Record<NotFoundVariant, NotFoundContent> = {
  'not-found': {
    emoji: '🧭',
    heading: 'Oops, page not found',
    message: "The page you're looking for doesn't exist or may have moved.",
  },
  error: {
    emoji: '⚠️',
    heading: 'Oops, something went wrong',
    message: 'An unexpected error occurred. Please try again.',
  },
}
