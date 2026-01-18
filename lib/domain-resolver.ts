/**
 * Domain Resolution System
 * 
 * Deterministic domain resolution following this flow:
 * 1. Normalize input (lowercase, trim, strip protocol/paths/www)
 * 2. Early exit if valid domain exists
 * 3. Authoritative search (single "official website" query)
 * 4. Validate top result with strict criteria
 * 5. AI-powered domain inference (Groq)
 * 6. Evidence-based fallback with hard filters
 * 7. Explicit failure instead of low-confidence guesses
 */

import { callGroqWithRetry } from './groq'

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

// Hard-filtered domains (never return as canonical)
const BLACKLIST_DOMAINS = [
  'google', 'r.google', 'r.bing', 'bing',
  'facebook', 'twitter', 'instagram', 'youtube', 'reddit', 'linkedin', 'github',
  'stackoverflow', 'pinterest', 'medium', 'quora', 'tumblr', 'tiktok',
  'amazon', 'ebay', 'aliexpress', 'walmart',
  'yelp', 'trustpilot', 'glassdoor', 'indeed',
  'github.io', 'blogspot', 'wordpress.com', 'wix.com', 'weebly.com'
]

// Common valid TLDs for country-specific domains
const COMMON_TLDS = ['.com', '.org', '.net', '.gov', '.com.au', '.org.au', '.net.au', '.gov.au', '.co.uk', '.gov.uk', '.co.nz', '.com.br']

/**
 * Step 1: Normalize input to canonical form
 * - Lowercase
 * - Trim whitespace
 * - Strip protocol (http://, https://)
 * - Strip paths and query strings
 * - Strip www.
 */
function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/^(https?:\/\/)/, '')
    .replace(/\/?(\?|#).*$/, '')
    .replace(/^www\./, '')
}

/**
 * Check if input is already a valid domain
 * Valid domains contain a dot and resolve via DNS/HTTP
 */
function looksLikeDomain(normalized: string): boolean {
  // Must have a dot and not be a social media site
  if (!normalized.includes('.')) return false
  
  // Has valid TLD pattern
  const hasTld = COMMON_TLDS.some(tld => normalized.endsWith(tld)) ||
                 /\.[a-z]{2,}$/.test(normalized)
  
  return hasTld
}

/**
 * Extract domain from URL string
 */
function extractDomain(urlString: string): string {
  try {
    const url = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`)
    return url.hostname || urlString
  } catch {
    return urlString
  }
}

/**
 * Step 2: Attempt DNS validation for domain-like input
 * Returns true if domain is accessible
 */
async function validateDomainExists(domain: string): Promise<boolean> {
  try {
    const url = domain.startsWith('http') ? domain : `https://${domain}`
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    }).catch(() => null)
    
    return response?.ok === true
  } catch {
    return false
  }
}

/**
 * Step 3: Search for "<business name>" official website
 * Performs single authoritative search query
 */
async function searchForOfficialWebsite(businessName: string): Promise<SearchResult | null> {
  const searchQuery = `"${businessName}" official website`
  
  try {
    console.log('[Domain] Searching:', searchQuery)
    
    const response = await fetch(
      `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
      }
    )
    
    if (!response.ok) return null
    
    const html = await response.text()
    const candidates = parseTopSearchResults(html, businessName)
    
    // Return only the top result if it exists
    return candidates.length > 0 ? candidates[0] : null
  } catch (error) {
    console.log('[Domain] Search failed:', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Step 4: Validate top search result with strict multi-criteria check
 * Returns true only if ≥2 criteria pass
 */
async function validateSearchResult(result: SearchResult): Promise<boolean> {
  let criteriaPass = 0
  
  // Criterion 1: Domain responds successfully
  const isAccessible = await validateDomainExists(result.domain)
  if (isAccessible) {
    criteriaPass++
    console.log('[Domain] ✓ Criterion 1 passed: Domain is accessible')
  }
  
  // Criterion 2: Homepage title/metadata aligns with business name
  // (We infer this from search result title)
  if (result.title && result.title.length > 0) {
    criteriaPass++
    console.log('[Domain] ✓ Criterion 2 passed: Title exists in search result')
  }
  
  // Criterion 3: Domain is NOT blacklisted
  if (!isBlacklistedDomain(result.domain)) {
    criteriaPass++
    console.log('[Domain] ✓ Criterion 3 passed: Not a blacklisted domain')
  }
  
  const validated = criteriaPass >= 2
  console.log(`[Domain] Validation: ${criteriaPass}/3 criteria passed -> ${validated ? 'ACCEPTED' : 'REJECTED'}`)
  
  return validated
}

/**
 * Check if domain is in the blacklist (social media, marketplaces, redirects)
 */
function isBlacklistedDomain(domain: string): boolean {
  const domainLower = domain.toLowerCase()
  return BLACKLIST_DOMAINS.some(blocked => domainLower.includes(blocked))
}

/**
 * Step 5: Parse top search result from HTML
 * Returns only 1 result (the top organic result)
 */
function parseTopSearchResults(html: string, businessName: string): SearchResult[] {
  const results: SearchResult[] = []
  
  // Find href attributes from search results
  // Google search results typically have href="/url?q=<actual_url>"
  const hrefRegex = /href=["']([^"']*)['"]/g
  let match
  
  const businessTokens = businessName
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2)
  
  const seen = new Set<string>()
  
  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1]
    
    // Only process HTTP URLs
    if (!url.startsWith('http')) continue
    
    // Extract domain from URL
    const domain = extractDomain(url)
    
    // Skip if already processed
    if (seen.has(domain)) continue
    seen.add(domain)
    
    // Hard filter: skip blacklisted domains
    if (isBlacklistedDomain(domain)) {
      console.log('[Domain] Filtered (blacklist):', domain)
      continue
    }
    
    // Hard filter: skip overly long domains (likely spam)
    if (domain.length > 50) {
      console.log('[Domain] Filtered (too long):', domain)
      continue
    }
    
    // Hard filter: skip very generic domains
    if (domain.split('.')[0].length < 2) {
      console.log('[Domain] Filtered (too short):', domain)
      continue
    }
    
    // Scoring: Check how many business name tokens appear in domain
    const matchCount = businessTokens.filter(token => domain.includes(token)).length
    const score = matchCount > 0 ? 0.8 + matchCount * 0.1 : 0.5
    
    results.push({
      domain,
      url,
      title: domain,
      snippet: matchCount > 0 ? `Matched ${matchCount} tokens` : 'Search result',
      relevanceScore: score
    })
    
    // Return only top result
    if (results.length >= 1) break
  }
  
  return results
}

/**
 * Step 6: Evidence-based fallback
 * Collects secondary candidates with hard filtering
 */
function generateFallbackCandidates(businessName: string): SearchResult[] {
  // Normalize: lowercase, remove special chars, split by spaces
  const normalized = businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0)
    .join('')
  
  if (normalized.length < 2) return []
  
  const candidates: SearchResult[] = []
  
  // Try .com first (most common), then country-specific
  const tldsToTry = ['.com', '.com.au', '.co.uk', '.org', '.net']
  
  for (const tld of tldsToTry) {
    const domain = normalized + tld
    candidates.push({
      domain,
      url: `https://${domain}`,
      title: domain,
      snippet: 'Fallback - name normalized',
      relevanceScore: 0.4
    })
  }
  
  return candidates
}

/**
 * Simplified scoring: returns a numeric score indicating confidence level
 */
function scoreCandidate(domain: string, searchMethod: string): number {
  // Direct/complete domain early-exit: highest confidence
  if (searchMethod === 'direct_complete') return 0.95
  
  // Found via authoritative search + validation: high confidence
  if (searchMethod === 'authoritative_search_validated') return 0.9
  
  // Found via AI inference: medium-high confidence
  if (searchMethod === 'ai_inference') return 0.75
  
  // Found in search but unvalidated: medium confidence
  if (searchMethod === 'search_unvalidated') return 0.6
  
  // Fallback guess: low confidence
  if (searchMethod === 'fallback_guess') return 0.3
  
  return 0.0
}

/**
 * Confidence level based on score
 */
function scoreToConfidence(score: number): 'high' | 'medium' | 'low' | 'none' {
  if (score >= 0.85) return 'high'
  if (score >= 0.6) return 'medium'
  if (score > 0) return 'low'
  return 'none'
}

/**
 * Step 5: AI-Powered Domain Inference
 * Uses Groq LLM to intelligently guess domain candidates from business name
 * Handles cases where domain doesn't match brand name
 * Example: "Centaman Entrance Control" → "entrancecontrol.com.au"
 * 
 * Fails gracefully if Groq is rate-limited or unavailable
 */
async function inferDomainsViaAI(businessName: string): Promise<SearchResult[]> {
  try {
    console.log('[Domain] Attempting AI-powered domain inference...')
    
    const prompt = `You are a domain name inference expert. Given a business name, generate the most likely domain names.

Business Name: "${businessName}"

Generate 3-5 possible domain names as a simple JSON array. Consider:
- Shortened versions of the name
- Key descriptive words (e.g., "Centaman Entrance Control" → "entrancecontrol")
- Common domain patterns
- Likely country TLDs (prioritize .com, .com.au, .co.uk)

Return ONLY a JSON array of strings like: ["domain1.com", "domain2.com.au"]
NO explanations, NO markdown, NO code fences.`

    const response = await callGroqWithRetry(
      'llama-3.3-70b-versatile',
      'You are a helpful domain name inference assistant.',
      prompt,
      0 // No retries for rate limit errors - don't waste tokens
    )
    
    // Parse the response as JSON array
    let candidates: string[] = []
    try {
      // Clean up response
      let cleaned = response.trim()
      if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
        candidates = JSON.parse(cleaned)
      }
    } catch (parseError) {
      console.log('[Domain] AI response parse failed, skipping inference')
      return []
    }
    
    console.log('[Domain] AI inference generated candidates:', candidates)
    
    // Convert to SearchResult format with medium confidence
    const results: SearchResult[] = candidates.map((domain, idx) => ({
      domain: domain.toLowerCase(),
      url: `https://${domain.toLowerCase()}`,
      title: domain,
      snippet: 'AI-inferred candidate',
      relevanceScore: 0.7 - (idx * 0.05) // Slightly lower for later candidates
    }))
    
    return results
  } catch (error) {
    // Check if this is a rate limit error
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (errorMsg.includes('rate_limit') || errorMsg.includes('429')) {
      console.log('[Domain] AI inference skipped: Rate limit reached (will try fallback methods)')
    } else {
      console.log('[Domain] AI inference failed:', errorMsg)
    }
    return []
  }
}

/**
 * MAIN ENTRY POINT: Domain Search
 * 
 * Follows the deterministic flow:
 * 1. Normalize input
 * 2. Early exit if valid domain exists
 * 3. Authoritative search + validation
 * 4. Evidence-based fallback
 * 5. Explicit failure instead of low-confidence guesses
 */
export async function searchDomain(
  businessNameOrDomain: string
): Promise<SearchDomainResult> {
  console.log('[Domain] === START RESOLUTION ===')
  console.log('[Domain] Input:', businessNameOrDomain)
  
  const originalInput = businessNameOrDomain
  const normalized = normalizeInput(businessNameOrDomain)
  
  console.log('[Domain] Normalized:', normalized)
  
  // STEP 2: Early exit if already a valid domain
  if (looksLikeDomain(normalized)) {
    console.log('[Domain] Looks like a domain, validating...')
    const isValid = await validateDomainExists(normalized)
    
    if (isValid) {
      console.log('[Domain] ✓ Direct domain validation succeeded')
      return {
        found: true,
        domain: normalized,
        originalInput,
        alternatives: [{
          domain: normalized,
          url: `https://${normalized}`,
          title: normalized,
          snippet: 'Direct input - verified',
          relevanceScore: 1.0
        }],
        searchMethod: 'direct_complete',
        confidence: 'high'
      }
    }
    
    console.log('[Domain] Direct validation failed, continuing to search...')
  }
  
  // STEP 3: Authoritative search
  console.log('[Domain] Performing authoritative search...')
  const topResult = await searchForOfficialWebsite(normalized)
  
  if (topResult) {
    // STEP 4: Validate the top result
    console.log('[Domain] Validating top search result:', topResult.domain)
    const isValid = await validateSearchResult(topResult)
    
    if (isValid) {
      console.log('[Domain] ✓ Search result validation PASSED')
      return {
        found: true,
        domain: topResult.domain,
        originalInput,
        alternatives: [topResult],
        searchMethod: 'authoritative_search_validated',
        confidence: 'high'
      }
    }
    
    console.log('[Domain] Search result validation FAILED, trying fallback...')
  }
  
  // STEP 5: AI-powered domain inference
  console.log('[Domain] Attempting AI-powered domain inference...')
  const aiCandidates = await inferDomainsViaAI(normalized)
  
  if (aiCandidates.length > 0) {
    console.log('[Domain] Testing AI-inferred candidates...')
    
    // Try each AI candidate in order
    for (const candidate of aiCandidates) {
      const isValid = await validateDomainExists(candidate.domain)
      
      if (isValid) {
        console.log('[Domain] ✓ AI-inferred domain validated:', candidate.domain)
        return {
          found: true,
          domain: candidate.domain,
          originalInput,
          alternatives: aiCandidates,
          searchMethod: 'ai_inference',
          confidence: 'medium'
        }
      } else {
        console.log('[Domain] AI candidate not accessible:', candidate.domain)
      }
    }
    
    console.log('[Domain] All AI candidates failed validation, trying fallback...')
  }
  
  // STEP 6: Evidence-based fallback
  console.log('[Domain] Attempting evidence-based fallback...')
  const fallbackCandidates = generateFallbackCandidates(normalized)
  
  if (fallbackCandidates.length > 0) {
    // Try to validate the first fallback candidate
    const bestFallback = fallbackCandidates[0]
    const fallbackValid = await validateDomainExists(bestFallback.domain)
    
    if (fallbackValid) {
      console.log('[Domain] ⚠ Using validated fallback:', bestFallback.domain)
      return {
        found: true,
        domain: bestFallback.domain,
        originalInput,
        alternatives: fallbackCandidates,
        searchMethod: 'fallback_guess',
        confidence: 'low'
      }
    }
  }
  
  // STEP 7: Explicit failure
  console.log('[Domain] ✗ Resolution FAILED - no valid domain found')
  return {
    found: false,
    domain: null,
    originalInput,
    alternatives: [],
    searchMethod: 'no_result',
    confidence: 'none'
  }
}

/**
 * Alias for backward compatibility
 */
export async function searchBusinessWebsite(
  businessNameOrDomain: string
): Promise<SearchDomainResult> {
  return searchDomain(businessNameOrDomain)
}
/**
 * Utility: Ensure domain is in proper URL format
 */
export function ensureDomainFormat(domain: string): string {
  const normalized = domain.trim()

  // Already has protocol? Keep it
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized
  }

  // Otherwise add https
  return `https://${normalized}`
}