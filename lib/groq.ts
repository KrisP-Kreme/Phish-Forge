import { Groq } from 'groq-sdk'

let groq: Groq | null = null

function getGroqInstance(): Groq {
  if (!groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in environment variables')
    }
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    })
  }
  return groq
}

export interface GroqCallOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  /** When set, forces the model to return valid JSON (no code fences). */
  response_format?: 'json_object';
}

/** Strip all code-fence variants (```json, ```, etc.) from a model response. */
export function cleanJsonResponse(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()
}

export async function callGroqWithRetry(
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxRetries: number = 2,
  estimatedOutputChars: number = 3000,
  options?: GroqCallOptions
): Promise<string> {
  let lastError: Error | null = null

  console.log('[Groq] callGroqWithRetry starting with model:', model)
  console.log('[Groq] API Key present:', !!process.env.GROQ_API_KEY)
  console.log('[Groq] System prompt length:', systemPrompt?.length || 'UNDEFINED')
  console.log('[Groq] Options:', options || 'defaults')

  if (!systemPrompt) {
    throw new Error('System prompt is empty or undefined')
  }

  const estimatedTokens = Math.ceil((estimatedOutputChars / 4) * 1.2)
  const maxTokens = options?.max_tokens ?? Math.min(2500, Math.max(1500, estimatedTokens))
  const temperature = options?.temperature ?? 0.7
  console.log('[Groq] Using temperature:', temperature, 'max_tokens:', maxTokens)

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Groq] Attempt ${attempt + 1}/${maxRetries + 1}`)
      const groqClient = getGroqInstance()
      const message = await groqClient.chat.completions.create({
        model,
        max_tokens: maxTokens,
        temperature,
        ...(options?.top_p && { top_p: options.top_p }),
        ...(options?.response_format === 'json_object' && {
          response_format: { type: 'json_object' },
        }),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      })

      const content = message.choices[0].message.content
      if (content) {
        console.log('[Groq] Success! Response length:', content.length)
        return content
      }

      throw new Error('Unexpected response format from Groq')
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`[Groq] Attempt ${attempt + 1} failed:`, lastError.message)

      if (lastError.message.includes('schema') || lastError.message.includes('validation')) {
        throw lastError
      }

      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000)
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
      }
    }
  }

  throw lastError || new Error('Failed to call Groq after retries')
}
