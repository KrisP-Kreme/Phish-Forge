const whois = require('whois');

/**
 * Queries whois information for a domain and returns structured JSON
 * Extracts: Registrar URL, Tech Contact Name/ID
 * @param {string} domain - The domain to query
 * @returns {Promise<Object>} JSON object with whois information
 */
async function queryWhoisInfo(domain) {
  return new Promise((resolve, reject) => {
    try {
      // Clean and normalize domain
      let cleanDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .split('/')[0]
        .replace(/^www\./, '');

      console.log(`Querying whois information for: ${cleanDomain}...`);

      whois.lookup(cleanDomain, (error, data) => {
        if (error) {
          console.error(`Whois lookup error for ${cleanDomain}:`, error.message);
          resolve({
            success: false,
            domain: cleanDomain,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
          return;
        }

        try {
          const parsed = parseWhoisData(data);
          resolve({
            success: true,
            domain: cleanDomain,
            ...parsed,
            timestamp: new Date().toISOString(),
          });
        } catch (parseError) {
          console.error(`Error parsing whois data for ${cleanDomain}:`, parseError.message);
          resolve({
            success: false,
            domain: cleanDomain,
            error: 'Failed to parse whois data',
            rawData: data,
            timestamp: new Date().toISOString(),
          });
        }
      });
    } catch (error) {
      console.error(`Error querying whois for ${domain}:`, error.message);
      reject({
        success: false,
        domain,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });
}

/**
 * Parses whois response data to extract key information
 * @param {string} data - The raw whois response
 * @returns {Object} Parsed whois information
 */
function parseWhoisData(data) {
  const result = {
    registrarUrl: null,
    registrarName: null,
    techContactName: null,
    techContactId: null,
    techContactEmail: null,
    adminContactName: null,
    adminContactEmail: null,
    registrantContactName: null,
    registrantContactEmail: null,
    nameServers: [],
    hostingProvider: null,
  };

  const lines = data.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Registrar URL patterns
    if (
      /registrar\s+url|registrar\s+website|registrar\s+web\s+site/i.test(line)
    ) {
      const match = line.match(/:\s*(.+?)$/);
      if (match) result.registrarUrl = match[1].trim();
    }

    // Registrar Name patterns
    if (/^registrar\s+name|^registrar:/i.test(line) && !result.registrarName) {
      const match = line.match(/:\s*(.+?)$/);
      if (match) result.registrarName = match[1].trim();
    }

    // Tech Contact Name patterns
    if (/tech\s+contact\s+name|tech\s+name/i.test(line)) {
      const match = line.match(/:\s*(.+?)$/);
      if (match) result.techContactName = match[1].trim();
    }

    // Tech Contact ID/Handle patterns
    if (/tech\s+contact\s+id|tech\s+contact\s+handle|tech\s+handle/i.test(line)) {
      const match = line.match(/:\s*(.+?)$/);
      if (match) result.techContactId = match[1].trim();
    }

    // Tech Contact Email patterns
    if (/tech\s+contact\s+email|tech\s+email/i.test(line)) {
      const match = line.match(/:\s*(.+?)$/);
      if (match) result.techContactEmail = match[1].trim();
    }

    // Admin Contact Name patterns
    if (/admin\s+contact\s+name|admin\s+name/i.test(line)) {
      const match = line.match(/:\s*(.+?)$/);
      if (match) result.adminContactName = match[1].trim();
    }

    // Admin Contact Email patterns
    if (/admin\s+contact\s+email|admin\s+email/i.test(line)) {
      const match = line.match(/:\s*(.+?)$/);
      if (match) result.adminContactEmail = match[1].trim();
    }

    // Registrant Contact Name patterns
    if (/registrant\s+contact\s+name|registrant\s+name/i.test(line)) {
      const match = line.match(/:\s*(.+?)$/);
      if (match) result.registrantContactName = match[1].trim();
    }

    // Registrant Contact Email patterns
    if (/registrant\s+contact\s+email|registrant\s+email/i.test(line)) {
      const match = line.match(/:\s*(.+?)$/);
      if (match) result.registrantContactEmail = match[1].trim();
    }

    // Name Server patterns - collect all nameservers
    if (/name\s+server|nameserver|ns\s+\d+/i.test(line)) {
      const match = line.match(/:\s*(.+?)$/);
      if (match) {
        const ns = match[1].trim();
        if (ns && !result.nameServers.includes(ns)) {
          result.nameServers.push(ns);
        }
      }
    }
  }

  // Detect hosting provider from nameservers
  if (result.nameServers.length > 0) {
    result.hostingProvider = detectHostingProvider(result.nameServers, data);
  }

  // Remove null values from result
  return Object.fromEntries(
    Object.entries(result).filter(([key, value]) => {
      if (key === 'nameServers') return value.length > 0;
      return value !== null;
    })
  );
}

/**
 * Detects hosting provider based on nameservers and whois data
 * @param {string[]} nameServers - List of nameservers
 * @param {string} whoisData - Raw whois data
 * @returns {string|null} Detected hosting provider
 */
function detectHostingProvider(nameServers, whoisData) {
  const nsString = nameServers.join(' ').toLowerCase();
  const whoisLower = whoisData.toLowerCase();

  // Common hosting provider patterns
  const hostingPatterns = [
    { pattern: /cloudflare/i, provider: 'Cloudflare' },
    { pattern: /aws|amazon/i, provider: 'Amazon Web Services (AWS)' },
    { pattern: /azure|microsoft/i, provider: 'Microsoft Azure' },
    { pattern: /google cloud|gcp/i, provider: 'Google Cloud Platform' },
    { pattern: /digitalocean/i, provider: 'DigitalOcean' },
    { pattern: /heroku/i, provider: 'Heroku' },
    { pattern: /netlify/i, provider: 'Netlify' },
    { pattern: /vercel/i, provider: 'Vercel' },
    { pattern: /linode/i, provider: 'Akamai (Linode)' },
    { pattern: /vultr/i, provider: 'Vultr' },
    { pattern: /bluehost/i, provider: 'Bluehost' },
    { pattern: /godaddy/i, provider: 'GoDaddy' },
    { pattern: /namecheap/i, provider: 'Namecheap' },
    { pattern: /hostgator/i, provider: 'HostGator' },
    { pattern: /siteground/i, provider: 'SiteGround' },
    { pattern: /kinsta|kinsta\.com/i, provider: 'Kinsta' },
    { pattern: /wpengine/i, provider: 'WP Engine' },
    { pattern: /dreamhost/i, provider: 'DreamHost' },
    { pattern: /ionos/i, provider: 'IONOS' },
    { pattern: /fastly/i, provider: 'Fastly' },
    { pattern: /akamai/i, provider: 'Akamai' },
    { pattern: /telstra/i, provider: 'Telstra' },
    { pattern: /iinet/i, provider: 'iiNet' },
    { pattern: /optus/i, provider: 'Optus' },
  ];

  // Check nameservers against patterns
  for (const { pattern, provider } of hostingPatterns) {
    if (pattern.test(nsString)) {
      return provider;
    }
  }

  // Check whois data for hosting provider mentions
  for (const { pattern, provider } of hostingPatterns) {
    if (pattern.test(whoisLower)) {
      return provider;
    }
  }

  // If no known pattern found, try to extract from nameserver domain
  if (nameServers.length > 0) {
    const nsDomain = nameServers[0].split('.').slice(1).join('.');
    if (nsDomain && nsDomain !== '') {
      return `Nameserver: ${nsDomain}`;
    }
  }

  return null;
}

/**
 * Main function to handle command-line usage
 */
async function main() {
  const domain = process.argv[2];

  if (!domain) {
    console.error('Usage: node whois.js <domain>');
    console.error('Example: node whois.js google.com');
    process.exit(1);
  }

  try {
    const result = await queryWhoisInfo(domain);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Export functions for use as module
module.exports = {
  queryWhoisInfo,
  parseWhoisData,
};

// Run main if this is the entry point
if (require.main === module) {
  main();
}
