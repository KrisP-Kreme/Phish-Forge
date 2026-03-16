import { z } from 'zod'

// Flat, simple schema used by both focused discovery calls.
// Avoids the nested partner_ecosystem complexity that confused the model.
export const DiscoveredPartnerSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    'commercial_vendor',
    'technology_platform',
    'email_security_provider',
    'marketing_agency',
    'developer_agency',
    'investor_parent',
    'operational_adjacency',
    'equipment_supplier',
    'industry_association',
    'community_partner',
    'media_partner',
    'professional_service',
    'licensed_program',
    'software_integration',
    'technology_partner',
    'logistics_supplier',
    'staff_training',
    'facility_service',
    'payment_financing',
  ]),
  evidence: z.string().min(1),
  confidence: z.number().min(0.65).max(1),
  url: z.string().optional().or(z.literal('')),
})

// Wrapper object required for json_object response_format mode.
export const DiscoveryResponseSchema = z.object({
  partners: z.array(DiscoveredPartnerSchema).default([]),
})

export type DiscoveredPartner = z.infer<typeof DiscoveredPartnerSchema>
export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>
