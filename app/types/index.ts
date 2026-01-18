import type { ReactNode } from "react"
import type { PartnerDiscoveryResponse, Partner } from "@/prompts/partner-discovery/partner-discovery.v1.schema"

// Website Design Data - extracted from target company
export interface TargetWebsiteDesign {
  domain: string
  colors: {
    primary?: string
    secondary?: string
    accent?: string
    neutral?: string
  }
  fonts: {
    primary?: string
    secondary?: string
  }
  logo?: string
  favicon?: string
  palette?: {
    dominant: string
    secondary: string
    accent: string
    neutral: string
    text: string
  }
}

// Email Generation Response - refactored with design data
export interface EmailGenerationResponse {
  subject: string
  from: string
  from_name?: string
  to: string
  partner_name: string
  partner_domain: string
  target_domain: string
  target_design?: TargetWebsiteDesign
  html_body: string
  text_body: string
  cta_text?: string
  cta_url?: string
  urgency?: 'low' | 'medium' | 'high' | 'critical'
  scenario?: string
  believability_factors?: string[]
  generated_at: string
  version: string
}

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
