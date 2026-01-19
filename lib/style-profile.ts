/**
 * Style Profile: Captures design principles for reuse across emails
 * Extracted once per domain, cached, reused across all emails to that domain
 * Reduces token cost from per-request scraping to one-time extraction
 */

export interface BrandConfidenceLevel {
  headerHeight: 'small' | 'medium' | 'large'
  colorIntensity: 'muted' | 'moderate' | 'saturated'
  visualComplexity: 'simple' | 'moderate' | 'complex'
  whitespace: 'compact' | 'balanced' | 'generous'
}

export interface StyleProfile {
  domain: string
  
  // Tone and voice
  toneProfile: {
    type: 'formal-corporate' | 'urgent-alert' | 'conversational' | 'authoritative'
    sentenceAvg: number // average words per sentence
    contractions: boolean
    voice: string // 1-2 word description
  }

  // Visual rhythm
  visualRhythm: {
    type: 'staccato' | 'flowing' | 'varied'
    paragraphDensity: 'sparse' | 'medium' | 'dense'
    spacingPixels: number // typical spacing between sections
    sectionCount: number // typical sections per email (3-5)
  }

  // Emphasis tools
  emphasisdTools: {
    emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy'
    boldingFrequency: 'rare' | 'selective' | 'frequent'
    capsUsage: 'none' | 'rare' | 'occasional'
    bulletPoints: boolean
    lineSpacing: 'compact' | 'balanced' | 'generous'
    colorStrategy: 'single' | 'dual' | 'multi'
  }

  // CTA strategy
  ctaStrategy: {
    placement: 'top' | 'inline' | 'bottom'
    prominence: 'subtle' | 'medium' | 'prominent'
    count: 'single' | 'multiple'
    framing: string // "direct", "professional", etc.
  }

  // Brand confidence
  confidence: BrandConfidenceLevel

  // Metadata
  extractedAt: string
  cached: boolean
}

/**
 * Minimal style profile for prompt injection (~30-50 tokens)
 * Extracted from full profile
 */
export interface CompactStyleProfile {
  domain: string
  tone: string
  rhythm: string
  emojiUsage: string
  boldingLevel: string
  ctaPlacement: string
  confidence: string
}

/**
 * Extract style profile to compact format for prompt
 */
export function compactifyStyleProfile(profile: StyleProfile): CompactStyleProfile {
  return {
    domain: profile.domain,
    tone: profile.toneProfile.type,
    rhythm: `${profile.visualRhythm.type} - ${profile.visualRhythm.paragraphDensity}`,
    emojiUsage: profile.emphasisdTools.emojiUsage,
    boldingLevel: profile.emphasisdTools.boldingFrequency,
    ctaPlacement: profile.ctaStrategy.placement,
    confidence: `${profile.confidence.colorIntensity} colors, ${profile.confidence.whitespace} whitespace`,
  }
}

/**
 * Build style guidance string for email prompt
 * Replaces verbose design guidelines with concise constraints
 */
export function buildStyleGuidance(profile: CompactStyleProfile): string {
  return `STYLE CONSTRAINTS (from target brand profile):
- Tone: ${profile.tone}
- Visual rhythm: ${profile.rhythm}
- Emphasis: ${profile.boldingLevel} bolding, ${profile.emojiUsage} emojis
- CTA placement: ${profile.ctaPlacement}
- Brand confidence: ${profile.confidence}`
}
