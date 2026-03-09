import { NextRequest, NextResponse } from 'next/server'
import { callGroqWithRetry } from '@/lib/groq'
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
            reject(new Error(`Script exited with code ${code}: ${stderr}`))
          }
        })
        child.on('error', reject)
      })

      // Parse the output - the script logs summary at the end
      const lines = stdout.split('\n')
      const resultLine = lines.find((line: string) => line.includes('Header font') || line.includes('Body font'))
      if (resultLine) {
        // Extract fonts from the summary
        const headerMatch = stdout.match(/Header font\s*:\s*([^\n]+)/)
        const bodyMatch = stdout.match(/Body font\s*:\s*([^\n]+)/)
        const backgroundMatch = stdout.match(/Background\s*:\s*([^\n]+)/)
        const textMatch = stdout.match(/Text\s*:\s*([^\n]+)/)
        const primaryMatch = stdout.match(/Primary\s*:\s*([^\n]+)/)
        const secondaryMatch = stdout.match(/Secondary\s*:\s*([^\n]+)/)
        const accentMatch = stdout.match(/Accent\s*:\s*([^\n]+)/)

        advancedDesign = {
          headerFont: headerMatch ? headerMatch[1].trim() : null,
          bodyFont: bodyMatch ? bodyMatch[1].trim() : null,
          background: backgroundMatch ? backgroundMatch[1].trim() : null,
          text: textMatch ? textMatch[1].trim() : null,
          primary: primaryMatch ? primaryMatch[1].trim() : null,
          secondary: secondaryMatch ? secondaryMatch[1].trim() : null,
          accent: accentMatch ? accentMatch[1].trim() : null,
        }
        console.log('[/api/email/generate] Advanced design data:', advancedDesign)
      }
    } catch (designError) {
      console.warn('[/api/email/generate] Advanced design scraping failed, using basic data:', designError)
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

      const cleanedOsint = osintResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      osintAnalysis = JSON.parse(cleanedOsint)
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

    // Format design data clearly for the AI
    const designSection = `USE THIS FOR FONT AND COLOUR SCHEME:
Header font : ${advancedDesign?.headerFont || scrapedData.fonts?.primary || 'Arial, sans-serif'}
Body font : ${advancedDesign?.bodyFont || scrapedData.fonts?.primary || 'Arial, sans-serif'}
Background : ${advancedDesign?.background || scrapedData.colors?.primary || '#ffffff'}
Text : ${advancedDesign?.text || scrapedData.colors?.secondary || '#333333'}
Heading : ${advancedDesign?.heading || '#000000'}
Primary : ${advancedDesign?.primary || palette?.dominant || scrapedData.colors?.primary || '#0066cc'}
Secondary : ${advancedDesign?.secondary || palette?.secondary || scrapedData.colors?.secondary || '#f0f5fa'}
Accent : ${advancedDesign?.accent || palette?.accent || scrapedData.colors?.primary || '#0066cc'}
Palette : ${advancedDesign?.palette || `${advancedDesign?.primary || '#0066cc'}, ${advancedDesign?.secondary || '#f0f5fa'}`}

Logo URL: https://img.logo.dev/${partnerDomain}?token=pk_LMYBshZrSNWjexfaZvNkAQ`

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

    const userMessage = `${designSection}

${organizationSection}

Generate a professional phishing simulation email now. Use ONLY the complete HTML code starting with <!DOCTYPE html> and ending with </html>. Do NOT output JSON or any wrapper - only the raw HTML.`

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
