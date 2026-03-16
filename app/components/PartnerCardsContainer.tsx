'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PartnerCardViewProps, DNSDataSection } from '@/app/types'
import { parseDNSResponse } from '@/lib/dns-utils'
import PartnerCard from './PartnerCard'
import EmailLiveEditor from './EmailLiveEditor'

interface PartnerCardsContainerProps {
  domain: string
  partners: PartnerCardViewProps[]
  dnsData?: any
  associatedBusinesses?: any[]
  isLoading?: boolean
}

const EMPTY_DNS: DNSDataSection = {
  aRecords: [],
  mxRecords: [],
  nsRecords: [],
  txtRecords: [],
  timestamp: new Date().toISOString(),
}

// Map associated-businesses types to AIDataSection types
const ASSOC_TYPE_MAP: Record<string, string> = {
  supplier:             'commercial_vendor',
  operational_partner:  'operational_adjacency',
  technology_partner:   'technology_platform',
  developer_agency:     'developer_agency',
  marketing_agency:     'marketing_agency',
  investor_parent:      'investor_parent',
}

function normalizeName(name: string | undefined): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\(.*\)/g, '')
    .replace(/trading as.*$/i, '')
    .trim()
}

export default function PartnerCardsContainer({
  domain,
  partners,
  dnsData,
  associatedBusinesses = [],
  isLoading = false,
}: PartnerCardsContainerProps) {
  const [selectedPartner, setSelectedPartner] = useState<PartnerCardViewProps | null>(null)
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false)

  const handlePartnerSelect = (partner: PartnerCardViewProps) => {
    setSelectedPartner(partner)
    setIsGeneratingEmail(true)
  }

  const handleEmailClose = () => {
    setSelectedPartner(null)
  }

  // --- Build DNS cards from the raw /api/dns response ---
  const parsed = parseDNSResponse(dnsData)
  const {
    emailHost,
    registrarTradingName,
    registrarDisplayName,
    registrarUrl,
    hostingProvider,
    technicalContact,
    securityServices,
  } = parsed

  const dnsCards: PartnerCardViewProps[] = [
    hostingProvider && {
      id: 'dns-hosting',
      domain,
      dnsData: EMPTY_DNS,
      aiData: {
        name: hostingProvider,
        type: 'commercial_vendor' as const,
        evidence: 'Primary hosting provider identified via WHOIS',
        confidence: 1,
        relationship: 'Infrastructure provider',
        isDNS: true,
      },
      mergedMetadata: { discoveredAt: new Date().toISOString(), sources: ['dns'] },
    },
    emailHost && {
      id: 'dns-email',
      domain,
      dnsData: EMPTY_DNS,
      aiData: {
        name: emailHost,
        type: 'commercial_vendor' as const,
        evidence: 'Email infrastructure provider identified via MX records',
        confidence: 1,
        relationship: 'Manages email delivery',
        isDNS: true,
      },
      mergedMetadata: { discoveredAt: new Date().toISOString(), sources: ['dns'] },
    },
    (registrarTradingName || registrarDisplayName) && {
      id: 'dns-provider',
      domain,
      dnsData: EMPTY_DNS,
      aiData: {
        name: (registrarTradingName || registrarDisplayName)!,
        type: 'commercial_vendor' as const,
        evidence: 'Domain registrar identified via WHOIS',
        confidence: 1,
        relationship: 'Domain registration provider',
        url: registrarUrl ?? undefined,
        isDNS: true,
      },
      mergedMetadata: { discoveredAt: new Date().toISOString(), sources: ['dns'] },
    },
    technicalContact && {
      id: 'dns-technical-contact',
      domain,
      dnsData: EMPTY_DNS,
      aiData: {
        name: technicalContact,
        type: 'commercial_vendor' as const,
        evidence: 'Technical contact for domain management (WHOIS)',
        confidence: 1,
        relationship: 'Domain technical contact',
        isDNS: true,
      },
      mergedMetadata: { discoveredAt: new Date().toISOString(), sources: ['dns'] },
    },
    ...securityServices.map((svc, idx) => ({
      id: `dns-security-${idx}`,
      domain,
      dnsData: EMPTY_DNS,
      aiData: {
        name: svc,
        type: 'email_security_provider' as const,
        evidence: 'Email security provider identified via DNS records',
        confidence: 1,
        relationship: 'Email security and threat protection',
        isDNS: true,
      },
      mergedMetadata: { discoveredAt: new Date().toISOString(), sources: ['dns'] },
    })),
  ].filter(Boolean) as PartnerCardViewProps[]

  // --- Convert associatedBusinesses to cards ---
  const associatedCards: PartnerCardViewProps[] = associatedBusinesses.map((biz, idx) => ({
    id: `assoc-${idx}`,
    domain,
    dnsData: EMPTY_DNS,
    aiData: {
      type: (ASSOC_TYPE_MAP[biz.type] ?? 'commercial_vendor') as any,
      name: biz.name,
      evidence: biz.evidence,
      confidence: biz.confidence,
      relationship: biz.relationship,
      url: biz.url ?? undefined,
    },
    mergedMetadata: {
      discoveredAt: new Date().toISOString(),
      sources: ['ai'],
      relevanceScore: biz.confidence,
    },
  }))

  // --- Deduplicate: DNS cards first, then AI partners, then associated businesses ---
  const uniqueCardMap = new Map<string, PartnerCardViewProps>()

  for (const card of dnsCards) {
    uniqueCardMap.set(card.id, card)
  }

  const filteredPartners = partners.filter((p) => {
    const evidence = p.aiData?.evidence ?? ''
    if (!evidence || evidence.trim().length < 10) return false
    const genericPatterns = [/^(found|mentioned|listed|noted)$/i, /^(generic|placeholder|example|test)$/i]
    return !genericPatterns.some((pat) => pat.test(evidence))
  })

  for (const partner of filteredPartners) {
    const normalized = normalizeName(partner.aiData?.name)
    const isDuplicate = Array.from(uniqueCardMap.values()).some(
      (c) => normalizeName(c.aiData?.name) === normalized && normalized !== '',
    )
    if (!isDuplicate && !uniqueCardMap.has(partner.id)) {
      uniqueCardMap.set(partner.id, partner)
    }
  }

  for (const card of associatedCards) {
    const normalized = normalizeName(card.aiData?.name)
    const isDuplicate = Array.from(uniqueCardMap.values()).some(
      (c) => normalizeName(c.aiData?.name) === normalized && normalized !== '',
    )
    if (!isDuplicate && !uniqueCardMap.has(card.id)) {
      uniqueCardMap.set(card.id, card)
    }
  }

  const allCards = Array.from(uniqueCardMap.values())

  if (allCards.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-500">No infrastructure or partner data found for this domain.</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-12">
      <div>
        <h2 className="text-2xl font-bold mb-6 text-white">
          Domain Infrastructure & Partners ({allCards.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {allCards.map((card) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <PartnerCard
                partner={card}
                isSelected={selectedPartner?.id === card.id}
                onSelect={() => handlePartnerSelect(card)}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Email Editor Modal */}
      <AnimatePresence>
        {selectedPartner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={handleEmailClose}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="fixed bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto z-50 bg-gray-900 rounded-t-2xl shadow-2xl"
            >
              <EmailLiveEditor
                domain={domain}
                partner={selectedPartner.aiData}
                isLoading={isGeneratingEmail}
                onClose={handleEmailClose}
                onLoadingChange={setIsGeneratingEmail}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
