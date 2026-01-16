import type { ReactNode } from "react"
import type { PartnerDiscoveryResponse, Partner } from "@/prompts/partner-discovery/partner-discovery.v1.schema"
import type { EmailGenerationResponse } from "@/prompts/email-generation/email-generation.v1.schema"

export interface Section {
  id: string
  title: string
  subtitle?: ReactNode
  content?: ReactNode
  showButton?: boolean
  buttonText?: string
}

export interface SectionProps extends Section {
  isActive: boolean
}

// DNS Data Type
export interface DNSResult {
  A?: string[]
  MX?: Array<{ priority: number; value: string }>
  NS?: string[]
  TXT?: string[]
  [key: string]: unknown
}

// DNS Data Section - structured DNS findings
export interface DNSDataSection {
  aRecords: string[]
  mxRecords: Array<{ priority: number; value: string }>
  nsRecords: string[]
  txtRecords: string[]
  timestamp: string
}

// AI Data Section - single discovered relationship
export interface AIDataSection {
  type: 'commercial_vendor' | 'marketing_agency' | 'technology_platform' | 'investor_parent' | 'operational_adjacency' | 'developer_agency'
  name: string
  evidence: string
  confidence: number
  relationship?: string
  url?: string
}

// Partner Card View Model - NEVER FLATTENED
export interface PartnerCardViewProps {
  id: string
  domain: string
  dnsData: DNSDataSection
  aiData: AIDataSection
  mergedMetadata: {
    discoveredAt: string
    sources: ('dns' | 'ai')[]
    relevanceScore?: number
  }
}

// Full ecosystem view
export interface PartnerEcosystemViewProps {
  domain: string
  partners: PartnerCardViewProps[]
  totalDiscovered: number
  highConfidenceCount: number
}

// API Response Types
export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: string
  details?: unknown
  retryable?: boolean
  retryAfter?: number
}

export interface PartnersAPIResponse extends APIResponse<{
  domain: string
  dnsData: DNSDataSection
  aiPartners: PartnerCardViewProps[]
  validatedAt: string
}> {}

export interface EmailGenerateAPIResponse extends APIResponse<EmailGenerationResponse> {}
