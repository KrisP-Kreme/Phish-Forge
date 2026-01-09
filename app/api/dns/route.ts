import { NextRequest, NextResponse } from 'next/server';

interface DomainCheckResult {
  exists: boolean;
  status: string;
  domain: string;
  error?: string;
  timestamp: string;
}

/**
 * Formats whois results for pretty console logging
 */
function formatWhoisResults(whoisData: any): string {
  if (!whoisData.success) {
    return `⚠️ WHOIS LOOKUP FAILED\n${'═'.repeat(70)}\nError: ${whoisData.error}\n${'═'.repeat(70)}\n`;
  }

  let output = `\n${'═'.repeat(70)}\n`;
  output += `📋 WHOIS INFORMATION\n`;
  output += `${'═'.repeat(70)}\n`;
  output += `Domain: ${whoisData.domain}\n`;
  output += `Timestamp: ${whoisData.timestamp}\n`;
  output += `${'─'.repeat(70)}\n\n`;

  // Hosting Provider
  if (whoisData.hostingProvider) {
    output += `🏥 HOSTING PROVIDER\n`;
    output += `  ${whoisData.hostingProvider}\n\n`;
  }

  // Registrar Info
  if (whoisData.registrarName || whoisData.registrarUrl) {
    output += `🏢 REGISTRAR\n`;
    if (whoisData.registrarName) {
      output += `  Name: ${whoisData.registrarName}\n`;
    }
    if (whoisData.registrarUrl) {
      output += `  URL: ${whoisData.registrarUrl}\n`;
    }
    output += `\n`;
  }

  // Name Servers
  if (whoisData.nameServers && whoisData.nameServers.length > 0) {
    output += `🔗 NAME SERVERS\n`;
    whoisData.nameServers.forEach((ns: string) => {
      output += `  • ${ns}\n`;
    });
    output += `\n`;
  }

  // Tech Contact
  if (whoisData.techContactName || whoisData.techContactId || whoisData.techContactEmail) {
    output += `👨‍💻 TECHNICAL CONTACT\n`;
    if (whoisData.techContactName) {
      output += `  Name: ${whoisData.techContactName}\n`;
    }
    if (whoisData.techContactId) {
      output += `  ID: ${whoisData.techContactId}\n`;
    }
    if (whoisData.techContactEmail) {
      output += `  Email: ${whoisData.techContactEmail}\n`;
    }
    output += `\n`;
  }

  // Admin Contact
  if (whoisData.adminContactName || whoisData.adminContactEmail) {
    output += `👔 ADMIN CONTACT\n`;
    if (whoisData.adminContactName) {
      output += `  Name: ${whoisData.adminContactName}\n`;
    }
    if (whoisData.adminContactEmail) {
      output += `  Email: ${whoisData.adminContactEmail}\n`;
    }
    output += `\n`;
  }

  // Registrant Contact
  if (whoisData.registrantContactName || whoisData.registrantContactEmail) {
    output += `👤 REGISTRANT CONTACT\n`;
    if (whoisData.registrantContactName) {
      output += `  Name: ${whoisData.registrantContactName}\n`;
    }
    if (whoisData.registrantContactEmail) {
      output += `  Email: ${whoisData.registrantContactEmail}\n`;
    }
    output += `\n`;
  }

  output += `${'═'.repeat(70)}\n`;
  return output;
}

/**
 * Formats DNS results for pretty console logging
 */
function formatDNSResults(result: any): string {
  if (!result.success) {
    return `❌ DNS Lookup Failed for ${result.domain}: ${result.error}`;
  }

  const { domain, data, timestamp } = result;
  let output = `\n${'═'.repeat(70)}\n`;
  output += `📊 DNS LOOKUP RESULTS\n`;
  output += `${'═'.repeat(70)}\n`;
  output += `Domain: ${domain}\n`;
  output += `Timestamp: ${timestamp}\n`;
  output += `${'─'.repeat(70)}\n\n`;

  // Format MX Records
  if (data.MX && Array.isArray(data.MX)) {
    output += `📧 MAIL EXCHANGE (MX) RECORDS\n`;
    output += `${'─'.repeat(70)}\n`;
    data.MX.forEach((mx: any) => {
      output += `  Priority: ${mx.priority} → ${mx.exchange}\n`;
    });
    output += `\n`;
  } else if (data.MX?.error) {
    output += `📧 MAIL EXCHANGE (MX): ${data.MX.error}\n\n`;
  }

  // Format TXT Records
  if (data.TXT && Array.isArray(data.TXT)) {
    output += `📝 TEXT (TXT) RECORDS\n`;
    output += `${'─'.repeat(70)}\n`;
    data.TXT.forEach((txt: any, index: number) => {
      const txtContent = Array.isArray(txt) ? txt.join('') : txt;
      output += `  [${index + 1}] ${txtContent}\n`;
    });
    output += `\n`;
  } else if (data.TXT?.error) {
    output += `📝 TEXT (TXT): ${data.TXT.error}\n\n`;
  }

  output += `${'═'.repeat(70)}\n`;
  return output;
}

export async function POST(request: NextRequest) {
  try {
    const { domain, recordTypes = ['MX', 'TXT', 'NS'], comprehensive = false } = await request.json();

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      );
    }

    // Dynamically import the dns-lookup script
    const { checkDomainExists, performDNSLookup, performComprehensiveDNSLookup } = await import(
      '@/scripts/dns-lookup.js'
    );

    // First, check if domain exists before running any other scripts
    console.log(`\n🔍 PRE-VALIDATION: Checking domain existence...`);
    const existenceCheck = await checkDomainExists(domain) as DomainCheckResult;
    
    if (!existenceCheck.exists) {
      console.error(`❌ Domain validation failed: ${existenceCheck.error}`);
      return NextResponse.json(
        { 
          error: 'Domain does not exist or cannot be resolved',
          domainCheck: existenceCheck,
        },
        { status: 400 }
      );
    }

    console.log(`✅ Domain exists: ${existenceCheck.domain} (Status: ${existenceCheck.status})`);

    let result: any;
    if (comprehensive || Array.isArray(recordTypes)) {
      // Use custom record types or default to MX, TXT, NS
      const types = Array.isArray(recordTypes) ? recordTypes : ['MX', 'TXT', 'NS'];
      result = await performComprehensiveDNSLookup(domain, types);
    } else {
      result = await performDNSLookup(domain, recordTypes);
    }

    // Log formatted output
    console.log(formatDNSResults(result));

    // Translate email providers
    const { translateEmailProviders, generateJSONReport, formatReportForConsole } =
      await import('@/scripts/email-provider-translator.js');
    const providerAnalysis: any = translateEmailProviders(result.data);
    const jsonReport: any = generateJSONReport(providerAnalysis);

    // Log formatted report
    console.log(formatReportForConsole(jsonReport));

    // Query whois information
    console.log(`\n🔍 WHOIS: Querying whois information for ${domain}...`);
    let whoisData: any = null;
    try {
      const { queryWhoisInfo } = await import('@/scripts/whois.js');
      whoisData = await queryWhoisInfo(domain);
      console.log(formatWhoisResults(whoisData));
      if (whoisData.success) {
        console.log(`✅ Whois lookup successful for ${domain}`);
      } else {
        console.log(`⚠️ Whois lookup failed: ${whoisData.error}`);
      }
    } catch (whoisError) {
      console.error(`Whois query error: ${whoisError instanceof Error ? whoisError.message : String(whoisError)}`);
      whoisData = {
        success: false,
        error: whoisError instanceof Error ? whoisError.message : 'Whois query failed',
      };
    }

    return NextResponse.json({
      domainCheck: existenceCheck,
      dnsRecords: result,
      report: jsonReport,
      whois: whoisData,
    });
  } catch (error) {
    console.error('DNS API Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'DNS lookup failed',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const domain = searchParams.get('domain');
  const recordType = searchParams.get('recordType') || 'A';
  const comprehensive = searchParams.get('comprehensive') === 'true';

  if (!domain) {
    return NextResponse.json(
      { error: 'Domain query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const { performDNSLookup, performComprehensiveDNSLookup } = await import(
      '@/scripts/dns-lookup.js'
    );

    let result;
    if (comprehensive) {
      const types = recordType.split(',').map((t) => t.trim());
      result = await performComprehensiveDNSLookup(domain, types);
    } else {
      result = await performDNSLookup(domain, recordType);
    }

    console.log('DNS Lookup Result:', JSON.stringify(result, null, 2));
    return NextResponse.json(result);
  } catch (error) {
    console.error('DNS API Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'DNS lookup failed',
      },
      { status: 500 }
    );
  }
}
