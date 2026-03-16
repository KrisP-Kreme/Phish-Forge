/**
 * Domain Resolution — fully deterministic, zero AI inference.
 *
 * Resolution order:
 *  1. Normalise + early-exit if already a valid domain
 *  2. DuckDuckGo Instant Answer API  (structured JSON, free, no key)
 *  3. DuckDuckGo HTML search          (reliable for any business)
 *  4. DNS brute-force on TLD variants (fast, no HTTP needed)
 *  5. Explicit failure
 */

import dns from 'dns'
import { promisify } from 'util'

const dnsResolve4 = promisify(dns.resolve4)

// ── types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  domain: string
  url: string
  title: string
  snippet: string
  relevanceScore: number
}

interface SearchDomainResult {
  found: boolean
  domain: string | null
  originalInput: string
  alternatives: SearchResult[]
  searchMethod: string
  confidence: 'high' | 'medium' | 'low' | 'none'
}

// ── constants ─────────────────────────────────────────────────────────────────

const BLACKLIST = new Set([
  'google', 'bing', 'yahoo', 'duckduckgo',
  'facebook', 'twitter', 'instagram', 'youtube', 'reddit', 'linkedin',
  'tiktok', 'pinterest', 'medium', 'quora', 'tumblr',
  'amazon', 'ebay', 'walmart', 'aliexpress',
  'yelp', 'trustpilot', 'glassdoor', 'indeed',
  'blogspot', 'wordpress.com', 'wix.com', 'weebly.com',
  'wikipedia', 'wikimedia',
])

// Ordered TLD list tailored to common AU/NZ/UK/US company patterns
const TLD_VARIANTS = [
  '.com.au', '.org.au', '.net.au', '.gov.au',
  '.com', '.org', '.net',
  '.co.uk', '.org.uk',
  '.co.nz',
]

const REQUEST_TIMEOUT_MS = 6000

// ── utilities ─────────────────────────────────────────────────────────────────

function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
}

function looksLikeDomain(s: string): boolean {
  return s.includes('.') && /\.[a-z]{2,}$/.test(s)
}

function extractDomain(urlString: string): string | null {
  try {
    const u = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`)
    return u.hostname || null
  } catch {
    return null
  }
}

function isBlacklisted(domain: string): boolean {
  const d = domain.toLowerCase()
  return BLACKLIST.has(d.split('.')[0]) ||
    Array.from(BLACKLIST).some(b => b.includes('.') && d.includes(b))
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '')
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  try {
    const ctrl = new AbortController()
    const id = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    clearTimeout(id)
    return res
  } catch {
    return null
  }
}

// ── step 1: direct domain validation ─────────────────────────────────────────

async function validateDomainHTTP(domain: string): Promise<boolean> {
  for (const prefix of [`https://${domain}`, `https://www.${domain}`]) {
    const res = await fetchWithTimeout(prefix)
    if (res && res.status < 400) {
      console.log('[Domain] ✓ Domain accessible:', prefix)
      return true
    }
  }
  console.warn('[Domain] ⚠ Domain not accessible:', domain)
  return false
}

// ── step 2: DuckDuckGo Instant Answer API ────────────────────────────────────
// Returns structured JSON — great for known organisations (industry bodies,
// associations, franchises).  No API key required.

async function queryDuckDuckGoInstant(query: string): Promise<string | null> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
  const res = await fetchWithTimeout(url)
  if (!res || !res.ok) return null

  try {
    const data = await res.json()

    // Prefer explicit OfficialSite field
    if (data.OfficialSite) {
      const domain = extractDomain(data.OfficialSite)
      if (domain && !isBlacklisted(domain)) {
        console.log('[Domain] DDG Instant OfficialSite:', domain)
        return domain
      }
    }

    // AbstractURL is the Wikipedia article URL — not the company site.
    // But it often contains the company's real URL in AbstractSource.
    if (data.AbstractSource && data.AbstractURL) {
      const domain = extractDomain(data.AbstractURL)
      if (domain && !isBlacklisted(domain) && !domain.includes('wikipedia')) {
        console.log('[Domain] DDG Instant AbstractURL:', domain)
        return domain
      }
    }

    // Scan top Results
    for (const result of (data.Results || []).slice(0, 3)) {
      const domain = extractDomain(result.FirstURL || '')
      if (domain && !isBlacklisted(domain)) {
        console.log('[Domain] DDG Instant Results:', domain)
        return domain
      }
    }
  } catch {
    // ignore parse failures
  }

  return null
}

// ── step 3: DuckDuckGo HTML search ───────────────────────────────────────────
// Falls back to the human-readable HTML results page.  DuckDuckGo does not
// obfuscate link hrefs the way Google does, so direct href extraction works.

async function queryDuckDuckGoHTML(query: string): Promise<string | null> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const res = await fetchWithTimeout(url)
  if (!res || !res.ok) return null

  try {
    const html = await res.text()

    // DDG HTML results: <a class="result__a" href="https://...">
    const re = /class="result__a"[^>]+href="(https?:\/\/[^"]+)"/g
    let m: RegExpExecArray | null

    while ((m = re.exec(html)) !== null) {
      const domain = extractDomain(m[1])
      if (domain && !isBlacklisted(domain)) {
        console.log('[Domain] DDG HTML result:', domain)
        return domain
      }
    }

    // Broader fallback: any href that is an absolute URL
    const broadRe = /href="(https?:\/\/[^"]{10,80})"/g
    const seen = new Set<string>()
    while ((m = broadRe.exec(html)) !== null) {
      const domain = extractDomain(m[1])
      if (domain && !isBlacklisted(domain) && !seen.has(domain)) {
        seen.add(domain)
        console.log('[Domain] DDG HTML broad result:', domain)
        return domain
      }
    }
  } catch {
    // ignore parse failures
  }

  return null
}

// ── step 4: DNS brute-force ───────────────────────────────────────────────────
// Generate TLD variant candidates from the business name and probe DNS A
// records.  DNS resolution is ~10× faster than HTTP and works even for sites
// that block HTTP scanners.

function buildNameVariants(name: string): string[] {
  const slug = slugify(name)
  const words = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).filter(w => w.length > 1)

  const variants = new Set<string>()

  // Full concatenated slug
  if (slug) variants.add(slug)

  // First two words joined (e.g. "swimming australia" → "swimmingaustralia")
  if (words.length >= 2) variants.add(words.slice(0, 2).join(''))

  // Acronym (e.g. "AUSactive Recreation" → "ar")
  const acronym = words.map(w => w[0]).join('')
  if (acronym.length >= 2 && acronym.length <= 6) variants.add(acronym)

  // Drop common suffixes (pty, ltd, inc, co, group, australia, au)
  const stopWords = new Set(['pty', 'ltd', 'inc', 'co', 'group', 'australia', 'au', 'the', 'and'])
  const filtered = words.filter(w => !stopWords.has(w))
  if (filtered.length > 0 && filtered.join('') !== slug) {
    variants.add(filtered.join(''))
    if (filtered.length >= 2) variants.add(filtered.slice(0, 2).join(''))
  }

  return Array.from(variants).filter(v => v.length >= 3)
}

async function resolvesViaDNS(domain: string): Promise<boolean> {
  try {
    const addresses = await dnsResolve4(domain)
    return addresses.length > 0
  } catch {
    return false
  }
}

async function bruteForceTLDs(businessName: string): Promise<string | null> {
  const nameVariants = buildNameVariants(businessName)
  console.log('[Domain] DNS brute-force variants:', nameVariants)

  // Build candidate list: vary both the name slug and the TLD
  const candidates: string[] = []
  for (const variant of nameVariants) {
    for (const tld of TLD_VARIANTS) {
      candidates.push(variant + tld)
    }
  }

  // Probe all candidates concurrently in batches of 10
  const BATCH = 10
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(async (domain) => ({
        domain,
        resolves: await resolvesViaDNS(domain),
      }))
    )
    const hit = results.find(r => r.resolves)
    if (hit) {
      console.log('[Domain] ✓ DNS brute-force resolved:', hit.domain)
      return hit.domain
    }
  }

  return null
}

// ── main export ───────────────────────────────────────────────────────────────

export async function searchDomain(
  businessNameOrDomain: string
): Promise<SearchDomainResult> {
  console.log('[Domain] === START RESOLUTION ===')
  console.log('[Domain] Input:', businessNameOrDomain)

  const originalInput = businessNameOrDomain
  const normalized = normalizeInput(businessNameOrDomain)
  console.log('[Domain] Normalized:', normalized)

  // ── 1. Direct domain ────────────────────────────────────────────────────────
  if (looksLikeDomain(normalized)) {
    console.log('[Domain] Looks like a domain, validating...')
    const ok = await validateDomainHTTP(normalized)
    if (ok) {
      console.log('[Domain] ✓ Direct domain validation succeeded')
      return {
        found: true,
        domain: normalized,
        originalInput,
        alternatives: [{ domain: normalized, url: `https://${normalized}`, title: normalized, snippet: 'Direct input', relevanceScore: 1 }],
        searchMethod: 'direct_complete',
        confidence: 'high',
      }
    }
    console.log('[Domain] Direct validation failed, falling through to search...')
  }

  // Use the full original name (minus any www/protocol) for search queries
  const queryName = businessNameOrDomain.trim()

  // ── 2. DuckDuckGo Instant Answer ────────────────────────────────────────────
  console.log('[Domain] Querying DuckDuckGo Instant Answer...')
  const instantDomain = await queryDuckDuckGoInstant(queryName)
  if (instantDomain && !isBlacklisted(instantDomain)) {
    const ok = await validateDomainHTTP(instantDomain)
    if (ok) {
      return {
        found: true,
        domain: instantDomain,
        originalInput,
        alternatives: [{ domain: instantDomain, url: `https://${instantDomain}`, title: queryName, snippet: 'DuckDuckGo Instant Answer', relevanceScore: 0.95 }],
        searchMethod: 'ddg_instant',
        confidence: 'high',
      }
    }
  }

  // ── 3. DuckDuckGo HTML search ───────────────────────────────────────────────
  console.log('[Domain] Querying DuckDuckGo HTML search...')
  const htmlDomain = await queryDuckDuckGoHTML(`${queryName} official website`)
  if (htmlDomain && !isBlacklisted(htmlDomain)) {
    const ok = await validateDomainHTTP(htmlDomain)
    if (ok) {
      return {
        found: true,
        domain: htmlDomain,
        originalInput,
        alternatives: [{ domain: htmlDomain, url: `https://${htmlDomain}`, title: queryName, snippet: 'DuckDuckGo HTML search', relevanceScore: 0.85 }],
        searchMethod: 'ddg_html',
        confidence: 'high',
      }
    }
  }

  // ── 4. DNS brute-force ──────────────────────────────────────────────────────
  console.log('[Domain] DNS brute-force on TLD variants...')
  const dnsDomain = await bruteForceTLDs(queryName)
  if (dnsDomain) {
    return {
      found: true,
      domain: dnsDomain,
      originalInput,
      alternatives: [{ domain: dnsDomain, url: `https://${dnsDomain}`, title: queryName, snippet: 'DNS brute-force', relevanceScore: 0.65 }],
      searchMethod: 'dns_bruteforce',
      confidence: 'medium',
    }
  }

  // ── 5. Explicit failure ─────────────────────────────────────────────────────
  console.log('[Domain] ✗ Resolution FAILED - no valid domain found')
  return {
    found: false,
    domain: null,
    originalInput,
    alternatives: [],
    searchMethod: 'no_result',
    confidence: 'none',
  }
}

export async function searchBusinessWebsite(businessNameOrDomain: string): Promise<SearchDomainResult> {
  return searchDomain(businessNameOrDomain)
}

export function ensureDomainFormat(domain: string): string {
  const n = domain.trim()
  return n.startsWith('http://') || n.startsWith('https://') ? n : `https://${n}`
}
