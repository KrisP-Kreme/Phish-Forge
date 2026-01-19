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
import { buildScenarioSuggestion, updateScenarioMemory } from '@/lib/scenario-memory'
import { compactifyStyleProfile, buildStyleGuidance, type CompactStyleProfile } from '@/lib/style-profile'
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

// OPTIMIZATION: In-memory cache for scenario memory (in production, use Redis)
const scenarioMemoryCache = new Map<string, any>()

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

    // Extract and resolve partner domain via search
    let partnerDomain: string
    
    if (partner.url) {
      // Use provided URL - most reliable
      const parsedUrl = new URL(partner.url)
      partnerDomain = parsedUrl.hostname || partner.url
      console.log('[/api/email/generate] Using provided partner URL:', partnerDomain)
    } else {
      // Search for partner domain by name
      console.log('[/api/email/generate] Searching for partner domain:', partner.name)
      const partnerSearch = await searchDomain(partner.name)
      
      if (partnerSearch.found && partnerSearch.domain) {
        partnerDomain = partnerSearch.domain
        console.log('[/api/email/generate] ✓ Partner domain resolved to:', partnerDomain)
      } else {
        // Fallback: use partner name as best guess
        console.warn('[/api/email/generate] ⚠ Partner domain not found, using name as fallback:', partner.name)
        partnerDomain = partner.name.toLowerCase().replace(/\s+/g, '')
      }
    }

    // Validate that partnerDomain is not accidentally the target domain
    if (partnerDomain.includes(domain.split('.')[0])) {
      console.error('[/api/email/generate] ⚠ WARNING: Partner domain appears to be the target domain! This may indicate incorrect domain resolution.')
    }

    // Resolve target domain via search
    let resolvedDomain = domain
    console.log('[/api/email/generate] Resolving target domain:', domain)
    
    const targetSearch = await searchDomain(domain)
    resolvedDomain = targetSearch.domain || domain
    console.log('[/api/email/generate] ✓ Target domain resolved to:', resolvedDomain)

    // OPTIMIZATION: Scrape partner website with hard limits
    console.log('[/api/email/generate] Scraping partner website:', partnerDomain, '(FROM:', partner.name, ')')
    const scrapedData = await scrapeWebsite(partnerDomain)
    
    // Extract color palette from scraped data
    let palette = null
    if (scrapedData.success) {
      palette = await extractColorPalette(scrapedData.logo, scrapedData.colors?.primary)
      console.log('[/api/email/generate] Extracted color palette from partner:', palette)
    }

    // OPTIMIZATION: Build minimal design data context (~35 tokens instead of ~450)
    const targetDesignData: TargetWebsiteDesign = {
      domain: partnerDomain,
      colors: scrapedData.colors,
      fonts: scrapedData.fonts,
      logo: scrapedData.logo,
      favicon: scrapedData.favicon,
      palette: palette || undefined,
    }

    // OPTIMIZATION: Compact design digest for prompt (minimal tokens)
    const designDigest = {
      primary_color: palette?.dominant || scrapedData.colors?.primary || '#0066cc',
      secondary_color: palette?.secondary || scrapedData.colors?.secondary || '#0052a3',
      primary_font: scrapedData.fonts?.primary || 'Arial, sans-serif',
      logo_url: scrapedData.logo || `https://img.logo.dev/${partnerDomain}`,
    }

    // OPTIMIZATION: Replace full previousEmail with scenario suggestion
    let scenarioSuggestion = ''
    if (previousEmail) {
      console.log('[/api/email/generate] Building scenario suggestion instead of embedding full email')
      const memoryKey = `${sessionId}:${resolvedDomain}`
      let scenarioMemory = scenarioMemoryCache.get(memoryKey)
      scenarioSuggestion = buildScenarioSuggestion(scenarioMemory)
      console.log('[/api/email/generate] Scenario suggestion:', scenarioSuggestion)
    }

    // OPTIMIZATION: Build comprehensive design-focused user message with professional email standards
    // Extract target company name from domain for greeting
    const targetCompanyName = resolvedDomain
      .replace(/^www\./, '')
      .split('.')[0]
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    const userMessage = `Generate a CRYSTAL CLEAR phishing simulation email - simple enough for ANY employee to understand in 30 seconds:

CLARITY FIRST:
- Write like you're talking to a busy employee who doesn't have time for jargon
- First sentence must say WHY they should care
- Every paragraph should be understandable by someone with no technical knowledge
- Avoid jargon: no "facilitate", "leverage", "synergize", "operationalize", etc.
- Use simple words: "need", "want", "must", "check", "verify", "click here"
- SHORT paragraphs - max 3-4 lines each
- Active voice ("We need you to...") not passive ("Implementation of...")
- If you have to read it twice, it's not clear enough

BUSINESS RELATIONSHIP CONTEXT (MAKE IT RELEVANT):
- Sender Company: ${partner.name}
- Target Company: ${targetCompanyName}
- Relationship Type: ${partner.relationship || 'Business Partner'}
- Partner Type: ${partner.type || 'Service Provider'}

Why this matters: Reference their actual business together. Make it obvious why ${partner.name} would contact ${targetCompanyName}.

SENDER DETAILS:
- Company: ${partner.name}
- Domain: ${partnerDomain}
- To: ${targetCompanyName}

BRAND DESIGN ELEMENTS:
- Logo: ${designDigest.logo_url}
- Primary Color: ${designDigest.primary_color}
- Secondary Color: ${designDigest.secondary_color}

CRITICAL EMAIL STRUCTURE:

GREETING (SIMPLE):
- Format: "Hi ${targetCompanyName} team,"
- That's it. Direct and clear.

OPENING (SAY WHY THEY SHOULD READ THIS):
- One short sentence explaining the reason
- Example: "We noticed your account needs verification for our payment system to keep working."
- NOT: "Operational adjacency requires verification protocol implementation"

MAIN CONTENT (CRYSTAL CLEAR):
- Use very short paragraphs
- One idea per paragraph
- Explain the "why" in plain English
- Use concrete examples
- Examples (contextual to relationship):
  * If vendor: "Urgent: Vendor Portal Access Verification Required"
  * If partner: "Partnership Update: Account Verification Needed"
  * If service provider: "Action Required: Service Agreement Renewal"
- Size: 16-18px, bold, with 24px spacing above/below
- This answers visually: "What is this email about in context of OUR relationship?"

PARAGRAPH RHYTHM (CRITICAL):
- NO uniform paragraph lengths
- Pattern: Short (2-3 lines) → Medium (4-5 lines) → Short (2-3 lines)
- Vary block heights intentionally
- Creates pacing and scannable rhythm
- Emails are scanned, so rhythm is functional

TYPOGRAPHY:
- Body: 14-16px, line-height 1.6, color #333/#444
- Primary focus: 16-18px, bold
- Section labels: 13px, optional weight
- Footer: 12px, muted color #666666
- Use size/weight variation for hierarchy

SPACING:
- Between paragraphs: 16-20px
- Around primary focus: 24px above + below
- Between sections: 24-28px
- Before footer: 40px+ (clear break)

CTA CONTEXT (MUST BE RELATIONSHIP-SPECIFIC):
- Add ACTION LABEL before button specific to their relationship
CTA (CLEAR AND DIRECT):
- Action label: Simple and obvious, like "Next step:" or "Click below to verify:"
- Button text: Plain action verb (e.g., "Verify Now", "Confirm Account", "Click Here")
- NOT: "Facilitate expedited credential authentication"
- YES: "Verify Your Account"
- Make it obvious what will happen when they click
- Spacing: 20px between label and button

FOOTER (SIMPLE):
- Just company info, phone, email
- Don't over-explain
- Small text, light color

TONE & LANGUAGE:
- Professional but natural (like an email from a coworker)
- Urgent but not panicked
- Clear about what the person needs to do
- No corporate jargon
- If you hear yourself saying it sounds "corporate-y", simplify it
- Check: Would a high school graduate understand this?

PARAGRAPH STRUCTURE:
- Average paragraph: 2-4 sentences, max
- Short sentences are better than long ones
- One main idea per paragraph
- Connect ideas simply ("After you verify...", "Then we'll send...")
- Break up long lists into short points

OVERALL APPROACH:
This email should read like it came from a real person at ${partner.name} who needed to contact ${targetCompanyName} about something important.
- Natural language
- Clear purpose
- Easy to act on
- No mystery about what they should do

CLARITY CHECK:
Before finalizing - if ANY sentence takes more than 10 seconds to understand, rewrite it simpler.
Example: Instead of "Your authentication credentials require re-verification", say "We need you to confirm your password."

SCENARIO: Professional, urgent business communication between ${partner.name} and ${targetCompanyName}
TONE: Direct, clear, helpful
CTA: Obvious next step${scenarioSuggestion ? `\nVARIATION: ${scenarioSuggestion}` : ''}`

    console.log('[/api/email/generate] Generating email for:', {
      target: resolvedDomain,
      partner: partner.name,
      partnerDomain,
      userMessageLength: userMessage.length,
    })

    // OPTIMIZATION: Dynamic max_tokens calculation based on estimated output
    const estimatedOutputChars = 3000 // HTML email
    let groqResponse: string
    try {
      groqResponse = await callGroqWithRetry(
        EMAIL_GENERATION_MODEL,
        EMAIL_GENERATION_PROMPT,
        userMessage,
        1, // max 1 retry for speed
        estimatedOutputChars
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

    // OPTIMIZATION: Client-side JSON parsing and validation (moved from LLM)
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
          const fixedResponse = cleanedResponse
            .replace(/:\s*"([^"]*)\n([^"]*)"/, ': "$1 $2"')
            .replace(/,\s*\n\s*"/, ', "')
          
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

    // OPTIMIZATION: Update scenario memory for next variation
    if (previousEmail && parsedResponse.scenario) {
      const memoryKey = `${sessionId}:${resolvedDomain}`
      const currentMemory = scenarioMemoryCache.get(memoryKey)
      const updatedMemory = updateScenarioMemory(currentMemory, resolvedDomain, parsedResponse.scenario)
      scenarioMemoryCache.set(memoryKey, updatedMemory)
      console.log('[/api/email/generate] Updated scenario memory:', updatedMemory.scenariosUsed)
    }

    // Build response with minimal context
    const emailResponse = {
      subject: parsedResponse.subject || 'Urgent Action Required',
      from: parsedResponse.from || `noreply@${partnerDomain}`,
      to: parsedResponse.to || `employee@${resolvedDomain}`,
      partner_name: partner.name,
      partner_domain: partnerDomain,
      target_domain: resolvedDomain,
      html_body: parsedResponse.html_body || '',
      text_body: parsedResponse.text_body || '',
      cta_text: parsedResponse.cta_text,
      cta_url: parsedResponse.cta_url,
      urgency: parsedResponse.urgency || 'high',
      scenario: parsedResponse.scenario,
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
