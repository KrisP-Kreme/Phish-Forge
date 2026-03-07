import { z } from 'zod'

// Generic services blocklist for schema-level validation
const GENERIC_SERVICES = [
  'facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok',
  'pinterest', 'whatsapp', 'google', 'google analytics', 'google maps',
  'wordpress', 'wix', 'squarespace', 'aws', 'azure', 'mailchimp',
  'hotjar', 'mixpanel', 'visa', 'mastercard', 'paypal',
]

function isNotGenericService(name: string): boolean {
  const normalized = name.toLowerCase();
  return !GENERIC_SERVICES.some(service => normalized.includes(service));
}

const AssociatedBusinessSchema = z.object({
  name: z.string().min(1, 'Business name is required').refine(
    (name) => isNotGenericService(name),
    { message: "Cannot include generic services like Google, Facebook, WordPress, etc." }
  ),
  type: z.enum([
    'developer_agency',
    'marketing_agency',
    'supplier',
    'investor_parent',
    'operational_partner',
    'technology_partner',
  ]),
  relationship: z.string().min(1, 'Relationship description required'),
  evidence: z.string().min(1, 'Evidence is required'),
  confidence: z.number().min(0.65).max(1, 'Confidence must be 0.65-1.00'),
  url: z.string().optional().or(z.literal('')),
  source_page: z.string().optional(),
})

export const AssociatedBusinessesResponseSchema = z.object({
  associated_businesses: z.array(AssociatedBusinessSchema).default([]),
  discovery_notes: z.array(z.string()).default([]),
}).transform((val) => {
  // Sort by confidence (highest first) and limit to top 10
  return {
    ...val,
    associated_businesses: val.associated_businesses
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10),
  }
})

export type AssociatedBusinessesResponse = z.infer<
  typeof AssociatedBusinessesResponseSchema
>
export type AssociatedBusiness = z.infer<typeof AssociatedBusinessSchema>
