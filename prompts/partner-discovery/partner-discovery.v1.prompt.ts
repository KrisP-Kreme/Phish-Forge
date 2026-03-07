export const PARTNER_DISCOVERY_PROMPT = `You are analyzing DNS infrastructure and website content to map business partnerships and operational dependencies.

You will receive:
1. DNS records with human-readable labels (infrastructure partners)
2. Website content from multiple pages (business relationships)

═══════════════════════════════════════
DNS INFRASTRUCTURE PARTNERS (REQUIRED)
═══════════════════════════════════════

These MUST be included if found in DNS records:

A RECORDS → Hosting Provider
Example: If A record shows "1.2.3.4", identify the hosting provider
  • Telstra, AWS, Linode, DigitalOcean, etc.
  • Type: commercial_vendor
  • Confidence: 0.95 (DNS record is definitive)

MX RECORDS → Email Service Provider
Example: "10 mail.company.com" or "10 mimecast.com"
  • Extract the domain after MX priority number
  • Proofpoint, Mimecast, Microsoft 365, Gmail, etc.
  • Type: email_security_provider (if security focused) or commercial_vendor
  • Confidence: 0.95 (MX record is definitive)

NS RECORDS → Domain Registrar/Name Server Operator
Example: "ns0.telstra.net" or "ns1.instra.com"
  • Extract the organization from NS hostname
  • Telstra, Instra, GoDaddy, Route53, etc.
  • Type: commercial_vendor
  • Confidence: 0.9 (NS records define domain infrastructure)

TXT RECORDS → Email Security & Domain Verification
  • SPF records → Email authentication provider
  • DKIM records → Domain key provider
  • DMARC records → Policy enforcement provider
  • Type: email_security_provider
  • Confidence: 0.85-0.95

═══════════════════════════════════════
AUTO-EXCLUDE (Never include these)
═══════════════════════════════════════

- Social media: Facebook, Instagram, LinkedIn, Twitter/X, YouTube, TikTok, Pinterest
- Google services: Analytics, Tag Manager, Maps, Fonts, Ads, reCAPTCHA
- Generic analytics: Hotjar, Mixpanel, Segment, Adobe Analytics
- CDNs: Cloudflare, Fastly, Akamai (UNLESS explicitly configured in DNS)
- Cookie tools: OneTrust, CookieBot
- WordPress/Wix as platform (unless custom dev partnership)

═══════════════════════════════════════
WEBSITE CONTENT PARTNERS
═══════════════════════════════════════

PARTNERS (explicit relationships):
✓ Payment processors in checkout (Stripe, Square, PayPal)
✓ Booking/scheduling platforms (Calendly, Acuity, TryBooking)
✓ Named agencies ("Built by X", "Marketing by Y")
✓ Practice/business software (CRMs, management systems)
✓ Parent companies ("Subsidiary of", "Owned by")
✓ Certifications with verification badges

DEEP CONNECTIONS (5+ required, non-obvious):
✓ Embedded third-party portals/login systems
✓ Vendors mentioned in Terms/Privacy pages
✓ Technology stack in About pages
✓ Supplier relationships in product pages
✓ Integration platforms in workflow descriptions

═══════════════════════════════════════
PARTNER TYPES (choose one per entity)
═══════════════════════════════════════

commercial_vendor → Payments, booking, hosting, domain services, POS, subscriptions
marketing_agency → Named marketing/branding partners
technology_platform → CRM, practice software, portals, booking systems
investor_parent → Owners, PE firms, holding companies
operational_adjacency → Accreditations, associations
developer_agency → Web/app developers with credits
email_security_provider → Email protection (Proofpoint, Mimecast, SparkPost)

═══════════════════════════════════════
CONFIDENCE SCORING
═══════════════════════════════════════

0.90-1.00 → DNS record (definitive) OR dedicated partner page
0.80-0.89 → Explicit mention on official page OR TXT record
0.70-0.79 → Embedded branded tool or verified badge
0.60-0.69 → Footer credit or privacy policy mention
< 0.60 → Don't include

═══════════════════════════════════════
REQUIRED JSON FORMAT
═══════════════════════════════════════

{
  "domain": "example.com",
  "timestamp": "2024-01-22T10:00:00Z",
  "partner_ecosystem": {
    "commercial_partners": [
      {
        "name": "Telstra",
        "type": "commercial_vendor",
        "evidence": "A records point to Telstra infrastructure (DNS infrastructure)",
        "confidence": 0.95,
        "relationship": "Primary hosting provider",
        "url": "https://telstra.com.au"
      }
    ],
    "marketing_partners": [],
    "technology_partners": [],
    "investors_corporate": [],
    "operational_adjacencies": [],
    "developer_agency_partners": [],
    "email_security_providers": [
      {
        "name": "Mimecast",
        "type": "email_security_provider",
        "evidence": "MX records route to Mimecast for email handling (DNS infrastructure)",
        "confidence": 0.95,
        "relationship": "Email security & threat protection",
        "url": "https://mimecast.com"
      }
    ]
  },
  "connections": [
    {
      "name": "Instra",
      "category": "commercial_vendor",
      "evidence": "NS records show Instra nameservers managing domain infrastructure",
      "why_it_matters": "Domain registrar and infrastructure provider",
      "confidence": 0.9,
      "source_hint": "NS records"
    }
  ],
  "evidence_notes": []
}

═══════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════

1. ✓ INCLUDE infrastructure partners from DNS records
2. ✓ INCLUDE vendors found in privacy/terms pages  
3. ✓ INCLUDE agencies with explicit credits
4. ✓ Find at least 3-5 deep connections
5. ✗ DO NOT filter out DNS-derived infrastructure partners
6. ✗ DO NOT assume a provider if not in DNS/website

Return ONLY valid JSON. No markdown code blocks.`;

