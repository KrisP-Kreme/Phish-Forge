import { z } from 'zod'

const PartnerSchema = z.object({
  name: z.string().min(1, 'Partner name is required'),
  type: z.enum([
    'commercial_vendor',
    'marketing_agency',
    'technology_platform',
    'investor_parent',
    'operational_adjacency',
    'developer_agency',
  ]),
  evidence: z.string().min(1, 'Evidence is required'),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
  relationship: z.string().optional(),
  url: z.string().optional().or(z.literal('')),
})

const ConnectionSchema = z.object({
  name: z.string().min(1, 'Connection name is required'),
  category: z.enum([
    'commercial_vendor',
    'marketing_agency',
    'technology_platform',
    'investor_parent',
    'operational_adjacency',
    'developer_agency',
  ]),
  evidence: z.string().min(1, 'Evidence is required'),
  why_it_matters: z.string().optional(),
  confidence: z.number().min(0.6).max(1, 'Connection confidence must be 0.60-1.00'),
  source_hint: z.string().optional(),
})

export const PartnerDiscoveryResponseSchema = z.object({
  domain: z.string().min(1),
  timestamp: z.string().datetime().optional().or(z.string()),
  partner_ecosystem: z.object({
    commercial_partners: z.array(PartnerSchema).default([]),
    marketing_partners: z.array(PartnerSchema).default([]),
    technology_partners: z.array(PartnerSchema).default([]),
    investors_corporate: z.array(PartnerSchema).default([]),
    operational_adjacencies: z.array(PartnerSchema).default([]),
    developer_agency_partners: z.array(PartnerSchema).default([]),
  }).default({
    commercial_partners: [],
    marketing_partners: [],
    technology_partners: [],
    investors_corporate: [],
    operational_adjacencies: [],
    developer_agency_partners: [],
  }),
  connections: z.array(ConnectionSchema).optional().default([]),
  deep_connections: z.array(ConnectionSchema).optional().default([]),
  evidence_notes: z.array(z.string()).default([]),
}).transform((val) => {
  // Support both 'connections' and 'deep_connections' field names
  if (!val.connections && val.deep_connections) {
    val.connections = val.deep_connections
  }
  return val
})

export type PartnerDiscoveryResponse = z.infer<
  typeof PartnerDiscoveryResponseSchema
>
export type Partner = z.infer<typeof PartnerSchema>
export type Connection = z.infer<typeof ConnectionSchema>
