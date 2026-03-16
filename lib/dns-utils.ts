import type { DNSDataSection, DNSResult } from '@/app/types'

/**
 * Structure DNS data from the raw /api/dns envelope for use in /api/partners.
 * The DNS API response shape is { domainCheck, dnsRecords: { data: { MX, NS, TXT, A } }, report, whois }.
 * DomainForm now sends the full envelope, so we navigate dnsRecords.data.
 */
export function structureDNSData(raw: any): DNSDataSection {
  // Support both the full DNS envelope and a bare record object for backwards compat
  const records = raw?.dnsRecords?.data ?? raw
  const mxList: any[] = Array.isArray(records?.MX) ? records.MX : []

  return {
    aRecords: Array.isArray(records?.A) ? records.A : [],
    mxRecords: mxList.map((mx: any) => ({
      priority: mx.priority ?? 0,
      // DNS API uses `exchange` field for MX hostnames
      value: mx.exchange ?? mx.value ?? (typeof mx === 'string' ? mx : ''),
    })),
    nsRecords: Array.isArray(records?.NS) ? records.NS : [],
    // TXT records are arrays of strings that need joining
    txtRecords: Array.isArray(records?.TXT)
      ? records.TXT.map((t: any) => (Array.isArray(t) ? t.join('') : String(t)))
      : [],
    timestamp: new Date().toISOString(),
  }
}

export interface ParsedDNSInfo {
  emailHost: string | null
  registrar: string | null
  registrarTradingName: string | null
  registrarUrl: string | null
  registrarDisplayName: string | null
  hostingProvider: string | null
  technicalContact: string | null
  securityServices: string[]
}

const GENERIC_EMAIL_LABELS = new Set(['Self-Hosted / Custom', 'Other', 'Custom', ''])

function isGenericLabel(v: string | null | undefined): boolean {
  return !v || GENERIC_EMAIL_LABELS.has(v)
}

/**
 * Parse the raw /api/dns response into a clean, stable shape.
 * Replaces the 150-line multi-fallback extraction in PartnerCardsContainer.
 * Accepts both the direct API response and the unwrapped result object.
 */
export function parseDNSResponse(rawDnsData: any): ParsedDNSInfo {
  const data = rawDnsData?.result ?? rawDnsData
  const report = data?.report
  const whois = data?.whois

  // --- Security services (check all known field shapes) ---
  let securityServices: string[] = []
  const rawSecurity =
    report?.security_services ??
    report?.securityServices ??
    report?.security ??
    report?.services?.security ??
    (Array.isArray(report?.services) ? report.services : null)

  if (rawSecurity != null) {
    const arr = Array.isArray(rawSecurity) ? rawSecurity : [rawSecurity]
    securityServices = arr
      .map((s: any) => (typeof s === 'string' ? s : s?.name ?? s?.provider ?? null))
      .filter((s: string | null): s is string => typeof s === 'string' && s.length > 0)
  }

  // --- Email host ---
  let emailHost: string | null =
    report?.email_provider ||
    report?.mail_provider ||
    report?.mx_provider ||
    null

  // If null or a generic placeholder, try inferring from security services
  if (isGenericLabel(emailHost)) {
    const knownEmailProviders = ['Proofpoint', 'Mimecast', 'Microsoft', 'Google']
    outer: for (const svc of securityServices) {
      for (const prov of knownEmailProviders) {
        if (svc.toLowerCase().includes(prov.toLowerCase())) {
          emailHost = prov === 'Microsoft' ? 'Microsoft 365' : prov
          break outer
        }
      }
    }
  }

  // If still generic, infer from raw MX records (stored at dnsRecords.data.MX)
  if (isGenericLabel(emailHost)) {
    const mxRecords = data?.dnsRecords?.data?.MX ?? data?.dnsRecords?.MX
    if (Array.isArray(mxRecords) && mxRecords.length > 0) {
      const mx = mxRecords[0]
      const mxVal = (typeof mx === 'string' ? mx : mx?.exchange ?? mx?.value ?? '').toLowerCase()
      if (mxVal.includes('google')) {
        emailHost = 'Google Workspace'
      } else if (mxVal.includes('microsoft') || mxVal.includes('outlook') || mxVal.includes('office365')) {
        emailHost = 'Microsoft 365'
      } else if (mxVal.includes('proofpoint')) {
        emailHost = 'Proofpoint'
      } else if (mxVal.includes('mimecast')) {
        emailHost = 'Mimecast'
      } else {
        const parts = mxVal.split('.')
        const base = parts[0]
        if (base && base.length > 1) {
          emailHost = base.charAt(0).toUpperCase() + base.slice(1)
        }
      }
    }
  }

  // --- Registrar ---
  let registrar: string | null = whois?.registrar ?? whois?.registrarName ?? null
  let registrarTradingName: string | null = null
  if (registrar && registrar.includes('trading as')) {
    const [before, after] = registrar.split('trading as ')
    registrarTradingName = after?.trim() ?? null
    registrar = before?.trim() ?? registrar
  }

  const registrarUrl: string | null = whois?.registrar_url ?? whois?.registrarUrl ?? null
  let registrarDisplayName: string | null = null
  if (registrarUrl) {
    try {
      const hostname = new URL(registrarUrl).hostname.replace('www.', '')
      const base = hostname.split('.')[0]
      registrarDisplayName = base.charAt(0).toUpperCase() + base.slice(1)
    } catch {
      // Invalid URL — leave as null
    }
  }

  // --- Hosting provider (reject if it looks like a domain or IP) ---
  const rawProvider: string | null = whois?.hosting_provider ?? whois?.hostingProvider ?? null
  const hostingProvider: string | null =
    rawProvider &&
    !rawProvider.includes('.') &&
    !/^\d+\.\d+\.\d+\.\d+$/.test(rawProvider)
      ? rawProvider
      : null

  const technicalContact: string | null =
    whois?.technical_contact?.name ?? whois?.technicalContact?.name ?? null

  return {
    emailHost: isGenericLabel(emailHost) ? null : emailHost,
    registrar,
    registrarTradingName,
    registrarUrl,
    registrarDisplayName,
    hostingProvider,
    technicalContact,
    securityServices,
  }
}
