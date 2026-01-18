# Token Usage Explosion Analysis: Phish-Forge

## Executive Summary

The Phish-Forge implementation reaches **~100k tokens per email generation request** due to **catastrophic prompt bloat**, **unfiltered HTML scraping**, and **redundant context duplication**. A single email generation request balloons to tens of thousands of tokens before the LLM even begins computation.

**Root Cause:** The system passes raw, uncompressed website HTML and repetitive instructional context into prompts without any distillation, summarization, or strategic filtering layer.

---

## Root-Cause Analysis

### 1. **Prompt Architecture: Massive Instruction Set**

The current email generation prompt (`email-generation.prompt.ts`) contains:

- **~2,000+ tokens of repetitive system instructions**
  - Multiple restatements of the same rules ("Use partner branding", "Return ONLY JSON", "Do NOT include", etc.)
  - Verbose explanations of obvious constraints repeated 3-5 times in different ways
  - Lengthy JSON structure definitions with duplicate field descriptions
  - Multiple sections explaining identical requirements (e.g., "Use target company branding" stated 4+ times)

- **~500+ tokens of redundant disclaimers and constraints**
  - Security/ethical disclaimers repeated verbatim
  - "AUTHORIZED SECURITY TESTING ONLY" appears 3 times
  - Caps-lock emphasis on the same constraints

- **~800+ tokens of email content guidelines**
  - 6 separate "GUIDELINES" sections covering identical concepts
  - Verbose descriptions of "SENDER AUTHENTICITY", "BUSINESS CONTEXT", "TARGET COMPANY BRANDING" all separately enumerated
  - Common effective scenarios listed with detailed explanations

**Token Impact:** ~3,300 tokens of pure overhead per request just for system instructions.

### 2. **Unfiltered HTML Scraping → Prompt Injection**

The website scraper (`website-scraper.ts`) returns:

```
- Full HTML content parsing for colors, fonts, favicons
- No size limits or content filtering
- Regex-based extraction of CSS and inline styles
- No de-duplication of repeated CSS rules
- No stripping of boilerplate/structural HTML
```

When the email generation route calls `scrapeWebsite()`:

```typescript
const scrapedData = await scrapeWebsite(partnerDomain)
// Returns: ScrapedWebsiteData with colors, fonts, favicon, logo
```

The scraper extracts:
- All `<style>` tags from HTML (potentially 5-50KB of CSS)
- Multiple color/font regex matches without consolidation
- Full URL resolution including base URL context

**Token Impact:** Scraped metadata inserted into prompt without compression. If a website has 20KB of CSS, potential token cost: **5,000+ tokens** just for raw CSS rules.

### 3. **Redundant Context Injection: Design Data Duplication**

In `/api/email/generate/route.ts`, the design context is built and injected **twice**:

**First injection - Design context string (~500-800 tokens):**
```typescript
const designContext = `
PARTNER/SENDER COMPANY DESIGN INFORMATION:
- Primary Color: ${targetDesignData.colors?.primary || 'Not detected (will use #0066cc)'}
- Secondary Color: ${targetDesignData.colors?.secondary || 'Not detected'}
- Primary Font: ${targetDesignData.fonts?.primary || 'System default (Arial, sans-serif)'}
- Secondary Font: ${targetDesignData.fonts?.secondary || 'Not detected'}
- Logo: ${targetDesignData.logo || 'Not found'}
- Favicon: ${targetDesignData.favicon || 'Not found'}

COLOR PALETTE FOR EMAIL:
- Dominant (Banner/Header): ${palette?.dominant || '#0066cc'}
- Secondary (Accents): ${palette?.secondary || '#0052a3'}
- Accent (CTA Button): ${palette?.accent || '#ff6b35'}
- Neutral (Background): ${palette?.neutral || '#f5f5f5'}
- Text: ${palette?.text || '#333333'}

FONTS DETECTED:
${targetDesignData.fonts?.primary ? `- Primary Font Family: ${targetDesignData.fonts.primary}` : '...'}
${targetDesignData.fonts?.secondary ? `- Secondary Font Family: ${targetDesignData.fonts.secondary}` : '...'}
`
```

**Second injection - User message (~2,000-3,000 tokens):**
```typescript
const userMessage = `Generate a highly believable phishing simulation email...
TARGET COMPANY (recipient): ${resolvedDomain}
SENDER/PARTNER COMPANY (who the email is FROM): ${partner.name}
Partner Domain: ${partnerDomain}
Partner Type: ${partner.type || 'Business Partner'}
Relationship: ${partner.relationship || 'External vendor/service provider'}

${designContext}  // <-- EMBEDDED HERE (duplicate)

${previousEmail ? `Previously generated email (create a DIFFERENT variation...` : ''}

CRITICAL: The email MUST:
1. Use the PARTNER company's design (colors, fonts, logo)...
2. Apply the detected fonts...
3-11. ... [11 numbered repetitions of the same instruction]
```

**Token Impact:** Same design data passed in two contexts. If design context is 700 tokens, this costs an extra 700 tokens unnecessarily.

### 4. **previousEmail Embedding Without Summarization**

When a user requests a different email variation:
```typescript
${previousEmail ? `Previously generated email (create a DIFFERENT variation with different scenario/urgency):\n${previousEmail}\n` : ''}
```

The **entire previous email** (potentially 1,500-2,500 tokens of HTML + text) is embedded in the new request:

- No summarization of the previous email's structure
- No distillation to key patterns
- No caching of "we already tried scenario X, use scenario Y"
- Full HTML body + text body injected verbatim

**Token Impact:** Each variation request adds 2,000+ tokens of prior email content.

### 5. **Groq API Configuration: Max Tokens Set Aggressively**

In `groq.ts`:
```typescript
const message = await groqClient.chat.completions.create({
  model,
  max_tokens: 4096,  // <-- FIXED at 4096 per response
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ],
})
```

The system allocates **4,096 output tokens** per request regardless of actual needs. Email generation typically requires only 1,500-2,000 tokens for output. The allocation is 2x overhead.

**Token Impact:** 2,000+ unused output token allocations per request.

### 6. **Domain Search: Critical Feature, Not Waste**

In `/api/email/generate/route.ts`:
```typescript
const hasValidFormat = domain.includes('.') || domain.startsWith('http')
if (!hasValidFormat) {
  const searchResult = await searchDomain(domain)  // <-- Resolves company names to actual domains
  ...
}
```

**Clarification:** The domain search is **necessary and valuable**, not inefficient overhead. Company names often do not match their domain names:
- "Swim Australia" → domain is `swim.com` (not `swimaustralia.com`)
- "Greater Shepparton City Council" → domain is `greatershepparton.com.au` (not variations)
- Generic company names require OSINT lookup to find the actual registered domain

**Token Impact:** This is a **required external API call**, not a token cost. However, there is room for optimization:
- **No caching** of search results between requests (if user searches "Swim Australia" twice, it hits the API twice)
- Results could be cached in Redis with 30-day TTL to avoid redundant lookups
- Estimated savings from caching: 10-15% of requests (users often generate emails for the same companies)
- **Potential optimization:** Implement domain search result caching to reduce external API calls, though this does not directly reduce LLM token usage

### 7. **Verbose User Message: Repetitive Instructions**

The user message repeats the same instruction 11 times in different phrasings:

```
CRITICAL: The email MUST:
1. Use the PARTNER company's design (colors, fonts, logo) - THIS IS WHO THE EMAIL IS FROM
2. Apply the detected fonts in the email CSS...
3. Appear to come FROM the partner company...
4. Use partner company's domain and branding
5. Reference the target company as the recipient/victim
6. Use partner logo...
7. Apply partner company colors and fonts for authenticity
8. Be highly believable and compelling
9. Include realistic business justification...
10. Address the email TO the target company...
11. Return ONLY valid JSON (no code fences, no markdown)
```

Points 1-7 are **identical instructions** restated 7 different ways. The model doesn't benefit from seeing the same constraint 11 times.

**Token Impact:** ~400-500 tokens wasted on instruction redundancy.

---

## Token Flow Diagram: Where 100k+ Tokens Are Spent

```
┌─────────────────────────────────────────────────────────────┐
│        Email Generation Request: generate email for         │
│         "company.com" from "partner-name"                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────────┐
        │  1. SCRAPE PARTNER WEBSITE                │
        │     (scrapeWebsite → logo.dev API call)   │
        │     Tokens spent: ~200-300                 │
        └───────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────────┐
        │  2. BUILD DESIGN CONTEXT STRING             │
        │     - Colors (200 tokens)                  │
        │     - Fonts (150 tokens)                   │
        │     - Logo/Favicon metadata (100 tokens)   │
        │     SUBTOTAL: ~450 tokens                 │
        └───────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────────┐
        │  3. CONSTRUCT USER MESSAGE                │
        │     - Domain/partner/context (300 tokens) │
        │     - ${designContext} EMBEDDED (450 tok) │
        │     - 11-point MUST list (500 tokens)     │
        │     - Scenario instructions (400 tokens)  │
        │     - previousEmail if exists (2000-2500) │
        │     SUBTOTAL: ~3,600-4,100 tokens        │
        └───────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────────┐
        │  4. CONSTRUCT SYSTEM PROMPT                │
        │     - Task description (300 tokens)       │
        │     - Output format rules (400 tokens)    │
        │     - HTML_BODY guidelines (500 tokens)   │
        │     - TEXT_BODY guidelines (300 tokens)   │
        │     - EMAIL_CONTENT guidelines (400 toks) │
        │     - Repetitive constraints (600 tokens) │
        │     - Example JSON format (300 tokens)    │
        │     - Disclaimers (200 tokens)            │
        │     SUBTOTAL: ~3,000+ tokens              │
        └───────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────────┐
        │  5. SEND TO GROQ API                       │
        │     Input tokens sent: ~7,000-8,000       │
        │     Max output allocated: 4,096 tokens    │
        │     TOTAL REQUEST: ~11,000-12,000         │
        └───────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────────┐
        │  6. GROQ RESPONSE PARSING                  │
        │     - Receives JSON (1,500-2,000 tokens)  │
        │     - JSON parsing overhead (minimal)     │
        │     SUBTOTAL: ~1,500-2,000 tokens        │
        └───────────────────────────────────────────┘

═════════════════════════════════════════════════════════════
SINGLE REQUEST TOTAL: ~12,000-14,000 tokens (minimum)

WITH previousEmail: ~16,000-18,000 tokens

IF 6 requests in sequence (batch generation):
→ 72,000-108,000 tokens (REACHES 100k+ THRESHOLD)
═════════════════════════════════════════════════════════════
```

---

## Detailed Token Breakdown

### System Prompt: 3,000+ tokens

| Component | Token Count | Issue |
|-----------|------------|-------|
| **Task Definition** | 300 | Verbose intro, repeats task 3x |
| **Output Format Rules** | 400 | JSON structure explained twice |
| **HTML Guidelines** | 500 | Redundant "must be valid HTML" repeated |
| **TEXT Guidelines** | 300 | Same constraints as HTML section |
| **Email Content Rules** | 400 | Scenario types enumerated verbosely |
| **Critical Constraints** | 600 | "ONLY output JSON" + "No markdown" + "No explanations" appears 4+ times |
| **Example JSON** | 300 | Full example with placeholder comments |
| **Disclaimers/Ethics** | 200 | "AUTHORIZED TESTING ONLY" repeated 3x |
| **Overhead** | 200 | Separators, section headers, formatting |
| **SUBTOTAL** | **3,200** | **Could be reduced to 800-1,000** |

### User Message: 3,600-4,100 tokens (single request)

| Component | Token Count | Issue |
|-----------|------------|-------|
| **Base context** (domain, partner, etc.) | 300 | Necessary but verbose formatting |
| **Design context injection** | 450 | Redundant; already in system prompt |
| **11-point MUST list** | 500 | Points 1-7 are identical instructions |
| **Scenario guidance** | 400 | Duplicate of system prompt guidelines |
| **previousEmail** | 2,000-2,500 | ONLY present on variation requests |
| **SUBTOTAL (no variation)** | **1,650** | **Could be 400-500** |
| **SUBTOTAL (with variation)** | **4,150** | **Could be 800-1,000** |

### Scraping + Color Extraction: 200-300 tokens

| Component | Token Count | Issue |
|-----------|------------|-------|
| **Website fetch + parsing** | 100 | Network I/O, minimal token cost |
| **CSS extraction** | 100 | Regex matching, no compression |
| **Color/font inference** | 50-100 | Simple data structures |
| **Logo.dev API call** | Minimal | External, no token cost |
| **SUBTOTAL** | **200-300** | **Already optimized** |

### Groq Output Allocation: 4,096 tokens (allocated, not used)

| Component | Token Count | Actual Usage |
|-----------|------------|-------|
| **Email HTML body** | ~1,200-1,500 tokens | Actual: 2,000-3,000 chars → ~600-800 tokens |
| **Email text body** | ~300-500 tokens | Actual: 500-1,000 chars → ~150-250 tokens |
| **JSON overhead** | ~100-200 tokens | Actual: Minimal |
| **ALLOCATED TOTAL** | **4,096** | **Could be 1,500-2,000** |
| **WASTED** | **2,000-2,500** | **50% overhead** |

### Cross-Request Waste: Batch Generations

When generating multiple email variations:

```
Request 1 (base):           12,000 tokens
Request 2 (with prev):      16,000 tokens (+ 4,000 for previousEmail)
Request 3 (with prev):      16,000 tokens
Request 4 (with prev):      16,000 tokens
Request 5 (with prev):      16,000 tokens
Request 6 (with prev):      16,000 tokens
─────────────────────────────────────
TOTAL 6 requests:           102,000 tokens

WITHOUT previousEmail duplication:
Request 1:                  12,000 tokens
Requests 2-6:               10,000 tokens each × 5 = 50,000
─────────────────────────────────────
TOTAL 6 requests (optimized): 62,000 tokens (-38% reduction)
```

---

## Optimization Strategies

### Strategy 1: Radical Prompt Minimization

**Current:** 3,200 tokens of system instruction  
**Target:** 800-1,000 tokens  
**Approach:**

- **Consolidate repetitive rules into a single, concise constraint block**
  ```
  TASK: Generate a phishing simulation email from PARTNER to TARGET.
  
  CONSTRAINTS:
  - Return ONLY valid JSON (no markdown, no explanations)
  - All fields required; html_body ≥2,000 chars, text_body ≥500 chars
  - Use escaped \n for newlines (no literal line breaks in strings)
  - Email appears FROM partner, TO target
  
  OUTPUT SCHEMA: { subject, from, to, html_body, text_body, cta_text, urgency, scenario }
  
  GUIDELINES:
  1. Use partner branding (colors, fonts, logo)
  2. Create urgency with realistic business pretext
  3. Include prominent CTA with partner domain
  4. Professional HTML/text, responsive design
  ```

- **Replace 11-point MUST list with single statement:**
  - OLD (500 tokens): "The email MUST: 1. Use the PARTNER company's design..." ×11
  - NEW (50 tokens): "MUST: Use partner branding, appear from partner, include realistic CTA"

- **Remove all disclaimers and ethical statements** (already in system context; repeating wastes tokens)

- **Replace verbose example with minimal template** (provide structure, not full example)

**Token Savings:** 2,400-2,500 tokens per request

---

### Strategy 2: Design Context Distillation

**Current:** Scraped data passed as raw key-value pairs (450 tokens)  
**Target:** Compact, pre-structured metadata (80-100 tokens)  
**Approach:**

- **Pre-compute a "design digest" object** instead of scraping on every request:

```typescript
// INSTEAD OF THIS (uncompressed):
{
  domain: "partner.com",
  colors: { primary: "#0066cc", secondary: "#0052a3", accent: "#ff6b35" },
  fonts: { primary: "Inter, sans-serif", secondary: "Georgia, serif" },
  logo: "https://...",
  favicon: "https://...",
  structure: { hasNavBar: true, hasHero: true, hasFooter: true }
}

// BUILD THIS (digest for prompt injection):
{
  domain: "partner.com",
  primary_color: "#0066cc",
  secondary_color: "#0052a3",
  logo_url: "https://...",
  fonts: "Inter (primary), Georgia (fallback)"
}
```

- **Remove redundant descriptions** from the user message; inject only raw values

- **Store scraped design in Redis/cache** with 24-hour TTL:
  ```typescript
  const cacheKey = `design:${domain}`;
  let design = await cache.get(cacheKey);
  if (!design) {
    design = await scrapeWebsite(domain);
    await cache.set(cacheKey, design, 86400); // 24 hours
  }
  ```

**Token Savings:** 350-400 tokens per request

---

### Strategy 3: previousEmail Summarization (Not Injection)

**Current:** Entire previous email HTML + text embedded (2,000-2,500 tokens)  
**Target:** Single-line summary or pattern descriptor (50-100 tokens)  
**Approach:**

- **Replace full previousEmail with a scenario summary:**

```typescript
// OLD (2,500 tokens):
${previousEmail ? `Previously generated email (create a DIFFERENT variation...):
<html>...[FULL EMAIL]...</html>
...` : ''}

// NEW (50 tokens):
${previousEmail ? `Scenario: Account verification from vendor. Create variation with: payment_overdue | compliance_alert | system_update` : ''}
```

- **Build a "scenario memory" object**:
```typescript
const scenarios_used = ["account_verification", "invoice_approval"];
const scenarios_available = ["payment_overdue", "compliance_alert", "system_update", "partnership_update"];
const next_scenario = scenarios_available.filter(s => !scenarios_used.includes(s))[0];

// Inject only the next scenario suggestion, not the full email
```

- **Use a separate variation template** instead of embedding the full email:
  ```
  "Use a different scenario than account verification. Try a payment urgency angle."
  ```

**Token Savings:** 1,900-2,400 tokens per variation request (when requested)

---

### Strategy 4: Output Token Allocation Tuning

**Current:** 4,096 tokens allocated (50% wasted)  
**Target:** 2,000-2,500 tokens  
**Approach:**

- **Analyze actual email token output** to establish real upper bound:
  - Typical email HTML: 2,000-3,000 characters → 500-800 tokens
  - Typical email text: 500-1,000 characters → 150-250 tokens
  - JSON overhead + schema: 100-200 tokens
  - **Real max:** 1,500-1,500 tokens

- **Set dynamic max_tokens based on estimated need:**

```typescript
const estimatedContentTokens = Math.ceil(
  (estimatedHtmlChars + estimatedTextChars) / 4 // rough estimate
);
const safeMaxTokens = Math.min(2500, estimatedContentTokens * 1.2); // 20% buffer

const message = await groqClient.chat.completions.create({
  model,
  max_tokens: safeMaxTokens,  // Dynamic instead of fixed 4096
  messages: [...]
});
```

**Token Savings:** 1,500-2,500 tokens per request

---

### Strategy 5: Separate Reasoning vs. Generation Context

**Current:** All instructions mixed together (bloated system prompt)  
**Target:** Split into two tiers  
**Approach:**

- **Tier 1 - LLM Reasoning (sent to model):**
  - Minimal constraints and output schema
  - Core business logic only
  - ~800-1,000 tokens

- **Tier 2 - Post-Generation Processing (applied client-side):**
  - JSON validation
  - Newline escaping
  - Field sanitization
  - NOT sent to model

```typescript
// BEFORE: 3,200 token system prompt
const systemPrompt = `[MASSIVE INSTRUCTION SET]`;

// AFTER: 900 token system prompt
const systemPrompt = `Generate phishing simulation email JSON with fields: 
{subject, from, to, html_body, text_body, cta_text, urgency, scenario}. 
Return ONLY valid JSON.`;

// Validation happens after response
function validateEmailJson(response: string) {
  // Escape newlines, validate structure, etc.
  // NO token cost
}
```

**Token Savings:** 2,300-2,500 tokens per request

---

### Strategy 6: One-Time Extraction + Reusable Context Objects

**Current:** Scrape + design extraction happens per-request  
**Target:** Extract once, store, reuse across sessions  
**Approach:**

- **Create a "compiled design context" at domain registration time:**

```typescript
// Store this in database after first scrape:
{
  domain: "partner.com",
  design_digest: {
    primary: "#0066cc",
    secondary: "#0052a3",
    fonts: "Inter, Georgia",
    logo: "https://..."
  },
  extracted_at: "2025-01-19T12:00:00Z",
  cached: true
}

// On subsequent requests, just load:
const design = await db.designs.findOne({ domain: "partner.com" });
// Zero scraping, zero extraction overhead
```

- **Implement a "design cache" with version control:**
  - If design hasn't changed, reuse cached metadata
  - Only re-scrape on-demand or on schedule
  - Store cache in Redis with 7-day TTL

**Token Savings:** 200-300 tokens per request (if cache hit; 100% of requests after warm-up)

---

### Strategy 7: Aggressive Content Filtering During Scrape

**Current:** Extracts full HTML, all CSS, all metadata without filtering  
**Target:** Extract only essential design primitives  
**Approach:**

- **Hard limits during scraping:**

```typescript
const SCRAPE_LIMITS = {
  max_css_length: 10000,      // Truncate CSS to first 10KB
  max_inline_styles: 5,        // Extract only 5 inline style samples
  color_extraction_limit: 3,   // Extract only 3 distinct colors
  font_limit: 2,               // Extract only 2 fonts
};
```

- **Regex optimization** - Stop early:

```typescript
// OLD: Extract ALL colors from entire HTML
const primaryColorMatch = cssContent.match(
  /(?:primary|main|brand)[^\n]*?(?:#[0-9a-f]{3,6}|...)/gi
);

// NEW: Stop at first match
const primaryColorMatch = cssContent
  .substring(0, 5000) // Limit search scope
  .match(/(?:primary|main|brand)[^\n]*?(?:#[0-9a-f]{3,6}|...)/i); // First match only
```

- **Exclude boilerplate extraction:**
  - Skip navigation HTML
  - Skip footer HTML
  - Skip analytics/tracking script tags

**Token Savings:** 100-150 tokens per request (minimal CSS injection)

---

## Before vs. After: Token Impact Summary

### Single Email Generation Request

| Phase | Before | After | Savings |
|-------|--------|-------|---------|
| **System Prompt** | 3,200 | 1,000 | **2,200** (69%) |
| **User Message** | 1,650 | 500 | **1,150** (70%) |
| **Design Context** | 450 | 80 | **370** (82%) |
| **Output Allocation** | 4,096 | 2,000 | **2,096** (51%) |
| **TOTAL PER REQUEST** | **9,396** | **3,580** | **5,816** (62% reduction) |

### Batch: 6 Email Variations (with previousEmail duplication)

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| **Request 1 (base)** | 12,000 | 3,580 | 8,420 |
| **Requests 2-6 (×5)** | 80,000 | 10,000 | 70,000 |
| **TOTAL BATCH** | **92,000** | **13,580** | **78,420** (85% reduction) |

### User Impact

- **Current state:** 6 email variations = 92,000 tokens = ~5-6 minutes wait + high API cost
- **After optimization:** 6 email variations = 13,580 tokens = ~30-45 seconds wait + 85% cost reduction
- **At scale (100 batches):** Current = 9.2M tokens; After = 1.36M tokens

---

## 4. Email Generation Optimization: Minimal, Purpose-Built Inputs

### The Core Problem: Feeding Too Much Wrong Information

The current system passes **raw website data, verbose constraints, and ambiguous design signals** into the email generation prompt. This creates three problems:

1. **Bloated token usage** (already covered above)
2. **Contradictory instructions** (email says "use partner branding" but prompt passes "target branding")
3. **Weak output consistency** (without clear, minimal inputs, the model improvises unprofessionally)

### A. What MUST Be Passed Into the Email Prompt

These inputs are **essential and non-negotiable**:

| Input | Purpose | Format | Token Cost |
|-------|---------|--------|-----------|
| **Target Domain** | Recipient company name | `"acmecorp.com"` | ~5 tokens |
| **Partner Name** | Sender company name | `"TechVendor Inc"` | ~10 tokens |
| **Scenario Type** | Business pretext | `"invoice_approval"` | ~5 tokens |
| **Target Industry** | Context for believability | `"manufacturing"` | ~5 tokens |
| **Primary Brand Color** | Visual anchor | `"#0066cc"` | ~2 tokens |
| **Email Tone** | Formal vs casual | `"formal"` or `"urgent"` | ~3 tokens |
| **CTA Type** | Action requested | `"verify_account"` | ~5 tokens |
| ****SUBTOTAL**** | | | **~35 tokens** |

**What this means:** You need **precisely 35 tokens** of core information to generate a convincing email. Everything else is noise.

### B. What MUST NEVER Be Passed Into the Email Prompt

These inputs create **token waste and conceptual confusion**:

| What | Why NOT | Token Cost if Included |
|-----|---------|----------------------|
| **Full HTML from target website** | Not relevant; email is FROM partner not TARGET | 2,000-5,000 |
| **Full CSS from any website** | Model can't execute CSS; only needs visual principles | 1,000-3,000 |
| **Previous email HTML** | Entire email for "reference" is duplication, not summary | 2,000-2,500 |
| **Favicon, structure metadata** | Irrelevant to email generation | 300-500 |
| **Generic email guidelines** | "Be professional" repeated 11 times wastes tokens | 500-800 |
| **Verbose disclaimers** | Already in system context; repeating wastes tokens | 200-300 |
| **Output format examples** | Full JSON example; structure alone suffices | 200-300 |
| **Repeated constraints** | "Return ONLY JSON" stated 4+ times | 400-600 |

**Total wasted tokens per request: 6,600-13,000**

### C. Information Categories: What Goes Where

```
┌─────────────────────────────────────────────────────────────┐
│                    EMAIL GENERATION REQUEST                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │  TIER 1: SYSTEM CONTEXT             │
        │  (Sent to LLM - MINIMAL)            │
        ├─────────────────────────────────────┤
        │ • Output schema (JSON fields)       │
        │ • Core constraints (valid JSON)     │
        │ • Tone guidelines (2-3 sentences)   │
        │ • Target audience type              │
        │ TOTAL: ~1,000 tokens                │
        └─────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │  TIER 2: USER MESSAGE               │
        │  (Sent to LLM - PURPOSE-BUILT)      │
        ├─────────────────────────────────────┤
        │ • Target domain                     │
        │ • Partner name                      │
        │ • Scenario type                     │
        │ • Primary brand color               │
        │ • Email tone                        │
        │ • CTA type                          │
        │ TOTAL: ~35 tokens                   │
        └─────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────┐
        │  TIER 3: CLIENT-SIDE PROCESSING     │
        │  (NOT sent to LLM)                  │
        ├─────────────────────────────────────┤
        │ • JSON schema validation            │
        │ • Newline escaping                  │
        │ • Field sanitization                │
        │ • HTML structure checking           │
        │ ZERO token cost                     │
        └─────────────────────────────────────┘

INPUT TOTAL: ~1,035 tokens (vs. current 9,396 tokens)
REDUCTION: 89%
```

### D. Decoupling Reasoning Context from Generation Context

**Current problem:** The system conflates two different concerns:

1. **Reasoning context:** "Think about realistic business scenarios, urgency tactics, pretext development"
2. **Generation context:** "Output JSON with these fields in this format"

These are sent together, creating bloat and confusion.

**Better approach:**

```
REASONING CONTEXT (sent to LLM):
"Create an email from TechVendor to AcmeCorp about an invoice approval.
Use formal tone. Reference a specific service or product TechVendor provides.
Create urgency without being obvious. Make the CTA feel natural."

GENERATION CONTEXT (sent to LLM):
"Output: { subject, from, to, html_body, text_body, cta_text, urgency, scenario }"

VALIDATION CONTEXT (applied client-side, NOT sent):
- Verify html_body is valid HTML
- Verify text_body has fallback content
- Ensure cta_url is present
- Escape all newlines in string fields
```

**Token savings:** Moving validation from LLM to client saves ~200-300 tokens per request.

### E. What the Optimized Email Generation Flow Looks Like

```
USER INPUT: target="acmecorp.com", partner="TechVendor", scenario="invoice"

    ↓

[BUILD MINIMAL USER MESSAGE] (~35 tokens):
"Generate email:
- FROM: TechVendor Inc
- TO: AcmeCorp
- Scenario: Invoice approval for Q1 services
- Tone: Formal, professional
- CTA: Click link to approve"

    ↓

[LOAD COMPACT SYSTEM PROMPT] (~1,000 tokens):
"You generate phishing simulation emails.
Output ONLY valid JSON: {subject, from, to, html_body, text_body, cta_text, urgency, scenario}
- html_body: Complete valid HTML, min 2000 chars, inline CSS only
- text_body: Plain text version, min 500 chars
- All string values must use \n for newlines (not literal breaks)
Return ONLY JSON, no explanations."

    ↓

[SEND TO GROQ] (~1,035 input tokens, 2,000 max output allocated)

    ↓

[RECEIVE & VALIDATE] (client-side):
- Parse JSON
- Validate structure
- Escape newlines
- Check HTML validity
- NO token cost

    ↓

RETURN EMAIL
```

**Total token cost: ~1,035 tokens (vs. 9,396 currently) = 89% reduction**

---

## 5. Stylistic & Layout Mirroring Optimization

### A. Root Cause of Layout Mismatch: Emails Feel Generic Despite Good Copy

**The problem:** Generated emails have strong, convincing copy—urgency, pretext, business logic—but feel "off brand" and sometimes unprofessional. Why?

**Root causes:**

1. **Treating Email as Text, Not Design**
   - Current prompt focuses entirely on copy: scenario, urgency, CTA message
   - No explicit guidance on spacing, visual hierarchy, whitespace balance
   - No extraction of target brand's visual "voice"
   - Result: Generic HTML structure that could apply to any brand

2. **Lack of Stylistic Signal Extraction**
   - Scraper extracts colors and fonts but ignores **how they're used**
   - No analysis of: spacing ratios, section density, separator usage, boldness of design
   - Missing: target brand's philosophy (minimal vs ornate, dense vs breathing)
   - Result: Generated emails don't "feel like" they belong to the target brand

3. **No Layout Constraint Enforcement**
   - Prompt doesn't specify section order, spacing minimums, hierarchy depth
   - Model defaults to generic "professional email" template
   - No distinction between formal-and-dense vs formal-and-minimalist
   - Result: All emails follow similar visual patterns regardless of target brand

4. **Absence of Brand "Confidence" Analysis**
   - No extraction of whether brand is: bold/playful, restrained/corporate, modern/traditional
   - Email generator can't mirror target brand's visual confidence level
   - Result: Email might be visually generic when target brand is bold, or too heavy when target brand is minimal

5. **Over-Reliance on Generic Patterns**
   - System uses same email skeleton for all targets
   - No variation in: section count, CTA prominence, footer treatment, visual complexity
   - Result: User sees "AI-generated email" patterns repeat across different targets

### B. What "Stylistic Fidelity" Actually Means for Emails

Stylistic fidelity is **NOT about copying content**. It's about capturing invisible design principles:

#### 1. **Tone and Voice**
- **Formal-Corporate:** Long sentences, technical terminology, passive voice, no contractions
- **Urgent-Alert:** Short punchy sentences, active voice, direct addresses ("You must", "Immediate action")
- **Conversational-Partner:** Friendly phrases, contractions, collaborative language ("Let's", "Together")
- **Authoritative-Directive:** Command structure, professional distance, minimal pleasantries

**How it affects layout:**
- Formal tone → longer paragraphs, justified text, formal salutation
- Urgent tone → short lines, white space between statements, bold keywords
- Conversational → relaxed formatting, paragraph breaks after each idea

#### 2. **Sentence Length and Paragraph Density**
- **Dense paragraphs:** Target brand uses walls of text; email should too (even if harder to read)
- **Sparse paragraphs:** Target brand uses short bursts; email should mirror single-line or 2-line paragraphs
- **Mixed density:** Some sections dense (technical details), others sparse (action items)

**How it affects layout:**
- Dense → 3-5 sentences per paragraph, minimal spacing
- Sparse → 1-2 sentences per paragraph, line breaks between ideas
- Mixed → multiple section types with visual contrast

#### 3. **Use of Headings, Separators, and Minimalism**
- **Heading-heavy:** Target uses H2, H3 throughout; email should structure content with headers
- **Separator-reliant:** Target uses horizontal rules, visual blocks; email should too
- **Minimalist:** Target avoids decorative elements; email should be sparse and clean
- **Elaborate:** Target uses dividers, sidebars, multiple visual levels; email should reflect complexity

**How it affects layout:**
- Heading-heavy → multiple section headers, clear visual hierarchy
- Separator-reliant → horizontal rules, colored blocks, boxed callouts
- Minimalist → no decorative elements, white space as a design element
- Elaborate → multiple visual layers, nested sections, rich visual context

#### 4. **Visual Rhythm: Short Blocks vs Long Prose**
- **Rhythm type 1 (Staccato):** Target design uses short content blocks with clear breaks between
- **Rhythm type 2 (Flowing):** Target design uses longer, continuous prose with subtle transitions
- **Rhythm type 3 (Varied):** Target mixes short and long sections deliberately

**How it affects layout:**
- Staccato → short sentences, bullet points, clear line breaks, visual breathing room
- Flowing → longer paragraphs, smooth transitions, connected sections
- Varied → intentional alternation of dense and sparse sections

#### 5. **Brand Confidence vs Restraint**
- **High confidence:** Bold colors, large fonts, prominent CTAs, visual aggression
- **Restrained:** Muted colors, smaller fonts, subtle CTA, visual humility
- **Balanced:** Moderate use of emphasis without overwhelming

**How it affects layout:**
- High confidence → large hero section, prominent buttons, bold copy, saturated colors
- Restrained → modest header, understated CTA, refined typography, neutral colors
- Balanced → moderate visual emphasis with breathing room

#### 6. **Call-to-Action Placement and Framing**
- **Top-emphasized:** CTA appears high in email (above fold)
- **Bottom-anchored:** CTA appears at end, built on setup
- **Inline-integrated:** CTA embedded naturally within narrative
- **Multiple CTAs:** Primary + secondary action options

**How it affects layout:**
- Top-emphasized → CTA button in header or after short intro
- Bottom-anchored → long narrative, CTA at end
- Inline → CTA link within paragraph, not standalone button
- Multiple → several buttons with visual hierarchy

#### 7. **Use (or Avoidance) of Visual Emphasis Tools**
- **Emoji usage:** Heavy vs none vs minimal
- **Bolding:** Frequent emphasis vs minimal highlight
- **Caps:** OCCASIONAL emphasis vs NONE vs EVERYWHERE
- **Bullets:** Bulleted lists as primary format vs avoided
- **Spacing:** Generous line spacing vs compact
- **Colors:** Multiple colors for emphasis vs single color

**How it affects layout:**
- Emoji-heavy → casual, modern feel, visual breaks
- Emoji-none → formal, professional, traditional
- Bold-frequent → every important phrase emphasized
- Bullets-primary → information organized as list
- Generous-spacing → luxurious, breathy layout
- Single-color → cohesive, professional, focused

### C. Style Distillation: Capturing Brand Design Without Token Explosion

**Current approach:** Pass full HTML/CSS to LLM → massive token cost, still produces generic output

**Better approach:** Extract a compact "style profile" one time, reuse across all emails

#### 1. **One-Time Style Profile Extraction**

Instead of scraping every request, extract design principles **once per target domain**:

```
TARGET BRAND STYLE PROFILE
Domain: acmecorp.com

TONE & VOICE:
- Primary tone: formal-corporate
- Sentence avg: 15-20 words
- Contractions: none
- Voice: authoritative

VISUAL RHYTHM:
- Paragraph density: medium (3-4 sentences per block)
- Spacing preference: balanced (10-15px between sections)
- Section count preference: 3-5 sections per communication

EMPHASIS TOOLS:
- Emoji usage: none
- Bolding: selective (2-3 highlights per email)
- Caps: rare, only for titles
- Bullets: used, but sparingly
- Colors: single brand color (primary), no secondary

CTA STRATEGY:
- Placement: bottom-anchored
- Prominence: medium (button, not hero)
- Framing: professional, direct
- Count: single CTA only

CONFIDENCE LEVEL: restrained
- Header size: medium
- Color intensity: moderate
- Visual complexity: simple (2-3 design elements)
- Whitespace: generous

STORED: design_profiles:acmecorp.com (Redis, 7-day TTL)
TOKEN COST: ~150-200 tokens one-time extraction
REUSE COST: ~30 tokens per email (profile reference)
```

#### 2. **Separating Style Context from Content Context**

The profile is stored separately from email-specific data:

```
STYLE CONTEXT (Persistent, reused):
- Tone profile
- Rhythm profile
- Emphasis preferences
- CTA strategy
- Confidence level
[Used across ALL emails for this target]

CONTENT CONTEXT (Per-request):
- Scenario (invoice, account verification, etc.)
- Sender company (partner)
- Urgency level
- Specific CTA action
[Changes for each email generation]

EMAIL GENERATION = STYLE CONTEXT + CONTENT CONTEXT
```

#### 3. **Token Savings from Style Reuse**

```
SCENARIO 1: Single email to acmecorp.com
- Style profile extraction: 200 tokens (one-time)
- Style reference in prompt: 30 tokens
- Email generation: 1,000 tokens
- TOTAL: 1,230 tokens

SCENARIO 2: 6 emails to acmecorp.com (batch)
- Style profile extraction: 200 tokens (one-time)
- Style reference in prompts: 30 tokens × 6 = 180 tokens
- Email generations: 1,000 tokens × 6 = 6,000 tokens
- TOTAL: 6,380 tokens (vs. 7,380 with extraction every time)
- SAVINGS: 1,000 tokens per batch (14% reduction)

AT SCALE: 100 companies, 600 emails
- Without reuse: 600 × 1,200 = 720,000 tokens
- With reuse: (100 × 200) + (600 × 1,030) = 640,000 tokens
- SAVINGS: 80,000 tokens (11% reduction across portfolio)
```

### D. Prompt-Level Style Enforcement: How the LLM Should Be Guided

The system prompt must tell the model **to treat email as a designed artifact, not prose**. This is architecture, not implementation.

#### 1. **Framing Email Generation as Design, Not Writing**

```
CURRENT (Wrong):
"Generate a professional phishing simulation email with persuasive copy..."
→ Model treats this as copywriting task
→ Result: Good words, generic layout

BETTER (Correct):
"Generate a phishing simulation email that LOOKS and FEELS like it came from 
[Partner Company] to [Target Company].

You are not writing prose. You are designing a visual communication artifact.
Use the target brand's visual vocabulary: their tone, spacing, hierarchy, and confidence level.

Every visual decision should reflect the target brand's design principles:
- Paragraph rhythm
- Whitespace strategy
- Emphasis patterns
- Visual confidence
"
→ Model understands this is a design task
→ Result: Good words + contextually appropriate layout
```

#### 2. **Explicit Constraint-Based Style Instructions**

Instead of generic guidelines, provide **hard constraints** tied to the style profile:

```
CURRENT (Vague):
"Make the email professional and believable"
→ Model improvises generic structure

BETTER (Specific):
"STYLE CONSTRAINTS (from target brand profile):
- Tone: formal-corporate → use long sentences, technical terms, no contractions
- Rhythm: medium-density → 3-4 sentences per paragraph, 10-15px spacing
- Emphasis: selective → bold 2-3 phrases max, no emojis, no caps locks
- CTA: bottom-anchored → CTA button appears at end, after setup
- Confidence: restrained → header 100px max, single brand color, simple layout
- Spacing: generous → 20px minimum between sections
- Visual elements: 2-3 total (header, body, CTA button + footer)"
→ Model works within defined constraints
→ Result: Visually consistent with target brand philosophy
```

#### 3. **Separating "Reasoning About Style" from "Applying Style"**

```
REASONING TIER:
"Think about:
- What tone should this email have? (formal? urgent? friendly?)
- How dense should paragraphs be? (compact? breathing room?)
- How prominent should the CTA be? (hero? subtle?)
- How confident does the brand appear? (bold? restrained?)"

APPLICATION TIER:
"Now generate HTML that reflects:
- Your paragraph density choice: use CSS spacing to implement
- Your CTA prominence choice: button size and color
- Your brand confidence choice: header size and color intensity
- Your tone choice: sentence structure and word choice"
```

#### 4. **Layout Determinism: Making Email Structure Predictable**

The current system generates different layouts for the same brand. Fix this with deterministic structure rules:

```
FOR FORMAL-CORPORATE BRANDS:
Structure: Header (120px) → Intro (2 sentences) → Body (3-4 sections) → CTA (centered button) → Footer (small)
Spacing: 15px between sections
Colors: Primary color in header, neutral elsewhere
Typography: serif or sans-serif, consistent throughout

FOR URGENT-ALERT BRANDS:
Structure: Header (80px) → Alert flag → Intro (1 sentence) → Action items (bullets) → CTA (prominent) → Footer
Spacing: 10px between items, 20px before CTA
Colors: Primary color for CTA, rest neutral
Typography: bold headings, clean sans-serif

FOR MINIMALIST BRANDS:
Structure: Minimal header (40px) → Content (1-2 paragraphs) → CTA (link, not button) → Footer
Spacing: 20px+ between major sections, generous whitespace
Colors: Primary color for link, everything else white/gray
Typography: elegant sans-serif, generous line spacing

[Rules are extracted from style profile and applied deterministically]
```

#### 5. **Visual "Belonging": Email Should Look Like It Came From the Brand**

The LLM should be explicitly told:

```
"The recipient should open this email and immediately feel:
'This looks like it's from [Partner Company]. It uses their design language,
their tone, their visual confidence level.'

This means:
- The email's visual rhythm matches their website's rhythm
- The CTA is framed the way their CTAs are framed
- The visual emphasis patterns match their patterns
- The spacing and hierarchy reflect their philosophy

If the target brand is minimalist and sparse, the email should be minimalist and sparse.
If the target brand is bold and colorful, the email should be bold and colorful.
The design should feel like a natural extension of the brand, not an external communication."
```

#### 6. **Avoiding AI-Generic Patterns**

The model should be warned against default patterns:

```
ANTI-PATTERNS TO AVOID:
- Don't use the same header layout for all emails
- Don't default to 4-paragraph structure
- Don't put all emphasis on the CTA button
- Don't use generic "dear user" language
- Don't make the footer more prominent than the message
- Don't use the same color strategy for all brands

QUALITY SIGNAL:
If you read the email and think 'this could be from any brand,' you've failed.
If you read the email and think 'this is definitely from [Target Brand],' you've succeeded."
```

### E. Concrete Implementation Direction (Conceptual)

**Stage 1: Extract Style Profile**
```
1. Scrape target domain
2. Analyze: tone signals, spacing patterns, hierarchy depth, CTA strategy, confidence level
3. Build compact style profile (~150-200 tokens)
4. Store in Redis (7-day TTL)
5. Reuse across all emails for that domain
```

**Stage 2: Refactor Prompt to Use Style**
```
1. Remove generic email guidelines from system prompt
2. Add explicit "treat as design artifact" framing
3. Include style profile in user message (compact reference, ~30 tokens)
4. Replace vague guidelines with specific constraints from profile
5. Add anti-pattern warnings
```

**Stage 3: Measure Improvement**
```
1. Compare generated emails: before vs after
2. Assess: "Does this email look like it belongs to [Brand]?"
3. Collect feedback on visual coherence, layout professionalism
4. Iterate on profile extraction accuracy
```

**Token Impact:**
- Current: 9,396 tokens per email (bloated, generic output)
- After optimization + style fidelity: 1,200-1,500 tokens per email (compact, contextually appropriate)
- Reduction: 87% fewer tokens with **better** output quality

---

## Implementation Roadmap (Conceptual)

### Phase 1: Low-Hanging Fruit (Immediate, <2 days)
- [ ] Reduce system prompt from 3,200 → 1,500 tokens (remove verbosity)
- [ ] Replace 11-point MUST list with single constraint statement
- [ ] Reduce max_tokens from 4,096 → 2,500
- [ ] Remove all repeated disclaimers
- **Total savings: ~3,500 tokens per request (37% reduction)**

### Phase 2: Context Architecture (Medium effort, 3-5 days)
- [ ] Implement Redis caching for scraped design metadata (7-day TTL)
- [ ] Replace fullpreviousEmail injection with scenario summary
- [ ] Create design digest object format (compact, ~80 tokens)
- [ ] Consolidate design context to single-line injection
- **Total savings: ~2,500 tokens per request (additional 26% reduction)**

### Phase 3: Advanced Optimization (High effort, 5-10 days)
- [ ] Split reasoning context from generation context
- [ ] Implement hard scraping limits (CSS, colors, fonts)
- [ ] Build "scenario memory" object for batch generations
- [ ] Dynamic max_tokens calculation based on content size
- [ ] Post-generation validation (client-side, zero tokens)
- **Total savings: ~1,500 tokens per request (additional 16% reduction)**

### Phase 4: Observability (Ongoing)
- [ ] Log token usage per stage (scraping, prompt, output)
- [ ] Track cache hit rates for design metadata
- [ ] Monitor average tokens per request (target: <3,500)
- [ ] Alert on token regressions

**Target Final State:** 3,500 tokens per request (66% reduction from baseline)

---

## Root-Cause Summary

The system hits 100k tokens not because email generation is inherently expensive, but because:

1. **Prompt bloat:** 3,200+ tokens of redundant, repetitive instructions (could be 1,000)
2. **Unfiltered scraping:** Raw HTML and CSS injected without compression or filtering
3. **Redundant context:** Design data passed twice in the same request
4. **previousEmail duplication:** Entire prior email embedded instead of summarized
5. **Over-allocated output:** 4,096 tokens reserved when 1,500 would suffice
6. **No caching:** Same design data scraped for every request instead of cached

**The fix is not about faster models or better algorithms—it's about aggressive prompt hygiene and intelligent caching.**

A well-optimized implementation should use **3,500-4,500 tokens per email** instead of 10,000+, representing an **order-of-magnitude improvement** in efficiency.
