'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PartnerCardViewProps } from '@/app/types'
import PartnerCard from './PartnerCard'
import EmailLiveEditor from './EmailLiveEditor'

interface PartnerCardsContainerProps {
  domain: string
  partners: PartnerCardViewProps[]
  dnsData?: any
  isLoading?: boolean
}

export default function PartnerCardsContainer({
  domain,
  partners,
  dnsData,
  isLoading = false,
}: PartnerCardsContainerProps) {
  const [selectedPartner, setSelectedPartner] = useState<PartnerCardViewProps | null>(null)
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false)

  const handlePartnerSelect = async (partner: PartnerCardViewProps) => {
    setSelectedPartner(partner)
    setIsGeneratingEmail(true)
  }

  const handleEmailClose = () => {
    setSelectedPartner(null)
  }

  // Convert DNS data into card items
  // DNS data structure: { domainCheck, dnsRecords, report, whois }
  const dnsCardData = dnsData?.result || dnsData
  const reportData = dnsCardData?.report
  const whoisData = dnsCardData?.whois
  
  console.log('[PartnerCardsContainer] reportData:', reportData)
  console.log('[PartnerCardsContainer] whoisData:', whoisData)
  console.log('[PartnerCardsContainer] whoisData full object:')
  if (whoisData) {
    Object.entries(whoisData).forEach(([key, value]) => {
      console.log(`  whoisData.${key}:`, value)
    })
  }
  if (reportData) {
    console.log('[PartnerCardsContainer] reportData full object:')
    Object.entries(reportData).forEach(([key, value]) => {
      console.log(`  reportData.${key}:`, value)
    })
  }
  
  // Extract all infrastructure values from report and whois
  const emailHost = reportData?.domain  // e.g., "Google Workspace", "Mimecast"
  let registrar = whoisData?.registrar || whoisData?.registrarName  // e.g., "Domain Directors Pty Ltd trading as Instra"
  let registrarTradingName = null
  
  // If registrar contains "trading as", extract the trading name (e.g., Instra)
  if (registrar && typeof registrar === 'string' && registrar.includes('trading as')) {
    const parts = registrar.split('trading as ')
    registrarTradingName = parts[1]?.trim() || null
    registrar = parts[0]?.trim() || registrar
  }
  
  const hostingProvider = whoisData?.hosting_provider || whoisData?.hostingProvider  // e.g., "Bluehost", "Telstra"
  const technicalContact = whoisData?.technical_contact?.name || whoisData?.technicalContact?.name  // e.g., "Website Development", "John Doe"
  const registrarUrl = whoisData?.registrar_url || whoisData?.registrarUrl  // e.g., "https://www.crazydomains.com.au/contact/"
  const securityServices = reportData?.security_services || reportData?.securityServices || []
  
  // Extract registrar name from URL for display
  const registrarDisplayName = (() => {
    if (!registrarUrl) return null
    try {
      const url = new URL(registrarUrl)
      return url.hostname
        ?.replace('www.', '')
        .split('.')[0]
        .charAt(0)
        .toUpperCase() + url.hostname?.replace('www.', '').split('.')[0].slice(1)
    } catch {
      return null
    }
  })()
  
  console.log('[PartnerCardsContainer] reportData full object:', reportData)
  console.log('[PartnerCardsContainer] Security services extracted:', securityServices)
  console.log('[PartnerCardsContainer] Security services type:', typeof securityServices, 'Is array:', Array.isArray(securityServices))
  
  console.log('[PartnerCardsContainer] Extracted values:', { emailHost, registrar, registrarTradingName, hostingProvider, technicalContact, registrarDisplayName, securityServices })
  
  const dnsCards: PartnerCardViewProps[] = [
    hostingProvider && {
      id: 'dns-hosting',
      domain: domain,
      dnsData: {
        records: { A: [], MX: [], NS: [], TXT: [] }
      },
      aiData: {
        name: hostingProvider,
        type: 'commercial_vendor',
        evidence: 'Primary hosting provider',
        confidence: 1,
        relationship: 'Infrastructure provider',
        isDNS: true
      },
      mergedMetadata: {
        discoveredAt: new Date().toISOString(),
      }
    },
    emailHost && {
      id: 'dns-email',
      domain: domain,
      dnsData: {
        records: { A: [], MX: [], NS: [], TXT: [] }
      },
      aiData: {
        name: emailHost,
        type: 'commercial_vendor',
        evidence: 'Email infrastructure provider',
        confidence: 1,
        relationship: 'Manages email servers',
        isDNS: true
      },
      mergedMetadata: {
        discoveredAt: new Date().toISOString(),
      }
    },
    registrarDisplayName && {
      id: 'dns-provider',
      domain: domain,
      dnsData: {
        records: { A: [], MX: [], NS: [], TXT: [] }
      },
      aiData: {
        name: registrarDisplayName,
        type: 'commercial_vendor',
        evidence: 'Domain registrar - where domain was purchased',
        confidence: 1,
        relationship: 'Domain registration provider',
        url: registrarUrl,
        isDNS: true
      },
      mergedMetadata: {
        discoveredAt: new Date().toISOString(),
      }
    },
    technicalContact && {
      id: 'dns-technical-contact',
      domain: domain,
      dnsData: {
        records: { A: [], MX: [], NS: [], TXT: [] }
      },
      aiData: {
        name: technicalContact,
        type: 'commercial_vendor',
        evidence: 'Technical contact for domain management',
        confidence: 1,
        relationship: 'Domain technical contact',
        isDNS: true
      },
      mergedMetadata: {
        discoveredAt: new Date().toISOString(),
      }
    },
    registrarTradingName && {
      id: 'dns-registrar-brand',
      domain: domain,
      dnsData: {
        records: { A: [], MX: [], NS: [], TXT: [] }
      },
      aiData: {
        name: registrarTradingName,
        type: 'commercial_vendor',
        evidence: 'Domain registrar (trading name)',
        confidence: 1,
        relationship: 'Domain provider - handles domain registration & management',
        isDNS: true
      },
      mergedMetadata: {
        discoveredAt: new Date().toISOString(),
      }
    },
    // Add security services as cards
    ...(Array.isArray(securityServices) ? securityServices.map((service: string, idx: number) => ({
      id: `dns-security-${idx}`,
      domain: domain,
      dnsData: {
        records: { A: [], MX: [], NS: [], TXT: [] }
      },
      aiData: {
        name: service,
        type: 'commercial_vendor',
        evidence: 'Security service provider',
        confidence: 1,
        relationship: 'Provides security & protection',
        isDNS: true
      },
      mergedMetadata: {
        discoveredAt: new Date().toISOString(),
      }
    })) : [])
  ].filter(Boolean) as PartnerCardViewProps[]

  const allCards = [...dnsCards, ...partners]
  
  if (typeof window !== 'undefined') {
    console.log('[PartnerCardsContainer] Full dnsData object:', dnsData)
    console.log('[PartnerCardsContainer] dnsCardData extracted:', dnsCardData)
    if (dnsCardData) {
      console.log('[PartnerCardsContainer] dnsCardData is:', dnsCardData)
      console.log('[PartnerCardsContainer] ALL dnsCardData values:')
      Object.entries(dnsCardData).forEach(([key, value]) => {
        console.log(`  ${key}:`, value)
      })
    }
    console.log('[PartnerCardsContainer] dnsCards created:', dnsCards.length, dnsCards)
    console.log('[PartnerCardsContainer] partners received:', partners.length)
    console.log('[PartnerCardsContainer] allCards total:', allCards.length)
  }

  if (allCards.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-500">No infrastructure or partner data found for this domain.</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Combined Infrastructure & Partners Grid */}
      <div className="w-full">
        <h2 className="font-bold text-gray-900 mb-2" style={{ fontSize: 'clamp(16px, 4vw, 22px)' }}>
          Domain Infrastructure & Partners ({allCards.length})
        </h2>
        <div className="w-full overflow-hidden"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(210px, 1fr))`,
            gap: 'clamp(10px, 2.5vw, 14px)',
            gridAutoRows: 'minmax(290px, auto)',
            maxHeight: 'calc(100vh - 300px)',
            overflowY: 'auto',
            paddingRight: '6px'
          }}
        >
          <AnimatePresence>
            {allCards.map((card) => (
              <PartnerCard
                key={card.id}
                partner={card}
                onSelect={handlePartnerSelect}
                isSelected={selectedPartner?.id === card.id}
                isLoading={isGeneratingEmail && selectedPartner?.id === card.id}
              />
            ))}
          </AnimatePresence>
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
