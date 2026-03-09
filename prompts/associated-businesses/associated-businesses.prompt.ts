export const ASSOCIATED_BUSINESSES_PROMPT = `TASK: Find SPECIFIC NAMED business relationships on this website. Return only real companies, not generic tools.

EXCLUDE ALWAYS (do not include under any circumstances):
- Social media: Facebook, Instagram, Twitter, LinkedIn, YouTube, TikTok, Pinterest, WhatsApp
- Google services: Google Analytics, Google Maps, Google Ads, Google Fonts, Gmail, reCAPTCHA
- Generic platforms: WordPress, Wix, Squarespace, AWS, Azure, Cloudflare
- Tools everyone uses: Mailchimp, Hotjar, Zendesk, PayPal, Visa, Mastercard
- Hosting: Bluehost, HostGator, DigitalOcean, Siteground
- Analytics: Mixpanel, Heap, Segment, Amplitude

INCLUDE (look for NAMED companies in these contexts):
- "Designed by [Company Name]" → developer_agency
- "Developed by [Company Name]" → developer_agency  
- "Photography by [Name]" → developer_agency
- "In partnership with [Company]" → operational_partner
- "Official partner: [Company]" → operational_partner
- "Subsidiary of [Company]" or "Part of [Group]" → investor_parent
- "Legal: [Law Firm]" or "Accounting: [Firm]" → technology_partner
- "Powered by [SPECIFIC Company]" (if not generic platform) → technology_partner
- Suppliers, manufacturers, distributors → supplier
- Marketing/PR/branding agencies → marketing_agency

SEARCH IN:
- Footer (credits, copyright, "built by")
- About/Team pages
- Partners/Affiliates pages
- Contact page
- Blog/News sections
- Legal/Privacy notices
- Case studies
- Home Page 

OUTPUT FORMAT (must be exactly this):
{
  "associated_businesses": [
    {
      "name": "Company Name",
      "type": "developer_agency|marketing_agency|supplier|investor_parent|operational_partner|technology_partner",
      "relationship": "Brief description of relationship",
      "evidence": "Exact text where found",
      "confidence": 0.85,
      "url": "https://...",
      "source_page": "/page-name"
    }
  ],
  "discovery_notes": ["Summary of what was found and excluded"]
}

RULES:
1. Confidence must be 0.65-1.0 (only include these)
2. Return max 10 results, sorted by confidence (highest first)
3. Empty array [] is acceptable if no businesses found
4. Every entry needs EXPLICIT evidence from the website
5. Do not guess or assume relationships
6. Exclude parent company if it's already in provided excluded list
7. JSON only, no markdown, no preamble`;
