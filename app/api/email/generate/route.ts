import { NextRequest, NextResponse } from 'next/server'
import { callGroqWithRetry, cleanJsonResponse } from '@/lib/groq'
import { emailGenerationRateLimiter } from '@/lib/rate-limit'
import { logDomainSearch } from '@/lib/logging'
import {
  EMAIL_GENERATION_PROMPT,
  EMAIL_GENERATION_MODEL,
  EMAIL_GENERATION_VERSION,
} from '@/prompts/email-generation/email-generation.prompt'
import { OSINT_DOMAIN_ANALYSIS_PROMPT } from '@/prompts/osint-domain-analysis/osint-domain-analysis.prompt'
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

    // Run advanced design scraping using the script
    console.log('[/api/email/generate] Running advanced design scraping on partner domain:', partnerDomain)
    let advancedDesign: any = null
    try {
      const { spawn } = require('child_process')
      const scriptPath = require('path').join(process.cwd(), 'scripts', 'scrape-design.js')
      
      const child = spawn('node', [scriptPath, `https://${partnerDomain}`], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env, HEADLESS_MODE: 'true' }, // Suppress browser opening
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      await new Promise((resolve, reject) => {
        child.on('close', (code: number) => {
          if (code === 0) {
            resolve(null)
          } else {
            console.error('[/api/email/generate] Design script stderr:', stderr)
            reject(new Error(`Script exited with code ${code}: ${stderr}`))
          }
        })
        child.on('error', reject)
      })

      // Parse the output - the script logs clean summary data
      console.log('[/api/email/generate] Script stdout length:', stdout.length)
      const lines = stdout.split('\n')
      const resultLineIdx = lines.findIndex((line: string) => line.includes('RESULT_SUMMARY'))
      
      if (resultLineIdx >= 0) {
        console.log('[/api/email/generate] Found RESULT_SUMMARY at line', resultLineIdx)
        // Extract fonts from the summary using simpler patterns
        const headerMatch = stdout.match(/^Header font:\s*(.+?)$/m)
        const bodyMatch = stdout.match(/^Body font:\s*(.+?)$/m)
        const backgroundMatch = stdout.match(/^Background:\s*(.+?)$/m)
        const textMatch = stdout.match(/^Text:\s*(.+?)$/m)
        const headingMatch = stdout.match(/^Heading:\s*(.+?)$/m)
        const primaryMatch = stdout.match(/^Primary:\s*(.+?)$/m)
        const secondaryMatch = stdout.match(/^Secondary:\s*(.+?)$/m)
        const accentMatch = stdout.match(/^Accent:\s*(.+?)$/m)
        const paletteMatch = stdout.match(/^Palette:\s*(.+?)$/m)

        // Filter out "none" values
        advancedDesign = {
          headerFont: headerMatch ? headerMatch[1].trim() : null,
          bodyFont: bodyMatch ? bodyMatch[1].trim() : null,
          background: backgroundMatch ? backgroundMatch[1].trim() : null,
          text: textMatch ? textMatch[1].trim() : null,
          heading: headingMatch ? headingMatch[1].trim() : null,
          primary: primaryMatch ? primaryMatch[1].trim() : null,
          secondary: secondaryMatch ? secondaryMatch[1].trim() : null,
          accent: accentMatch ? accentMatch[1].trim() : null,
          palette: paletteMatch ? paletteMatch[1].trim() : null,
        }
        
        // Remove "none" values and only keep actual values
        Object.keys(advancedDesign).forEach(key => {
          if (advancedDesign[key] === 'none' || advancedDesign[key] === '') {
            advancedDesign[key] = null
          }
        })
        
        console.log('[/api/email/generate] Advanced design data extracted:', advancedDesign)
      } else {
        console.warn('[/api/email/generate] RESULT_SUMMARY not found in script output')
        console.log('[/api/email/generate] Script stdout length:', stdout.length, 'first 500 chars:', stdout.substring(0, 500))
      }
    } catch (designError) {
      console.warn('[/api/email/generate] Advanced design scraping failed, using basic data:', designError)
      console.error('[/api/email/generate] Design error details:', designError)
    }

    // Run OSINT analysis on the partner domain
    console.log('[/api/email/generate] Running OSINT analysis on partner domain:', partnerDomain)
    let osintAnalysis: any = null
    try {
      const osintUserMessage = `Analyze the following domain based on the provided website content.

Domain: ${partnerDomain}

Website Content (scraped from website):
${scrapedData.title || 'No title'}
${scrapedData.description || 'No description'}
${scrapedData.colors ? `Colors: ${JSON.stringify(scrapedData.colors)}` : ''}
${scrapedData.fonts ? `Fonts: ${JSON.stringify(scrapedData.fonts)}` : ''}

Provide a comprehensive OSINT analysis following the schema exactly.`

      const osintResponse = await callGroqWithRetry(
        'llama-3.3-70b-versatile',
        OSINT_DOMAIN_ANALYSIS_PROMPT,
        osintUserMessage,
        1, // 1 retry
        2048, // smaller for analysis
        { temperature: 0.2 }
      )

      osintAnalysis = JSON.parse(cleanJsonResponse(osintResponse))
      console.log('[/api/email/generate] OSINT analysis completed')
    } catch (osintError) {
      console.warn('[/api/email/generate] OSINT analysis failed, continuing without it:', osintError)
    }

    // OPTIMIZATION: Build minimal design data context (~35 tokens instead of ~450)
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

    // Format design data clearly as explicit values the AI must use
    const designData = {
      headerFont: advancedDesign?.headerFont || scrapedData.fonts?.primary || 'Arial, sans-serif',
      bodyFont: advancedDesign?.bodyFont || scrapedData.fonts?.primary || 'Arial, sans-serif',
      background: advancedDesign?.background || scrapedData.colors?.primary || '#ffffff',
      text: advancedDesign?.text || scrapedData.colors?.secondary || '#333333',
      heading: advancedDesign?.heading || '#000000',
      primary: advancedDesign?.primary || palette?.dominant || scrapedData.colors?.primary || '#0066cc',
      secondary: advancedDesign?.secondary || palette?.secondary || scrapedData.colors?.secondary || '#f0f5fa',
      accent: advancedDesign?.accent || palette?.accent || scrapedData.colors?.primary || '#0066cc',
      palette: advancedDesign?.palette || `${advancedDesign?.primary || '#0066cc'}, ${advancedDesign?.secondary || '#f0f5fa'}`,
      logoUrl: `https://img.logo.dev/${partnerDomain}?token=pk_LMYBshZrSNWjexfaZvNkAQ`
    }

    const designSection = `DESIGN SPECIFICATIONS (USE THESE EXACT VALUES):
background: ${designData.background}
text: ${designData.text}
heading: ${designData.heading}
primary: ${designData.primary}
secondary: ${designData.secondary}
accent: ${designData.accent}
header_font: ${designData.headerFont}
body_font: ${designData.bodyFont}
logo_url: ${designData.logoUrl}

Replace [BACKGROUND] with: ${designData.background}
Replace [TEXT] with: ${designData.text}
Replace [HEADING] with: ${designData.heading}
Replace [PRIMARY] with: ${designData.primary}
Replace [SECONDARY] with: ${designData.secondary}
Replace [ACCENT] with: ${designData.accent}
Replace [HEADER_FONT] with: ${designData.headerFont}
Replace [BODY_FONT] with: ${designData.bodyFont}
Replace logo URL in <img src="..."> with: ${designData.logoUrl}`

    console.log('[/api/email/generate] Design data being sent to AI:')
    console.log('[/api/email/generate] designData:', JSON.stringify(designData, null, 2))
    console.log('[/api/email/generate] advancedDesign source:', advancedDesign)
    console.log('[/api/email/generate] scrapedData source:', { fonts: scrapedData.fonts, colors: scrapedData.colors })
    console.log('[/api/email/generate] palette source:', palette)

    // Build the user message with structured design data and OSINT (matching successful format)
    // Create a well-formatted organization profile from OSINT data
    const organizationSection = osintAnalysis 
      ? `
domain: ${partnerDomain}
organization_name: ${osintAnalysis.organization_name || partner.name}
organization_type: ${osintAnalysis.organization_type || 'Unknown'}

business_activities:
${osintAnalysis.business_activities?.map((activity: any) => `  - ${activity.activity}: ${activity.description}`).join('\n') || 'See OSINT analysis below'}

monetization:
  does_bill_for_services: ${osintAnalysis.monetization?.does_bill_for_services ?? true}
  billing_model: ${osintAnalysis.monetization?.billing_model || 'Standard business model'}

target_customers:
${osintAnalysis.target_customers?.map((customer: any) => `  - ${customer.customer_type}`).join('\n') || 'Multiple customer segments'}

industries:
${osintAnalysis.industries?.map((ind: any) => `  - ${ind.industry}`).join('\n') || 'See primary business'}

geographic_focus:
${osintAnalysis.geographic_focus?.map((geo: any) => `  - ${geo.region}`).join('\n') || 'Global'}

key_public_entities:
${osintAnalysis.key_public_entities?.map((entity: any) => `  - ${entity.name}: ${entity.relationship}`).join('\n') || 'N/A'}
`
      : `domain: ${partnerDomain}
organization_name: ${partner.name}
organization_type: Technology/Service Provider`;

    const userMessage = `You will now generate a phishing simulation email in HTML format.

${designSection}

ORGANIZATION TO IMPERSONATE:
${organizationSection}

INSTRUCTIONS:
1. Start with <!DOCTYPE html> and end with </html>
2. Use ONLY inline CSS - no external stylesheets
3. Apply the design specifications EXACTLY as listed above
4. Make the email about the organization's business model and services
5. Make it urgent - requiring action NOW
6. Include a single CTA button using the Primary color
7. Include organization logo from the logo URL
8. Make text readable with proper contrast
9. Include footer with contact links from the organization's website
10. Include comment: <!-- This email is for educational and simulation purposes only. -->

OUTPUT ONLY THE HTML CODE - nothing else.`

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

    // OPTIMIZATION: Client-side HTML parsing and validation
    let parsedResponse: any
    try {
      // Clean up response - remove markdown code fences if present
      let htmlResponse = groqResponse
        .replace(/^```html\n?/, '')
        .replace(/^```(?:javascript|jsx|typescript|tsx)?\n?/, '')
        .replace(/\n?```$/, '')
        .trim()

      // Extract subject from HTML title or h1
      let subject = 'Important Security Update Required'
      const titleMatch = htmlResponse.match(/<title[^>]*>([^<]+)<\/title>/i)
      const h1Match = htmlResponse.match(/<h1[^>]*>([^<]+)<\/h1>/i)
      if (titleMatch) {
        subject = titleMatch[1].trim()
      } else if (h1Match) {
        subject = h1Match[1].trim()
      }

      // Extract text version from HTML by removing tags
      const textBody = htmlResponse
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 500)

      // Build the JSON response for the client
      parsedResponse = {
        subject: subject,
        from: `noreply@${partnerDomain.replace(/^www\./, '')}`,
        html_body: htmlResponse,
        text_body: textBody,
      }

      console.log('[/api/email/generate] Successfully parsed HTML email response')
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
