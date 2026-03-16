// Single source of truth for partner discovery constants.
// Imported by route.ts, schema files, and components — do not duplicate.

// Generic services that should never appear as discovered business partners.
export const GENERIC_SERVICE_BLOCKLIST = [
  // Social Media
  'facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok',
  'pinterest', 'whatsapp', 'snapchat', 'reddit', 'x.com',
  // Google Services
  'google', 'google analytics', 'google maps', 'google ads', 'google fonts',
  'google tag manager', 'gmail', 'recaptcha', 'google workspace', 'google search console',
  // Generic Tech / CMS
  'wordpress', 'wix', 'squarespace', 'godaddy', 'cloudflare', 'aws',
  'amazon web services', 'azure', 'microsoft azure', 'digitalocean',
  // Mass-market marketing tools
  'mailchimp', 'constant contact', 'sendinblue', 'mailgun', 'sendgrid',
  // Analytics
  'hotjar', 'mixpanel', 'heap', 'segment', 'amplitude', 'adobe analytics',
  // Payment / Cards (brand-level, not processor integrations)
  'visa', 'mastercard', 'amex', 'american express', 'paypal',
  // Cookie / Privacy
  'onetrust', 'cookiebot', 'osano', 'usercentrics',
  // Generic hosting
  'bluehost', 'hostgator', 'siteground', 'dreamhost',
  // CDNs
  'fastly', 'akamai', 'cloudfront',
] as const

export const GENERIC_SERVICE_BLOCKLIST_SET = new Set<string>(GENERIC_SERVICE_BLOCKLIST)

export function isGenericService(name: string): boolean {
  const normalized = name.toLowerCase().trim()
  if (GENERIC_SERVICE_BLOCKLIST_SET.has(normalized)) return true
  for (const blocked of GENERIC_SERVICE_BLOCKLIST_SET) {
    if (normalized.includes(blocked)) return true
  }
  return false
}

// Inline blocklist string for embedding directly in AI prompts.
// Prevents AI from wasting token budget reasoning about excluded services.
export const GENERIC_BLOCKLIST_FOR_PROMPT = `- Facebook, Instagram, LinkedIn, Twitter/X, YouTube, TikTok, Pinterest, WhatsApp, Reddit
- Google Analytics, Google Tag Manager, Google Fonts, Google Maps, Google Ads, Gmail, reCAPTCHA
- WordPress (as a CMS platform), Wix, Squarespace
- AWS, Azure, Cloudflare (CDN only), DigitalOcean, Fastly, Akamai, CloudFront
- Bluehost, HostGator, SiteGround, DreamHost
- Hotjar, Mixpanel, Heap, Segment, Amplitude, Adobe Analytics
- OneTrust, CookieBot, Osano, Usercentrics
- Visa, Mastercard, Amex, PayPal (card brands — payment processors like Stripe ARE allowed)
- Mailchimp, Constant Contact, SendinBlue, Mailgun, SendGrid`

// Confidence thresholds — single source of truth across prompts, schemas, and route logic.
export const CONFIDENCE_THRESHOLDS = {
  DNS_RECORD: 0.95,       // DNS record is definitive infrastructure proof
  PARTNER_PAGE: 0.90,     // Dedicated partner/integrations page
  TXT_RECORD: 0.85,       // TXT record (SPF/DKIM/DMARC)
  EMBEDDED_WIDGET: 0.85,  // Definitively embedded external resource (script/iframe)
  EXPLICIT_MENTION: 0.80, // Explicit mention on official page
  EMBEDDED_BRANDED: 0.70, // Embedded branded tool or verified badge
  FOOTER_PRIVACY: 0.65,   // Footer credit or privacy policy mention
  MINIMUM: 0.60,          // Minimum to include any partner from AI prompts
  ROUTE_MINIMUM: 0.30,    // Minimum for main partner_ecosystem categories
} as const

// Known service fingerprints: URL substring pattern → service metadata.
// Used by lib/scraper.ts to detect embedded third-party services from HTML resource tags.
export const SERVICE_FINGERPRINTS: Record<string, { name: string; type: string; relationship: string }> = {
  // Payment Processors
  'js.stripe.com':          { name: 'Stripe',       type: 'commercial_vendor',      relationship: 'Payment processing integration' },
  'checkout.stripe.com':    { name: 'Stripe',       type: 'commercial_vendor',      relationship: 'Payment processing integration' },
  'squareup.com':           { name: 'Square',       type: 'commercial_vendor',      relationship: 'Point-of-sale and payment processing' },
  'square.com/js':          { name: 'Square',       type: 'commercial_vendor',      relationship: 'Point-of-sale and payment processing' },
  'braintreegateway.com':   { name: 'Braintree',    type: 'commercial_vendor',      relationship: 'Payment processing (PayPal subsidiary)' },
  'afterpay-static.com':    { name: 'Afterpay',     type: 'commercial_vendor',      relationship: 'Buy-now-pay-later integration' },
  'afterpay.com':           { name: 'Afterpay',     type: 'commercial_vendor',      relationship: 'Buy-now-pay-later integration' },
  'klarna.com':             { name: 'Klarna',       type: 'commercial_vendor',      relationship: 'Buy-now-pay-later integration' },
  'eway.com.au':            { name: 'eWAY',         type: 'commercial_vendor',      relationship: 'Payment gateway integration' },
  'windcave.com':           { name: 'Windcave',     type: 'commercial_vendor',      relationship: 'Payment gateway integration' },
  'laybuy.com':             { name: 'Laybuy',       type: 'commercial_vendor',      relationship: 'Buy-now-pay-later integration' },
  'zip.co':                 { name: 'Zip',          type: 'commercial_vendor',      relationship: 'Buy-now-pay-later integration' },

  // Scheduling / Booking
  'calendly.com':           { name: 'Calendly',            type: 'technology_platform', relationship: 'Appointment scheduling platform' },
  'acuityscheduling.com':   { name: 'Acuity Scheduling',   type: 'technology_platform', relationship: 'Appointment scheduling platform' },
  'trybooking.com':         { name: 'TryBooking',          type: 'technology_platform', relationship: 'Event and booking platform' },
  'simplybook.me':          { name: 'SimplyBook',          type: 'technology_platform', relationship: 'Appointment booking platform' },
  'setmore.com':            { name: 'Setmore',             type: 'technology_platform', relationship: 'Appointment scheduling platform' },
  'appointedd.com':         { name: 'Appointedd',          type: 'technology_platform', relationship: 'Booking management platform' },
  'mindbody.io':            { name: 'Mindbody',            type: 'technology_platform', relationship: 'Business management and booking platform' },
  'rezdy.com':              { name: 'Rezdy',               type: 'technology_platform', relationship: 'Tour and activity booking platform' },

  // E-commerce Platforms
  'cdn.shopify.com':        { name: 'Shopify',      type: 'technology_platform', relationship: 'E-commerce platform' },
  'shopifycloud.com':       { name: 'Shopify',      type: 'technology_platform', relationship: 'E-commerce platform' },
  'woocommerce.com':        { name: 'WooCommerce',  type: 'technology_platform', relationship: 'E-commerce platform (WordPress)' },
  'bigcommerce.com':        { name: 'BigCommerce',  type: 'technology_platform', relationship: 'E-commerce platform' },
  'lightspeedapp.com':      { name: 'Lightspeed',   type: 'technology_platform', relationship: 'Retail and e-commerce platform' },

  // CRM / Marketing Automation
  'hs-scripts.com':         { name: 'HubSpot',          type: 'technology_platform', relationship: 'CRM and marketing automation' },
  'hubspot.com':            { name: 'HubSpot',          type: 'technology_platform', relationship: 'CRM and marketing automation' },
  'salesforce.com':         { name: 'Salesforce',       type: 'technology_platform', relationship: 'CRM platform' },
  'pardot.com':             { name: 'Salesforce Pardot', type: 'technology_platform', relationship: 'Marketing automation (Salesforce)' },
  'klaviyo.com':            { name: 'Klaviyo',          type: 'technology_platform', relationship: 'Email marketing automation' },
  'activecampaign.com':     { name: 'ActiveCampaign',   type: 'technology_platform', relationship: 'CRM and email marketing automation' },

  // Customer Support / Live Chat
  'intercomcdn.com':        { name: 'Intercom',   type: 'technology_platform', relationship: 'Customer messaging platform' },
  'intercom.io':            { name: 'Intercom',   type: 'technology_platform', relationship: 'Customer messaging platform' },
  'zendesk.com':            { name: 'Zendesk',    type: 'technology_platform', relationship: 'Customer support platform' },
  'zdassets.com':           { name: 'Zendesk',    type: 'technology_platform', relationship: 'Customer support platform' },
  'freshdesk.com':          { name: 'Freshdesk',  type: 'technology_platform', relationship: 'Customer support platform' },
  'drift.com':              { name: 'Drift',      type: 'technology_platform', relationship: 'Conversational marketing platform' },
  'tawk.to':                { name: 'Tawk.to',    type: 'technology_platform', relationship: 'Live chat support platform' },
  'livechat.com':           { name: 'LiveChat',   type: 'technology_platform', relationship: 'Live chat support platform' },

  // Video / Media
  'wistia.com':             { name: 'Wistia',   type: 'technology_platform', relationship: 'Video hosting platform' },
  'vidyard.com':            { name: 'Vidyard',  type: 'technology_platform', relationship: 'Video hosting platform' },
  'loom.com':               { name: 'Loom',     type: 'technology_platform', relationship: 'Video messaging platform' },
  'zoom.us':                { name: 'Zoom',     type: 'technology_platform', relationship: 'Video conferencing platform' },

  // Forms / Surveys
  'typeform.com':           { name: 'Typeform',      type: 'technology_platform', relationship: 'Form and survey platform' },
  'jotform.com':            { name: 'JotForm',       type: 'technology_platform', relationship: 'Form builder platform' },
  'formstack.com':          { name: 'Formstack',     type: 'technology_platform', relationship: 'Form automation platform' },

  // Accounting / Finance
  'xero.com':               { name: 'Xero',       type: 'technology_platform', relationship: 'Accounting platform' },
  'myob.com':               { name: 'MYOB',       type: 'technology_platform', relationship: 'Accounting platform' },

  // Email Security (supplemental to DNS-derived detection)
  'proofpoint.com':         { name: 'Proofpoint', type: 'email_security_provider', relationship: 'Email security and threat protection' },
  'mimecast.com':           { name: 'Mimecast',   type: 'email_security_provider', relationship: 'Email security and archiving' },

  // E-signature / Documents
  'docusign.com':           { name: 'DocuSign',  type: 'technology_platform', relationship: 'Electronic signature platform' },
  'hellosign.com':          { name: 'HelloSign', type: 'technology_platform', relationship: 'Electronic signature platform' },
  'pandadoc.com':           { name: 'PandaDoc',  type: 'technology_platform', relationship: 'Document management platform' },

  // Property / Real Estate
  'realestate.com.au':      { name: 'REA Group',      type: 'commercial_vendor', relationship: 'Property listing platform' },
  'domain.com.au':          { name: 'Domain',          type: 'commercial_vendor', relationship: 'Property listing platform' },
  'campaigntrack.com':      { name: 'CampaignTrack',   type: 'technology_platform', relationship: 'Property marketing platform' },
}
