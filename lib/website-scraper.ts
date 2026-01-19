/**
 * Website Scraper Utility - OPTIMIZED
 * Extracts minimal design information with hard limits to reduce token usage
 */

import { searchDomain, ensureDomainFormat } from './domain-resolver'

export interface ScrapedWebsiteData {
  domain: string
  resolvedDomain?: string
  title?: string
  description?: string
  favicon?: string
  logo?: string
  colors: {
    primary?: string
    secondary?: string
    accent?: string
  }
  fonts: {
    primary?: string
    secondary?: string
  }
  scraped_at: string
  success: boolean
  error?: string
}

// OPTIMIZATION: Hard limits on scraping to prevent token bloat
const SCRAPE_LIMITS = {
  max_html_length: 100000,      // Limit HTML to 100KB
  css_search_scope: 5000,       // Limit regex search to first 5KB
  color_extraction_limit: 2,    // Extract only 2 distinct colors
  font_limit: 1,                // Extract only 1 font
}

/**
 * Scrape website and extract ONLY essential design information
 */
export async function scrapeWebsite(domain: string): Promise<ScrapedWebsiteData> {
  const result: ScrapedWebsiteData = {
    domain,
    colors: {},
    fonts: {},
    scraped_at: new Date().toISOString(),
    success: false,
  }

  try {
    // Resolve domain if incomplete
    let resolvedDomain = domain
    const hasValidFormat = domain.includes('.') || domain.startsWith('http')
    
    if (!hasValidFormat) {
      console.log('[scrapeWebsite] Domain looks incomplete, searching:', domain)
      const searchResult = await searchDomain(domain)
      if (searchResult.found && searchResult.domain) {
        resolvedDomain = searchResult.domain
        result.resolvedDomain = resolvedDomain
        console.log('[scrapeWebsite] ✓ Resolved to:', resolvedDomain)
      } else {
        console.warn('[scrapeWebsite] Could not resolve domain, using original:', domain)
        resolvedDomain = domain
      }
    }
    
    const url = ensureDomainFormat(resolvedDomain)
    console.log('[scrapeWebsite] Fetching:', url)
    
    let response: Response
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
      
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      
      console.log('[scrapeWebsite] Fetch succeeded, status:', response.status)
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'
      console.error('[scrapeWebsite] Fetch failed:', errorMsg)
      result.error = `Fetch error: ${errorMsg}`
      result.success = false
      return result
    }

    if (!response.ok) {
      result.error = `HTTP ${response.status}`
      console.warn('[scrapeWebsite] HTTP error:', response.status)
      return result
    }

    let html = await response.text()
    
    // OPTIMIZATION: Limit HTML length to prevent massive CSS extraction
    if (html.length > SCRAPE_LIMITS.max_html_length) {
      console.log('[scrapeWebsite] HTML exceeds limit, truncating')
      html = html.substring(0, SCRAPE_LIMITS.max_html_length)
    }

    // Parse HTML content
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) {
      result.title = titleMatch[1].trim()
    }

    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    if (descMatch) {
      result.description = descMatch[1]
    }

    // Fetch logo using logo.dev API
    try {
      const logoApiUrl = `https://img.logo.dev/${domain}?token=pk_LMYBshZrSNWjexfaZvNkAQ`
      const logoResponse = await fetch(logoApiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })
      
      if (logoResponse.ok) {
        result.logo = logoApiUrl
        console.log('[scrapeWebsite] Logo fetched from API')
      }
    } catch (logoError) {
      console.log('[scrapeWebsite] Logo API fetch failed')
    }

    // OPTIMIZATION: Extract colors and fonts with hard limits
    const colors = extractColorsOptimized(html)
    result.colors = colors

    const fonts = extractFontsOptimized(html)
    result.fonts = fonts

    result.success = true
    console.log('[scrapeWebsite] Successfully scraped')
    return result
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error'
    console.error('[scrapeWebsite] Error:', result.error)
    return result
  }
}

/**
 * Extract color information with hard limits
 */
function extractColorsOptimized(html: string): Record<string, string | undefined> {
  const colors: Record<string, string | undefined> = {}
  
  // OPTIMIZATION: Limit CSS search to first N characters
  const cssContent = html.substring(0, SCRAPE_LIMITS.css_search_scope)

  // Extract only ONE primary color (stop at first match)
  const primaryColorMatch = cssContent.match(
    /(?:primary|main|brand)[^\n]*?(?:#[0-9a-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\))/i
  )
  if (primaryColorMatch) {
    const colorValue = primaryColorMatch[0].match(
      /#[0-9a-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\)/i
    )
    if (colorValue) {
      colors.primary = normalizeColorOptimized(colorValue[0])
    }
  }

  // Extract only ONE secondary color if space available
  if (Object.keys(colors).length < SCRAPE_LIMITS.color_extraction_limit) {
    const secondaryMatch = cssContent.match(
      /(?:secondary|accent)[^\n]*?(?:#[0-9a-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\))/i
    )
    if (secondaryMatch) {
      const colorValue = secondaryMatch[0].match(
        /#[0-9a-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\)/i
      )
      if (colorValue) {
        colors.secondary = normalizeColorOptimized(colorValue[0])
      }
    }
  }

  return colors
}

/**
 * Extract font information with hard limits
 */
function extractFontsOptimized(html: string): Record<string, string | undefined> {
  const fonts: Record<string, string | undefined> = {}
  
  // OPTIMIZATION: Limit search to first N characters, stop at first font
  const searchContent = html.substring(0, SCRAPE_LIMITS.css_search_scope)

  const googleFontsMatch = searchContent.match(
    /font-family:\s*['"]?([^;'"]+?)['"]?(?:;|$)/i
  )
  if (googleFontsMatch) {
    const fontName = googleFontsMatch[1].replace(/[';]/g, '').trim()
    if (fontName.length > 0) {
      fonts.primary = fontName
    }
  }

  return fonts
}

/**
 * Normalize color format to hex
 */
function normalizeColorOptimized(color: string): string {
  if (color.startsWith('#')) {
    return color.toLowerCase()
  }
  
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g)
    if (match && match.length >= 3) {
      const [r, g, b] = match.slice(0, 3).map(Number)
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
    }
  }
  
  return '#0066cc' // fallback
}
