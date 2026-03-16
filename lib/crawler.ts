import { SERVICE_FINGERPRINTS, CONFIDENCE_THRESHOLDS } from './partner-constants'
import type { FingerprintedService } from './scraper'

export type { FingerprintedService }

export interface CrawledPage {
  url: string
  path: string
  depth: number
  title: string
  content: string
  scrapedAt: string
}

export interface CrawlResult {
  domain: string
  pages: CrawledPage[]
  knowledgeDigest: string
  fingerprintedServices: FingerprintedService[]
  crawledAt: string
  totalCharacters: number
}

// Cache with 1-hour TTL
const crawlCache = new Map<string, { result: CrawlResult; expiresAt: number }>()
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

const MAX_PAGES = 15
const MAX_DEPTH = 3
const BATCH_SIZE = 5
const TOTAL_TIMEOUT_MS = 25000
const PAGE_FETCH_TIMEOUT_MS = 5000
const MAX_DIGEST_CHARS = 5000

// Link scoring rules
const LINK_SCORE_RULES: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /\/(faq|faqs|frequently-asked|partner|vendor|supplier|integration)/i, score: 4 },
  { pattern: /\/(pricing|plans|subscription|about|our-story|team|who-we-are)/i,    score: 3 },
  { pattern: /\/(service|solution|product|offering|contact|how-it-works|process)/i, score: 2 },
  { pattern: /\/(support|help|knowledge-base)/i,                                    score: 1 },
  { pattern: /\/(blog|news|press|article)/i,                                        score: 0 },
  { pattern: /\/(privacy|terms|legal|cookie)/i,                                     score: -1 },
]

// Paths to skip entirely (score -99)
const SKIP_PATH_PATTERNS = [
  /\/(cart|checkout|account|login|register|wp-admin|wp-content|wp-json|cdn-cgi|feed)(\/|$)/i,
  /^\/#/,
  /\/\.well-known/i,
]

// File extensions to skip
const SKIP_EXTENSIONS = /\.(pdf|png|jpg|jpeg|gif|svg|xml|json|css|js|ico|woff|woff2|zip|mp4|mp3)$/i

// Knowledge digest signal patterns
const DIGEST_PATTERNS: RegExp[] = [
  /powered by/i,
  /built (on|by|with)/i,
  /\buses?\b/i,
  /\busing\b/i,
  /integrat(e|ed|es|ing)? with/i,
  /partner(ed)? with/i,
  /in partnership/i,
  /official partner/i,
  /we (use|accept|offer|partner)/i,
  /our (platform|system|software|tool|partner|provider)/i,
  /\bpayment\b/i,
  /\bcheckout\b/i,
  /\bbilling\b/i,
  /\bsubscription\b/i,
  /\binvoicing\b/i,
  /buy now pay later/i,
  /\bafterpay\b/i,
  /\bzippay\b/i,
  /\bequipment\b/i,
  /\bgear\b/i,
  /\bmachinery\b/i,
  /\bsupplies\b/i,
  /\bhardware\b/i,
  /manufactur/i,
  /\bcertified\b/i,
  /\baccredited\b/i,
  /member of/i,
  /registered with/i,
  /licensed by/i,
  /approved by/i,
  /\bcouncil\b/i,
  /\bgovernment\b/i,
  /\bassociation\b/i,
  /\bfederation\b/i,
  /\binstitute\b/i,
  /\bauthority\b/i,
  /\bbody\b/i,
  /\bsponsor\b/i,
  /supported by/i,
  /funded by/i,
  /\bgrant\b/i,
  /website (by|designed|built|developed)/i,
  /digital by/i,
  /creative by/i,
]

// Matches copyright lines: © followed by year and uppercase word
const COPYRIGHT_PATTERN = /©\s*\d{4}\s+[A-Z][A-Za-z]/

// Matches multi-word proper noun sequence (Title Case words, 2+ words, letters only)
const PROPER_NOUN_PATTERN = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/

function scorePath(path: string): number {
  for (const skip of SKIP_PATH_PATTERNS) {
    if (skip.test(path)) return -99
  }
  if (SKIP_EXTENSIONS.test(path)) return -99

  let score = 0
  for (const { pattern, score: pts } of LINK_SCORE_RULES) {
    if (pattern.test(path)) {
      score += pts
    }
  }
  return score
}

function extractTitleFromHTML(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match) return ''
  return match[1]
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .trim()
}

function extractTextFromHTML(html: string): string {
  try {
    let text = html

    // Remove script and style content
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

    // Extract alt/title attributes from img and a tags before stripping —
    // equipment brand names and product names often live only in alt text
    text = text.replace(/<img[^>]+alt=["']([^"']{3,80})["'][^>]*>/gi, (_, alt) => ` ${alt} `)
    text = text.replace(/<img[^>]+title=["']([^"']{3,80})["'][^>]*>/gi, (_, title) => ` ${title} `)
    text = text.replace(/<a[^>]+title=["']([^"']{3,80})["'][^>]*>/gi, (_, title) => ` ${title} `)

    // Remove meta tags and other metadata
    text = text.replace(/<meta[^>]*>/gi, '')
    text = text.replace(/<link[^>]*>/gi, '')
    text = text.replace(/<noscript[^>]*>.*?<\/noscript>/gi, '')

    // Remove navigation and header elements
    text = text.replace(/<(nav|header|footer|script|style)[^>]*>.*?<\/\1>/gi, '')
    text = text.replace(/class\s*=\s*["']([^"']*sidebar[^"']*|[^"']*navigation[^"']*)['"'][^>]*>.*?<\/[a-z]+>/gi, '')

    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, '')

    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&[a-z]+;/gi, ' ')

    // Clean up whitespace
    text = text
      .replace(/\n\n+/g, '\n\n')
      .replace(/\t+/g, ' ')
      .replace(/  +/g, ' ')
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .join('\n')

    return text.trim()
  } catch (error) {
    console.error('[Crawler] Error parsing HTML:', error)
    return ''
  }
}

function fingerprintResources(html: string): FingerprintedService[] {
  const found = new Map<string, FingerprintedService>()
  const resourcePattern = /<(?:script|iframe|link)[^>]+(?:src|href)=["']([^"']+)["'][^>]*>/gi
  let match

  while ((match = resourcePattern.exec(html)) !== null) {
    const url = match[1].toLowerCase()
    for (const [pattern, service] of Object.entries(SERVICE_FINGERPRINTS)) {
      if (url.includes(pattern.toLowerCase()) && !found.has(service.name)) {
        found.set(service.name, {
          name: service.name,
          type: service.type,
          relationship: service.relationship,
          sourceUrl: match[1],
          confidence: CONFIDENCE_THRESHOLDS.EMBEDDED_WIDGET,
        })
        break
      }
    }
  }

  return Array.from(found.values())
}

function extractLinks(html: string, domain: string): string[] {
  const paths: string[] = []
  const seen = new Set<string>()
  const hrefPattern = /href=["']([^"'#][^"']*)["']/gi
  let match

  while ((match = hrefPattern.exec(html)) !== null) {
    let href = match[1].trim()

    // Strip query strings and fragments
    const qIdx = href.indexOf('?')
    if (qIdx !== -1) href = href.substring(0, qIdx)
    const hIdx = href.indexOf('#')
    if (hIdx !== -1) href = href.substring(0, hIdx)

    if (!href) continue

    let path: string

    if (href.startsWith('/')) {
      // Relative path
      path = href
    } else if (href.startsWith('http://') || href.startsWith('https://')) {
      // Absolute URL — must be same domain
      try {
        const parsed = new URL(href)
        const parsedHost = parsed.hostname.replace(/^www\./i, '')
        if (!parsedHost.includes(domain)) continue
        path = parsed.pathname || '/'
      } catch {
        continue
      }
    } else {
      // Relative URL without leading slash or other schemes — skip
      continue
    }

    // Normalise trailing slash (keep root as-is)
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1)
    }

    if (seen.has(path)) continue
    seen.add(path)

    paths.push(path)
  }

  return paths
}

function buildKnowledgeDigest(
  pages: Array<{ path: string; title: string; content: string }>,
): string {
  let digest = ''

  // ── SECTION 1: page overview ──────────────────────────────────────────────
  // Every crawled page gets a one-line summary so the AI understands the
  // business type and activity before reasoning about partners.
  digest += '=== PAGES CRAWLED ===\n'
  for (const { path, title, content } of pages) {
    const intro = content
      .replace(/\n+/g, ' ')
      .replace(/  +/g, ' ')
      .substring(0, 220)
      .trim()
    const titlePart = title ? ` (${title.substring(0, 60)})` : ''
    digest += `[${path}]${titlePart}: ${intro}\n`
  }

  // ── SECTION 2: relationship signals ───────────────────────────────────────
  // Lines that explicitly mention vendors, tools, certifications, payments,
  // equipment brands, councils, agencies etc.
  digest += '\n=== KEY SIGNALS ===\n'
  const seenLines = new Set<string>()

  for (const { path, content } of pages) {
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.length < 10 || line.length > 300) continue

      let include = false

      for (const pattern of DIGEST_PATTERNS) {
        if (pattern.test(line)) { include = true; break }
      }

      if (!include && COPYRIGHT_PATTERN.test(line)) include = true

      // Proper noun line — increased to 200 chars so longer brand/org names qualify
      if (!include && line.length < 200 && PROPER_NOUN_PATTERN.test(line)) include = true

      // FAQ answer: line immediately after a question, 20–250 chars
      if (!include && i > 0) {
        const prev = lines[i - 1].trim()
        if (prev.endsWith('?') && line.length >= 20 && line.length <= 250) include = true
      }

      if (!include) continue

      const key = line.toLowerCase()
      if (seenLines.has(key)) continue
      seenLines.add(key)

      digest += `[${path}] ${line}\n`
    }
  }

  return digest.substring(0, MAX_DIGEST_CHARS)
}

async function fetchPageRaw(
  domain: string,
  path: string,
  timeoutMs: number,
): Promise<{ html: string; status: number } | null> {
  const url = `https://${domain}${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.log(`[Crawler] ${path} returned ${response.status}`)
      return { html: '', status: response.status }
    }

    const html = await response.text()
    return { html, status: response.status }
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      console.log(`[Crawler] Timeout on ${path}`)
    } else {
      console.log(`[Crawler] Error fetching ${path}: ${error.message}`)
    }
    return null
  }
}

export async function crawlWebsite(rawDomain: string): Promise<CrawlResult | null> {
  // Normalise domain
  const domain = rawDomain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()

  // Check cache
  const cached = crawlCache.get(domain)
  if (cached && Date.now() < cached.expiresAt) {
    console.log('[Crawler] Cache hit for', domain)
    return cached.result
  }

  console.log(`[Crawler] Starting crawl for ${domain}`)

  const crawlStart = Date.now()

  // BFS state
  type QueueItem = { path: string; depth: number; score: number }
  const visited = new Set<string>(['/'])
  const queue: QueueItem[] = [{ path: '/', depth: 0, score: 10 }]

  const pages: CrawledPage[] = []
  const allFingerprinted = new Map<string, FingerprintedService>()

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    // Check wall-clock timeout
    if (Date.now() - crawlStart >= TOTAL_TIMEOUT_MS) {
      console.log('[Crawler] Wall-clock timeout reached, stopping crawl')
      break
    }

    // Sort by depth ASC, then score DESC
    queue.sort((a, b) => a.depth !== b.depth ? a.depth - b.depth : b.score - a.score)

    // Take up to BATCH_SIZE items from the front
    const remaining = MAX_PAGES - pages.length
    const batchSize = Math.min(BATCH_SIZE, remaining, queue.length)
    const batch = queue.splice(0, batchSize)

    const depths = [...new Set(batch.map((b) => b.depth))]
    for (const d of depths) {
      const count = batch.filter((b) => b.depth === d).length
      console.log(`[Crawler] Level ${d}: fetching ${count} pages`)
    }

    // Calculate per-page timeout leaving headroom
    const elapsed = Date.now() - crawlStart
    const timeLeft = TOTAL_TIMEOUT_MS - elapsed
    const perPageTimeout = Math.min(PAGE_FETCH_TIMEOUT_MS, Math.floor(timeLeft / batchSize))

    // Fetch batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const raw = await fetchPageRaw(domain, item.path, Math.max(perPageTimeout, 1000))
        return { item, raw }
      }),
    )

    for (const { item, raw } of batchResults) {
      if (!raw || !raw.html) continue

      const { html } = raw
      const content = extractTextFromHTML(html)
      const chars = content.length

      if (chars < 50) {
        console.log(`[Crawler] ${item.path} yielded minimal content (${chars} chars)`)
        continue
      }

      const title = extractTitleFromHTML(html)

      // Fingerprint raw HTML
      const fingerprinted = fingerprintResources(html)
      for (const svc of fingerprinted) {
        if (!allFingerprinted.has(svc.name)) {
          allFingerprinted.set(svc.name, svc)
        }
      }

      console.log(`[Crawler] ✓ ${item.path} (${chars} chars, depth ${item.depth})`)

      pages.push({
        url: `https://${domain}${item.path}`,
        path: item.path,
        depth: item.depth,
        title,
        content,
        scrapedAt: new Date().toISOString(),
      })

      // Don't follow links from max-depth pages
      if (item.depth >= MAX_DEPTH) continue

      // Check remaining budget
      if (pages.length >= MAX_PAGES) continue
      if (Date.now() - crawlStart >= TOTAL_TIMEOUT_MS) continue

      // Extract and enqueue links
      const links = extractLinks(html, domain)
      for (const linkPath of links) {
        if (visited.has(linkPath)) continue
        const linkScore = scorePath(linkPath)
        if (linkScore <= -99) continue
        visited.add(linkPath)
        queue.push({ path: linkPath, depth: item.depth + 1, score: linkScore })
      }
    }
  }

  if (pages.length === 0) {
    console.error('[Crawler] No pages successfully crawled')
    return null
  }

  const knowledgeDigest = buildKnowledgeDigest(
    pages.map((p) => ({ path: p.path, title: p.title, content: p.content })),
  )

  const fingerprintedServices = Array.from(allFingerprinted.values())
  const totalCharacters = pages.reduce((sum, p) => sum + p.content.length, 0)

  console.log(
    `[Crawler] ✓ Crawl complete: ${pages.length} pages, ${totalCharacters} chars, digest: ${knowledgeDigest.length} chars, ${fingerprintedServices.length} services`,
  )

  const result: CrawlResult = {
    domain,
    pages,
    knowledgeDigest,
    fingerprintedServices,
    crawledAt: new Date().toISOString(),
    totalCharacters,
  }

  crawlCache.set(domain, { result, expiresAt: Date.now() + CACHE_TTL })
  return result
}
