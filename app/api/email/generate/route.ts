import { NextRequest, NextResponse } from 'next/server'
import { callGroqWithRetry } from '@/lib/groq'
import { emailGenerationRateLimiter } from '@/lib/rate-limit'
import { logDomainSearch } from '@/lib/logging'
import { EmailGenerationResponseSchema } from '@/prompts/email-generation/email-generation.v1.schema'
import {
  EMAIL_GENERATION_PROMPT_V1,
  EMAIL_GENERATION_MODEL,
  EMAIL_GENERATION_VERSION,
} from '@/prompts/email-generation/email-generation.v1.prompt'
import type { AIDataSection } from '@/app/types'
import { z } from 'zod'

// Request validation
const RequestSchema = z.object({
  domain: z.string().min(1),
  partner: z.object({
    name: z.string(),
    type: z.string(),
    relationship: z.string().optional(),
  }),
  previousEmail: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const { domain, partner, previousEmail } = RequestSchema.parse(body)

    // Rate limiting check
    const sessionId = request.headers.get('x-session-id') || request.ip || 'unknown'
    const rateLimitKey = `email-generation:${sessionId}`
    const limitStatus = emailGenerationRateLimiter(request, rateLimitKey)

    if (limitStatus.isLimited) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded: ${limitStatus.count}/${limitStatus.limit} email generations per session`,
          retryAfter: limitStatus.retryAfter,
          retryable: true,
        },
        { status: 429 }
      )
    }

    // Build context for email generation
    const userMessage = `Generate a phishing email for authorized security testing:

Target Domain: ${domain}
Partner Entity: ${partner.name}
Partner Type: ${partner.type}
Relationship: ${partner.relationship || 'Not specified'}

${previousEmail ? `Previous email (for reference/variation):\n${previousEmail}\n\nGenerate a different variation.` : ''}

Return ONLY valid JSON matching the specified schema. No explanations, no markdown code blocks. Start with { and end with }.`

    let groqResponse: string
    try {
      groqResponse = await callGroqWithRetry(
        EMAIL_GENERATION_MODEL,
        EMAIL_GENERATION_PROMPT_V1,
        userMessage,
        1 // max 1 retry for speed
      )
    } catch (groqError) {
      logDomainSearch({
        timestamp: new Date().toISOString(),
        domain,
        source: 'email_generation',
        success: false,
        errorType: 'groq_call_failed',
      })

      const errorMsg = groqError instanceof Error ? groqError.message : 'Unknown Groq error'
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate email with AI',
          details: errorMsg,
          retryable: true,
        },
        { status: 500 }
      )
    }

    // Parse JSON response
    let parsedResponse: any
    try {
      // Clean up response
      const cleanedResponse = groqResponse
        .replace(/^```json\n?/, '')
        .replace(/\n?```$/, '')
        .trim()

      parsedResponse = JSON.parse(cleanedResponse)
    } catch (parseError) {
      logDomainSearch({
        timestamp: new Date().toISOString(),
        domain,
        source: 'email_generation',
        success: false,
        errorType: 'json_parse_failed',
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse AI response as JSON',
          details: 'Response was not valid JSON',
          retryable: true,
        },
        { status: 422 }
      )
    }

    // Validate against schema
    let validatedResponse: any
    try {
      validatedResponse = EmailGenerationResponseSchema.parse(parsedResponse)
    } catch (validationError) {
      logDomainSearch({
        timestamp: new Date().toISOString(),
        domain,
        source: 'email_generation',
        success: false,
        errorType: 'schema_validation_failed',
      })

      const zodError = validationError instanceof z.ZodError ? validationError.errors : []
      return NextResponse.json(
        {
          success: false,
          error: 'AI response did not match expected schema',
          details: zodError,
          retryable: true,
        },
        { status: 422 }
      )
    }

    logDomainSearch({
      timestamp: new Date().toISOString(),
      domain,
      source: 'email_generation',
      success: true,
    })

    return NextResponse.json({
      success: true,
      data: validatedResponse,
    })
  } catch (error) {
    console.error('[/api/email/generate] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
