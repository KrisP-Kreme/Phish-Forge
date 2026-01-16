// In-memory rate limiting (replace with Redis in production)
interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore: Record<string, RateLimitEntry> = {}

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  keyGenerator: (req: any) => string
}

export function createRateLimiter(config: RateLimitConfig) {
  return (req: any, key?: string) => {
    const limitKey = key || config.keyGenerator(req)
    const now = Date.now()

    if (!rateLimitStore[limitKey]) {
      rateLimitStore[limitKey] = {
        count: 0,
        resetTime: now + config.windowMs,
      }
    }

    const entry = rateLimitStore[limitKey]

    // Reset if window has passed
    if (now > entry.resetTime) {
      entry.count = 0
      entry.resetTime = now + config.windowMs
    }

    entry.count++

    const isLimited = entry.count > config.maxRequests
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000)

    return {
      isLimited,
      count: entry.count,
      limit: config.maxRequests,
      retryAfter,
    }
  }
}

// Partner discovery: 5 per domain per hour
export const partnerDiscoveryRateLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
  keyGenerator: (req: any) => {
    const domain = req.body?.domain || 'unknown'
    return `partner-discovery:${domain}`
  },
})

// Email generation: 10 per session
export const emailGenerationRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 24 * 60 * 60 * 1000, // 24 hours (session-like)
  keyGenerator: (req: any) => {
    const sessionId = req.headers?.['x-session-id'] || req.ip || 'unknown'
    return `email-generation:${sessionId}`
  },
})
