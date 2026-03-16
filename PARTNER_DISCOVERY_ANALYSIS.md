# Partner Discovery Feature - Current State & Improvement Opportunities

## Executive Summary

The Partner Discovery feature analyzes target domains to identify meaningful business relationships, vendors, and operational dependencies for targeted phishing campaigns. Currently, it combines DNS infrastructure analysis with website scraping and AI processing to extract partner relationships.

**Current Issues:**
- Layout not dynamic enough for different website structures
- Results lack depth and meaningful context
- Static page scraping misses dynamic content and deeper relationships
- Limited intelligence extraction from discovered partners
- No follow-up analysis on discovered partners themselves

---

## Current Workflow Architecture

### 1. User Entry Point
**File:** `app/select-domain/page.tsx`
- Simple page that renders the main UI container
- Displays `LaptopMockup` component which orchestrates the domain analysis

**File:** `app/components/LaptopMockup.tsx`
- Main UI container that displays results
- Coordinates between DNS lookup and partner discovery
- Renders `PartnerCardsContainer` with discovered partners

**File:** `app/components/DomainForm.tsx` (Lines 144+)
- User enters target domain
- Triggers two parallel API calls:
  - `/api/dns` - DNS and WHOIS lookup
  - `/api/partners` - Partner discovery

---

### 2. DNS & Infrastructure Analysis
**File:** `app/api/dns/route.ts`
- Performs comprehensive DNS lookups (A, MX, NS, TXT records)
- WHOIS data extraction (registrar, hosting provider)
- Uses external scripts in `/scripts` directory

**Supporting Scripts:**
- `scripts/dns-lookup.js` - Core DNS resolution (SOA, NS, A, MX, TXT)
- `scripts/whois.js` - WHOIS data extraction
- `scripts/email-provider-translator.js` - Normalizes email provider names

**Data Extracted:**
- **A Records** → Hosting providers (IPs mapped to provider names)
- **MX Records** → Email service providers  
- **NS Records** → Domain registrar/nameserver operators
- **TXT Records** → SPF, DKIM, DMARC (email security)
- **WHOIS** → Registrar info, tech contacts, nameservers

**Output Structure:**
```typescript
{
  domainCheck: { exists: boolean, status: string },
  dnsRecords: { A, MX, NS, TXT },
  report: { 
    hosting_provider, 
    email_provider, 
    security_services,
    registrar_name 
  },
  whois: { /* raw WHOIS data */ }
}
```

---

### 3. Website Content Scraping
**File:** `lib/scraper.ts`
- Fetches multiple pages from target domain in parallel
- Converts HTML to clean text content
- 1-hour cache with 15K character limit

**Pages Scraped (Static List):**
```javascript
[
  '/',              // Homepage
  '/about',         // About page
  '/partners',      // Partners page
  '/integrations',  // Integrations page
  '/technology',    // Technology page
  '/privacy',       // Privacy policy
  '/terms',         // Terms of service
]
```

**Limitations:**
- Hardcoded page paths don't adapt to site structure
- Misses dynamic pages (blog posts, case studies, team pages)
- No sitemap.xml parsing
- No JavaScript-rendered content extraction
- Basic HTML text extraction (strips navigation, but misses rich context)
- Limited to 15K characters (may miss critical deep content)

---

### 4. AI Partner Discovery (Dual Prompt System)
**File:** `app/api/partners/route.ts`
- Orchestrates the entire partner discovery process
- Calls two AI analysis prompts sequentially

#### Prompt 1: Partner Discovery (Primary)
**Files:**
- `prompts/partner-discovery/partner-discovery.v1.prompt.ts`
- `prompts/partner-discovery/partner-discovery.v1.schema.ts`

**Input:**
- Formatted DNS data with human-readable labels
- Combined website content from all scraped pages

**Analysis Categories:**
```typescript
{
  commercial_partners: [],      // Payments, hosting, domain services
  marketing_partners: [],       // Marketing/branding agencies
  technology_partners: [],      // CRM, booking systems, portals
  investors_corporate: [],      // Parent companies, PE firms
  operational_adjacencies: [],  // Accreditations, associations
  developer_agency_partners: [], // Web/app developers
  email_security_providers: [], // Proofpoint, Mimecast
  connections: []               // Deep/non-obvious relationships
}
```

**Confidence Scoring:**
- 0.90-1.00: DNS record (definitive) or dedicated partner page
- 0.80-0.89: Explicit mention on official page
- 0.70-0.79: Embedded branded tool
- 0.60-0.69: Footer credit or privacy mention
- < 0.60: Excluded

**Generic Service Blocklist:**
- Social media (Facebook, LinkedIn, Instagram, etc.)
- Google services (Analytics, Maps, Fonts, etc.)
- Common platforms (WordPress, Wix, AWS, Cloudflare)
- Generic tools (Mailchimp, PayPal, Visa)

#### Prompt 2: Associated Businesses (Secondary)
**Files:**
- `prompts/associated-businesses/associated-businesses.prompt.ts`
- `prompts/associated-businesses/associated-businesses.schema.ts`

**Purpose:** Find specific named business relationships not captured by primary discovery

**Types:**
- `developer_agency` - "Designed by [Company]"
- `marketing_agency` - Marketing/PR/branding firms
- `supplier` - Manufacturers, distributors
- `investor_parent` - Parent companies, legal/accounting firms
- `operational_partner` - "In partnership with..."
- `technology_partner` - "Powered by [SPECIFIC Company]"

**Filtering (Lines 137-156 in route.ts):**
```javascript
GENERIC_SERVICE_BLOCKLIST = [
  'facebook', 'instagram', 'linkedin', 'twitter', ...
  'google', 'google analytics', 'wordpress', 'wix', ...
  'mailchimp', 'hotjar', 'paypal', 'visa', 'mastercard', ...
  'cloudflare', 'aws', 'azure', 'digitalocean', ...
]

function filterAssociatedBusinesses(businesses) {
  return businesses.filter(business => {
    // Remove generic services
    if (isGenericService(business.name)) return false;
    // Remove low confidence (< 0.65)
    if (business.confidence < 0.65) return false;
    return true;
  });
}
```

---

### 5. Result Processing & Card Generation
**File:** `app/api/partners/route.ts` (Lines 400-500)

**Processing Steps:**
1. Merge results from both AI prompts
2. Filter duplicates (same partner name)
3. Filter low confidence partners (< 0.3 threshold)
4. Convert to `PartnerCardViewProps` format
5. Add "self" card for direct client emails

**Card Data Structure:**
```typescript
interface PartnerCardViewProps {
  id: string,
  domain: string,
  dnsData: DNSDataSection,      // DNS findings
  aiData: AIDataSection,          // AI-discovered relationship
  mergedMetadata: {
    discoveredAt: string,
    sources: ['dns' | 'ai'],
    relevanceScore: number
  }
}
```

---

### 6. Frontend Display
**File:** `app/components/PartnerCardsContainer.tsx`
- Receives partner cards array from API
- Manages partner selection for email generation
- Displays cards in grid layout

**File:** `app/components/PartnerCard.tsx`
- Individual partner card UI
- Shows type badge, confidence indicator, evidence, relationship
- Collapsible DNS data section
- Click to select for email generation

**Card Types & Styling:**
```typescript
const typeConfig = {
  commercial_vendor: { label: 'Commercial Vendor', color: 'blue' },
  marketing_agency: { label: 'Marketing Agency', color: 'purple' },
  technology_platform: { label: 'Tech Platform', color: 'cyan' },
  investor_parent: { label: 'Investor/Parent', color: 'green' },
  operational_adjacency: { label: 'Operational', color: 'orange' },
  developer_agency: { label: 'Developer Agency', color: 'pink' }
}
```

---

## Key Files Reference

### API Routes
- `app/api/partners/route.ts` - Main partner discovery orchestration
- `app/api/dns/route.ts` - DNS and WHOIS lookups

### Prompts & Schemas
- `prompts/partner-discovery/partner-discovery.v1.prompt.ts` - Primary AI prompt
- `prompts/partner-discovery/partner-discovery.v1.schema.ts` - Zod schema
- `prompts/associated-businesses/associated-businesses.prompt.ts` - Secondary AI prompt
- `prompts/associated-businesses/associated-businesses.schema.ts` - Zod schema

### Components
- `app/components/DomainForm.tsx` - Initial domain submission
- `app/components/LaptopMockup.tsx` - Main UI container
- `app/components/PartnerCardsContainer.tsx` - Partner cards grid
- `app/components/PartnerCard.tsx` - Individual card UI

### Libraries
- `lib/scraper.ts` - Website content scraping
- `lib/groq.ts` - AI model integration (Llama 3.3 70B)
- `lib/rate-limit.ts` - Rate limiting
- `lib/logging.ts` - Analytics logging

### Scripts
- `scripts/dns-lookup.js` - DNS resolution
- `scripts/whois.js` - WHOIS queries
- `scripts/email-provider-translator.js` - Provider normalization

### Types
- `app/types/index.ts` - TypeScript interfaces

---

## Current Strengths

✅ **Strong DNS Analysis**
- Comprehensive record extraction (A, MX, NS, TXT)
- Good WHOIS integration
- Confidence scoring based on DNS records (0.95 for definitive infrastructure)

✅ **Dual-Prompt System**
- Primary discovery for infrastructure
- Secondary discovery for specific named businesses
- Generic service filtering prevents noise

✅ **Structured Data Model**
- Clear separation of DNS vs AI data
- Confidence scoring
- Evidence tracking

✅ **Caching & Rate Limiting**
- 1-hour scrape cache
- Rate limiting on API endpoints

---

## Major Gaps & Improvement Opportunities

### 🔴 Critical Issues

#### 1. **Static Page Discovery**
**Problem:** Hardcoded page list misses most website structures
```javascript
// Current: Only 7 hardcoded paths
const pagesToScrape = ['/', '/about', '/partners', '/integrations', ...]
```

**Impact:** Misses:
- Blog posts with partner case studies
- Team pages mentioning consultancies
- Product pages with integration details
- News/press releases about partnerships
- Custom URL structures (e.g., `/company`, `/our-team`, `/solutions`)

**Solution Needed:** 
- Sitemap.xml parsing
- Recursive link crawling (with depth limits)
- Intelligent page relevance scoring
- Dynamic discovery of high-value pages

---

#### 2. **Shallow Content Extraction**
**Problem:** Basic HTML text extraction misses context and structure

**Missing:**
- Embedded widgets (calendars, booking systems, payment forms)
- JavaScript-rendered content (SPAs, dynamic lists)
- Structured data (JSON-LD, microdata)
- Meta tags (technology stack hints)
- Link relationships (`<link rel="...">`)
- iFrame sources (embedded services)

**Solution Needed:**
- Headless browser rendering (Playwright/Puppeteer)
- JavaScript execution before scraping
- DOM structure analysis (not just text)
- Extract all external resource URLs
- Parse structured data schemas

---

#### 3. **No Partner Intelligence Depth**
**Problem:** Discovers partner names but no follow-up analysis

**Current:** "Uses Stripe" → confidence 0.8
**Needed:** 
- What Stripe products are integrated? (Payments, Billing, Terminal)
- How recently was it implemented? (footer copyright, blog posts)
- Is it live or just mentioned in docs?
- What's the integration complexity level?
- Are there alternatives they considered?

**Solution Needed:**
- Secondary scraping of discovered partner domains
- Cross-reference partner mentions across multiple pages
- Temporal analysis (when partnership started)
- Technology stack fingerprinting
- Service-specific detection (Stripe Checkout vs Billing vs Connect)

---

#### 4. **Limited Relationship Context**
**Problem:** Knows WHO but not WHY or HOW

**Current Output:**
```json
{
  "name": "Acuity Scheduling",
  "type": "technology_platform",
  "evidence": "Embedded booking widget on services page",
  "confidence": 0.75
}
```

**Missing Context:**
- **Business Impact:** What business problem does this solve?
- **Revenue Model:** Is this client-facing or internal?
- **Integration Depth:** Embedded vs deep API integration?
- **Dependency Level:** Critical vs nice-to-have?
- **Phishing Vector:** What social engineering angle does this enable?

**Solution Needed:**
- Analyze partner usage patterns across site
- Identify customer-facing vs internal tools
- Map partners to business capabilities
- Suggest phishing scenarios for each partner

---

#### 5. **No Cross-Partner Intelligence**
**Problem:** Partners analyzed in isolation

**Missing:**
- Partner ecosystems (e.g., Shopify → Klaviyo → Stripe stack)
- Common tech stacks (WordPress + WooCommerce + Stripe)
- Competing services (uses Mailchimp AND HubSpot?)
- Integration networks (partners that integrate with each other)

**Solution Needed:**
- Pattern recognition across partner combinations
- Tech stack templates (e.g., "SaaS Marketing Stack")
- Identify unusual or contradictory combinations
- Suggest missing partners in common ecosystems

---

#### 6. **No Social/Network Intelligence**
**Problem:** Ignores social media, but it's rich with partner data

**Current Blocklist:**
```javascript
'facebook', 'instagram', 'linkedin', 'twitter' // Always excluded
```

**Missed Opportunities:**
- LinkedIn company page → employees, recent posts about partnerships
- Twitter/X → announcements, integrations, customer complaints
- Facebook → reviews mentioning partners ("Great service, easy to pay with Stripe")
- Instagram → sponsored partnerships, influencer mentions

**Solution Needed:**
- Scrape social profiles (within rate limits)
- Extract partnership announcements
- Analyze customer reviews for tool mentions
- Map employee connections (LinkedIn → consultancies)

---

#### 7. **No OSINT Enrichment**
**Problem:** Only analyzes target domain, not broader web presence

**Missing:**
- Crunchbase → funding, investors, acquisitions
- GitHub → open-source integrations, API usage
- Job postings → "Experience with Salesforce required"
- Press releases → partnership announcements
- Case studies on partner websites about the target
- Domain age/history → when did they switch providers?

**Solution Needed:**
- Third-party API integrations (Crunchbase, Clearbit, etc.)
- Google/Bing search for "[domain] + partnership"
- GitHub search for repository mentions
- Job board scraping for tech stack clues

---

### 🟡 Medium Priority Issues

#### 8. **No Email Template Correlation**
**Problem:** Partners discovered but not linked to email scenarios

**Gap:** Should automatically suggest:
- "Payment update required" (for Stripe partners)
- "Calendar invitation not delivered" (for Acuity/Calendly)
- "Security alert from your email provider" (for Proofpoint/Mimecast)

**Solution:** 
- Map partner types to phishing scenarios
- Auto-generate scenario recommendations
- Pre-populate email templates based on partner

---

#### 9. **Weak Evidence Trails**
**Problem:** "Evidence" field is often vague

**Current:** `"Evidence": "Found on homepage"`
**Better:** `"Evidence": "Line 342 of /about page: 'Powered by Acuity Scheduling since 2019'"`

**Solution:**
- Store exact text matches with context
- Line numbers/character positions
- Screenshot capability
- Link preservation with archive.org fallback

---

#### 10. **No Partner Confidence Evolution**
**Problem:** Static confidence scores don't update

**Current:** Initial scrape gives confidence 0.75, never changes
**Needed:** Confidence should increase with:
- Multiple page mentions
- Recent blog posts about partner
- Deep integration evidence
- Customer testimonials mentioning partner

**Solution:**
- Multi-signal confidence scoring
- Weighted evidence aggregation
- Temporal decay (old mentions = lower confidence)

---

## Suggested Feature Improvements

### 🎯 High-Impact Quick Wins

#### A. **Intelligent Sitemap Parsing**
**Effort:** Low | **Impact:** High
- Parse `/sitemap.xml` and `/robots.txt`
- Extract all URLs
- Score pages by relevance keywords (partner, about, team, technology, integration)
- Prioritize high-value pages for scraping

**Files to Modify:**
- `lib/scraper.ts` - Add sitemap parsing before hardcoded pages

---

#### B. **Headless Browser Rendering**
**Effort:** Medium | **Impact:** Very High
- Replace `fetch()` with Playwright/Puppeteer
- Execute JavaScript before scraping
- Capture embedded widgets and iframes
- Screenshot capability for evidence

**Files to Modify:**
- `lib/scraper.ts` - Replace fetch with browser automation
- Consider edge function limitations (timeouts)

**Example Implementation:**
```typescript
import { chromium } from '@playwright/test';

async function scrapeWithBrowser(url: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // Extract all external script sources
  const scripts = await page.$$eval('script[src]', els => 
    els.map(el => el.getAttribute('src'))
  );
  
  // Extract iframes
  const iframes = await page.$$eval('iframe[src]', els => 
    els.map(el => el.getAttribute('src'))
  );
  
  // Get rendered content
  const content = await page.content();
  await browser.close();
  
  return { content, scripts, iframes };
}
```

---

#### C. **External Resource Fingerprinting**
**Effort:** Low | **Impact:** High
- Extract all `<script src="...">` tags
- Extract all `<iframe src="...">` tags  
- Extract all `<link href="...">` tags
- Map URLs to known services (e.g., `js.stripe.com` → Stripe)

**Implementation:**
```typescript
const serviceFingerprints = {
  'js.stripe.com': { name: 'Stripe', type: 'payment_processor' },
  'calendly.com/assets': { name: 'Calendly', type: 'scheduling' },
  'shopify.com': { name: 'Shopify', type: 'ecommerce' },
  // ... hundreds more
};

function detectServicesFromScripts(html: string) {
  const scriptRegex = /<script[^>]*src=["']([^"']+)["']/gi;
  const matches = [...html.matchAll(scriptRegex)];
  return matches
    .map(m => m[1])
    .map(url => Object.entries(serviceFingerprints)
      .find(([pattern]) => url.includes(pattern))
    )
    .filter(Boolean);
}
```

---

#### D. **Recursive Partner Discovery**
**Effort:** Medium | **Impact:** Very High
- When partner discovered, scrape their website too
- Find reverse mentions (partner's case studies about target)
- Build bidirectional relationship graph
- Detect partner networks

**Example:**
- Target: `acmecorp.com` uses Stripe
- Scrape `stripe.com/customers` → find Acme Corp case study
- Extract deeper context: "Acme Corp processes $5M/year"
- Confidence boost: 0.75 → 0.95 (bidirectional confirmation)

---

#### E. **Multi-Signal Confidence Scoring**
**Effort:** Medium | **Impact:** High

**Current:** Single confidence score per partner
**Improved:** Aggregate multiple signals

```typescript
interface ConfidenceSignals {
  dnsRecord: number;          // 0.95 if in DNS
  homepageMention: number;    // 0.80 if on homepage
  multiplePages: number;      // +0.05 per page mention
  recentMention: number;      // 0.90 if < 6mo old
  embeddedWidget: number;     // 0.85 if live widget
  bidirectionalConfirm: number; // 0.95 if partner confirms
  customerReview: number;     // 0.70 if in reviews
  jobPosting: number;         // 0.75 if in job reqs
}

function calculateAggregateConfidence(signals: ConfidenceSignals): number {
  // Weighted average with decay
  const weights = { ... };
  return weightedAverage(signals, weights);
}
```

---

### 🚀 Advanced Features (Next Level)

#### F. **Social Media Intelligence**
**Effort:** High | **Impact:** Very High

**LinkedIn:**
- Scrape company page → employees, recent posts
- Employee profiles → "Skills: Salesforce, HubSpot"
- Posts about partnerships

**Twitter/X:**
- Recent tweets mentioning tools
- Customer service interactions revealing tools
- Partnership announcements

**Reviews (Google, Trustpilot, G2):**
- Customers mentioning tools: "Easy checkout with Stripe"

**Implementation:**
- Use APIs where available (LinkedIn, Twitter)
- Fallback to scraping with rate limiting
- Store in separate "social intelligence" field

---

#### G. **Third-Party Data Enrichment**
**Effort:** High | **Impact:** Very High

**Services to Integrate:**
- **Clearbit:** Company data, tech stack detection
- **BuiltWith:** Technology profiling
- **Wappalyzer:** Web technology detection
- **Crunchbase:** Funding, investors, acquisitions
- **GitHub:** Open-source integrations

**Implementation:**
```typescript
async function enrichWithThirdParty(domain: string) {
  const [builtwith, clearbit, wappalyzer] = await Promise.all([
    fetch(`https://api.builtwith.com/v1/${domain}`),
    fetch(`https://company.clearbit.com/v1/domains/find?name=${domain}`),
    // ... etc
  ]);
  
  return {
    techStack: builtwith.technologies,
    companyInfo: clearbit.data,
    webTech: wappalyzer.applications
  };
}
```

---

#### H. **Partner Ecosystem Mapping**
**Effort:** Medium | **Impact:** High

**Detect known stacks:**
- **SaaS Marketing:** HubSpot + Stripe + Intercom + Segment
- **E-commerce:** Shopify + Klaviyo + Stripe + Gorgias
- **Healthcare:** Epic + Salesforce Health Cloud + Zoom for Healthcare
- **Financial:** Plaid + Stripe + QuickBooks + DocuSign

**Output:**
```json
{
  "detected_stack": "E-commerce Marketing Stack",
  "stack_confidence": 0.88,
  "partners": [
    { "name": "Shopify", "role": "ecommerce_platform" },
    { "name": "Klaviyo", "role": "email_marketing" },
    { "name": "Stripe", "role": "payments" }
  ],
  "missing_typical_partners": [
    { "name": "Gorgias", "role": "customer_support", "likelihood": 0.7 }
  ]
}
```

**Phishing Value:** 
- "Your Shopify-Klaviyo integration requires re-authentication"
- More believable because it reflects real integrated systems

---

#### I. **Temporal Analysis**
**Effort:** Medium | **Impact:** Medium

**Track:**
- When partnerships started (blog post dates, copyright years)
- Recent changes (domain history, archive.org)
- Seasonal patterns (busy periods for certain tools)

**Use Cases:**
- "We noticed you recently integrated Stripe..." (if < 3mo)
- "Your [old CRM] to [new CRM] migration..." (if provider changed)

**Implementation:**
- Wayback Machine API queries
- Copyright year extraction
- Blog post date parsing

---

#### J. **Phishing Scenario Auto-Mapping**
**Effort:** Low | **Impact:** Very High

**For each discovered partner, auto-generate:**
- Recommended phishing scenarios
- Email templates pre-populated
- Believability score for each scenario
- Urgency level suggestion

**Example:**
```json
{
  "partner": "Stripe",
  "suggested_scenarios": [
    {
      "scenario": "payment_method_update_required",
      "template": "Your payment method ending in 4242 has been declined",
      "believability": 0.92,
      "urgency": "high",
      "cta": "Update Payment Method"
    },
    {
      "scenario": "suspicious_transaction_alert",
      "template": "We detected unusual activity on your Stripe account",
      "believability": 0.85,
      "urgency": "critical",
      "cta": "Review Transaction"
    }
  ]
}
```

**Files to Create:**
- `lib/scenario-mapper.ts` - Maps partners to scenarios
- `data/partner-scenario-templates.json` - Template database

---

## Implementation Priority Roadmap

### Phase 1: Core Infrastructure (Week 1-2)
1. ✅ Sitemap parsing (Quick win)
2. ✅ External resource fingerprinting (Quick win)
3. ✅ Multi-signal confidence scoring (Foundation)

### Phase 2: Deep Discovery (Week 3-4)
4. ✅ Headless browser rendering (Playwright integration)
5. ✅ Recursive partner discovery (Bidirectional scraping)
6. ✅ Partner usage context analysis

### Phase 3: Intelligence Layer (Week 5-6)
7. ✅ Social media intelligence (LinkedIn/Twitter)
8. ✅ Third-party enrichment (BuiltWith, Clearbit)
9. ✅ Partner ecosystem detection

### Phase 4: Phishing Intelligence (Week 7-8)
10. ✅ Scenario auto-mapping
11. ✅ Template pre-population
12. ✅ Temporal analysis (recent vs old partners)

---

## Technical Considerations

### Rate Limiting & Ethics
- Respect `robots.txt` on all domains
- Implement exponential backoff
- Max pages per domain: 25-50 (configurable)
- Max crawl depth: 3 levels
- Polite crawling: 1-2 second delays between requests

### Performance
- Background job queue for deep analysis (not blocking UI)
- Progressive results (show DNS immediately, partners as discovered)
- Caching layers (Redis for partner data, 24hr TTL)
- Async processing for social/OSINT enrichment

### Cost Management
- Third-party APIs: Rate limits and budget caps
- Playwright: Resource-intensive, use sparingly
- AI prompts: Already using Groq (economical)

### Data Storage
- Consider database for partner intelligence cache
- Store evidence screenshots (S3/Cloudflare R2)
- Historical tracking (partner changes over time)

---

## Success Metrics

### Quantitative
- **Partners per domain:** Current avg ~5 → Target ~15-25
- **Confidence accuracy:** Validate against manual analysis
- **Deep connections:** Currently ~2 → Target ~8-12
- **Processing time:** Keep under 30 seconds for user experience

### Qualitative
- **Partner relevance:** % of partners actually usable for phishing
- **Context richness:** Evidence detail and specificity
- **Relationship depth:** Understanding of HOW partner is used
- **Scenario coverage:** % of partners with auto-suggested scenarios

---

## Files to Create/Modify Summary

### New Files to Create
- `lib/sitemap-parser.ts` - Parse sitemap.xml and robots.txt
- `lib/browser-scraper.ts` - Playwright-based deep scraping
- `lib/resource-fingerprinter.ts` - Detect services from external resources
- `lib/partner-enrichment.ts` - Third-party API integrations
- `lib/social-intelligence.ts` - Social media scraping
- `lib/scenario-mapper.ts` - Auto-map partners to phishing scenarios
- `lib/confidence-scorer.ts` - Multi-signal confidence aggregation
- `data/service-fingerprints.json` - Known service URL patterns
- `data/tech-stacks.json` - Common technology ecosystem templates
- `data/partner-scenarios.json` - Partner → scenario mappings

### Files to Modify
- `lib/scraper.ts` - Integrate new discovery methods
- `app/api/partners/route.ts` - Add enrichment layers
- `prompts/partner-discovery/partner-discovery.v1.prompt.ts` - Enhanced context
- `app/components/PartnerCard.tsx` - Display enriched data
- `app/types/index.ts` - New interfaces for enriched data

---

## Conclusion

The current partner discovery system has a solid foundation with DNS analysis and dual-prompt AI extraction. However, it's limited by static page discovery, shallow content extraction, and lack of follow-up intelligence.

**The biggest opportunities lie in:**
1. **Dynamic content discovery** (sitemaps, headless browsers)
2. **Recursive partner analysis** (scraping partners' websites too)
3. **External intelligence** (social media, OSINT, third-party APIs)
4. **Scenario mapping** (auto-suggest phishing uses for each partner)

**Recommended starting point:** Implement sitemap parsing and external resource fingerprinting first (low effort, high impact), then move to headless browser rendering for JavaScript-heavy sites.

This will transform the feature from "finding some partners" to "comprehensive partner ecosystem intelligence with actionable phishing scenarios."
