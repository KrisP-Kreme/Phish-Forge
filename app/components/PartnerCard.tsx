'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { PartnerCardViewProps } from '@/app/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Lock, Globe } from 'lucide-react'

interface PartnerCardProps {
  partner: PartnerCardViewProps
  onSelect: (partner: PartnerCardViewProps) => void
  isSelected?: boolean
  isLoading?: boolean
}

// Map type to human-readable label and color
const typeConfig: Record<string, { label: string; color: string }> = {
  commercial_vendor: { label: 'Commercial Vendor', color: 'bg-blue-100 text-blue-800' },
  marketing_agency: { label: 'Marketing Agency', color: 'bg-purple-100 text-purple-800' },
  technology_platform: { label: 'Tech Platform', color: 'bg-cyan-100 text-cyan-800' },
  investor_parent: { label: 'Investor/Parent', color: 'bg-green-100 text-green-800' },
  operational_adjacency: { label: 'Operational', color: 'bg-orange-100 text-orange-800' },
  developer_agency: { label: 'Developer Agency', color: 'bg-pink-100 text-pink-800' },
}

// Confidence indicator
function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100)
  const color = confidence > 0.7 ? 'text-green-600' : confidence > 0.5 ? 'text-yellow-600' : 'text-gray-600'

  return (
    <div className="flex items-center gap-1" style={{ fontSize: 'clamp(9px, 1.8vw, 11px)' }}>
      <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden" style={{ minWidth: '25px' }}>
        <div
          className={`h-full transition-all ${confidence > 0.7 ? 'bg-green-500' : confidence > 0.5 ? 'bg-yellow-500' : 'bg-gray-400'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`font-semibold whitespace-nowrap ${color}`}>{percentage}%</span>
    </div>
  )
}

// DNS Data Section
function DNSSection({ dnsData }: { dnsData: PartnerCardViewProps['dnsData'] }) {
  const hasData = dnsData.aRecords.length > 0 || dnsData.mxRecords.length > 0 || dnsData.nsRecords.length > 0

  if (!hasData) {
    return null
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">DNS Findings</h4>
      <div className="space-y-1 text-xs text-gray-600">
        {dnsData.aRecords.length > 0 && (
          <div>
            <span className="font-medium">A Records:</span> {dnsData.aRecords.slice(0, 2).join(', ')}
            {dnsData.aRecords.length > 2 && ` +${dnsData.aRecords.length - 2}`}
          </div>
        )}
        {dnsData.mxRecords.length > 0 && (
          <div>
            <span className="font-medium">MX Records:</span> {dnsData.mxRecords.slice(0, 2).map((mx) => mx.value).join(', ')}
            {dnsData.mxRecords.length > 2 && ` +${dnsData.mxRecords.length - 2}`}
          </div>
        )}
        {dnsData.nsRecords.length > 0 && (
          <div>
            <span className="font-medium">Nameservers:</span> {dnsData.nsRecords.slice(0, 2).join(', ')}
            {dnsData.nsRecords.length > 2 && ` +${dnsData.nsRecords.length - 2}`}
          </div>
        )}
      </div>
    </div>
  )
}

// AI Data Section
function AISection({ aiData }: { aiData: PartnerCardViewProps['aiData'] }) {
  const config = typeConfig[aiData.type] || typeConfig.commercial_vendor
  const isDNS = (aiData as any).isDNS

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 line-clamp-2" style={{ fontSize: 'clamp(12px, 2.5vw, 14px)' }}>{aiData.name}</h3>
          <div className="flex gap-0.5 items-center mt-0.5 flex-wrap">
            <Badge className={`${config.color} text-xs px-1.5 py-0.5`} style={{ fontSize: 'clamp(9px, 1.8vw, 11px)' }}>{config.label}</Badge>
            {isDNS && (
              <Badge className="bg-gray-600 text-white text-xs px-1.5 py-0.5" style={{ fontSize: 'clamp(9px, 1.8vw, 11px)' }}>Infra</Badge>
            )}
          </div>
        </div>
      </div>

      {aiData.relationship && (
        <p className="text-gray-700 line-clamp-1" style={{ fontSize: 'clamp(10px, 1.8vw, 12px)' }}>
          <span className="font-semibold">Role:</span> {aiData.relationship}
        </p>
      )}

      <div>
        <p className="font-semibold text-gray-600" style={{ fontSize: 'clamp(9px, 1.8vw, 11px)', marginBottom: '2px' }}>Evidence</p>
        <p className="text-gray-700 line-clamp-2" style={{ fontSize: 'clamp(9px, 1.8vw, 11px)' }}>{aiData.evidence}</p>
      </div>

      <div>
        <p className="font-semibold text-gray-600" style={{ fontSize: 'clamp(9px, 1.8vw, 11px)', marginBottom: '2px' }}>Confidence</p>
        <ConfidenceIndicator confidence={aiData.confidence} />
      </div>

      {aiData.url && !isDNS && (
        <a
          href={aiData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 font-medium line-clamp-1 mt-1.5"
          style={{ fontSize: 'clamp(9px, 1.8vw, 11px)' }}
        >
          <Globe className="w-2.5 h-2.5 flex-shrink-0" />
          <span>Visit</span>
          <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
        </a>
      )}
    </div>
  )
}

export default function PartnerCard({
  partner,
  onSelect,
  isSelected = false,
  isLoading = false,
}: PartnerCardProps) {
  const isDNS = (partner.aiData as any).isDNS

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={`
        relative rounded-lg border-2 transition-all cursor-pointer h-full flex flex-col
        ${
          isDNS
            ? isSelected
              ? 'border-blue-500 bg-blue-50 shadow-lg'
              : 'border-gray-400 bg-gray-50 hover:border-gray-500 hover:shadow-md'
            : isSelected
            ? 'border-blue-500 bg-blue-50 shadow-lg'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
        }
      `}
      style={{
        padding: 'clamp(10px, 2.5vw, 14px)',
      }}
      onClick={() => !isLoading && onSelect(partner)}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 rounded-lg flex items-center justify-center">
          <div className="animate-spin">
            <Lock className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      )}

      {/* AI Data (Primary) */}
      <AISection aiData={partner.aiData} />

      {/* DNS Data (Secondary, collapsible) - only for AI partners, not DNS cards */}
      {!isDNS && <DNSSection dnsData={partner.dnsData} />}

      {/* Metadata Footer */}
      <div className="mt-auto pt-1 border-t border-gray-100">
        <div className="flex items-center justify-between" style={{ fontSize: 'clamp(9px, 1.8vw, 11px)' }}>
          <p className="text-gray-500">
            {isDNS ? 'Infra' : `${new Date(partner.mergedMetadata.discoveredAt).toLocaleDateString()}`}
          </p>
          {isSelected && (
            <span className="font-semibold text-blue-600">✓</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
