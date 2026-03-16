import { SERVICE_FINGERPRINTS, CONFIDENCE_THRESHOLDS } from './partner-constants'

export interface FingerprintedService {
  name: string
  type: string
  relationship: string
  sourceUrl: string
  confidence: number
}

export interface ScrapedPage {
  url: string
  path: string
  content: string
  scrapedAt: string
}

export interface ScrapedContent {
  domain: string
  pages: ScrapedPage[]
  combinedText: string
  totalCharacters: number
  fingerprintedServices: FingerprintedService[]
}

// Cache with 1-hour TTL
const scrapeCache = new Map<string, { content: ScrapedContent; expiresAt: number }>()
const CACHE_TTL = 1000 * 60 * 60 // 1 hour
const MAX_COMBINED_CHARS = 20000

// Static fallback pages — used when no sitemap is found
const STATIC_FALLBACK_PAGES = [
  '/',
  '/about',
  '/partners',
  '/integrations',
  '/technology',
  '/privacy',
  '/privacy-policy',
  '/terms',
  '/terms-of-service',
  '/faq',
  '/faqs',
  '/support',
  '/pricing',
  '/contact',
  '/how-it-works',
]

// Relevance scoring for sitemap URLs
const SITEMAP_RELEVANCE_RULES: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /partner|vendor|supplier/i,                    score: 3 },
  { pattern: /integrat|technology|platform|ecosystem/i,     score: 3 },
  { pattern: /faq|faqs|how-it-works|pricing|support/i,      score: 2 },
  { pattern: /about|team|company|our-story/i,               score: 2 },
  { pattern: /service|solution|product/i,                   score: 1 },
  { pattern: /blog|news|press|article|case-stud/i,          score: 1 },
  { pattern: /privacy|terms|legal|cookie/i,                 score: -1 },
  { pattern: /\/(cart|checkout|shop\/\w+|order|account)\//i, score: -2 },
]

function extractTextFromHTML(html: string): string {
  try {
    let text = html

    // Remove script and style content
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

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
    console.error('[Scraper] Error parsing HTML:', error)
    return ''
  }
}

/**
 * Detect embedded third-party services by scanning raw HTML for known resource URLs.
 * Runs on raw HTML before tag stripping so script/iframe/link tags are still present.
 */
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

/**
 * Score and filter a list of absolute URLs from a sitemap.
 * Returns the top paths sorted by relevance, excluding low-value or non-HTML URLs.
 */
function scoreAndFilterSitemapUrls(urls: string[], domain: string): string[] {
  const seen = new Set<string>()

  return urls
    .map((url) => {
      // Extract the path from an absolute URL, filtering out off-domain links
      let path: string
      try {
        const parsed = new URL(url)
        // Skip URLs from other domains
        if (!parsed.hostname.includes(domain.replace(/^www\./, ''))) return null
        path = parsed.pathname || '/'
      } catch {
        return null
      }

      // Skip non-HTML files, pagination, very long dynamic paths
      if (/\.(pdf|png|jpg|jpeg|gif|svg|xml|json|css|js|ico|woff|woff2)$/i.test(path)) return null
      if (/\/(page|p)\/\d+/i.test(path)) return null
      if (path.length > 100) return null
      if (seen.has(path)) return null
      seen.add(path)

      let score = 0
      for (const { pattern, score: pts } of SITEMAP_RELEVANCE_RULES) {
        if (pattern.test(path)) score += pts
      }

      return { path, score }
    })
    .filter((item): item is { path: string; score: number } => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map(({ path }) => path)
}

/**
 * Try to discover pages worth scraping via /sitemap.xml or /robots.txt.
 * Falls back to an empty array so callers can fall back to the static list.
 */
async function fetchSitemapPaths(domain: string): Promise<string[]> {
  const fetchWithTimeout = async (url: string, ms: number): Promise<string | null> => {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), ms)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SitemapBot/1.0)',
          'Accept': 'application/xml,text/xml,text/plain,*/*',
        },
      })
      if (!res.ok) return null
      return await res.text()
    } catch {
      return null
    } finally {
      clearTimeout(id)
    }
  }

  // 1. Try /sitemap.xml directly
  let sitemapContent = await fetchWithTimeout(`https://${domain}/sitemap.xml`, 4000)

  // 2. Try /robots.txt for a Sitemap: directive
  if (!sitemapContent) {
    const robots = await fetchWithTimeout(`https://${domain}/robots.txt`, 3000)
    if (robots) {
      const match = robots.match(/^Sitemap:\s*(.+)$/mi)
      if (match) {
        sitemapContent = await fetchWithTimeout(match[1].trim(), 3000)
      }
    }
  }

  if (!sitemapContent) {
    console.log(`[Scraper] No sitemap found for ${domain}`)
    return []
  }

  // If it's a sitemap index, fetch the first child
  if (sitemapContent.includes('<sitemapindex')) {
    const locMatch = sitemapContent.match(/<loc>(.*?)<\/loc>/i)
    if (locMatch) {
      const child = await fetchWithTimeout(locMatch[1].trim(), 3000)
      if (child) sitemapContent = child
    }
  }

  // Extract all <loc> values
  const locs: string[] = []
  const locPattern = /<loc>(.*?)<\/loc>/gi
  let m
  while ((m = locPattern.exec(sitemapContent)) !== null) {
    locs.push(m[1].trim())
  }

  const paths = scoreAndFilterSitemapUrls(locs, domain)
  console.log(`[Scraper] Sitemap found ${locs.length} URLs, selected ${paths.length} paths:`, paths)
  return paths
}

/**
 * Fetch and extract content from a single page. Also fingerprints raw HTML
 * before text extraction so embedded third-party services are detected.
 */
async function fetchPage(
  domain: string,
  path: string,
  timeout: number = 5000,
): Promise<{ page: ScrapedPage; fingerprinted: FingerprintedService[] } | null> {
  try {
    const url = `https://${domain}${path}`
    console.log(`[Scraper] Fetching ${path}...`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.log(`[Scraper] ${path} returned ${response.status}`)
        return null
      }

      const html = await response.text()

      // Fingerprint raw HTML before stripping tags
      const fingerprinted = fingerprintResources(html)

      const content = extractTextFromHTML(html)

      if (content.length < 50) {
        console.log(`[Scraper] ${path} yielded minimal content (${content.length} chars)`)
        return null
      }

      console.log(`[Scraper] ✓ ${path} (${content.length} chars, ${fingerprinted.length} services fingerprinted)`)

      return {
        page: { url, path, content, scrapedAt: new Date().toISOString() },
        fingerprinted,
      }
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        console.log(`[Scraper] Timeout fetching ${path} (${timeout}ms)`)
      } else {
        console.log(`[Scraper] Error fetching ${path}: ${error.message}`)
      }
      return null
    }
  } catch (error) {
    console.error(`[Scraper] Unexpected error on ${path}:`, error)
    return null
  }
}

/**
 * Main scraper — discovers pages via sitemap (with static fallback),
 * fetches them in parallel, fingerprints embedded resources, and returns
 * combined text + detected services.
 */
export async function scrapeWebsiteContent(rawDomain: string): Promise<ScrapedContent | null> {
  // Normalise — strip any protocol/www/path a caller may have left in
  const domain = rawDomain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()

  try {
    const cached = scrapeCache.get(domain)
    if (cached && Date.now() < cached.expiresAt) {
      console.log('[Scraper] Cache hit for', domain)
      return cached.content
    }

    console.log(`[Scraper] Starting scrape for ${domain}`)

    // Discover pages: try sitemap first, fall back to static list
    let pagesToScrape: string[]
    const sitemapPaths = await fetchSitemapPaths(domain)

    if (sitemapPaths.length > 0) {
      // Always include homepage + high-value content pages (privacy/terms list data processors,
      // about pages list partners) even when a sitemap is available — these are often omitted.
      const PRIORITY_PAGES = [
        '/', '/about', '/privacy', '/privacy-policy', '/terms', '/terms-of-service',
        '/faq', '/faqs', '/support', '/pricing', '/contact', '/how-it-works',
      ]
      const merged = Array.from(new Set([...PRIORITY_PAGES, ...sitemapPaths]))
      pagesToScrape = merged
      console.log(`[Scraper] Using ${pagesToScrape.length} pages (sitemap + priority pages)`)
    } else {
      pagesToScrape = STATIC_FALLBACK_PAGES
      console.log(`[Scraper] Using ${pagesToScrape.length} static fallback pages`)
    }

    // Fetch all pages in parallel
    const fetchResults = await Promise.all(
      pagesToScrape.map((path) => fetchPage(domain, path, 5000)),
    )

    const scrapedPages: ScrapedPage[] = []
    const allFingerprinted = new Map<string, FingerprintedService>()
    let combinedText = ''

    for (const result of fetchResults) {
      if (!result) continue

      // Aggregate fingerprinted services (deduplicate by name)
      for (const svc of result.fingerprinted) {
        if (!allFingerprinted.has(svc.name)) {
          allFingerprinted.set(svc.name, svc)
        }
      }

      scrapedPages.push(result.page)

      const pageMarker = `\n\n[SOURCE: ${result.page.path}]\n`
      if ((combinedText + pageMarker + result.page.content).length <= MAX_COMBINED_CHARS) {
        combinedText += pageMarker + result.page.content
      } else {
        const remaining = MAX_COMBINED_CHARS - combinedText.length
        if (remaining > 500) {
          combinedText += pageMarker + result.page.content.substring(0, remaining - pageMarker.length)
        }
        break
      }
    }

    if (scrapedPages.length === 0) {
      console.error('[Scraper] No pages successfully scraped')
      return null
    }

    if (combinedText.length < 100) {
      console.error('[Scraper] Combined content too short:', combinedText.length, 'chars')
      return null
    }

    const fingerprintedServices = Array.from(allFingerprinted.values())
    console.log(`[Scraper] ✓ Scrape complete: ${scrapedPages.length} pages, ${combinedText.length} chars, ${fingerprintedServices.length} services fingerprinted`)
    if (fingerprintedServices.length > 0) {
      console.log('[Scraper] Fingerprinted services:', fingerprintedServices.map((s) => s.name).join(', '))
    }

    const result: ScrapedContent = {
      domain,
      pages: scrapedPages,
      combinedText: combinedText.trim(),
      totalCharacters: combinedText.length,
      fingerprintedServices,
    }

    scrapeCache.set(domain, { content: result, expiresAt: Date.now() + CACHE_TTL })
    return result
  } catch (error) {
    console.error('[Scraper] Fatal error:', error)
    return null
  }
}
