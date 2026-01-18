import { NextRequest, NextResponse } from 'next/server'
import { searchDomain } from '@/lib/domain-resolver'
import { z } from 'zod'

const RequestSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
})

/**
 * Search for and resolve a domain
 * POST /api/domain/search
 * 
 * Request:
 * {
 *   "domain": "greatersheppartoncitycouncil"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "found": true,
 *     "domain": "greatershepparton.com.au",
 *     "originalInput": "greatersheppartoncitycouncil",
 *     "alternatives": [...],
 *     "searchMethod": "tld_probe_success"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { domain } = RequestSchema.parse(body)

    console.log('[/api/domain/search] Searching for domain:', domain)

    const result = await searchDomain(domain)

    console.log('[/api/domain/search] Search result:', {
      found: result.found,
      domain: result.domain,
      alternatives: result.alternatives.length,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[/api/domain/search] Error:', error)

    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search for domain',
        details: errorMsg,
      },
      { status: 400 }
    )
  }
}
