import { NextRequest, NextResponse } from 'next/server'
import { callGroqWithRetry } from '@/lib/groq'
import { partnerDiscoveryRateLimiter } from '@/lib/rate-limit'
import { logDomainSearch } from '@/lib/logging'
import { PartnerDiscoveryResponseSchema } from '@/prompts/partner-discovery/partner-discovery.v1.schema'
import {
  PARTNER_DISCOVERY_PROMPT,
} from '@/prompts/partner-discovery/partner-discovery.v1.prompt'
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

    // Call Groq with retry logic
    const userMessage = `Analyze this domain and discover all related partners, vendors, and ecosystem participants:\n\nDomain: ${domain}\n\nDNS Records:\n${JSON.stringify(structuredDNS, null, 2)}\n\nReturn ONLY valid JSON matching the specified schema. No explanations, no markdown code blocks. Start with { and end with }.`

    let groqResponse: string
    try {
      console.log('[/api/partners] Calling Groq with model:', MODEL)
      console.log('[/api/partners] Prompt loaded, length:', PARTNER_DISCOVERY_PROMPT?.length || 'UNDEFINED')
      
      if (!PARTNER_DISCOVERY_PROMPT) {
        throw new Error('PARTNER_DISCOVERY_PROMPT is undefined - prompt file import failed')
      }
      
      groqResponse = await callGroqWithRetry(
        MODEL,
        PARTNER_DISCOVERY_PROMPT,
        userMessage,
        2 // max 2 retries
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
    }

    Object.entries(partnerCategories).forEach(([category, type]) => {
      const partners = validatedResponse.partner_ecosystem[category as keyof typeof validatedResponse.partner_ecosystem] || []
      partners.forEach((partner: any, index: number) => {
        // Filter out low confidence partners
        if (partner.confidence < MIN_CONFIDENCE) {
          return
        }

        // Skip duplicates (same partner name already added)
        const partnerNameLower = partner.name.toLowerCase()
        if (seenPartnerNames.has(partnerNameLower)) {
          console.log(`[/api/partners] Skipping duplicate partner: ${partner.name}`)
          return
        }
        seenPartnerNames.add(partnerNameLower)

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

    logDomainSearch({
      timestamp: new Date().toISOString(),
      domain,
      source: 'partner_discovery',
      success: true,
    })

    // Convert connections/deep_connections to cards as well
    const connections = validatedResponse.connections || validatedResponse.deep_connections || []
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

    return NextResponse.json({
      success: true,
      data: {
        domain,
        dnsData: structuredDNS,
        aiPartners: [...allPartners, ...connectionCards],
        validatedAt: new Date().toISOString(),
      },
    })
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
