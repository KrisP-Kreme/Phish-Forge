/**
 * Website Scraper Utility
 * Extracts design information from target websites including:
 * - Colors (from logo, primary elements)
 * - Fonts (from CSS)
 * - Images (logo URLs)
 * - Content structure
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
    neutral?: string
  }
  fonts: {
    primary?: string
    secondary?: string
  }
  structure: {
    hasNavBar: boolean
    hasHero: boolean
    hasFooter: boolean
  }
  scraped_at: string
  success: boolean
  error?: string
}

/**
 * Scrape website and extract design information
 */
export async function scrapeWebsite(domain: string): Promise<ScrapedWebsiteData> {
  const result: ScrapedWebsiteData = {
    domain,
    colors: {},
    fonts: {},
    structure: {
      hasNavBar: false,
      hasHero: false,
      hasFooter: false,
    },
    scraped_at: new Date().toISOString(),
    success: false,
  }

  try {
    // Resolve domain if incomplete
    let resolvedDomain = domain
    
    // Check if domain looks incomplete (no dots or doesn't look like a real domain)
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
    
    // Ensure URL is properly formatted
    const url = ensureDomainFormat(resolvedDomain)
    
    console.log('[scrapeWebsite] Fetching:', url, '(original:', domain + ')')
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      result.error = `HTTP ${response.status}`
      return result
    }

    const html = await response.text()

    // Parse HTML content
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) {
      result.title = titleMatch[1].trim()
    }

    // Extract meta description
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    if (descMatch) {
      result.description = descMatch[1]
    }

    // Extract favicon
    const faviconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i)
    if (faviconMatch) {
      result.favicon = resolvePath(faviconMatch[1], url)
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
        console.log('[scrapeWebsite] Logo fetched from API:', domain)
      }
    } catch (logoError) {
      console.log('[scrapeWebsite] Logo API fetch failed, falling back to HTML search')
      // Fallback: Extract logo from HTML (look for images with 'logo' in src)
      const logoMatches = html.match(/<img[^>]*src=["']([^"']*(?:logo|brand)[^"']*)["'][^>]*>/gi)
      if (logoMatches && logoMatches.length > 0) {
        const logoSrc = logoMatches[0].match(/src=["']([^"']+)["']/i)
        if (logoSrc) {
          result.logo = resolvePath(logoSrc[1], url)
        }
      }
    }

    // Extract colors from CSS
    const colors = extractColors(html, url)
    result.colors = { ...colors }

    // Extract fonts from CSS
    const fonts = extractFonts(html, url)
    result.fonts = { ...fonts }

    // Detect structure
    result.structure = {
      hasNavBar: /(<nav|class=["'][^"']*nav|id=["'][^"']*nav)/i.test(html),
      hasHero: /class=["'][^"']*hero|class=["'][^"']*banner/i.test(html),
      hasFooter: /<footer/i.test(html),
    }

    result.success = true
    console.log('[scrapeWebsite] Successfully scraped:', domain)
    return result
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error'
    console.error('[scrapeWebsite] Error:', result.error)
    return result
  }
}

/**
 * Extract color information from HTML and CSS
 */
function extractColors(html: string, baseUrl: string): Record<string, string | undefined> {
  const colors: Record<string, string | undefined> = {}

  // Extract CSS colors
  const styleMatches = html.match(/<style[^>]*>([^<]+)<\/style>/gi)
  let cssContent = ''
  
  if (styleMatches) {
    cssContent = styleMatches.join('\n')
  }

  // Look for link to external CSS
  const cssLinks = html.match(/<link[^>]*href=["']([^"']+\.css)["']/gi)
  
  // Extract common color variables and declarations
  const primaryColorMatch = cssContent.match(
    /(?:primary|main|brand)[^\n]*?(?:#[0-9a-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\))/gi
  )
  if (primaryColorMatch) {
    const colorValue = primaryColorMatch[0].match(
      /#[0-9a-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\)/i
    )
    if (colorValue) {
      colors.primary = normalizeColor(colorValue[0])
    }
  }

  // Look for secondary colors
  const secondaryMatch = cssContent.match(
    /(?:secondary|accent)[^\n]*?(?:#[0-9a-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\))/gi
  )
  if (secondaryMatch) {
    const colorValue = secondaryMatch[0].match(
      /#[0-9a-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\)/i
    )
    if (colorValue) {
      colors.secondary = normalizeColor(colorValue[0])
    }
  }

  // Look for accent colors
  const accentMatch = cssContent.match(
    /(?:accent|highlight)[^\n]*?(?:#[0-9a-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\))/gi
  )
  if (accentMatch) {
    const colorValue = accentMatch[0].match(
      /#[0-9a-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\)/i
    )
    if (colorValue) {
      colors.accent = normalizeColor(colorValue[0])
    }
  }

  // Try to extract colors from inline styles
  const inlineColorMatch = html.match(/style=["']([^"']*(?:color|background)[^"']*)["']/gi)
  if (inlineColorMatch) {
    for (const style of inlineColorMatch) {
      const colorValue = style.match(/(#[0-9a-f]{3,6}|rgb\([^)]+\)|hsl\([^)]+\))/i)
      if (colorValue && !colors.primary) {
        colors.primary = normalizeColor(colorValue[0])
      }
    }
  }

  return colors
}

/**
 * Extract font information from HTML and CSS
 */
function extractFonts(html: string, baseUrl: string): Record<string, string | undefined> {
  const fonts: Record<string, string | undefined> = {}

  // Extract from Google Fonts import
  const googleFontsMatch = html.match(
    /font-family:[^;]*?['"]?([^;'"]+?)['"]?(?:;|$)/gi
  )
  if (googleFontsMatch) {
    const fontNames = googleFontsMatch
      .map(f => f.replace(/font-family:\s*/, '').replace(/[';]/g, '').trim())
      .filter(f => f.length > 0)
    
    if (fontNames.length > 0) {
      fonts.primary = fontNames[0]
    }
    if (fontNames.length > 1) {
      fonts.secondary = fontNames[1]
    }
  }

  // Look for common CSS-in-JS font declarations
  const fontFaceMatch = html.match(
    /@font-face\s*{[^}]*font-family:\s*['"]?([^;'"]+)['"]?/gi
  )
  if (fontFaceMatch) {
    const fontNames = fontFaceMatch
      .map(f => f.replace(/@font-face\s*{/, '').replace(/font-family:\s*/, '').replace(/['"]/g, '').trim())
      .filter(f => f.length > 0)
    
    if (fontNames.length > 0 && !fonts.primary) {
      fonts.primary = fontNames[0]
    }
  }

  // Extract from body or html font-family
  const bodyFontMatch = html.match(/body\s*{[^}]*font-family:\s*([^;]+)/i)
  if (bodyFontMatch && !fonts.primary) {
    fonts.primary = bodyFontMatch[1].trim().replace(/['"]/g, '').split(',')[0]
  }

  return fonts
}

/**
 * Normalize color formats to hex
 */
function normalizeColor(color: string): string {
  if (color.startsWith('#')) {
    return color.toLowerCase()
  }
  
  if (color.startsWith('rgb')) {
    return rgbToHex(color)
  }
  
  return color
}

/**
 * Convert RGB to Hex color
 */
function rgbToHex(rgb: string): string {
  const match = rgb.match(/\d+/g)
  if (!match || match.length < 3) return '#000000'
  
  const r = parseInt(match[0], 10)
  const g = parseInt(match[1], 10)
  const b = parseInt(match[2], 10)
  
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('').toLowerCase()
}

/**
 * Resolve relative URLs to absolute
 */
function resolvePath(path: string, baseUrl: string): string {
  if (path.startsWith('http')) {
    return path
  }
  
  if (path.startsWith('//')) {
    return 'https:' + path
  }
  
  try {
    const base = new URL(baseUrl)
    if (path.startsWith('/')) {
      return base.origin + path
    }
    return new URL(path, baseUrl).toString()
  } catch {
    return path
  }
}
