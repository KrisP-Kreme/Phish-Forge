// Logging utility for domain searches
export interface DomainSearchLog {
  timestamp: string
  domain: string
  source: 'partner_discovery' | 'email_generation'
  success: boolean
  errorType?: string
}

const logs: DomainSearchLog[] = []

export function logDomainSearch(log: DomainSearchLog): void {
  logs.push(log)
  
  // Keep last 1000 logs in memory
  if (logs.length > 1000) {
    logs.shift()
  }

  // In production, write to file or logging service
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Domain Search] ${log.domain} (${log.source}):`, log.success ? 'SUCCESS' : `FAILED - ${log.errorType}`)
  }
}

export function getDomainSearchLogs(): DomainSearchLog[] {
  return [...logs]
}
