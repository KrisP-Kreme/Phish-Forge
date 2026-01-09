const { promises: dnsPromises } = require('dns');

/**
 * Checks if a domain exists by performing an SOA query (similar to dig +noall +comments status)
 * This is a lightweight check to validate domain existence before running comprehensive lookups
 * @param {string} domain - The domain to check
 * @returns {Promise<Object>} Object with { exists: boolean, status: string, domain: string }
 */
async function checkDomainExists(domain) {
  try {
    // Clean and normalize domain
    let cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .split('/')[0]
      .replace(/^www\./, '');

    console.log(`Checking if domain exists: ${cleanDomain}...`);

    // Try SOA query first (most reliable for domain existence)
    try {
      await dnsPromises.resolveSoa(cleanDomain);
      return {
        exists: true,
        status: 'NOERROR',
        domain: cleanDomain,
        timestamp: new Date().toISOString(),
      };
    } catch (soaError) {
      // If SOA fails, try NS query as fallback
      try {
        await dnsPromises.resolveNs(cleanDomain);
        return {
          exists: true,
          status: 'NOERROR',
          domain: cleanDomain,
          timestamp: new Date().toISOString(),
        };
      } catch (nsError) {
        // If both fail, domain doesn't exist
        return {
          exists: false,
          status: 'NXDOMAIN',
          domain: cleanDomain,
          error: 'Domain does not exist or cannot be resolved',
          timestamp: new Date().toISOString(),
        };
      }
    }
  } catch (error) {
    console.error(`Domain existence check error for ${domain}:`, error.message);
    return {
      exists: false,
      status: 'ERROR',
      domain,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Performs a DNS lookup for a given domain using Node.js built-in DNS module
 * @param {string} domain - The domain to look up
 * @param {string} recordType - The DNS record type (A, MX, NS, TXT, etc.)
 * @returns {Promise<Object>} The DNS lookup results
 */
async function performDNSLookup(domain, recordType = 'A') {
  try {
    // Clean and normalize domain - remove protocol, path, and www prefix
    let cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .split('/')[0];
    
    // Remove www. prefix to query root domain for authoritative records
    cleanDomain = cleanDomain.replace(/^www\./, '');

    console.log(`Performing DNS lookup for ${cleanDomain} (${recordType})...`);

    let result;
    
    switch (recordType.toUpperCase()) {
      case 'A':
        result = await dnsPromises.resolve4(cleanDomain);
        break;
      case 'AAAA':
        result = await dnsPromises.resolve6(cleanDomain);
        break;
      case 'MX':
        result = await dnsPromises.resolveMx(cleanDomain);
        break;
      case 'NS':
        result = await dnsPromises.resolveNs(cleanDomain);
        break;
      case 'TXT':
        result = await dnsPromises.resolveTxt(cleanDomain);
        break;
      case 'CNAME':
        result = await dnsPromises.resolveCname(cleanDomain);
        break;
      case 'SOA':
        result = await dnsPromises.resolveSoa(cleanDomain);
        break;
      case 'SRV':
        result = await dnsPromises.resolveSrv(cleanDomain);
        break;
      default:
        result = await dnsPromises.resolve4(cleanDomain);
    }
    
    return {
      success: true,
      domain: cleanDomain,
      recordType,
      data: result,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`DNS lookup error for ${domain}:`, error.message);
    return {
      success: false,
      domain,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Performs multiple DNS queries for different record types
 * @param {string} domain - The domain to look up
 * @param {string[]} recordTypes - Array of DNS record types to query
 * @returns {Promise<Object>} The DNS lookup results
 */
async function performComprehensiveDNSLookup(domain, recordTypes = ['A', 'AAAA', 'MX', 'NS', 'TXT']) {
  try {
    let cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .split('/')[0];
    
    // Remove www. prefix to query root domain for authoritative records
    cleanDomain = cleanDomain.replace(/^www\./, '');

    console.log(`Performing comprehensive DNS lookup for ${cleanDomain}...`);

    const results = {};

    // Prepare all DNS queries
    const queries = [];
    
    for (const recordType of recordTypes) {
      let promise;
      
      switch (recordType.toUpperCase()) {
        case 'A':
          promise = dnsPromises.resolve4(cleanDomain)
            .then(data => ({ type: 'A', success: true, data }))
            .catch(error => ({ type: 'A', success: false, error: error.message }));
          break;
        case 'AAAA':
          promise = dnsPromises.resolve6(cleanDomain)
            .then(data => ({ type: 'AAAA', success: true, data }))
            .catch(error => ({ type: 'AAAA', success: false, error: error.message }));
          break;
        case 'MX':
          promise = dnsPromises.resolveMx(cleanDomain)
            .then(data => ({ type: 'MX', success: true, data }))
            .catch(error => ({ type: 'MX', success: false, error: error.message }));
          break;
        case 'NS':
          promise = dnsPromises.resolveNs(cleanDomain)
            .then(data => ({ type: 'NS', success: true, data }))
            .catch(error => ({ type: 'NS', success: false, error: error.message }));
          break;
        case 'TXT':
          promise = dnsPromises.resolveTxt(cleanDomain)
            .then(data => ({ type: 'TXT', success: true, data }))
            .catch(error => ({ type: 'TXT', success: false, error: error.message }));
          break;
        case 'CNAME':
          promise = dnsPromises.resolveCname(cleanDomain)
            .then(data => ({ type: 'CNAME', success: true, data }))
            .catch(error => ({ type: 'CNAME', success: false, error: error.message }));
          break;
        case 'SOA':
          promise = dnsPromises.resolveSoa(cleanDomain)
            .then(data => ({ type: 'SOA', success: true, data }))
            .catch(error => ({ type: 'SOA', success: false, error: error.message }));
          break;
        default:
          continue;
      }
      
      queries.push(promise);
    }

    // Execute all queries in parallel
    const queryResults = await Promise.all(queries);
    
    // Organize results by type
    for (const result of queryResults) {
      if (result.success) {
        results[result.type] = result.data;
      } else {
        results[result.type] = { error: result.error };
      }
    }

    return {
      success: true,
      domain: cleanDomain,
      data: results,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Comprehensive DNS lookup error for ${domain}:`, error.message);
    return {
      success: false,
      domain,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// Export functions for use in API routes
module.exports = {
  checkDomainExists,
  performDNSLookup,
  performComprehensiveDNSLookup,
};
