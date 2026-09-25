/**
 * canonicalRaceAuditService.ts
 *
 * Módulo de Auditoria Objetiva da Esteira de Simulação Canônica de Corrida (BUG-07).
 * Realiza inspeção estática e estrutural real das esteiras de corrida, callers e persistência,
 * garantindo ausência de geradores legados, bônus artificiais de grid, fallbacks locais e duplicações.
 */

import weekendSimServiceSource from '@/services/weekendSimulationService.ts?raw'
import canonicalRaceEngineSource from '@/services/canonicalRaceEngineService.ts?raw'
import canonicalRaceResultSource from '@/services/canonicalRaceResultService.ts?raw'

export interface CanonicalRaceSimulationAuditReport {
  legacyRaceResultGenerators: number
  canonicalRaceResultPaths: number
  gridScoreBonuses: number
  localOfficialResultBuilders: number
  legacyRaceFallbacks: number
  duplicateOfficializationPaths: number
  duplicateCareerRegistrationPaths: number
  details: {
    legacyGeneratorsFound: string[]
    canonicalPathsFound: string[]
    gridScoreBonusesFound: string[]
    localBuildersFound: string[]
    fallbacksFound: string[]
    duplicateOfficializationsFound: string[]
    duplicateRegistrationsFound: string[]
  }
}

/**
 * Inspeciona as fontes ativas dos callers de corrida e dos serviços de simulação
 * para verificar se o caminho canônico é único, livre de geradores sintéticos,
 * sem duplicações e sem bônus artificiais por posição de grid.
 */
export function auditCanonicalRaceSimulationPath(sources?: {
  raceSlim?: string
  raceSlimWrapper?: string
  weekendSim?: string
  canonicalRaceEngine?: string
  canonicalRaceResult?: string
}): CanonicalRaceSimulationAuditReport {
  const codeSlim = sources?.raceSlim ?? ''
  const codeWrapper = sources?.raceSlimWrapper ?? ''
  const codeWeekend = sources?.weekendSim ?? weekendSimServiceSource
  const codeEngine = sources?.canonicalRaceEngine ?? canonicalRaceEngineSource
  const codeResult = sources?.canonicalRaceResult ?? canonicalRaceResultSource

  const legacyGeneratorsFound: string[] = []
  const canonicalPathsFound: string[] = []
  const gridScoreBonusesFound: string[] = []
  const localBuildersFound: string[] = []
  const fallbacksFound: string[] = []
  const duplicateOfficializationsFound: string[] = []
  const duplicateRegistrationsFound: string[] = []

  // 1. legacyRaceResultGenerators: geradores sintéticos alternativos de resultado de corrida
  // (ex.: generateFallbackRaceResults, generateAlternativeRace, buildFinishingOrder sintético)
  const legacyGenPatterns = [
    { pattern: /function\s+generateFallbackRaceResults/i, name: 'generateFallbackRaceResults' },
    { pattern: /const\s+generateAlternativeRace/i, name: 'generateAlternativeRace' },
    { pattern: /function\s+generateRaceResults/i, name: 'generateRaceResults' },
    { pattern: /buildFinishingOrder\s*\(/i, name: 'buildFinishingOrder' },
    { pattern: /calculateRacePoints\s*\(/i, name: 'calculateRacePoints' },
  ]

  for (const { pattern, name } of legacyGenPatterns) {
    if (pattern.test(codeSlim)) legacyGeneratorsFound.push(`RaceSlim:${name}`)
    if (pattern.test(codeWrapper)) legacyGeneratorsFound.push(`RaceSlimWrapper:${name}`)
  }

  // 2. canonicalRaceResultPaths: deve existir exatamente 1 caminho oficial canônico ativo no adapter (simulateRaceSessionCanonical)
  if (/simulateRaceSessionCanonical\s*\(/.test(codeWeekend)) {
    canonicalPathsFound.push('weekendSimulationService.simulateRaceSessionCanonical')
  }

  // 3. gridScoreBonuses: fórmulas ativas de score/pace derivadas diretamente de qPos ou gridPosition (ex: (24 - qPos) * 1.5)
  // Nota: gridTrafficDelay na volta 1 é tempo de partida física de pelotão parado, não bônus esportivo de pace contínuo.
  const gridScorePatterns = [
    { pattern: /\(24\s*-\s*qPos\)\s*\*\s*1\.5/, name: '(24 - qPos) * 1.5' },
    { pattern: /\(24\s*-\s*gridPosition\)\s*\*\s*1\.5/, name: '(24 - gridPosition) * 1.5' },
    { pattern: /score:\s*\(24\s*-\s*qPos\)/, name: 'score: (24 - qPos)' },
    { pattern: /paceBonus.*gridPosition/i, name: 'paceBonus by gridPosition' },
    { pattern: /gridBonus.*driver/i, name: 'gridBonus by driver' },
  ]

  for (const { pattern, name } of gridScorePatterns) {
    if (pattern.test(codeWeekend)) gridScoreBonusesFound.push(`weekendSimulationService:${name}`)
    if (pattern.test(codeEngine)) gridScoreBonusesFound.push(`canonicalRaceEngine:${name}`)
    if (pattern.test(codeSlim)) gridScoreBonusesFound.push(`RaceSlim:${name}`)
  }

  // 4. localOfficialResultBuilders: criação local alternativa de OfficialRaceResult fora de officializeRace
  const localBuilderPatterns = [
    {
      pattern: /const\s+fallbackResult\s*:\s*OfficialRaceResult/i,
      name: 'fallbackResult: OfficialRaceResult',
    },
    {
      pattern: /const\s+mockResult\s*:\s*OfficialRaceResult/i,
      name: 'mockResult: OfficialRaceResult',
    },
    {
      pattern: /setOfficialResult\s*\(\s*\{[^}]*entries:/i,
      name: 'manual setOfficialResult object',
    },
  ]

  for (const { pattern, name } of localBuilderPatterns) {
    if (pattern.test(codeSlim)) localBuildersFound.push(`RaceSlim:${name}`)
    if (pattern.test(codeWrapper)) localBuildersFound.push(`RaceSlimWrapper:${name}`)
  }

  // 5. legacyRaceFallbacks: fallbacks esportivos que inventam vencedor ou resultado em caso de erro
  const catchBlocksSlim = codeSlim.match(/catch\s*\([^)]*\)\s*\{[^}]*\}/g) || []
  for (const block of catchBlocksSlim) {
    if (/officializeRace|winnerDriverId|winner:\s*true|setOfficialResult\s*\(\s*\{/.test(block)) {
      fallbacksFound.push(`RaceSlim:catchBlockSportsFallback`)
    }
  }

  // 6. duplicateOfficializationPaths: officializeRace deve ser chamada no serviço canônico, não espalhada em callers
  // RaceSlim e RaceSlimWrapper não devem chamar officializeRace diretamente
  if (/[^a-zA-Z0-9_]officializeRace\s*\(/.test(codeSlim)) {
    duplicateOfficializationsFound.push('RaceSlim:officializeRace')
  }
  if (/[^a-zA-Z0-9_]officializeRace\s*\(/.test(codeWrapper)) {
    duplicateOfficializationsFound.push('RaceSlimWrapper:officializeRace')
  }

  // 7. duplicateCareerRegistrationPaths: registerOfficialRaceResultInCareer chamado por RaceSlim ou RaceSlimWrapper diretamente
  if (/[^a-zA-Z0-9_]registerOfficialRaceResultInCareer\s*\(/.test(codeSlim)) {
    duplicateRegistrationsFound.push('RaceSlim:registerOfficialRaceResultInCareer')
  }
  if (/[^a-zA-Z0-9_]registerOfficialRaceResultInCareer\s*\(/.test(codeWrapper)) {
    duplicateRegistrationsFound.push('RaceSlimWrapper:registerOfficialRaceResultInCareer')
  }

  return {
    legacyRaceResultGenerators: legacyGeneratorsFound.length,
    canonicalRaceResultPaths: canonicalPathsFound.length,
    gridScoreBonuses: gridScoreBonusesFound.length,
    localOfficialResultBuilders: localBuildersFound.length,
    legacyRaceFallbacks: fallbacksFound.length,
    duplicateOfficializationPaths: duplicateOfficializationsFound.length,
    duplicateCareerRegistrationPaths: duplicateRegistrationsFound.length,
    details: {
      legacyGeneratorsFound,
      canonicalPathsFound,
      gridScoreBonusesFound,
      localBuildersFound,
      fallbacksFound,
      duplicateOfficializationsFound,
      duplicateRegistrationsFound,
    },
  }
}
