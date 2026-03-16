import { NextRequest, NextResponse } from 'next/server'
import { callGroqWithRetry, cleanJsonResponse } from '@/lib/groq'
import { domainAnalysisRateLimiter } from '@/lib/rate-limit'
import { logDomainSearch } from '@/lib/logging'
import { OSINTDomainAnalysisResponseSchema } from '@/prompts/osint-domain-analysis/osint-domain-analysis.schema'
import {
  OSINT_DOMAIN_ANALYSIS_PROMPT,
  OSINT_DOMAIN_ANALYSIS_MODEL,
} from '@/prompts/osint-domain-analysis/osint-domain-analysis.prompt'
import { scrapeWebsiteContent } from '@/lib/scraper'
import { z } from 'zod'

// Request validation
const RequestSchema = z.object({
  domain: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const { domain } = RequestSchema.parse(body)

    // Rate limiting check
    const sessionId = request.headers.get('x-session-id') || 'unknown'
    const rateLimitKey = `domain-analysis:${sessionId}`
    const limitStatus = domainAnalysisRateLimiter(request, rateLimitKey)

    if (limitStatus.isLimited) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded: ${limitStatus.count}/${limitStatus.limit} domain analyses per session`,
          retryAfter: limitStatus.retryAfter,
          retryable: true,
        },
        { status: 429 }
      )
    }

    // Scrape website content for analysis
    console.log('[/api/domain/analysis] Scraping website content for:', domain)
    const scrapedContent = await scrapeWebsiteContent(domain)

    if (!scrapedContent) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to scrape website content',
          details: 'No content could be extracted',
          retryable: true,
        },
        { status: 500 }
      )
    }

    console.log('[/api/domain/analysis] Scraping complete:', scrapedContent.pages.length, 'pages,', scrapedContent.totalCharacters, 'chars')

    // Build user message with scraped content
    const userMessage = `Analyze the following domain based on the provided website content.

Domain: ${domain}

Website Content (scraped from ${scrapedContent.pages.length} pages):
${scrapedContent.combinedText}

Provide a comprehensive OSINT analysis following the schema exactly.`

    let groqResponse: string
    try {
      console.log('[/api/domain/analysis] Calling Groq with model:', OSINT_DOMAIN_ANALYSIS_MODEL)
      groqResponse = await callGroqWithRetry(
        OSINT_DOMAIN_ANALYSIS_MODEL,
        OSINT_DOMAIN_ANALYSIS_PROMPT,
        userMessage,
        2, // retries
        4096, // max tokens
        {
          temperature: 0.2, // Lower temperature for factual analysis
          max_tokens: 4096,
        }
      )
      console.log('[/api/domain/analysis] Groq response received, length:', groqResponse.length)
    } catch (groqError) {
      logDomainSearch({
        timestamp: new Date().toISOString(),
        domain,
        source: 'domain_analysis',
        success: false,
        errorType: 'groq_call_failed',
      })

      const errorMsg = groqError instanceof Error ? groqError.message : 'Unknown Groq error'
      console.error('[/api/domain/analysis] Groq error:', errorMsg)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to analyze domain with AI',
          details: errorMsg,
          retryable: true,
        },
        { status: 500 }
      )
    }

    // Parse JSON response
    let parsedResponse: any
    try {
      parsedResponse = JSON.parse(cleanJsonResponse(groqResponse))
    } catch (parseError) {
      logDomainSearch({
        timestamp: new Date().toISOString(),
        domain,
        source: 'domain_analysis',
        success: false,
        errorType: 'json_parse_failed',
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse AI response as JSON',
          details: 'Response was not valid JSON',
          retryable: true,
        },
        { status: 422 }
      )
    }

    // Validate against schema
    let validatedResponse: any
    try {
      validatedResponse = OSINTDomainAnalysisResponseSchema.parse(parsedResponse)
    } catch (validationError) {
      console.error('[/api/domain/analysis] Schema validation failed:')
      if (validationError instanceof z.ZodError) {
        validationError.errors.forEach((err, idx) => {
          console.error(`  [${idx}] Path: ${err.path.join('.')}, Code: ${err.code}, Message: ${err.message}`)
        })
      }

      logDomainSearch({
        timestamp: new Date().toISOString(),
        domain,
        source: 'domain_analysis',
        success: false,
        errorType: 'schema_validation_failed',
      })

      return NextResponse.json(
        {
          success: false,
          error: 'AI response did not match expected schema',
          details: validationError instanceof z.ZodError ? validationError.errors : validationError,
          retryable: true,
        },
        { status: 422 }
      )
    }

    logDomainSearch({
      timestamp: new Date().toISOString(),
      domain,
      source: 'domain_analysis',
      success: true,
    })

    return NextResponse.json({
      success: true,
      data: validatedResponse,
    })
  } catch (error) {
    console.error('[/api/domain/analysis] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}