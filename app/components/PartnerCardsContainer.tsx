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
  
  // Extract email host - try multiple sources to find actual provider name
  // Extract security services FIRST - handle multiple possible field names and formats
  let securityServices: any[] = []
  if (reportData?.security_services) {
    securityServices = Array.isArray(reportData.security_services) 
      ? reportData.security_services.filter((s: any) => s)
      : typeof reportData.security_services === 'string' 
        ? [reportData.security_services]
        : []
  } else if (reportData?.securityServices) {
    securityServices = Array.isArray(reportData.securityServices)
      ? reportData.securityServices.filter((s: any) => s)
      : typeof reportData.securityServices === 'string'
        ? [reportData.securityServices]
        : []
  } else if (reportData?.security) {
    securityServices = Array.isArray(reportData.security)
      ? reportData.security.filter((s: any) => s)
      : typeof reportData.security === 'string'
        ? [reportData.security]
        : []
  } else if (reportData?.services?.security) {
    // Handle nested services.security structure
    securityServices = Array.isArray(reportData.services.security)
      ? reportData.services.security.filter((s: any) => s)
      : typeof reportData.services.security === 'string'
        ? [reportData.services.security]
        : []
  } else if (reportData?.services && Array.isArray(reportData.services)) {
    securityServices = reportData.services.filter((s: any) => s)
  }
  
  let emailHost: string | null = null
  
  // Try to get email provider from various fields
  if (reportData?.email_provider) {
    emailHost = reportData.email_provider
    console.log('[PartnerCardsContainer] emailHost from email_provider:', emailHost)
  } else if (reportData?.mail_provider) {
    emailHost = reportData.mail_provider
    console.log('[PartnerCardsContainer] emailHost from mail_provider:', emailHost)
  } else if (reportData?.mx_provider) {
    emailHost = reportData.mx_provider
    console.log('[PartnerCardsContainer] emailHost from mx_provider:', emailHost)
  } else if (reportData?.domain && reportData.domain !== 'Self-Hosted / Custom' && reportData.domain !== 'Other' && reportData.domain !== 'Custom') {
    emailHost = reportData.domain
    console.log('[PartnerCardsContainer] emailHost from domain:', emailHost)
  } else {
    console.log('[PartnerCardsContainer] No direct emailHost field, reportData.domain is:', reportData?.domain)
  }
  
  // If still no email host found or it's a generic label, try to infer from security services first, then MX records
  if (!emailHost || emailHost === 'Self-Hosted / Custom' || emailHost === 'Other' || emailHost === 'Custom') {
    console.log('[PartnerCardsContainer] emailHost is null/generic, attempting inference from securityServices...')
    // First check if we have Proofpoint or other security providers that also provide email hosting
    if (securityServices && Array.isArray(securityServices) && securityServices.length > 0) {
      console.log('[PartnerCardsContainer] Checking securityServices for email provider match:', securityServices)
      const knownEmailProviders = ['Proofpoint', 'Mimecast', 'Microsoft', 'Google']
      for (const service of securityServices) {
        const serviceName = typeof service === 'string' ? service : (service?.name || '')
        console.log('[PartnerCardsContainer] Checking service:', serviceName)
        for (const provider of knownEmailProviders) {
          if (serviceName.toLowerCase().includes(provider.toLowerCase())) {
            emailHost = provider === 'Microsoft' ? 'Microsoft 365' : provider
            console.log('[PartnerCardsContainer] Matched emailHost from security provider:', emailHost)
            break
          }
        }
        if (emailHost) break
      }
    } else {
      console.log('[PartnerCardsContainer] No security services to check, securityServices:', securityServices)
    }
    
    // If still no host, try MX records
    if (!emailHost && dnsCardData?.dnsRecords?.MX && Array.isArray(dnsCardData.dnsRecords.MX)) {
      console.log('[PartnerCardsContainer] Trying MX record inference...')
      const mxRecord = dnsCardData.dnsRecords.MX[0]
      if (mxRecord) {
        const mxValue = typeof mxRecord === 'string' ? mxRecord : mxRecord.value
        console.log('[PartnerCardsContainer] MX Record value:', mxValue)
        // Try to infer provider from MX record domain
        if (mxValue && typeof mxValue === 'string') {
          // Extract the domain part from MX record (e.g., "mail.google.com" -> "Google")
          const mxDomain = mxValue.toLowerCase()
          if (mxDomain.includes('google')) {
            emailHost = 'Google Workspace'
          } else if (mxDomain.includes('microsoft') || mxDomain.includes('outlook') || mxDomain.includes('office365')) {
            emailHost = 'Microsoft 365'
          } else if (mxDomain.includes('proofpoint')) {
            emailHost = 'Proofpoint'
          } else if (mxDomain.includes('mimecast')) {
            emailHost = 'Mimecast'
          } else {
            // Extract the first meaningful part of the domain
            const parts = mxDomain.split('.')
            const provider = parts[0]?.charAt(0).toUpperCase() + parts[0]?.slice(1)
            if (provider && provider.length > 1) {
              emailHost = provider
            }
          }
        }
      }
    }
  }
  
  let registrar = whoisData?.registrar || whoisData?.registrarName  // e.g., "Domain Directors Pty Ltd trading as Instra"
  let registrarTradingName = null
  
  // If registrar contains "trading as", extract the trading name (e.g., Instra)
  if (registrar && typeof registrar === 'string' && registrar.includes('trading as')) {
    const parts = registrar.split('trading as ')
    registrarTradingName = parts[1]?.trim() || null
    registrar = parts[0]?.trim() || registrar
  }
  
  const hostingProvider = (() => {
    const provider = whoisData?.hosting_provider || whoisData?.hostingProvider
    // Filter out if it looks like a domain/nameserver (contains dots, looks like compusult.com.au, ns1.example.com)
    if (provider && typeof provider === 'string') {
      const lowerProvider = provider.toLowerCase()
      // Skip if it looks like a domain or IP
      if (lowerProvider.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(provider)) {
        return null
      }
      return provider
    }
    return provider
  })() // e.g., "Bluehost", "Telstra" - NOT nameservers or domains
  const technicalContact = whoisData?.technical_contact?.name || whoisData?.technicalContact?.name  // e.g., "Website Development", "John Doe"
  const registrarUrl = whoisData?.registrar_url || whoisData?.registrarUrl  // e.g., "https://www.crazydomains.com.au/contact/"
  
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
  console.log('[PartnerCardsContainer] reportData keys:', reportData ? Object.keys(reportData) : 'no reportData')
  console.log('[PartnerCardsContainer] Security services extracted:', securityServices, 'Length:', securityServices.length)
  console.log('[PartnerCardsContainer] Security services type:', typeof securityServices, 'Is array:', Array.isArray(securityServices))
  if (securityServices && securityServices.length > 0) {
    console.log('[PartnerCardsContainer] First security service:', securityServices[0], 'Type:', typeof securityServices[0])
  }
  
  console.log('[PartnerCardsContainer] Email host value:', emailHost, 'Type:', typeof emailHost, 'Is null?', emailHost === null, 'Is empty string?', emailHost === '')
  console.log('[PartnerCardsContainer] Extracted DNS values:', { emailHost, registrarTradingName, registrarDisplayName, hostingProvider, technicalContact, securityServices })
  
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
    // Use registrarTradingName (brand name) if available, otherwise use registrarDisplayName
    (registrarTradingName || registrarDisplayName) && {
      id: 'dns-provider',
      domain: domain,
      dnsData: {
        records: { A: [], MX: [], NS: [], TXT: [] }
      },
      aiData: {
        name: registrarTradingName || registrarDisplayName,
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
    // Add security services as cards
    ...(Array.isArray(securityServices) && securityServices.length > 0 ? securityServices.map((service: any, idx: number) => {
      // Handle both string and object formats
      const serviceName = typeof service === 'string' ? service : (service?.name || service?.provider || String(service))
      
      return {
        id: `dns-security-${idx}`,
        domain: domain,
        dnsData: {
          records: { A: [], MX: [], NS: [], TXT: [] }
        },
        aiData: {
          name: serviceName,
          type: 'email_security_provider',
          evidence: 'Email security & threat protection provider',
          confidence: 1,
          relationship: 'Provides email security & protection',
          isDNS: true
        },
        mergedMetadata: {
          discoveredAt: new Date().toISOString(),
        }
      }
    }) : [])
  ].filter(Boolean) as PartnerCardViewProps[]

  // Log DNS cards created
  console.log('[PartnerCardsContainer] DNS Cards created:', dnsCards.length)
  dnsCards.forEach((card, idx) => {
    console.log(`  [${idx}] ${card.id}: ${card.aiData?.name} (${card.aiData?.type})`)
  })

  // Deduplicate cards by ID to prevent double-ups
  const uniqueCardMap = new Map<string, PartnerCardViewProps>()
  
  // Helper function to normalize names for comparison (remove extra spaces, handle "trading as", etc)
  const normalizeName = (name: string | undefined): string => {
    if (!name) return ''
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\(.*\)/g, '') // Remove parenthetical content
      .replace(/trading as.*$/i, '') // Remove "trading as" suffixes
      .trim()
  }
  
  // Add DNS cards first
  dnsCards.forEach((card) => {
    if (!uniqueCardMap.has(card.id)) {
      uniqueCardMap.set(card.id, card)
    }
  })
  
  // Filter partners to only include those with meaningful sources and non-generic evidence
  const filteredPartners = partners.filter((partner) => {
    const evidence = partner.aiData?.evidence || ''
    const sourceName = partner.aiData?.name || ''
    
    // Only exclude if evidence is empty or extremely short
    if (!evidence || evidence.trim().length < 10) {
      return false
    }
    
    // Exclude only clearly generic/placeholder evidence
    const genericPatterns = [
      /^(found|mentioned|listed|noted)$/i,
      /^(generic|placeholder|example|test)$/i,
    ]
    
    const isGeneric = genericPatterns.some(pattern => pattern.test(evidence))
    
    // Keep all partners with real, non-empty evidence
    return !isGeneric
  })
  
  console.log('[PartnerCardsContainer] Partners before filtering:', partners.length)
  console.log('[PartnerCardsContainer] Partners after filtering:', filteredPartners.length)
  
  // Add partners, skipping duplicates by normalized name
  filteredPartners.forEach((partner) => {
    const partnerNormalized = normalizeName(partner.aiData?.name)
    
    // Check if this partner name already exists in our unique map
    const isDuplicate = Array.from(uniqueCardMap.values()).some((card) => {
      const cardNormalized = normalizeName(card.aiData?.name)
      return cardNormalized === partnerNormalized && partnerNormalized !== ''
    })
    
    if (!isDuplicate && !uniqueCardMap.has(partner.id)) {
      uniqueCardMap.set(partner.id, partner)
    } else if (isDuplicate) {
      console.log(`[PartnerCardsContainer] Skipping duplicate partner: ${partner.aiData?.name}`)
    }
  })
  
  const allCards = Array.from(uniqueCardMap.values())
  
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
    console.log('[PartnerCardsContainer] dnsCards created:', dnsCards.length)
    dnsCards.forEach((card, idx) => {
      console.log(`  [${idx}] ${card.id}: ${card.aiData?.name}`)
    })
    console.log('[PartnerCardsContainer] partners received:', partners.length, partners.slice(0, 3))
    console.log('[PartnerCardsContainer] After dedup - uniqueCardMap size:', uniqueCardMap.size)
    console.log('[PartnerCardsContainer] allCards after dedup:', allCards.length)
    allCards.forEach((card, idx) => {
      console.log(`  [${idx}] ${card.id}: ${card.aiData?.name}`)
    })
  }

  if (allCards.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-500">No infrastructure or partner data found for this domain.</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-12">
      {/* All Partners Section (DNS + AI-discovered, deduplicated) */}
      {allCards.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-6 text-white">Domain Infrastructure & Partners ({allCards.length})</h2>
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
      )}

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
