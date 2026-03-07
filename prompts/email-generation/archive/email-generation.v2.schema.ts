import { z } from 'zod'

export const EmailGenerationResponseSchemaV2 = z.object({
  subject: z.string().min(1, 'Subject is required').optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  html_body: z.string().optional(),
  body_html: z.string().optional(),
  text_body: z.string().optional(),
  body_text: z.string().optional(),
  urgency_level: z.string().optional(),
  cta_type: z.string().optional(),
  banner_available: z.boolean().optional(),
  source_domain: z.string().optional(),
  target_domain: z.string().optional(),
  generated_at: z.string().optional(),
  security_note: z.string().optional(),
}).passthrough() // Allow additional fields

export type EmailGenerationResponseV2 = z.infer<
  typeof EmailGenerationResponseSchemaV2
>

