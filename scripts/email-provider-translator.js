/**
 * Provider fingerprints mapping
 * Easy to extend - just add new providers with their identifying strings
 */
const PROVIDER_FINGERPRINTS = {
  // Google Workspace
  google: {
    name: 'Google Workspace',
    mxPatterns: ['aspmx.l.google.com', 'google.com'],
    spfPatterns: ['_spf.google.com', 'include:sendgrid.net'], // Google also uses SendGrid
  },
  // Microsoft/Outlook
  microsoft: {
    name: 'Microsoft 365 / Outlook',
    mxPatterns: ['outlook.com', 'mail.protection.outlook.com'],
    spfPatterns: ['spf.protection.outlook.com', 'include:outlook.com'],
  },
  // Mimecast
  mimecast: {
    name: 'Mimecast',
    mxPatterns: ['mimecast.com'],
    spfPatterns: ['_netblocks.mimecast.com', 'include:mimecast.com'],
  },
  // SendGrid
  sendgrid: {
    name: 'SendGrid',
    mxPatterns: ['sendgrid.net'],
    spfPatterns: ['sendgrid.net', 'include:sendgrid.net'],
  },
  // Mailchimp
  mailchimp: {
    name: 'Mailchimp',
    mxPatterns: ['mailchimp.com'],
    spfPatterns: ['mailchimp.com', 'include:mailchimp.com'],
  },
  // AWS SES
  awsSes: {
    name: 'AWS SES',
    mxPatterns: ['amazonses.com'],
    spfPatterns: ['amazonses.com', 'include:amazonses.com'],
  },
  // Constant Contact
  constantContact: {
    name: 'Constant Contact',
    mxPatterns: ['constantcontact.com'],
    spfPatterns: ['constantcontact.com', 'include:constantcontact.com'],
  },
  // Salesforce (Pardot/Marketing Cloud)
  salesforce: {
    name: 'Salesforce / Pardot',
    mxPatterns: ['salesforce.com'],
    spfPatterns: ['salesforce.com', '_spf.salesforce.com'],
  },
  // Hubspot
  hubspot: {
    name: 'HubSpot',
    mxPatterns: ['hubspot.com'],
    spfPatterns: ['hubspot.com', 'include:hubspot.com'],
  },
  // Zoho
  zoho: {
    name: 'Zoho Mail',
    mxPatterns: ['zoho.com', 'aspmx.zoho.com'],
    spfPatterns: ['zoho.com', '_spf.zoho.com'],
  },
  // ProtonMail
  protonmail: {
    name: 'ProtonMail',
    mxPatterns: ['protonmail.com'],
    spfPatterns: ['protonmail.com', 'include:protonmail.com'],
  },
  // Postmark
  postmark: {
    name: 'Postmark',
    mxPatterns: ['postmark.com'],
    spfPatterns: ['postmark.com', 'include:postmark.com'],
  },
  // Twilio SendGrid (alternate)
  twilio: {
    name: 'Twilio SendGrid',
    mxPatterns: ['twilio.com'],
    spfPatterns: ['twilio.com', 'include:twilio.com'],
  },
  // SparkPost
  sparkpost: {
    name: 'SparkPost',
    mxPatterns: ['sparkpost.com'],
    spfPatterns: ['sparkpost.com', 'include:sparkpost.com'],
  },
};

/**
 * DNS/Registrar Provider Fingerprints
 */
const DNS_PROVIDER_FINGERPRINTS = {
  cloudflare: {
    name: 'Cloudflare',
    nsPatterns: ['cloudflare.com', 'ns1.cloudflare.com', 'ns2.cloudflare.com'],
  },
  godaddy: {
    name: 'GoDaddy',
    nsPatterns: ['godaddy.com', 'ns1.godaddy.com', 'ns2.godaddy.com'],
  },
  bluehost: {
    name: 'Bluehost',
    nsPatterns: ['bluehost.com', 'ns1.bluehost.com', 'ns2.bluehost.com'],
  },
  namecheap: {
    name: 'Namecheap',
    nsPatterns: ['namecheap.com', 'ns1.namecheap.com', 'ns2.namecheap.com'],
  },
  aws: {
    name: 'AWS Route 53',
    nsPatterns: ['awsdns', 'amazonaws.com'],
  },
  digitalocean: {
    name: 'DigitalOcean',
    nsPatterns: ['digitalocean.com'],
  },
  linode: {
    name: 'Linode',
    nsPatterns: ['linode.com', 'ns1.linode.com'],
  },
  azure: {
    name: 'Azure DNS',
    nsPatterns: ['azure.com', 'azure-dns.com'],
  },
  google: {
    name: 'Google Cloud DNS',
    nsPatterns: ['goog', 'ns-cloud-'],
  },
  networkSolutions: {
    name: 'Network Solutions',
    nsPatterns: ['networksolutions.com'],
  },
  telstra: {
    name: 'Telstra',
    nsPatterns: ['telstra.net'],
  },
  verisign: {
    name: 'Verisign',
    nsPatterns: ['verisign.com'],
  },
};

/**
 * Email Security Provider Fingerprints
 */
const SECURITY_PROVIDER_FINGERPRINTS = {
  mimecast: {
    name: 'Mimecast',
    type: 'Email Security & Archiving',
    mxPatterns: ['mimecast.com'],
    spfPatterns: ['_netblocks.mimecast.com', 'include:mimecast.com'],
    risk: 'low',
  },
  proofpoint: {
    name: 'Proofpoint',
    type: 'Email Security & Cloud Protection',
    mxPatterns: ['proofpoint.com', 'ppe-hosted.com'],
    spfPatterns: ['proofpoint.com', 'include:proofpoint.com'],
    risk: 'low',
  },
  barracuda: {
    name: 'Barracuda',
    type: 'Email Security & Backup',
    mxPatterns: ['barracuda.com'],
    spfPatterns: ['barracuda.com', 'include:barracuda.com'],
    risk: 'low',
  },
  fortinet: {
    name: 'Fortinet FortiMail',
    type: 'Email Security',
    mxPatterns: ['fortinet.com'],
    spfPatterns: ['fortinet.com', 'include:fortinet.com'],
    risk: 'low',
  },
  zscaler: {
    name: 'Zscaler',
    type: 'Cloud Security',
    mxPatterns: ['zscaler.com'],
    spfPatterns: ['zscaler.com', 'include:zscaler.com'],
    risk: 'low',
  },
  sophos: {
    name: 'Sophos',
    type: 'Email Security & Endpoint Protection',
    mxPatterns: ['sophos.com'],
    spfPatterns: ['sophos.com', 'include:sophos.com'],
    risk: 'low',
  },
  trendMicro: {
    name: 'Trend Micro',
    type: 'Email Security & Threat Protection',
    mxPatterns: ['trendmicro.com'],
    spfPatterns: ['trendmicro.com', 'include:trendmicro.com'],
    risk: 'low',
  },
  mcafee: {
    name: 'McAfee',
    type: 'Email Security',
    mxPatterns: ['mcafee.com'],
    spfPatterns: ['mcafee.com', 'include:mcafee.com'],
    risk: 'low',
  },
  checkpoint: {
    name: 'Check Point',
    type: 'Email Security & Gateway',
    mxPatterns: ['checkpoint.com'],
    spfPatterns: ['checkpoint.com', 'include:checkpoint.com'],
    risk: 'low',
  },
  kaspersky: {
    name: 'Kaspersky',
    type: 'Email Security & Anti-Virus',
    mxPatterns: ['kaspersky.com'],
    spfPatterns: ['kaspersky.com', 'include:kaspersky.com'],
    risk: 'low',
  },
  fsecure: {
    name: 'F-Secure',
    type: 'Email Security',
    mxPatterns: ['f-secure.com'],
    spfPatterns: ['f-secure.com', 'include:f-secure.com'],
    risk: 'low',
  },
  symantec: {
    name: 'Symantec / Norton',
    type: 'Email Security & Endpoint Protection',
    mxPatterns: ['symantec.com'],
    spfPatterns: ['symantec.com', 'include:symantec.com'],
    risk: 'low',
  },
};

/**
 * Email Marketing Service Fingerprints
 */
const MARKETING_PROVIDER_FINGERPRINTS = {
  campaignMonitor: {
    name: 'Campaign Monitor',
    type: 'Email Marketing & Automation',
    spfPatterns: ['createsend.com', 'include:_spf.createsend.com'],
  },
  mailchimp: {
    name: 'Mailchimp',
    type: 'Email Marketing & CRM',
    spfPatterns: ['mailchimp.com', 'include:mailchimp.com'],
  },
  klaviyo: {
    name: 'Klaviyo',
    type: 'Email Marketing & Customer Data',
    spfPatterns: ['klaviyo.com', 'include:klaviyo.com'],
  },
  braze: {
    name: 'Braze',
    type: 'Customer Engagement & Marketing',
    spfPatterns: ['braze.com', 'include:braze.com'],
  },
  sendinblue: {
    name: 'Sendinblue (Brevo)',
    type: 'Email Marketing Platform',
    spfPatterns: ['sendinblue.com', 'include:sendinblue.com'],
  },
  hubspot: {
    name: 'HubSpot',
    type: 'Email Marketing & CRM',
    spfPatterns: ['hubspot.com', 'include:hubspot.com'],
  },
  activecampaign: {
    name: 'ActiveCampaign',
    type: 'Email Marketing & Automation',
    spfPatterns: ['activecampaign.com', 'include:activecampaign.com'],
  },
  drip: {
    name: 'Drip',
    type: 'Email Marketing Automation',
    spfPatterns: ['drip.com', 'include:drip.com'],
  },
  convertkit: {
    name: 'ConvertKit',
    type: 'Email Marketing for Creators',
    spfPatterns: ['convertkit.com', 'include:convertkit.com'],
  },
  getresponse: {
    name: 'GetResponse',
    type: 'Email Marketing & Automation',
    spfPatterns: ['getresponse.com', 'include:getresponse.com'],
  },
  aweber: {
    name: 'Aweber',
    type: 'Email Marketing Platform',
    spfPatterns: ['aweber.com', 'include:aweber.com'],
  },
  mailerlite: {
    name: 'MailerLite',
    type: 'Email Marketing Platform',
    spfPatterns: ['mailerlite.com', 'include:mailerlite.com'],
  },
  constantContact: {
    name: 'Constant Contact',
    type: 'Email Marketing & CRM',
    spfPatterns: ['constantcontact.com', 'include:constantcontact.com'],
  },
  emailoctopus: {
    name: 'EmailOctopus',
    type: 'Email Marketing Platform',
    spfPatterns: ['emailoctopus.com', 'include:emailoctopus.com'],
  },
  mailgun: {
    name: 'Mailgun',
    type: 'Email Service Provider',
    spfPatterns: ['mailgun.org', 'mailgun.com'],
  },
  sendpulse: {
    name: 'SendPulse',
    type: 'Marketing Automation Platform',
    spfPatterns: ['sendpulse.com', 'include:sendpulse.com'],
  },
  leadpages: {
    name: 'Leadpages',
    type: 'Landing Pages & Email Marketing',
    spfPatterns: ['leadpages.net', 'include:leadpages.net'],
  },
  unbounce: {
    name: 'Unbounce',
    type: 'Landing Page & Conversion Platform',
    spfPatterns: ['unbounce.com', 'include:unbounce.com'],
  },
  intercom: {
    name: 'Intercom',
    type: 'Customer Communication Platform',
    spfPatterns: ['intercom.com', 'include:intercom.com'],
  },
  drift: {
    name: 'Drift',
    type: 'Customer Communication Platform',
    spfPatterns: ['drift.com', 'include:drift.com'],
  },
};

/**
 * Identifies marketing services from SPF/TXT records
 * @param {Array} txtRecords - Array of TXT records
 * @returns {Object} - { services: Array, details: Array }
 */
function identifyMarketingServices(txtRecords) {
  const detectedServices = [];
  const serviceSet = new Set();

  // Check TXT/SPF records for marketing service patterns
  if (Array.isArray(txtRecords)) {
    for (const txt of txtRecords) {
      const spfString = Array.isArray(txt) ? txt.join('') : txt;
      if (spfString && spfString.toLowerCase().includes('v=spf1')) {
        for (const [key, config] of Object.entries(MARKETING_PROVIDER_FINGERPRINTS)) {
          for (const pattern of config.spfPatterns) {
            if (spfString.toLowerCase().includes(pattern.toLowerCase())) {
              if (!serviceSet.has(config.name)) {
                detectedServices.push({
                  name: config.name,
                  type: config.type,
                });
                serviceSet.add(config.name);
              }
            }
          }
        }
      }
    }
  }

  return {
    detected: detectedServices.length > 0,
    services: detectedServices,
    count: detectedServices.length,
  };
}

/**
 * Identifies security services from MX and SPF records
 * @param {Array} mxRecords - Array of MX record objects
 * @param {Array} txtRecords - Array of TXT records
 * @returns {Object} - { services: Array, details: Array }
 */
function identifySecurityServices(mxRecords, txtRecords) {
  const detectedServices = [];
  const serviceSet = new Set();

  // Check MX records for security service patterns
  if (Array.isArray(mxRecords)) {
    for (const mx of mxRecords) {
      const exchange =
        typeof mx === 'string' ? mx : mx.exchange || '';
      for (const [key, config] of Object.entries(SECURITY_PROVIDER_FINGERPRINTS)) {
        for (const pattern of config.mxPatterns) {
          if (exchange.toLowerCase().includes(pattern.toLowerCase())) {
            if (!serviceSet.has(config.name)) {
              detectedServices.push({
                name: config.name,
                type: config.type,
                source: 'MX Record',
              });
              serviceSet.add(config.name);
            }
          }
        }
      }
    }
  }

  // Check TXT/SPF records for security service patterns
  if (Array.isArray(txtRecords)) {
    for (const txt of txtRecords) {
      const spfString = Array.isArray(txt) ? txt.join('') : txt;
      if (spfString && spfString.toLowerCase().includes('v=spf1')) {
        for (const [key, config] of Object.entries(SECURITY_PROVIDER_FINGERPRINTS)) {
          for (const pattern of config.spfPatterns) {
            if (spfString.toLowerCase().includes(pattern.toLowerCase())) {
              if (!serviceSet.has(config.name)) {
                detectedServices.push({
                  name: config.name,
                  type: config.type,
                  source: 'SPF Record',
                });
                serviceSet.add(config.name);
              }
            }
          }
        }
      }
    }
  }

  return {
    detected: detectedServices.length > 0,
    services: detectedServices,
    count: detectedServices.length,
  };
}

/**
 * Identifies DNS/Registrar provider from NS records
 * @param {Array} nsRecords - Array of NS record strings
 * @returns {Object} - { provider: string, nameservers: Array<string> }
 */
function identifyDNSProvider(nsRecords) {
  if (!Array.isArray(nsRecords) || nsRecords.length === 0) {
    return { provider: 'Unknown', nameservers: [] };
  }

  // Check for provider matches
  for (const [key, providerConfig] of Object.entries(DNS_PROVIDER_FINGERPRINTS)) {
    for (const ns of nsRecords) {
      for (const pattern of providerConfig.nsPatterns) {
        if (ns.toLowerCase().includes(pattern.toLowerCase())) {
          return {
            provider: providerConfig.name,
            nameservers: nsRecords,
            matchedPattern: pattern,
          };
        }
      }
    }
  }

  // If no provider matched, return unknown
  return {
    provider: 'Other / Custom DNS',
    nameservers: nsRecords,
  };
}

/**
 * Identifies email host provider from MX records
 * @param {Array} mxRecords - Array of MX record objects with 'exchange' property
 * @returns {Object} - { provider: string, mxServers: Array<string> }
 */
function identifyMXProvider(mxRecords) {
  if (!Array.isArray(mxRecords) || mxRecords.length === 0) {
    return { provider: 'Unknown/Self-Hosted', mxServers: [] };
  }

  const mxServers = mxRecords.map((mx) =>
    typeof mx === 'string' ? mx : mx.exchange
  );

  // Check for provider matches
  for (const [key, providerConfig] of Object.entries(PROVIDER_FINGERPRINTS)) {
    for (const server of mxServers) {
      for (const pattern of providerConfig.mxPatterns) {
        if (server.toLowerCase().includes(pattern.toLowerCase())) {
          return {
            provider: providerConfig.name,
            mxServers,
            matchedPattern: pattern,
          };
        }
      }
    }
  }

  // If no provider matched, it's self-hosted
  return {
    provider: 'Self-Hosted / Custom',
    mxServers,
  };
}

/**
 * Extracts domain from SPF include directive
 * @param {string} spfString - The SPF record string
 * @returns {Array<string>} - Array of extracted domains
 */
function extractSPFIncludes(spfString) {
  if (!spfString) return [];

  // Regex to match include: directives
  const includeRegex = /include:([a-zA-Z0-9.-]+)/g;
  const includes = [];
  let match;

  while ((match = includeRegex.exec(spfString)) !== null) {
    includes.push(match[1]);
  }

  return includes;
}

/**
 * Identifies authorized third-party senders from SPF TXT records
 * @param {Array} txtRecords - Array of TXT records (may be nested arrays)
 * @returns {Object} - { providers: Array, rawIncludes: Array }
 */
function identifySPFProviders(txtRecords) {
  if (!Array.isArray(txtRecords) || txtRecords.length === 0) {
    return { providers: [], rawIncludes: [] };
  }

  const identifiedProviders = new Set();
  const rawIncludes = [];

  // Process each TXT record
  for (const txt of txtRecords) {
    // Handle nested arrays (some DNS APIs return TXT as array of arrays)
    const spfString = Array.isArray(txt) ? txt.join('') : txt;

    if (spfString && spfString.toLowerCase().includes('v=spf1')) {
      // Extract all include: directives
      const includes = extractSPFIncludes(spfString);
      rawIncludes.push(...includes);

      // Match against provider fingerprints
      for (const domain of includes) {
        for (const [key, providerConfig] of Object.entries(
          PROVIDER_FINGERPRINTS
        )) {
          for (const pattern of providerConfig.spfPatterns) {
            if (domain.toLowerCase().includes(pattern.toLowerCase())) {
              identifiedProviders.add(providerConfig.name);
              break;
            }
          }
        }
      }
    }
  }

  return {
    providers: Array.from(identifiedProviders),
    rawIncludes,
  };
}

/**
 * Main translator function - identifies all email service providers
 * @param {Object} dnsData - Object containing MX, TXT, and NS arrays
 * @returns {Object} - Comprehensive provider information
 */
function translateEmailProviders(dnsData) {
  if (!dnsData) {
    return {
      success: false,
      error: 'No DNS data provided',
    };
  }

  const { MX = [], TXT = [], NS = [] } = dnsData;

  // Identify primary email host
  const primaryHost = identifyMXProvider(MX);

  // Identify authorized senders via SPF
  const spfAnalysis = identifySPFProviders(TXT);

  // Identify DNS/Registrar provider
  const dnsProvider = identifyDNSProvider(NS);

  // Identify security services
  const securityServices = identifySecurityServices(MX, TXT);

  // Identify marketing services
  const marketingServices = identifyMarketingServices(TXT);

  return {
    success: true,
    emailHost: {
      provider: primaryHost.provider,
      mxServers: primaryHost.mxServers,
      matchedPattern: primaryHost.matchedPattern || null,
    },
    dnsProvider: {
      provider: dnsProvider.provider,
      nameservers: dnsProvider.nameservers,
      matchedPattern: dnsProvider.matchedPattern || null,
    },
    security: {
      detected: securityServices.detected,
      count: securityServices.count,
      services: securityServices.services,
    },
    marketing: {
      detected: marketingServices.detected,
      count: marketingServices.count,
      services: marketingServices.services,
    },
    authorizedSenders: {
      providers: spfAnalysis.providers,
      spfIncludes: spfAnalysis.rawIncludes,
    },
    summary: {
      totalMXRecords: MX.length,
      totalNSRecords: NS.length,
      totalSPFIncludes: spfAnalysis.rawIncludes.length,
      securityServicesDetected: securityServices.count,
      marketingServicesDetected: marketingServices.count,
      distinctProviders: new Set([
        primaryHost.provider,
        dnsProvider.provider,
        ...spfAnalysis.providers,
        ...securityServices.services.map((s) => s.name),
        ...marketingServices.services.map((s) => s.name),
      ]).size,
    },
  };
}

/**
 * Adds a new provider to the fingerprints mapping
 * @param {string} key - Unique key for the provider
 * @param {Object} config - Provider configuration
 */
function addProvider(key, config) {
  if (!config.name || !config.mxPatterns || !config.spfPatterns) {
    throw new Error(
      'Provider config must have name, mxPatterns, and spfPatterns'
    );
  }
  PROVIDER_FINGERPRINTS[key] = config;
  console.log(`Added provider: ${config.name}`);
}

/**
 * List all registered providers
 * @returns {Array} - Array of provider names
 */
function listProviders() {
  return Object.entries(PROVIDER_FINGERPRINTS).map(([key, config]) => ({
    key,
    name: config.name,
  }));
}

module.exports = {
  translateEmailProviders,
  identifyMXProvider,
  identifyDNSProvider,
  identifySecurityServices,
  identifyMarketingServices,
  identifySPFProviders,
  extractSPFIncludes,
  addProvider,
  listProviders,
  PROVIDER_FINGERPRINTS,
  DNS_PROVIDER_FINGERPRINTS,
  SECURITY_PROVIDER_FINGERPRINTS,
  MARKETING_PROVIDER_FINGERPRINTS,
};
