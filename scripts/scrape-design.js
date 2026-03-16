/**
 * scrape-design.js — fetch-based design token extractor
 * No Playwright, no sharp, no external dependencies.
 * Uses only Node.js built-in https/http modules.
 */

'use strict'

const https = require('https')
const http = require('http')
const { URL } = require('url')

const PAGE_TIMEOUT_MS = 8000
const CSS_TIMEOUT_MS = 5000
const MAX_CSS_FILES = 3
const MAX_CSS_CHARS = 80000

// Generic families that don't count as brand fonts
const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'inherit', 'initial', 'unset',
  'arial', 'helvetica', 'times', 'times new roman', 'georgia', 'verdana',
  'courier', 'courier new', 'tahoma', 'trebuchet', 'impact',
])

// ── HTTP helper ───────────────────────────────────────────────────────────────

function fetchText(rawUrl, timeoutMs) {
  return new Promise((resolve, reject) => {
    let url
    try { url = new URL(rawUrl) } catch (e) { return reject(e) }

    const lib = url.protocol === 'https:' ? https : http
    const req = lib.get(rawUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,text/css,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    }, (res) => {
      // Follow up to 3 redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        try {
          const redirected = new URL(res.headers.location, rawUrl).href
          fetchText(redirected, timeoutMs).then(resolve).catch(reject)
        } catch (e) { reject(e) }
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} from ${rawUrl}`))
        return
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    })

    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout: ${rawUrl}`)) })
    req.on('error', reject)
  })
}

// ── CSS parsers ───────────────────────────────────────────────────────────────

/** Extract @font-face family names from a CSS string */
function parseFontFaces(css) {
  const families = []
  const re = /@font-face\s*\{([^}]+)\}/gi
  let m
  while ((m = re.exec(css)) !== null) {
    const fam = m[1].match(/font-family\s*:\s*['"]?([^;'"]+)['"]?/i)
    if (fam) {
      const name = fam[1].trim().replace(/['"]/g, '')
      if (!families.includes(name)) families.push(name)
    }
  }
  return families
}

/** Extract font family names from a Google Fonts URL embedded in HTML */
function parseGoogleFonts(html) {
  const families = []
  const re = /fonts\.googleapis\.com\/css[^"']*[?&]family=([^&"'\s]+)/gi
  let m
  while ((m = re.exec(html)) !== null) {
    for (const part of decodeURIComponent(m[1]).split('|')) {
      const name = part.split(':')[0].split('@')[0].replace(/\+/g, ' ').trim()
      if (name && !families.includes(name)) families.push(name)
    }
  }
  return families
}

/**
 * Try to find the font-family applied by a list of CSS selectors.
 * Returns the first non-generic family found.
 */
function fontForSelectors(css, selectors) {
  for (const sel of selectors) {
    // Escape special regex chars in selector string
    const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escaped + '\\s*(?:,\\s*[^{]+)?\\{([^}]+)\\}', 'gi')
    let m
    while ((m = re.exec(css)) !== null) {
      const fam = m[1].match(/font-family\s*:\s*(['"]?)([^;]+)\1/i)
      if (!fam) continue
      const first = fam[2].split(',')[0].trim().replace(/['"]/g, '')
      if (!GENERIC_FAMILIES.has(first.toLowerCase())) return first
    }
  }
  return null
}

/** Parse CSS custom properties on :root/html for colour keywords */
function parseCSSVariableColors(css) {
  const colors = {}
  const keywords = ['primary', 'secondary', 'accent', 'brand', 'highlight', 'cta', 'foreground', 'background', 'link']
  const rootRe = /(?::root|html)\s*\{([^}]+)\}/gi
  let rm
  while ((rm = rootRe.exec(css)) !== null) {
    const block = rm[1]
    const varRe = /--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/g
    let vm
    while ((vm = varRe.exec(block)) !== null) {
      const prop = vm[1].toLowerCase()
      const color = vm[2]
      for (const kw of keywords) {
        if (prop.includes(kw) && !colors[kw]) colors[kw] = color
      }
    }
  }
  return colors
}

/**
 * Find a background-color or color declaration for a given CSS selector.
 * Returns the first hex/rgb color found, or null.
 */
function colorForSelector(css, selector, property = 'background-color') {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped + '\\s*(?:,\\s*[^{]+)?\\{([^}]+)\\}', 'gi')
  let m
  while ((m = re.exec(css)) !== null) {
    const block = m[1]
    const colorRe = new RegExp(property.replace('-', '-?') + '\\s*:\\s*(#[0-9a-fA-F]{3,8}|rgba?\\([^)]+\\))', 'i')
    const cm = block.match(colorRe)
    if (cm) return cm[1]
  }
  return null
}

// ── main ─────────────────────────────────────────────────────────────────────

async function scrapeDesignTokens(targetUrl) {
  // Fetch homepage HTML
  const html = await fetchText(targetUrl, PAGE_TIMEOUT_MS)

  // meta[name=theme-color]
  const themeColorM =
    html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))["']/i) ||
    html.match(/<meta[^>]+content=["'](#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))["'][^>]+name=["']theme-color["']/i)
  const themeColor = themeColorM ? themeColorM[1] : null

  // ── collect CSS ──────────────────────────────────────────────────────────
  // 1. Inline <style> blocks
  let allCSS = ''
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let sm
  while ((sm = styleRe.exec(html)) !== null) allCSS += sm[1] + '\n'

  // 2. Linked stylesheets (fetch top N in parallel)
  const cssHrefs = []
  const linkRe = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi
  let lm
  while ((lm = linkRe.exec(html)) !== null) {
    try { cssHrefs.push(new URL(lm[1], targetUrl).href) } catch {}
  }

  const cssResults = await Promise.allSettled(
    cssHrefs.slice(0, MAX_CSS_FILES).map(u => fetchText(u, CSS_TIMEOUT_MS))
  )
  for (const r of cssResults) {
    if (r.status === 'fulfilled') allCSS += r.value + '\n'
  }

  // Trim to budget
  if (allCSS.length > MAX_CSS_CHARS) allCSS = allCSS.substring(0, MAX_CSS_CHARS)

  // ── fonts ────────────────────────────────────────────────────────────────
  const googleFonts = parseGoogleFonts(html)
  const fontFaceNames = parseFontFaces(allCSS)
  const allFonts = [...new Set([...fontFaceNames, ...googleFonts])]
    .filter(f => !GENERIC_FAMILIES.has(f.toLowerCase()))

  const headerFamily =
    fontForSelectors(allCSS, ['h1', 'h2', 'h3', '.heading', '.title', '[class*="heading"]']) ||
    allFonts[0] ||
    null

  const bodyFamily =
    fontForSelectors(allCSS, ['body', 'p', '.body', 'main', 'div']) ||
    allFonts[1] || allFonts[0] ||
    null

  // ── colours ──────────────────────────────────────────────────────────────
  const vars = parseCSSVariableColors(allCSS)

  const primary =
    vars.primary || vars.brand || themeColor ||
    colorForSelector(allCSS, 'button') ||
    colorForSelector(allCSS, '.btn') ||
    colorForSelector(allCSS, 'a', 'color') ||
    '#0066cc'

  const secondary =
    vars.secondary ||
    colorForSelector(allCSS, 'header') ||
    colorForSelector(allCSS, 'nav') ||
    '#f0f5fa'

  const accent =
    vars.accent || vars.highlight || vars.cta || primary

  const background =
    vars.background ||
    colorForSelector(allCSS, 'body') ||
    colorForSelector(allCSS, 'html') ||
    '#ffffff'

  const text =
    vars.foreground ||
    colorForSelector(allCSS, 'body', 'color') ||
    '#333333'

  const heading =
    colorForSelector(allCSS, 'h1', 'color') ||
    colorForSelector(allCSS, 'h2', 'color') ||
    text

  const palette = [...new Set([primary, secondary, accent, background, text, heading].filter(Boolean))].slice(0, 6)

  return { headerFamily, bodyFamily, colorScheme: { background, text, heading, primary, secondary, accent, palette } }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const target = process.argv[2]
if (!target) {
  console.error('Usage: node scrape-design.js <url>')
  process.exit(1)
}

scrapeDesignTokens(target)
  .then(({ headerFamily, bodyFamily, colorScheme }) => {
    const normFont = (name) => {
      if (!name) return null
      // Strip Typekit internal suffixes like "-w01-regular"
      if (/-w0[12]/i.test(name)) {
        const clean = name.split('-')[0].replace(/\d+$/, '').trim()
        return clean || name
      }
      return name
    }

    console.log('RESULT_SUMMARY')
    console.log('Header font:', normFont(headerFamily) ?? 'none')
    console.log('Body font:', normFont(bodyFamily) ?? 'none')
    console.log('Background:', colorScheme.background)
    console.log('Text:', colorScheme.text)
    console.log('Heading:', colorScheme.heading)
    console.log('Primary:', colorScheme.primary)
    console.log('Secondary:', colorScheme.secondary)
    console.log('Accent:', colorScheme.accent)
    console.log('Palette:', colorScheme.palette.join(', '))
    console.log('Logo: (resolved via API)')
  })
  .catch((err) => {
    console.error('Fatal:', err.message || String(err))
    process.exit(1)
  })
