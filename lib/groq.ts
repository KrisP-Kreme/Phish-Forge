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

export function getGroqClient(): Groq {
  return getGroqInstance()
}

export async function callGroqWithRetry(
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxRetries: number = 2,
  estimatedOutputChars: number = 3000 // For dynamic max_tokens
): Promise<string> {
  let lastError: Error | null = null
  
  console.log('[Groq] callGroqWithRetry starting with model:', model)
  console.log('[Groq] API Key present:', !!process.env.GROQ_API_KEY)
  console.log('[Groq] API Key (first 10 chars):', process.env.GROQ_API_KEY?.substring(0, 10))
  console.log('[Groq] System prompt length:', systemPrompt?.length || 'UNDEFINED')
  
  if (!systemPrompt) {
    throw new Error('System prompt is empty or undefined')
  }

  // OPTIMIZATION: Dynamic max_tokens instead of fixed 4096
  // Estimate: 1 token per 4 characters, 20% safety buffer
  const estimatedTokens = Math.ceil((estimatedOutputChars / 4) * 1.2)
  const maxTokens = Math.min(2500, Math.max(1500, estimatedTokens))
  console.log('[Groq] Dynamic max_tokens:', maxTokens, '(estimated output:', estimatedOutputChars, 'chars)')

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Groq] Attempt ${attempt + 1}/${maxRetries + 1}`)
      const groqClient = getGroqInstance()
      const message = await groqClient.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userMessage,
          },
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
      console.error('[Groq] Full error:', error)

      // Don't retry on validation/schema errors
      if (lastError.message.includes('schema') || lastError.message.includes('validation')) {
        throw lastError
      }

      // Retry on transient errors
      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000)
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
      }
    }
  }

  throw lastError || new Error('Failed to call Groq after retries')
}
