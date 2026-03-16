import { NextRequest, NextResponse } from 'next/server'
import { callGroqWithRetry, cleanJsonResponse } from '@/lib/groq'
import { partnerDiscoveryRateLimiter } from '@/lib/rate-limit'
import { logDomainSearch } from '@/lib/logging'
import { DiscoveryResponseSchema, type DiscoveredPartner } from '@/prompts/partner-discovery/discovery.schema'
import { TECH_TOOLS_PROMPT } from '@/prompts/partner-discovery/tech-tools.prompt'
import { BUSINESS_RELATIONSHIPS_PROMPT } from '@/prompts/partner-discovery/business-relationships.prompt'
import { GOODS_EQUIPMENT_PROMPT } from '@/prompts/partner-discovery/goods-equipment.prompt'
import { INDUSTRY_ASSOCIATIONS_PROMPT } from '@/prompts/partner-discovery/industry-associations.prompt'
import { COMMUNITY_LOCAL_PROMPT } from '@/prompts/partner-discovery/community-local.prompt'
import { MEDIA_PR_PROMPT } from '@/prompts/partner-discovery/media-pr.prompt'
import { FINANCE_PROFESSIONAL_PROMPT } from '@/prompts/partner-discovery/finance-professional.prompt'
import { PROGRAMS_TRAINING_PROMPT } from '@/prompts/partner-discovery/programs-training.prompt'
import { SOFTWARE_INTEGRATIONS_PROMPT } from '@/prompts/partner-discovery/software-integrations.prompt'
import { TECHNOLOGY_PARTNERS_PROMPT } from '@/prompts/partner-discovery/technology-partners.prompt'
import { LOGISTICS_SUPPLIERS_PROMPT } from '@/prompts/partner-discovery/logistics-suppliers.prompt'
import { STAFF_TRAINING_PROMPT } from '@/prompts/partner-discovery/staff-training.prompt'
import { FACILITY_SERVICES_PROMPT } from '@/prompts/partner-discovery/facility-services.prompt'
import { PAYMENT_FINANCING_PROMPT } from '@/prompts/partner-discovery/payment-financing.prompt'
import { crawlWebsite, type FingerprintedService } from '@/lib/crawler'
import { structureDNSData } from '@/lib/dns-utils'
import { isGenericService, CONFIDENCE_THRESHOLDS } from '@/lib/partner-constants'
import type { DNSDataSection, PartnerCardViewProps } from '@/app/types'
import { z } from 'zod'

const MODEL = 'llama-3.3-70b-versatile'

const RequestSchema = z.object({
  domain: z.string().min(1),
  dnsData: z.record(z.any()).optional(),
})

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

function formatDNSDataForAnalysis(dns: DNSDataSection): string {
  let formatted = ''

  if (dns.aRecords?.length > 0) {
    formatted += `\nA RECORDS (Hosting):\n`
    dns.aRecords.forEach((ip) => { formatted += `  • ${ip}\n` })
  }
  if (dns.mxRecords?.length > 0) {
    formatted += `\nMX RECORDS (Email):\n`
    dns.mxRecords.forEach((mx) => { formatted += `  • Priority ${mx.priority}: ${mx.value}\n` })
  }
  if (dns.nsRecords?.length > 0) {
    formatted += `\nNS RECORDS (Name Servers):\n`
    dns.nsRecords.forEach((ns) => { formatted += `  • ${ns}\n` })
  }
  if (dns.txtRecords?.length > 0) {
    formatted += `\nTXT RECORDS (Email Security):\n`
    dns.txtRecords.slice(0, 5).forEach((txt) => {
      formatted += `  • ${txt.substring(0, 100)}${txt.length > 100 ? '...' : ''}\n`
    })
  }
  return formatted
}

/**
 * Run a single focused discovery Groq call and return validated partners.
 * Fails silently (returns []) so one bad call never kills the whole request.
 */
async function runDiscoveryCall(
  label: string,
  systemPrompt: string,
  content: string,
  domain: string,
  skipNames: string[],
): Promise<DiscoveredPartner[]> {
  const skipBlock = skipNames.length > 0
    ? `\nAlready detected elsewhere (skip these — do not repeat them): ${skipNames.join(', ')}\n`
    : ''

  const userMessage =
    `Domain: ${domain}${skipBlock}\n` +
    `Website content to analyze:\n${content}\n\n` +
    `Return a JSON object with a "partners" array as instructed.`

  try {
    const raw = await callGroqWithRetry(
      MODEL,
      systemPrompt,
      userMessage,
      1,   // 1 retry — keep latency low
      700, // estimated output chars
      { temperature: 0.1, max_tokens: 600, response_format: 'json_object' },
    )

    const parsed = JSON.parse(cleanJsonResponse(raw))
    const validated = DiscoveryResponseSchema.parse(parsed)

    const filtered = validated.partners.filter(
      (p) => p.confidence >= CONFIDENCE_THRESHOLDS.FOOTER_PRIVACY && !isGenericService(p.name),
    )

    console.log(`[Discovery:${label}] ${filtered.length} partners after filtering (${validated.partners.length} raw)`)
    filtered.forEach((p) => console.log(`  ✓ ${p.name} (${p.type}) confidence=${p.confidence}`))

    return filtered
  } catch (err) {
    console.error(`[Discovery:${label}] Call failed:`, err instanceof Error ? err.message : err)
    return []
  }
}

function toPartnerCard(
  partner: DiscoveredPartner,
  domain: string,
  dns: DNSDataSection,
  id: string,
  source: 'ai' | 'fingerprint',
): PartnerCardViewProps {
  return {
    id,
    domain,
    dnsData: dns,
    aiData: {
      type: partner.type as any,
      name: partner.name,
      evidence: partner.evidence,
      confidence: partner.confidence,
      url: partner.url,
    },
    mergedMetadata: {
      discoveredAt: new Date().toISOString(),
      sources: [source],
      relevanceScore: partner.confidence,
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { domain: rawDomain, dnsData } = RequestSchema.parse(body)
    const domain = normalizeDomain(rawDomain)

    console.log('[/api/partners] Request received:', { domain, model: MODEL })

    // Rate limiting
    const rateLimitKey = `partner-discovery:${domain}`
    const limitStatus = partnerDiscoveryRateLimiter(request, rateLimitKey)
    if (limitStatus.isLimited) {
      logDomainSearch({ timestamp: new Date().toISOString(), domain, source: 'partner_discovery', success: false, errorType: 'rate_limited' })
      return NextResponse.json(
        { success: false, error: `Rate limit exceeded: ${limitStatus.count}/${limitStatus.limit} per hour`, retryAfter: limitStatus.retryAfter, retryable: true },
        { status: 429 },
      )
    }

    // Structure DNS data
    const structuredDNS = structureDNSData(dnsData)
    const formattedDNS = formatDNSDataForAnalysis(structuredDNS)

    // Crawl website — BFS 3 levels deep, builds a compact knowledge digest
    console.log('[/api/partners] Crawling website...')
    const crawlResult = await crawlWebsite(domain)

    if (!crawlResult || crawlResult.totalCharacters < 100) {
      console.error('[/api/partners] Failed to crawl meaningful content')
      logDomainSearch({ timestamp: new Date().toISOString(), domain, source: 'partner_discovery', success: false, errorType: 'scraping_failed' })
      return NextResponse.json(
        { success: false, error: 'Could not fetch website content', details: 'Website may be unreachable or blocking automated requests' },
        { status: 500 },
      )
    }

    console.log(`[/api/partners] Crawled ${crawlResult.pages.length} pages (${crawlResult.totalCharacters} chars, digest: ${crawlResult.knowledgeDigest.length} chars)`)
    console.log(`[/api/partners] Pages: ${crawlResult.pages.map((p: { path: string }) => p.path).join(', ')}`)

    // Fingerprinted services (confirmed from HTML resource scanning)
    const fingerprintedServices = crawlResult.fingerprintedServices ?? []
    const fingerprintNames = fingerprintedServices.map((s: { name: string }) => s.name)

    // Content sent to AI — knowledge digest (high-signal extracted lines) + DNS.
    // Digest is ~1,500–3,000 chars vs the full 20,000 chars, keeping token usage low.
    const contentForAI =
      (formattedDNS ? `DNS SIGNALS:\n${formattedDNS}\n\n` : '') +
      `KNOWLEDGE DIGEST (extracted from ${crawlResult.pages.length} pages):\n${crawlResult.knowledgeDigest}`

    // Run all 14 focused discovery calls in two parallel batches to respect
    // Groq free-tier TPM limits (~7 calls per batch × ~2,200 tokens = ~15,400 tokens/batch).
    console.log('[/api/partners] Launching discovery batch 1 (7 calls)...')
    const [
      techPartners, businessPartners, equipmentPartners, industryPartners, communityPartners,
      mediaPartners, financePartners,
    ] = await Promise.all([
      runDiscoveryCall('tech-tools',    TECH_TOOLS_PROMPT,             contentForAI, domain, fingerprintNames),
      runDiscoveryCall('business-rels', BUSINESS_RELATIONSHIPS_PROMPT, contentForAI, domain, fingerprintNames),
      runDiscoveryCall('goods-equip',   GOODS_EQUIPMENT_PROMPT,        contentForAI, domain, fingerprintNames),
      runDiscoveryCall('industry-assoc',INDUSTRY_ASSOCIATIONS_PROMPT,  contentForAI, domain, fingerprintNames),
      runDiscoveryCall('community',     COMMUNITY_LOCAL_PROMPT,        contentForAI, domain, fingerprintNames),
      runDiscoveryCall('media-pr',      MEDIA_PR_PROMPT,               contentForAI, domain, fingerprintNames),
      runDiscoveryCall('finance-prof',  FINANCE_PROFESSIONAL_PROMPT,   contentForAI, domain, fingerprintNames),
    ])

    console.log('[/api/partners] Launching discovery batch 2 (7 calls)...')
    const [
      programPartners, softwarePartners, techPartnerResults, logisticsPartners,
      staffTrainingPartners, facilityPartners, paymentPartners,
    ] = await Promise.all([
      runDiscoveryCall('programs',      PROGRAMS_TRAINING_PROMPT,      contentForAI, domain, fingerprintNames),
      runDiscoveryCall('sw-integr',     SOFTWARE_INTEGRATIONS_PROMPT,  contentForAI, domain, fingerprintNames),
      runDiscoveryCall('tech-partners', TECHNOLOGY_PARTNERS_PROMPT,    contentForAI, domain, fingerprintNames),
      runDiscoveryCall('logistics',     LOGISTICS_SUPPLIERS_PROMPT,    contentForAI, domain, fingerprintNames),
      runDiscoveryCall('staff-train',   STAFF_TRAINING_PROMPT,         contentForAI, domain, fingerprintNames),
      runDiscoveryCall('facility-svc',  FACILITY_SERVICES_PROMPT,      contentForAI, domain, fingerprintNames),
      runDiscoveryCall('payment-fin',   PAYMENT_FINANCING_PROMPT,      contentForAI, domain, fingerprintNames),
    ])

    // Merge and deduplicate all discovered partners
    const seenNames = new Set<string>(fingerprintNames.map((n: string) => n.toLowerCase()))
    const aiCards: PartnerCardViewProps[] = []
    let cardIndex = 0

    for (const partner of [
      ...techPartners, ...businessPartners, ...equipmentPartners, ...industryPartners,
      ...communityPartners, ...mediaPartners, ...financePartners, ...programPartners,
      ...softwarePartners, ...techPartnerResults, ...logisticsPartners,
      ...staffTrainingPartners, ...facilityPartners, ...paymentPartners,
    ]) {
      const key = partner.name.toLowerCase()
      if (seenNames.has(key)) {
        console.log(`[/api/partners] [DEDUP] ${partner.name}`)
        continue
      }
      seenNames.add(key)
      aiCards.push(toPartnerCard(partner, domain, structuredDNS, `${domain}-ai-${cardIndex++}`, 'ai'))
    }

    // Fingerprint cards (highest confidence — confirmed via HTML scanning)
    const fingerprintCards: PartnerCardViewProps[] = (fingerprintedServices as FingerprintedService[]).map((svc, i) => ({
      id: `${domain}-fp-${i}`,
      domain,
      dnsData: structuredDNS,
      aiData: {
        type: svc.type as any,
        name: svc.name,
        evidence: `Confirmed embedded integration via ${svc.sourceUrl.substring(0, 60)}`,
        confidence: svc.confidence,
        relationship: svc.relationship,
      },
      mergedMetadata: {
        discoveredAt: new Date().toISOString(),
        sources: ['fingerprint'],
        relevanceScore: svc.confidence,
      },
    }))

    // Self card — always present for generating client-facing emails
    const companyName = domain
      .replace(/^www\./, '')
      .split('.')[0]
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    const selfCard: PartnerCardViewProps = {
      id: `${domain}-self-0`,
      domain,
      dnsData: structuredDNS,
      aiData: {
        type: 'client_email',
        name: `${companyName} (Client Emails)`,
        evidence: 'Target domain for generating client-focused emails using company branding',
        confidence: 1.0,
        relationship: 'Client Communication',
        url: `https://${domain}`,
      },
      mergedMetadata: {
        discoveredAt: new Date().toISOString(),
        sources: ['target_domain'],
        relevanceScore: 1.0,
      },
    }

    const finalPartners = [...fingerprintCards, ...aiCards, selfCard]

    console.log('\n[/api/partners] ══════════════════════════════════════════')
    console.log(`[/api/partners] FINAL: ${finalPartners.length} cards`)
    console.log(`  Fingerprinted: ${fingerprintCards.length}`)
    console.log(`  AI discovered: ${aiCards.length} (tech: ${techPartners.length}, biz: ${businessPartners.length}, equip: ${equipmentPartners.length}, industry: ${industryPartners.length}, community: ${communityPartners.length}, media: ${mediaPartners.length}, finance: ${financePartners.length}, programs: ${programPartners.length}, sw-integr: ${softwarePartners.length}, tech-partners: ${techPartnerResults.length}, logistics: ${logisticsPartners.length}, staff-train: ${staffTrainingPartners.length}, facility: ${facilityPartners.length}, payment: ${paymentPartners.length})`)
    console.log(`  Self card: 1`)
    finalPartners.forEach((c, i) => {
      console.log(`  [${i}] ${c.aiData.name} (${c.aiData.type}) confidence=${c.aiData.confidence}`)
    })
    console.log('[/api/partners] ══════════════════════════════════════════\n')

    logDomainSearch({ timestamp: new Date().toISOString(), domain, source: 'partner_discovery', success: true })

    return NextResponse.json({
      success: true,
      data: {
        domain,
        dnsData: structuredDNS,
        scrapedPages: crawlResult.pages.map((p: { path: string; scrapedAt: string }) => ({ path: p.path, scrapedAt: p.scrapedAt })),
        aiPartners: finalPartners,
        associatedBusinesses: [],
        validatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[/api/partners] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
