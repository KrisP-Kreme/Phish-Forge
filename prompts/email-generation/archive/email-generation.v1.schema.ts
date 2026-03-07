import { z } from 'zod'

export const EmailGenerationResponseSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body_html: z.string().min(1, 'HTML body is required'),
  body_text: z.string().min(1, 'Text body is required'),
  headers: z
    .object({
      from: z.string().email('Invalid from email'),
      to: z.string().email('Invalid to email').optional(),
      cc: z.string().optional(),
      bcc: z.string().optional(),
    })
    .optional(),
  generated_at: z.string().datetime(),
})

export type EmailGenerationResponse = z.infer<
  typeof EmailGenerationResponseSchema
>
