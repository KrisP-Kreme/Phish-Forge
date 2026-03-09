import { NextRequest, NextResponse } from 'next/server'
import { callGroqWithRetry } from '@/lib/groq'
import { partnerDiscoveryRateLimiter } from '@/lib/rate-limit'
import { logDomainSearch } from '@/lib/logging'
import { PartnerDiscoveryResponseSchema } from '@/prompts/partner-discovery/partner-discovery.v1.schema'
import {
  PARTNER_DISCOVERY_PROMPT,
} from '@/prompts/partner-discovery/partner-discovery.v1.prompt'
import { AssociatedBusinessesResponseSchema } from '@/prompts/associated-businesses/associated-businesses.schema'
import {
  ASSOCIATED_BUSINESSES_PROMPT,
} from '@/prompts/associated-businesses/associated-businesses.prompt'
import { scrapeWebsiteContent } from '@/lib/scraper'
import type { DNSDataSection, PartnerCardViewProps, DNSResult } from '@/app/types'
import { z } from 'zod'

// Request validation
const RequestSchema = z.object({
  domain: z.string().min(1),
  dnsData: z.record(z.any()).optional(),
})

function structureDNSData(dnsResult: DNSResult | undefined): DNSDataSection {
  return {
    aRecords: Array.isArray(dnsResult?.A) ? dnsResult.A : [],
    mxRecords: Array.isArray(dnsResult?.MX)
      ? dnsResult.MX.map((mx: any) => ({
          priority: mx.priority || 0,
          value: typeof mx === 'string' ? mx : mx.value || '',
        }))
      : [],
    nsRecords: Array.isArray(dnsResult?.NS) ? dnsResult.NS : [],
    txtRecords: Array.isArray(dnsResult?.TXT) ? dnsResult.TXT : [],
    timestamp: new Date().toISOString(),
  }
}

function formatDNSDataForAnalysis(dns: DNSDataSection): string {
  let formatted = '';

  if (dns.aRecords && dns.aRecords.length > 0) {
    formatted += `\n📍 A RECORDS (IPv4 Hosting Providers):\n`;
    dns.aRecords.forEach(ip => {
      formatted += `  • ${ip}\n`;
    });
  }

  if (dns.mxRecords && dns.mxRecords.length > 0) {
    formatted += `\n📧 MX RECORDS (Email Infrastructure):\n`;
    dns.mxRecords.forEach(mx => {
      formatted += `  • Priority ${mx.priority}: ${mx.value} (Email service provider)\n`;
    });
  }

  if (dns.nsRecords && dns.nsRecords.length > 0) {
    formatted += `\n🏢 NS RECORDS (Domain Name Servers / Registrar Infrastructure):\n`;
    dns.nsRecords.forEach(ns => {
      formatted += `  • ${ns}\n`;
    });
  }

  if (dns.txtRecords && dns.txtRecords.length > 0) {
    formatted += `\n📝 TXT RECORDS (Email Security & Domain Verification):\n`;
    dns.txtRecords.slice(0, 5).forEach(txt => {
      const preview = txt.substring(0, 80) + (txt.length > 80 ? '...' : '');
      formatted += `  • ${preview}\n`;
    });
  }

  return formatted;
}

// Generic services that should NEVER appear in associated businesses results
const GENERIC_SERVICE_BLOCKLIST = new Set([
  // Social Media
  'facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok',
  'pinterest', 'whatsapp', 'snapchat', 'reddit',
  
  // Google Services
  'google', 'google analytics', 'google maps', 'google ads', 'google fonts',
  'google tag manager', 'gmail', 'recaptcha', 'google workspace',
  
  // Generic Tech/CMS
  'wordpress', 'wix', 'squarespace', 'godaddy', 'cloudflare', 'aws',
  'amazon web services', 'azure', 'microsoft azure', 'digitalocean',
  
  // Marketing Tools
  'mailchimp', 'constant contact', 'sendinblue', 'mailgun',
  
  // Analytics
  'hotjar', 'mixpanel', 'heap', 'segment', 'amplitude',
  
  // Payment/Cards
  'visa', 'mastercard', 'amex', 'american express', 'paypal',
  
  // Cookie/Privacy
  'onetrust', 'cookiebot', 'osano',
  
  // Hosting
  'bluehost', 'hostgator', 'siteground', 'dreamhost',
  
  // CDNs
  'fastly', 'akamai', 'cloudfront',
]);

function isGenericService(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  
  // Check exact match
  if (GENERIC_SERVICE_BLOCKLIST.has(normalized)) {
    return true;
  }
  
  // Check if it contains any blocklisted term
  for (const blocked of GENERIC_SERVICE_BLOCKLIST) {
    if (normalized.includes(blocked)) {
      return true;
    }
  }
  
  return false;
}

function filterAssociatedBusinesses(businesses: any[]): any[] {
  return businesses.filter(business => {
    // Filter out generic services
    if (isGenericService(business.name)) {
      console.log('[Associated Businesses] Removing generic service:', business.name);
      return false;
    }
    
    // Filter out low confidence
    if (business.confidence < 0.65) {
      console.log('[Associated Businesses] Removing low confidence:', business.name, business.confidence);
      return false;
    }
    
    return true;
  });
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const { domain, dnsData } = RequestSchema.parse(body)

    const MODEL = 'llama-3.3-70b-versatile'
    console.log('[/api/partners] Request received:', { domain, modelToUse: MODEL })

    // Rate limiting check
    const rateLimitKey = `partner-discovery:${domain}`
    const limitStatus = partnerDiscoveryRateLimiter(request, rateLimitKey)

    if (limitStatus.isLimited) {
      logDomainSearch({
        timestamp: new Date().toISOString(),
        domain,
        source: 'partner_discovery',
        success: false,
        errorType: 'rate_limited',
      })

      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded: ${limitStatus.count}/${limitStatus.limit} requests to this domain per hour`,
          retryAfter: limitStatus.retryAfter,
          retryable: true,
        },
        { status: 429 }
      )
    }

    // Structure DNS data
    const structuredDNS = structureDNSData(dnsData)

    // Scrape website content
    console.log('[/api/partners] Scraping website content...')
    const scrapedContent = await scrapeWebsiteContent(domain)

    if (!scrapedContent || scrapedContent.totalCharacters < 100) {
      console.error('[/api/partners] Failed to scrape meaningful content')
      logDomainSearch({
        timestamp: new Date().toISOString(),
        domain,
        source: 'partner_discovery',
        success: false,
        errorType: 'scraping_failed',
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Could not fetch website content',
          details: 'Website may be unreachable or blocking automated requests',
        },
        { status: 500 }
      )
    }

    console.log('[/api/partners] ════════════════════════════════════════')
    console.log('[/api/partners] SCRAPING RESULTS')
    console.log('[/api/partners] Pages fetched:', scrapedContent.pages.length)
    console.log('[/api/partners] Total characters:', scrapedContent.totalCharacters)
    console.log('[/api/partners] Pages:', scrapedContent.pages.map(p => p.path).join(', '))
    console.log('[/api/partners] ════════════════════════════════════════')

    // Build enhanced user message with both DNS and website content
    const formattedDNS = formatDNSDataForAnalysis(structuredDNS);
    
    const userMessage = `Analyze this domain and discover all related partners, vendors, and ecosystem participants.

TARGET DOMAIN: ${domain}

═══════════════════════════════════════════════════════════════
DNS INFRASTRUCTURE & TECHNICAL PARTNERS
═══════════════════════════════════════════════════════════════

The following DNS records reveal key infrastructure partners:
${formattedDNS}

KEY: Analyze hosting providers, email services, registrars, and CDNs from these records.
These are CONFIRMED infrastructure partners that should be included.

═══════════════════════════════════════════════════════════════
WEBSITE CONTENT (${scrapedContent.pages.length} pages analyzed)
═══════════════════════════════════════════════════════════════

${scrapedContent.combinedText}

═══════════════════════════════════════════════════════════════
ANALYSIS REQUIREMENTS
═══════════════════════════════════════════════════════════════

From DNS Infrastructure:
✓ Extract hosting provider(s) from A records (may require reverse DNS lookup knowledge)
✓ Extract email service provider(s) from MX records (the domain after @ in MX value)
✓ Extract name servers/registrar from NS records (organization owning the domain infrastructure)
✓ Extract email security/SPF info from TXT records (SPF, DKIM, DMARC handlers)

From Website Content:
✓ Find embedded tools, payment processors, booking systems
✓ Identify agency credits and partnerships
✓ Extract technology platform mentions from privacy/terms pages
✓ Find investor/corporate relationships

CRITICAL: Do NOT filter out infrastructure partners found in DNS records. 
These are confirmed technical dependencies.

Return ONLY valid JSON matching the schema. No markdown, no code blocks.`

    let groqResponse: string
    try {
      console.log('[/api/partners] Calling Groq with model:', MODEL)
      console.log('[/api/partners] Prompt loaded, length:', PARTNER_DISCOVERY_PROMPT?.length || 'UNDEFINED')
      console.log('[/api/partners] User message length:', userMessage.length)
      
      if (!PARTNER_DISCOVERY_PROMPT) {
        throw new Error('PARTNER_DISCOVERY_PROMPT is undefined - prompt file import failed')
      }
      
      groqResponse = await callGroqWithRetry(
        MODEL,
        PARTNER_DISCOVERY_PROMPT,
        userMessage,
        3, // Increase retries to 3
        4096, // Increase estimated output for detailed responses
        {
          temperature: 0.3, // Lower temperature for focused output
          max_tokens: 4096, // Increase for detailed responses
        }
      )
      console.log('[/api/partners] Groq response received, length:', groqResponse.length)
    } catch (groqError) {
      console.error('[/api/partners] Groq call failed:', groqError)
      logDomainSearch({
        timestamp: new Date().toISOString(),
        domain,
        source: 'partner_discovery',
        success: false,
        errorType: 'groq_call_failed',
      })

      const errorMsg = groqError instanceof Error ? groqError.message : 'Unknown Groq error'
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
      // Clean up response (remove markdown code blocks if present)
      const cleanedResponse = groqResponse
        .replace(/^```json\n?/, '')
        .replace(/\n?```$/, '')
        .trim()

      parsedResponse = JSON.parse(cleanedResponse)
    } catch (parseError) {
      logDomainSearch({
        timestamp: new Date().toISOString(),
        domain,
        source: 'partner_discovery',
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
      console.log('[/api/partners] Raw Groq response:', groqResponse.substring(0, 500) + '...')
      console.log('[/api/partners] Parsed response:', JSON.stringify(parsedResponse, null, 2))
      validatedResponse = PartnerDiscoveryResponseSchema.parse(parsedResponse)
    } catch (validationError) {
      console.error('[/api/partners] Schema validation failed:')
      console.error('[/api/partners] Validation error:', validationError)
      console.error('[/api/partners] Parsed response was:', JSON.stringify(parsedResponse, null, 2))
      
      if (validationError instanceof z.ZodError) {
        console.error('[/api/partners] Detailed Zod errors:')
        validationError.errors.forEach((err, idx) => {
          console.error(`  [${idx}] Path: ${err.path.join('.')}, Code: ${err.code}, Message: ${err.message}`)
          const pathStr = err.path.join('.')
          const value = parsedResponse
          let current = value
          for (const key of err.path) {
            current = current?.[key]
          }
          console.error(`      Current value: ${JSON.stringify(current)}`)
        })
      }
      
      logDomainSearch({
        timestamp: new Date().toISOString(),
        domain,
        source: 'partner_discovery',
        success: false,
        errorType: 'schema_validation_failed',
      })

      const zodError = validationError instanceof z.ZodError ? validationError.errors : []
      console.error('[/api/partners] Zod errors:', zodError)
      return NextResponse.json(
        {
          success: false,
          error: 'AI response did not match expected schema',
          details: zodError,
          retryable: true,
        },
        { status: 422 }
      )
    }

// Convert nested partner_ecosystem to cards (filter low confidence & duplicates)
    const allPartners: PartnerCardViewProps[] = []
    const MIN_CONFIDENCE = 0.3
    const seenPartnerNames = new Set<string>() // Track partner names to prevent duplicates

    const partnerCategories: Record<string, string> = {
      commercial_partners: 'commercial_vendor',
      marketing_partners: 'marketing_agency',
      technology_partners: 'technology_platform',
      investors_corporate: 'investor_parent',
      operational_adjacencies: 'operational_adjacency',
      developer_agency_partners: 'developer_agency',
      email_security_providers: 'email_security_provider',
    }

    console.log('\n[/api/partners] ════════════════════════════════════════════════════════════════════')
    console.log('[/api/partners] PARTNER DISCOVERY RESULTS')
    console.log('[/api/partners] Domain:', domain)
    console.log('[/api/partners] ════════════════════════════════════════════════════════════════════')

    Object.entries(partnerCategories).forEach(([category, type]) => {
      const partners = validatedResponse.partner_ecosystem[category as keyof typeof validatedResponse.partner_ecosystem] || []
      console.log(`\n[/api/partners] ${category.toUpperCase()}: ${partners.length} found`)
      
      partners.forEach((partner: any, index: number) => {
        // Filter out low confidence partners
        if (partner.confidence < MIN_CONFIDENCE) {
          console.log(`  [FILTERED - Low Confidence] ${partner.name} (confidence: ${partner.confidence})`)
          return
        }

        // Skip duplicates (same partner name already added)
        const partnerNameLower = partner.name.toLowerCase()
        if (seenPartnerNames.has(partnerNameLower)) {
          console.log(`  [FILTERED - Duplicate] ${partner.name}`)
          return
        }
        seenPartnerNames.add(partnerNameLower)

        console.log(`  ✓ ${partner.name}`)
        console.log(`    Type: ${type}`)
        console.log(`    Evidence: ${partner.evidence}`)
        console.log(`    Confidence: ${partner.confidence}`)
        console.log(`    Relationship: ${partner.relationship || 'N/A'}`)

        const cardId = `${domain}-${type}-${index}`
        const card: PartnerCardViewProps = {
          id: cardId,
          domain,
          dnsData: structuredDNS,
          aiData: {
            type: type as any,
            name: partner.name,
            evidence: partner.evidence,
            confidence: partner.confidence,
            relationship: partner.relationship,
            url: partner.url,
          },
          mergedMetadata: {
            discoveredAt: validatedResponse.timestamp,
            sources: ['dns', 'ai'],
            relevanceScore: partner.confidence,
          },
        }
        allPartners.push(card)
      })
      })

    console.log(`\n[/api/partners] Total partners extracted: ${allPartners.length}`)

    logDomainSearch({
      timestamp: new Date().toISOString(),
      domain,
      source: 'partner_discovery',
      success: true,
    })

    // Convert connections/deep_connections to cards as well
    const connections = validatedResponse.connections || validatedResponse.deep_connections || []
    console.log(`\n[/api/partners] DEEP CONNECTIONS: ${connections.length} found`)
    connections.forEach((conn: any) => {
      console.log(`  ✓ ${conn.name} (${conn.category})`)
      console.log(`    Evidence: ${conn.evidence}`)
      console.log(`    Why it matters: ${conn.why_it_matters}`)
      console.log(`    Confidence: ${conn.confidence}`)
    })
    
    const connectionCards: PartnerCardViewProps[] = connections.map((connection: any, index: number) => {
      const cardId = `${domain}-connection-${index}`
      const card: PartnerCardViewProps = {
        id: cardId,
        domain,
        dnsData: structuredDNS,
        aiData: {
          type: (connection.category || 'technology_platform') as any,
          name: connection.name,
          evidence: connection.evidence,
          confidence: connection.confidence || 0.7,
          relationship: connection.why_it_matters || connection.category,
          url: '',
        },
        mergedMetadata: {
          discoveredAt: validatedResponse.timestamp,
          sources: ['ai'],
          relevanceScore: connection.confidence || 0.7,
        },
      }
      return card
    })

    const finalPartners = [...allPartners, ...connectionCards]
    
    // Add the target domain itself as a selectable partner for client email generation
    const companyName = domain.replace(/^www\./, '').split('.')[0].replace(/[-_]/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    const selfCard: PartnerCardViewProps = {
      id: `${domain}-self-0`,
      domain,
      dnsData: structuredDNS,
      aiData: {
        type: 'client_email',
        name: `${companyName} (Client Emails)`,
        evidence: 'Target domain itself for generating client-focused emails using company branding',
        confidence: 1.0,
        relationship: 'Client Communication',
        url: `https://${domain}`,
      },
      mergedMetadata: {
        discoveredAt: validatedResponse.timestamp,
        sources: ['target_domain'],
        relevanceScore: 1.0,
      },
    }
    finalPartners.push(selfCard)
    
    console.log('\n[/api/partners] ════════════════════════════════════════════════════════════════════')
    console.log(`[/api/partners] FINAL RESULT: ${finalPartners.length} partners returned`)
    console.log('[/api/partners] Partners breakdown:')
    console.log(`  - From partner_ecosystem: ${allPartners.length}`)
    console.log(`  - From connections: ${connectionCards.length}`)
    console.log(`  - Self (target domain): 1`)
    console.log('[/api/partners] Partner card details:')
    finalPartners.forEach((card, idx) => {
      console.log(`  [${idx}] ${card.aiData.name} (${card.aiData.type}) - Confidence: ${card.aiData.confidence}`)
    })
    console.log('[/api/partners] ════════════════════════════════════════════════════════════════════\n')

    // ═══════════════════════════════════════════════════════════════════════════════════════════════
    // PHASE 2: Discover Associated Businesses (deeper connections)
    // ═══════════════════════════════════════════════════════════════════════════════════════════════
    console.log('[/api/partners] PHASE 2: Discovering associated businesses...')
    
    let associatedBusinesses: any[] = []
    try {
      // Build list of already-found partners to avoid duplicates
      const existingPartnerNames = finalPartners
        .map(p => p.aiData.name.toLowerCase())
        .filter(name => name.length > 0)
      
      const associatedBusinessesMessage = `Domain: ${domain}

Already discovered (exclude): ${existingPartnerNames.length > 0 ? existingPartnerNames.join(', ') : 'none'}

Website content:
${scrapedContent.combinedText}

Find specific named businesses associated with this website. Return JSON only.`

      console.log('[/api/partners] Calling Groq for associated businesses discovery...')
      const associatedBusinessesResponse = await callGroqWithRetry(
        MODEL,
        ASSOCIATED_BUSINESSES_PROMPT,
        associatedBusinessesMessage,
        2,
        1024,
        {
          temperature: 0.2,
          max_tokens: 1024,
        }
      )
      
      console.log('[/api/partners] Associated businesses response length:', associatedBusinessesResponse.length)
      
      // Parse associated businesses response
      try {
        const cleanedResponse = associatedBusinessesResponse
          .replace(/^```json\n?/, '')
          .replace(/\n?```$/, '')
          .trim()
        
        const parsedAssociated = JSON.parse(cleanedResponse)
        
        // Data repair: Fix common field name errors
        let repaired = parsedAssociated
        
        // If LLM used "connections" instead of "associated_businesses", rename it
        if (repaired.connections && !repaired.associated_businesses) {
          console.log('[Associated Businesses] WARNING: LLM used "connections" instead of "associated_businesses", auto-repairing...')
          repaired.associated_businesses = repaired.connections
          delete repaired.connections
        }
        
        // If items have "category" instead of "type", rename them
        if (repaired.associated_businesses && Array.isArray(repaired.associated_businesses)) {
          repaired.associated_businesses = repaired.associated_businesses.map((business: any) => {
            if (business.category && !business.type) {
              console.log(`[Associated Businesses] WARNING: Item "${business.name}" has "category" instead of "type", auto-repairing...`)
              return {
                ...business,
                type: business.category, // Try to use the category value as type
                category: undefined,
              }
            }
            return business
          }).filter((business: any) => business) // Remove undefined entries
        }
        
        const validatedAssociated = AssociatedBusinessesResponseSchema.parse(repaired)
        
        console.log('[Associated Businesses] Raw AI Response:')
        validatedAssociated.associated_businesses.forEach((business, idx) => {
          const willInclude = !isGenericService(business.name) && business.confidence >= 0.65
          console.log(`  ${idx + 1}. ${business.name} (${business.type}) - Confidence: ${business.confidence}`)
          console.log(`     Will include: ${willInclude}`)
          console.log(`     Evidence: ${business.evidence.substring(0, 100)}...`)
        })
        
        // Apply filtering to remove generic services
        const filteredBusinesses = filterAssociatedBusinesses(validatedAssociated.associated_businesses)
        
        console.log('[Associated Businesses] After Filtering:')
        filteredBusinesses.forEach((business, idx) => {
          console.log(`  ${idx + 1}. ${business.name} - Confidence: ${business.confidence}`)
        })
        
        // Take only top 5 after filtering
        associatedBusinesses = filteredBusinesses.slice(0, 5)
        
        console.log('[/api/partners] Associated businesses discovered:', associatedBusinesses.length)
        console.log('[/api/partners] Associated businesses final list:')
        associatedBusinesses.forEach((business, idx) => {
          console.log(`  [${idx}] ${business.name} (${business.type}) - Confidence: ${business.confidence}`)
          console.log(`    Relationship: ${business.relationship}`)
          console.log(`    Evidence: ${business.evidence.substring(0, 120)}...`)
        })
      } catch (parseError) {
        console.error('[/api/partners] Failed to parse associated businesses response:')
        
        // Detailed error logging
        if (parseError instanceof z.ZodError) {
          console.error('[/api/partners] Schema validation failed. Errors:')
          parseError.errors.forEach((err, idx) => {
            console.error(`  [${idx}] Path: ${err.path.join('.')}, Code: ${err.code}, Message: ${err.message}`)
            if (err.code === 'invalid_enum_value') {
              console.error(`       Received value: "${err.received}", Expected: ${JSON.stringify(err.options)}`)
            }
          })
        } else if (parseError instanceof SyntaxError) {
          console.error('[/api/partners] JSON parsing error:', (parseError as SyntaxError).message)
          console.error('[/api/partners] Raw response (first 500 chars):', associatedBusinessesResponse.substring(0, 500))
        } else {
          console.error('[/api/partners] Unexpected error:', parseError)
        }
        
        // Continue without associated businesses
      }
    } catch (associatedError) {
      console.error('[/api/partners] Error discovering associated businesses:', associatedError)
      // Continue without associated businesses
    }

    const responseData = {
      success: true,
      data: {
        domain,
        dnsData: structuredDNS,
        scrapedPages: scrapedContent.pages.map(p => ({
          path: p.path,
          scrapedAt: p.scrapedAt
        })),
        aiPartners: finalPartners,
        associatedBusinesses: associatedBusinesses,
        validatedAt: new Date().toISOString(),
      },
    }
    
    console.log('[/api/partners] Response contains:', responseData.data.aiPartners.length, 'cards in aiPartners array')
    console.log('[/api/partners] Response contains:', responseData.data.associatedBusinesses.length, 'associated businesses')
    
    return NextResponse.json(responseData)
  } catch (error) {
    console.error('[/api/partners] Error:', error)

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
