import { NextRequest, NextResponse } from 'next/server'
import { callGroqWithRetry } from '@/lib/groq'
import { emailGenerationRateLimiter } from '@/lib/rate-limit'
import { logDomainSearch } from '@/lib/logging'
import {
  EMAIL_GENERATION_PROMPT,
  EMAIL_GENERATION_MODEL,
  EMAIL_GENERATION_VERSION,
} from '@/prompts/email-generation/email-generation.prompt'
import { scrapeWebsite } from '@/lib/website-scraper'
import { extractColorPalette } from '@/lib/color-palette'
import { searchDomain } from '@/lib/domain-resolver'
import type { AIDataSection, TargetWebsiteDesign } from '@/app/types'
import { z } from 'zod'

// Simple request validation
const RequestSchema = z.object({
  domain: z.string().min(1, 'Target domain is required'),
  partner: z.object({
    name: z.string().min(1, 'Partner name is required'),
    type: z.string().optional(),
    relationship: z.string().optional(),
    url: z.string().optional(),
  }),
  previousEmail: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const { domain, partner, previousEmail } = RequestSchema.parse(body)

    // Rate limiting check
    const sessionId = request.headers.get('x-session-id') || 'unknown'
    const rateLimitKey = `email-generation:${sessionId}`
    const limitStatus = emailGenerationRateLimiter(request, rateLimitKey)

    if (limitStatus.isLimited) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded: ${limitStatus.count}/${limitStatus.limit} email generations per session`,
          retryAfter: limitStatus.retryAfter,
          retryable: true,
        },
        { status: 429 }
      )
    }

    // Extract partner domain from URL if available
    const partnerDomain = partner.url
      ? new URL(partner.url).hostname
      : partner.name.toLowerCase().replace(/\s+/g, '')

    // Resolve target domain if it looks incomplete
    let resolvedDomain = domain
    console.log('[/api/email/generate] Resolving target domain:', domain)
    
    const hasValidFormat = domain.includes('.') || domain.startsWith('http')
    if (!hasValidFormat) {
      console.log('[/api/email/generate] Domain appears incomplete, searching...')
      const searchResult = await searchDomain(domain)
      if (searchResult.found && searchResult.domain) {
        resolvedDomain = searchResult.domain
        console.log('[/api/email/generate] ✓ Domain resolved to:', resolvedDomain)
      } else {
        console.warn('[/api/email/generate] Domain search inconclusive, using best guess:', searchResult.domain || domain)
        resolvedDomain = searchResult.domain || domain
      }
    } else {
      console.log('[/api/email/generate] Domain appears complete, skipping search:', domain)
    }

    // Scrape PARTNER company website for design information (who the email is FROM)
    console.log('[/api/email/generate] Scraping partner website:', partnerDomain)
    const scrapedData = await scrapeWebsite(partnerDomain)
    
    // Extract color palette from scraped data
    let palette = null
    if (scrapedData.success) {
      palette = await extractColorPalette(scrapedData.logo, scrapedData.colors?.primary)
      console.log('[/api/email/generate] Extracted color palette from partner:', palette)
    }

    // Build partner website design data for prompt
    const targetDesignData: TargetWebsiteDesign = {
      domain: partnerDomain,
      colors: scrapedData.colors,
      fonts: scrapedData.fonts,
      logo: scrapedData.logo,
      favicon: scrapedData.favicon,
      palette: palette || undefined,
    }

    // Build design data context for prompt
    const designContext = `
PARTNER/SENDER COMPANY DESIGN INFORMATION:
- Primary Color: ${targetDesignData.colors?.primary || 'Not detected (will use #0066cc)'}
- Secondary Color: ${targetDesignData.colors?.secondary || 'Not detected'}
- Primary Font: ${targetDesignData.fonts?.primary || 'System default (Arial, sans-serif)'}
- Secondary Font: ${targetDesignData.fonts?.secondary || 'Not detected'}
- Logo: ${targetDesignData.logo || 'Not found'}
- Favicon: ${targetDesignData.favicon || 'Not found'}

COLOR PALETTE FOR EMAIL:
- Dominant (Banner/Header): ${palette?.dominant || '#0066cc'}
- Secondary (Accents): ${palette?.secondary || '#0052a3'}
- Accent (CTA Button): ${palette?.accent || '#ff6b35'}
- Neutral (Background): ${palette?.neutral || '#f5f5f5'}
- Text: ${palette?.text || '#333333'}

FONTS DETECTED:
${targetDesignData.fonts?.primary ? `- Primary Font Family: ${targetDesignData.fonts.primary}` : '- Primary Font: Not detected (use sans-serif fallback)'}
${targetDesignData.fonts?.secondary ? `- Secondary Font Family: ${targetDesignData.fonts.secondary}` : ''}
`

    // Build user message with context
    const userMessage = `Generate a highly believable phishing simulation email for authorized security awareness training.

TARGET COMPANY (recipient): ${resolvedDomain}
SENDER/PARTNER COMPANY (who the email is FROM): ${partner.name}
Partner Domain: ${partnerDomain}
Partner Type: ${partner.type || 'Business Partner'}
Relationship: ${partner.relationship || 'External vendor/service provider'}

${designContext}

${previousEmail ? `Previously generated email (create a DIFFERENT variation with different scenario/urgency):\n${previousEmail}\n` : ''}

CRITICAL: The email MUST:
1. Use the PARTNER company's design (colors, fonts, logo) - THIS IS WHO THE EMAIL IS FROM
2. Apply the detected fonts in the email CSS: ${targetDesignData.fonts?.primary ? `primary font="${targetDesignData.fonts.primary}"` : 'no primary font detected'}${targetDesignData.fonts?.secondary ? `, secondary font="${targetDesignData.fonts.secondary}"` : ''}
3. Appear to come FROM the partner company (${partner.name})
4. Use partner company's domain and branding
5. Reference the target company (${resolvedDomain}) as the recipient/victim
6. Use partner logo: https://img.logo.dev/${partnerDomain}
7. Apply partner company colors and fonts for authenticity
8. Be highly believable and compelling
9. Include realistic business justification for contacting the target
10. Address the email TO the target company (${resolvedDomain})
11. Return ONLY valid JSON (no code fences, no markdown)

The email should look like a legitimate business communication FROM the partner TO the target company.`

    console.log('[/api/email/generate] Generating email for:', {
      target: resolvedDomain,
      partner: partner.name,
      partnerDomain,
    })

    let groqResponse: string
    try {
      groqResponse = await callGroqWithRetry(
        EMAIL_GENERATION_MODEL,
        EMAIL_GENERATION_PROMPT,
        userMessage,
        1 // max 1 retry for speed
      )
    } catch (groqError) {
      logDomainSearch({
        timestamp: new Date().toISOString(),
        domain: resolvedDomain,
        source: 'email_generation',
        success: false,
        errorType: 'groq_call_failed',
      })

      const errorMsg = groqError instanceof Error ? groqError.message : 'Unknown Groq error'
      console.error('[/api/email/generate] Groq error:', errorMsg)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate email with AI',
          details: errorMsg,
          retryable: true,
        },
        { status: 500 }
      )
    }

    // Parse JSON response
    let parsedResponse: any
    try {
      // Clean up response - remove markdown code fences if present
      let cleanedResponse = groqResponse
        .replace(/^```json\n?/, '')
        .replace(/^```\n?/, '')
        .replace(/\n?```$/, '')
        .trim()

      // Try to find JSON object in response
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0]
      }

      try {
        parsedResponse = JSON.parse(cleanedResponse)
      } catch (parseError) {
        console.error('[/api/email/generate] First JSON parse attempt failed')
        
        // Try to fix common JSON issues
        try {
          // Remove literal newlines within string values but preserve structure
          const fixedResponse = cleanedResponse
            .replace(/:\s*"([^"]*)\n([^"]*)"/, ': "$1 $2"') // Replace newlines in strings with space
            .replace(/,\s*\n\s*"/, ', "') // Fix newlines after commas
          
          parsedResponse = JSON.parse(fixedResponse)
          console.log('[/api/email/generate] Successfully recovered from JSON via newline removal')
        } catch (secondError) {
          console.error('[/api/email/generate] Second JSON parse attempt failed')
          
          // Last attempt: extract key fields manually using regex
          try {
            const subjectMatch = cleanedResponse.match(/"subject"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/)?.[1]
            const fromMatch = cleanedResponse.match(/"from"\s*:\s*"([^"]*?)(?:\s*-|")/)?.[1]
            const htmlMatch = cleanedResponse.match(/"html_body"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/)?.[1]
            
            if (subjectMatch && fromMatch && htmlMatch) {
              parsedResponse = {
                subject: subjectMatch.replace(/\\"/g, '"'),
                from: fromMatch.replace(/\\"/g, '"'),
                html_body: htmlMatch.replace(/\\"/g, '"'),
                text_body: cleanedResponse.match(/"text_body"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/)?.[1] || '',
              }
              console.log('[/api/email/generate] Recovered using regex fallback')
            } else {
              throw new Error('Could not extract required fields')
            }
          } catch (regexError) {
            console.error('[/api/email/generate] All parse attempts failed')
            console.error('[/api/email/generate] Cleaned response preview:', cleanedResponse.substring(0, 500))
            throw new Error('Invalid JSON in AI response')
          }
        }
      }

      console.log('[/api/email/generate] Successfully parsed email response')
      console.log('[/api/email/generate] Response fields:', Object.keys(parsedResponse))
    } catch (parseError) {
      logDomainSearch({
        timestamp: new Date().toISOString(),
        domain: resolvedDomain,
        source: 'email_generation',
        success: false,
        errorType: 'json_parse_failed',
      })

      const errorMsg = parseError instanceof Error ? parseError.message : 'Parse error'
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse AI response as JSON',
          details: errorMsg,
          retryable: true,
        },
        { status: 422 }
      )
    }

    // Build response with partner context and design data
    const emailResponse = {
      subject: parsedResponse.subject || 'Urgent Action Required',
      from: parsedResponse.from || `noreply@${partnerDomain}`,
      from_name: parsedResponse.from_name || partner.name,
      to: parsedResponse.to || `employee@${resolvedDomain}`,
      partner_name: partner.name,
      partner_domain: partnerDomain,
      target_domain: resolvedDomain,
      target_design: targetDesignData,
      html_body: parsedResponse.html_body || '',
      text_body: parsedResponse.text_body || '',
      cta_text: parsedResponse.cta_text,
      cta_url: parsedResponse.cta_url,
      urgency: parsedResponse.urgency || 'high',
      scenario: parsedResponse.scenario,
      believability_factors: parsedResponse.believability_factors || [],
      design_integration: parsedResponse.design_integration,
      generated_at: new Date().toISOString(),
      version: EMAIL_GENERATION_VERSION,
    }

    console.log('[/api/email/generate] Email response prepared:', {
      subject: emailResponse.subject,
      from: emailResponse.from,
      htmlLength: emailResponse.html_body.length,
      textLength: emailResponse.text_body.length,
    })

    logDomainSearch({
      timestamp: new Date().toISOString(),
      domain: resolvedDomain,
      source: 'email_generation',
      success: true,
    })

    return NextResponse.json({
      success: true,
      data: emailResponse,
    })
  } catch (error) {
    console.error('[/api/email/generate] Unexpected error:', error)

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
