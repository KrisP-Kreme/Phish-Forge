import { z } from 'zod'

export const OSINTDomainAnalysisResponseSchema = z.object({
  domain: z.string(),
  organization_name: z.string(),
  organization_type: z.string(),
  summary: z.string(),
  business_activities: z.array(z.object({
    activity: z.string(),
    description: z.string(),
    evidence: z.array(z.object({
      source: z.string(),
      details: z.string(),
    })),
    confidence: z.number().min(0).max(1),
  })),
  monetization: z.object({
    does_bill_for_services: z.boolean(),
    billing_model: z.string(),
    pricing_information: z.string(),
    evidence: z.array(z.object({
      source: z.string(),
      details: z.string(),
    })),
    confidence: z.number().min(0).max(1),
  }),
  target_customers: z.array(z.object({
    customer_type: z.string(),
    evidence: z.array(z.object({
      source: z.string(),
      details: z.string(),
    })),
    confidence: z.number().min(0).max(1),
  })),
  industries: z.array(z.object({
    industry: z.string(),
    evidence: z.array(z.object({
      source: z.string(),
      details: z.string(),
    })),
    confidence: z.number().min(0).max(1),
  })),
  geographic_focus: z.array(z.object({
    region: z.string(),
    evidence: z.array(z.object({
      source: z.string(),
      details: z.string(),
    })),
    confidence: z.number().min(0).max(1),
  })),
  key_public_entities: z.array(z.object({
    name: z.string(),
    relationship: z.string(),
    evidence: z.array(z.object({
      source: z.string(),
      details: z.string(),
    })),
    confidence: z.number().min(0).max(1),
  })),
  data_gaps: z.array(z.object({
    missing_information: z.string(),
    reason: z.string(),
  })),
  analysis_notes: z.string(),
})

export type OSINTDomainAnalysisResponse = z.infer<typeof OSINTDomainAnalysisResponseSchema>