export interface ScrapedPage {
  url: string;
  path: string;
  content: string;
  scrapedAt: string;
}

export interface ScrapedContent {
  domain: string;
  pages: ScrapedPage[];
  combinedText: string;
  totalCharacters: number;
}

// Cache with 1-hour TTL
const scrapeCache = new Map<string, { content: ScrapedContent; expiresAt: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const MAX_COMBINED_CHARS = 15000;


function extractTextFromHTML(html: string): string {
  try {
    let text = html;

    // Remove script and style content
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Remove meta tags and other metadata
    text = text.replace(/<meta[^>]*>/gi, '');
    text = text.replace(/<link[^>]*>/gi, '');
    text = text.replace(/<noscript[^>]*>.*?<\/noscript>/gi, '');

    // Remove navigation and header elements (using tag-based approach)
    text = text.replace(/<(nav|header|footer|script|style)[^>]*>.*?<\/\1>/gi, '');
    text = text.replace(/class\s*=\s*["']([^"']*sidebar[^"']*|[^"']*navigation[^"']*)['"'][^>]*>.*?<\/[a-z]+>/gi, '');

    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&[a-z]+;/gi, ' ');

    // Clean up whitespace
    text = text
      .replace(/\n\n+/g, '\n\n')      // Multiple newlines to double
      .replace(/\t+/g, ' ')            // Tabs to spaces
      .replace(/  +/g, ' ')            // Multiple spaces to single
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .join('\n');

    return text.trim();
  } catch (error) {
    console.error('[Scraper] Error parsing HTML:', error);
    return '';
  }
}

/**
 * Fetch and extract content from a single page
 */
async function fetchPage(domain: string, path: string, timeout: number = 5000): Promise<ScrapedPage | null> {
  try {
    const url = `https://${domain}${path}`;
    
    console.log(`[Scraper] Fetching ${path}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log(`[Scraper] ${path} returned ${response.status}`);
        return null;
      }

      const html = await response.text();
      const content = extractTextFromHTML(html);

      if (content.length < 50) {
        console.log(`[Scraper] ${path} yielded minimal content (${content.length} chars)`);
        return null;
      }

      console.log(`[Scraper] ✓ ${path} (${content.length} chars)`);
      
      return {
        url,
        path,
        content,
        scrapedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.log(`[Scraper] Timeout fetching ${path} (${timeout}ms)`);
      } else {
        console.log(`[Scraper] Error fetching ${path}: ${error.message}`);
      }
      return null;
    }
  } catch (error) {
    console.error(`[Scraper] Unexpected error on ${path}:`, error);
    return null;
  }
}

/**
 * Main scraper function that fetches multiple key pages and combines content
 */
export async function scrapeWebsiteContent(domain: string): Promise<ScrapedContent | null> {
  try {
    // Check cache first
    const cached = scrapeCache.get(domain);
    if (cached && Date.now() < cached.expiresAt) {
      console.log('[Scraper] Cache hit for', domain);
      return cached.content;
    }

    console.log(`[Scraper] Starting scrape for ${domain}`);

    // Pages to scrape, in priority order
    const pagesToScrape = [
      '/',              // Homepage
      '/about',         // About page
      '/partners',      // Partners page
      '/integrations',  // Integrations page
      '/technology',    // Technology page
      '/privacy',       // Privacy policy
      '/terms',         // Terms of service
    ];

    const scrapedPages: ScrapedPage[] = [];
    let combinedText = '';

    // Fetch all pages in parallel with error handling
    const fetchPromises = pagesToScrape.map(path => fetchPage(domain, path, 5000));
    const results = await Promise.all(fetchPromises);

    // Collect successful pages and combine text
    for (const result of results) {
      if (result) {
        scrapedPages.push(result);
        
        // Add page marker to combined text
        const pageMarker = `\n\n[SOURCE: ${result.path}]\n`;
        if ((combinedText + pageMarker + result.content).length <= MAX_COMBINED_CHARS) {
          combinedText += pageMarker + result.content;
        } else {
          // Stop adding if we're approaching the limit
          const remaining = MAX_COMBINED_CHARS - combinedText.length;
          if (remaining > 500) {
            combinedText += pageMarker + result.content.substring(0, remaining - pageMarker.length);
          }
          break;
        }
      }
    }

    // Ensure we got meaningful content
    if (scrapedPages.length === 0) {
      console.error('[Scraper] No pages successfully scraped');
      return null;
    }

    if (combinedText.length < 100) {
      console.error('[Scraper] Combined content too short:', combinedText.length, 'chars');
      return null;
    }

    const result: ScrapedContent = {
      domain,
      pages: scrapedPages,
      combinedText: combinedText.trim(),
      totalCharacters: combinedText.length,
    };

    // Cache the result
    scrapeCache.set(domain, {
      content: result,
      expiresAt: Date.now() + CACHE_TTL,
    });

    console.log(`[Scraper] ✓ Scrape complete: ${scrapedPages.length} pages, ${combinedText.length} chars`);
    return result;
  } catch (error) {
    console.error('[Scraper] Fatal error:', error);
    return null;
  }
}
