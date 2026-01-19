/**
 * Scenario Memory: Tracks which scenarios have been used to suggest variations
 * Replaces full previousEmail embedding with compact scenario tracking
 */

export interface ScenarioMemory {
  targetDomain: string
  scenariosUsed: string[]
  lastUpdated: string
}

export const AVAILABLE_SCENARIOS = [
  'invoice_approval',
  'account_verification',
  'payment_update',
  'system_update',
  'compliance_alert',
  'partnership_update',
  'billing_discrepancy',
  'security_alert',
  'contract_renewal',
  'integration_status',
  'vendor_notification',
  'access_request',
]

/**
 * Get next recommended scenario for variation
 * Avoids repeating recently used scenarios
 */
export function getNextScenarioSuggestion(memory: ScenarioMemory | null): string {
  const usedScenarios = memory?.scenariosUsed || []
  const available = AVAILABLE_SCENARIOS.filter(s => !usedScenarios.includes(s))
  
  if (available.length === 0) {
    return AVAILABLE_SCENARIOS[Math.floor(Math.random() * AVAILABLE_SCENARIOS.length)]
  }
  
  return available[0]
}

/**
 * Build compact scenario suggestion for prompt
 * Replaces full previousEmail embedding (~30 tokens vs ~2,500)
 */
export function buildScenarioSuggestion(memory: ScenarioMemory | null): string {
  if (!memory || memory.scenariosUsed.length === 0) {
    return ''
  }

  const lastScenario = memory.scenariosUsed[memory.scenariosUsed.length - 1]
  const nextSuggestion = getNextScenarioSuggestion(memory)
  
  return `Previously used scenario: ${lastScenario}. Generate variation using scenario: ${nextSuggestion}`
}

/**
 * Update memory with new scenario
 */
export function updateScenarioMemory(
  memory: ScenarioMemory | null,
  targetDomain: string,
  newScenario: string
): ScenarioMemory {
  const current = memory || {
    targetDomain,
    scenariosUsed: [],
    lastUpdated: new Date().toISOString(),
  }

  // Keep only last 5 scenarios to maintain variety
  const updated = [...current.scenariosUsed, newScenario].slice(-5)

  return {
    targetDomain,
    scenariosUsed: updated,
    lastUpdated: new Date().toISOString(),
  }
}
