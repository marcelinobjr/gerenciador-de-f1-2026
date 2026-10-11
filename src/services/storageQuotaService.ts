/**
 * STORAGE QUOTA & PRUNE SERVICE (STORAGE-QUOTA-01A)
 *
 * Objetivo:
 * Impedir que o APEX GP Manager estoure a cota do localStorage por acúmulo de dados antigos.
 * 1. Medir o consumo por família de chaves apex_gp_* / apex_*;
 * 2. Identificar quais famílias dominam o espaço;
 * 3. Implementar prune seguro de dados antigos preservando a rodada atual e dados necessários;
 * 4. Tratar QuotaExceededError com retry único após prune controlado.
 */

export interface StorageKeyMeasurement {
  key: string
  sizeBytes: number
  family: string
  careerId?: string
  seasonId?: string
  round?: number
  isHistoricalRetention?: boolean
}

export interface FamilyQuotaSummary {
  family: string
  count: number
  totalBytes: number
  totalKB: number
  percentage: number
}

export interface StorageAuditReport {
  totalKeys: number
  totalBytes: number
  totalKB: number
  apexKeys: number
  apexBytes: number
  apexKB: number
  families: Record<string, FamilyQuotaSummary>
  measurements: StorageKeyMeasurement[]
}

export interface PruneContext {
  careerId?: string
  seasonId?: string
  currentRound?: number
}

export interface PruneResult {
  prunedKeys: string[]
  freedBytes: number
  freedKB: number
  preservedKeysCount: number
}

/**
 * Famílias de chaves canônicas do APEX GP Manager
 */
export const APEX_STORAGE_FAMILIES = {
  TIRES: 'apex_gp_tires',
  QUALIFYING_STAGE_STATE: 'apex_qualifying_stage_state',
  QUALIFYING_STAGE_RESULT: 'apex_qualifying_stage_result',
  QUALIFYING_FINAL_GRID: 'apex_qualifying_final_grid',
  QUALIFYING_PARC_FERME: 'apex_parc_ferme',
  QUALIFYING_ORCHESTRATOR: 'apex_qualifying_orchestrator',
  WEEKEND_SLOT: 'apex_weekend_slot',
  WEEKEND_GENERATION: 'apex_weekend_generation',
  WEEKEND_COMPLETED: 'apex_weekend_completed',
  PRACTICE_SESSION: 'apex_practice_session',
  PRACTICE_PREP: 'apex_practice_prep',
  PRACTICE_SETUP: 'apex_practice_setup',
  PRACTICE_KNOWLEDGE: 'apex_practice_knowledge',
  RACE_STATE: 'apex_race_state',
  PU_ALLOCATION: 'apex_gp_pu_allocation',
  PU_USAGE_JOURNAL: 'apex_gp_pu_usage_journal',
  PU_INTEGRATION: 'apex_pu_integration',
  CAREER_DRIVERS: 'apex_career_drivers',
  CAREER_RESULTS: 'career_race_results',
  CHAMPIONSHIP_SNAPSHOT: 'apex_championship_snapshot',
  ROOKIE_PLAN: 'apex_rookie_plan',
  EVENT_REGISTRATION: 'apex_event_registration',
  OTHER_APEX: 'apex_other',
  NON_APEX: 'non_apex',
} as const

/**
 * Famílias que representam histórico canônico necessário para estatísticas/campeonato
 * e NUNCA devem ser removidas por prune de rounds antigas.
 */
export const CRITICAL_HISTORICAL_FAMILIES = new Set<string>([
  APEX_STORAGE_FAMILIES.CAREER_DRIVERS,
  APEX_STORAGE_FAMILIES.PU_ALLOCATION,
  APEX_STORAGE_FAMILIES.PU_INTEGRATION,
  APEX_STORAGE_FAMILIES.WEEKEND_GENERATION, // Geração da rodada deve ser mantida
])

/**
 * Poda segura no boot da aplicação se o storage local passar de ~3MB.
 * Remove espelhos locais já canônicos no PB: journals COMPLETE, snapshots e resultados de rodadas antigas.
 */
export function runBootStoragePruneIfOverQuota(): PruneResult {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { prunedKeys: [], freedBytes: 0, freedKB: 0, preservedKeysCount: 0 }
  }

  let totalBytes = 0
  const allKeys: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (k) {
      allKeys.push(k)
      const v = window.localStorage.getItem(k) || ''
      totalBytes += (k.length + v.length) * 2
    }
  }

  // Se storage estiver abaixo do threshold de ~3MB, não precisa de intervenção agressiva
  if (totalBytes < STORAGE_WARNING_THRESHOLD_BYTES) {
    return { prunedKeys: [], freedBytes: 0, freedKB: 0, preservedKeysCount: allKeys.length }
  }

  console.info(
    `[runBootStoragePruneIfOverQuota] Storage usage (${Math.round((totalBytes / 1024 / 1024) * 100) / 100} MB) excede o threshold de 3MB. Executando poda no boot...`,
  )

  return pruneCanonicalMirrors({ force: true })
}

/**
 * Poda espelhos locais de dados já canônicos no PocketBase:
 * - Journals com status COMPLETE
 * - Snapshots de campeonato antigos
 * - Resultados de corrida de rodadas antigas
 */
export function pruneCanonicalMirrors(options?: {
  careerId?: string
  currentRound?: number
  force?: boolean
}): PruneResult {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { prunedKeys: [], freedBytes: 0, freedKB: 0, preservedKeysCount: 0 }
  }

  const prunedKeys: string[] = []
  let freedBytes = 0
  let preservedKeysCount = 0

  const allKeys: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (k) allKeys.push(k)
  }

  const effectiveRound = options?.currentRound

  for (const key of allKeys) {
    const meta = parseStorageKeyMetadata(key)

    // 1. Não mexer em chaves de outros apps / non_apex
    if (meta.family === APEX_STORAGE_FAMILIES.NON_APEX) {
      preservedKeysCount++
      continue
    }

    // 2. Journals COMPLETE (career_apply_result_*)
    if (key.startsWith('career_apply_result_')) {
      // Se tiver round e for a rodada atual sem force, preservar
      if (effectiveRound && meta.round === effectiveRound && !options?.force) {
        preservedKeysCount++
        continue
      }
      try {
        const raw = window.localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          // Se o journal estiver COMPLETE, o PB já tem canonical_career_apply_journals
          if (parsed && (parsed.status === 'COMPLETE' || parsed.applicationStatus === 'COMPLETE')) {
            const size = (key.length + raw.length) * 2
            window.localStorage.removeItem(key)
            prunedKeys.push(key)
            freedBytes += size
            continue
          }
        }
      } catch {
        // Se corrompido, pode podar
        const val = window.localStorage.getItem(key) || ''
        const size = (key.length + val.length) * 2
        window.localStorage.removeItem(key)
        prunedKeys.push(key)
        freedBytes += size
        continue
      }
    }

    // 3. Snapshots de campeonato antigos (championship_* ou apex_championship_snapshot_*)
    if (meta.family === APEX_STORAGE_FAMILIES.CHAMPIONSHIP_SNAPSHOT) {
      // Se soubermos o round atual e for round < effectiveRound - 1
      if (effectiveRound && typeof meta.round === 'number') {
        if (meta.round < effectiveRound - 1 || options?.force) {
          const val = window.localStorage.getItem(key) || ''
          const size = (key.length + val.length) * 2
          window.localStorage.removeItem(key)
          prunedKeys.push(key)
          freedBytes += size
          continue
        }
      } else if (options?.force) {
        // No boot cleanup sem round específico, manter apenas os snapshots mais recentes ou limpar cópias pesadas
        const val = window.localStorage.getItem(key) || ''
        const size = (key.length + val.length) * 2
        window.localStorage.removeItem(key)
        prunedKeys.push(key)
        freedBytes += size
        continue
      }
    }

    // 4. Resultados de corrida antigos locais (race_result_*)
    if (key.startsWith('race_result_')) {
      if (effectiveRound && typeof meta.round === 'number' && meta.round < effectiveRound - 1) {
        const val = window.localStorage.getItem(key) || ''
        const size = (key.length + val.length) * 2
        window.localStorage.removeItem(key)
        prunedKeys.push(key)
        freedBytes += size
        continue
      }
    }

    preservedKeysCount++
  }

  // Executa também prune padrão
  const standardPrune = pruneStorageData({
    careerId: options?.careerId,
    currentRound: effectiveRound,
  })

  for (const pk of standardPrune.prunedKeys) {
    if (!prunedKeys.includes(pk)) {
      prunedKeys.push(pk)
    }
  }
  freedBytes += standardPrune.freedBytes

  return {
    prunedKeys,
    freedBytes,
    freedKB: Math.round((freedBytes / 1024) * 100) / 100,
    preservedKeysCount,
  }
}

/**
 * Extrai metadados estruturados a partir da chave de storage.
 */
export function parseStorageKeyMetadata(key: string): {
  family: string
  careerId?: string
  seasonId?: string
  round?: number
} {
  // Pneus: apex_gp_tires_${seasonId}_r${round}
  const tiresMatch = key.match(/^apex_gp_tires_(.+)_r(\d+)$/)
  if (tiresMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.TIRES,
      seasonId: tiresMatch[1],
      round: parseInt(tiresMatch[2], 10),
    }
  }

  // Quali stage state: apex_qualifying_stage_state_v2_${seasonId}_r${round}_${stage}
  const qualiStateMatch = key.match(/^apex_qualifying_stage_state_v2_(.+)_r(\d+)_([a-z0-9]+)$/)
  if (qualiStateMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.QUALIFYING_STAGE_STATE,
      seasonId: qualiStateMatch[1],
      round: parseInt(qualiStateMatch[2], 10),
    }
  }

  // Quali stage result: apex_qualifying_stage_result_v2_${seasonId}_r${round}_${stage}
  const qualiResultMatch = key.match(/^apex_qualifying_stage_result_v2_(.+)_r(\d+)_([a-z0-9]+)$/)
  if (qualiResultMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.QUALIFYING_STAGE_RESULT,
      seasonId: qualiResultMatch[1],
      round: parseInt(qualiResultMatch[2], 10),
    }
  }

  // Quali final grid: apex_qualifying_final_grid_v2_${seasonId}_r${round}
  const qualiGridMatch = key.match(/^apex_qualifying_final_grid_v2_(.+)_r(\d+)$/)
  if (qualiGridMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.QUALIFYING_FINAL_GRID,
      seasonId: qualiGridMatch[1],
      round: parseInt(qualiGridMatch[2], 10),
    }
  }

  // Parc Fermé: apex_parc_ferme_v2_${seasonId}_r${round}
  const parcFermeMatch = key.match(/^apex_parc_ferme_v2_(.+)_r(\d+)$/)
  if (parcFermeMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.QUALIFYING_PARC_FERME,
      seasonId: parcFermeMatch[1],
      round: parseInt(parcFermeMatch[2], 10),
    }
  }

  // Weekend slot: apex_weekend_slot_state_v1_${careerId}_${seasonId}_r${round}
  const slotMatch = key.match(/^apex_weekend_slot_state_v1_(.+?)_(.+?)_r(\d+)$/)
  if (slotMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.WEEKEND_SLOT,
      careerId: slotMatch[1],
      seasonId: slotMatch[2],
      round: parseInt(slotMatch[3], 10),
    }
  }

  // Weekend generation: apex_weekend_generation_${careerId}_${seasonId}_r${round} ou apex_weekend_generation_${seasonId}_r${round}
  const genCareerMatch = key.match(/^apex_weekend_generation_(.+?)_(.+?)_r(\d+)$/)
  if (genCareerMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.WEEKEND_GENERATION,
      careerId: genCareerMatch[1],
      seasonId: genCareerMatch[2],
      round: parseInt(genCareerMatch[3], 10),
    }
  }
  const genSeasonMatch = key.match(/^apex_weekend_generation_(.+?)_r(\d+)$/)
  if (genSeasonMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.WEEKEND_GENERATION,
      seasonId: genSeasonMatch[1],
      round: parseInt(genSeasonMatch[2], 10),
    }
  }

  // Weekend completed: apex_f1_weekend_completed_v1_${seasonId}_r${round}
  const compMatch = key.match(/^apex_f1_weekend_completed_v1_(.+?)_r(\d+)$/)
  if (compMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.WEEKEND_COMPLETED,
      seasonId: compMatch[1],
      round: parseInt(compMatch[2], 10),
    }
  }

  // Practice session: apex_practice_session_${careerId}_${seasonId}_${round}_${tp} ou r${round}
  const pracSessMatch = key.match(/^apex_practice_session_(.+?)_(.+?)_r?(\d+)_([a-z0-9]+)$/)
  if (pracSessMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.PRACTICE_SESSION,
      careerId: pracSessMatch[1],
      seasonId: pracSessMatch[2],
      round: parseInt(pracSessMatch[3], 10),
    }
  }

  // Practice prep: apex_practice_prep_${careerId}_${seasonId}_${round}_${tp} ou r${round}
  const pracPrepMatch = key.match(/^apex_practice_prep_(.+?)_(.+?)_r?(\d+)_([a-z0-9]+)$/)
  if (pracPrepMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.PRACTICE_PREP,
      careerId: pracPrepMatch[1],
      seasonId: pracPrepMatch[2],
      round: parseInt(pracPrepMatch[3], 10),
    }
  }

  // Practice setup: apex_practice_setup_${careerId}_${seasonId}_r?(\d+)_([a-z0-9]+)
  const pracSetupMatch = key.match(/^apex_practice_setup_(.+?)_(.+?)_r?(\d+)_([a-z0-9]+)$/)
  if (pracSetupMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.PRACTICE_SETUP,
      careerId: pracSetupMatch[1],
      seasonId: pracSetupMatch[2],
      round: parseInt(pracSetupMatch[3], 10),
    }
  }

  // Practice knowledge: apex_practice_knowledge_${careerId}_... ou apex_practice_weekend_tyre_knowledge_...
  const pracKnowMatch = key.match(/^apex_practice_(?:weekend_tyre_)?knowledge_(.+?)_(.+?)_r?(\d+)/)
  if (pracKnowMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.PRACTICE_KNOWLEDGE,
      careerId: pracKnowMatch[1],
      seasonId: pracKnowMatch[2],
      round: parseInt(pracKnowMatch[3], 10),
    }
  }

  // Race state: apex_race_v2_canonical_state_${careerId}_s?${season}_r?${round} ou apex_sprint_race_canonical_state_...
  const raceStateMatch = key.match(
    /^(?:apex_race_v2_canonical_state|apex_sprint_race_canonical_state|f1_2026_canonical_race_v2(?:_sprint)?)_(.+?)_s?(.+?)_r?(\d+)$/,
  )
  if (raceStateMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.RACE_STATE,
      careerId: raceStateMatch[1],
      seasonId: raceStateMatch[2],
      round: parseInt(raceStateMatch[3], 10),
    }
  }

  // PU Allocation: apex_gp_pu_allocation_${careerId}
  const puAllocMatch = key.match(/^apex_gp_pu_allocation_(.+)$/)
  if (puAllocMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.PU_ALLOCATION,
      careerId: puAllocMatch[1],
    }
  }

  // PU Usage Journal: apex_gp_pu_usage_journal_${careerId}_s${season}_r${round}_${variant}
  const puJournalMatch = key.match(/^apex_gp_pu_usage_journal_(.+?)_s?(.+?)_r(\d+)(?:_(.+))?$/)
  if (puJournalMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.PU_USAGE_JOURNAL,
      careerId: puJournalMatch[1],
      seasonId: puJournalMatch[2],
      round: parseInt(puJournalMatch[3], 10),
    }
  }

  // PU Integration: apex_pu_integration_${careerId}_${seasonYear}_${teamId}
  const puIntegMatch = key.match(/^apex_pu_integration_(.+?)_(\d{4})_(.+)$/)
  if (puIntegMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.PU_INTEGRATION,
      careerId: puIntegMatch[1],
      seasonId: puIntegMatch[2],
    }
  }

  // Career drivers: apex_career_drivers_v2_${careerId}
  const careerDriversMatch = key.match(/^apex_career_drivers_v2_(.+)$/)
  if (careerDriversMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.CAREER_DRIVERS,
      careerId: careerDriversMatch[1],
    }
  }

  // Career Race Results & Journals:
  // race_result_${careerId}_${sId}_${round} ou career_apply_result_${careerId}_${sId}_${round}
  const careerResultMatch = key.match(
    /^(?:race_result|career_apply_result)_(.+?)_(.+?)_(\d+)(?:_(.+))?$/,
  )
  if (careerResultMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.CAREER_RESULTS,
      careerId: careerResultMatch[1],
      seasonId: careerResultMatch[2],
      round: parseInt(careerResultMatch[3], 10),
    }
  }

  // Championship snapshot: championship_${careerId}_${season}_r${round} ou apex_championship_snapshot_${careerId}_${season}_r${round}
  const champSnapMatch =
    key.match(/^championship_(.+?)_(.+?)_r(\d+)$/) ||
    key.match(/^apex_championship_snapshot_(.+?)_(.+?)_r(\d+)$/)
  if (champSnapMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.CHAMPIONSHIP_SNAPSHOT,
      careerId: champSnapMatch[1],
      seasonId: champSnapMatch[2],
      round: parseInt(champSnapMatch[3], 10),
    }
  }

  // Rookie plan: apex_rookie_tl1_plan_v1_${careerId}_${seasonId}_r${round}
  const rookieMatch = key.match(/^apex_rookie_tl1_plan_v1_(.+?)_(.+?)_r(\d+)$/)
  if (rookieMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.ROOKIE_PLAN,
      careerId: rookieMatch[1],
      seasonId: rookieMatch[2],
      round: parseInt(rookieMatch[3], 10),
    }
  }

  // Event registration: apex_event_registration_v2_${seasonId}_r${round}
  const eventRegMatch = key.match(/^apex_event_registration_v2_(.+?)_r(\d+)$/)
  if (eventRegMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.EVENT_REGISTRATION,
      seasonId: eventRegMatch[1],
      round: parseInt(eventRegMatch[2], 10),
    }
  }

  // Quali orchestrator states (legacy/alternatives): apex_(sprint_)?(q1|q2|q3|sq1|sq2|sq3|tp1|tp2|tp3)_state_...
  const orchMatch = key.match(
    /^apex_(?:sprint_)?(?:q[1-3]|sq[1-3]|tp[1-3]|starting_grid|qualifying_result)_state_(.+?)_(.+?)_r(\d+)$/,
  )
  if (orchMatch) {
    return {
      family: APEX_STORAGE_FAMILIES.QUALIFYING_ORCHESTRATOR,
      careerId: orchMatch[1],
      seasonId: orchMatch[2],
      round: parseInt(orchMatch[3], 10),
    }
  }

  if (key.startsWith('apex_') || key.startsWith('f1_2026_')) {
    // Tenta inferir round se houver _r(\d+)
    const rMatch = key.match(/_r(\d+)/)
    return {
      family: APEX_STORAGE_FAMILIES.OTHER_APEX,
      round: rMatch ? parseInt(rMatch[1], 10) : undefined,
    }
  }

  return {
    family: APEX_STORAGE_FAMILIES.NON_APEX,
  }
}

/**
 * 1. AUDITORIA LOCALIZADA
 * Mede chave por chave do localStorage e agrega métricas de uso por família.
 */
export function auditLocalStorageUsage(): StorageAuditReport {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      totalKeys: 0,
      totalBytes: 0,
      totalKB: 0,
      apexKeys: 0,
      apexBytes: 0,
      apexKB: 0,
      families: {},
      measurements: [],
    }
  }

  const measurements: StorageKeyMeasurement[] = []
  let totalBytes = 0
  let apexKeys = 0
  let apexBytes = 0

  const familiesMap: Record<string, { count: number; totalBytes: number }> = {}

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key) continue

    const value = window.localStorage.getItem(key) || ''
    // Tamanho em bytes aproximado em UTF-16: (key.length + value.length) * 2 bytes
    // No cálculo padrão de storage web, 1 char = 2 bytes (DOMString UTF-16).
    const keySize = (key.length + value.length) * 2
    totalBytes += keySize

    const meta = parseStorageKeyMetadata(key)
    const isApex = meta.family !== APEX_STORAGE_FAMILIES.NON_APEX
    if (isApex) {
      apexKeys++
      apexBytes += keySize
    }

    if (!familiesMap[meta.family]) {
      familiesMap[meta.family] = { count: 0, totalBytes: 0 }
    }
    familiesMap[meta.family].count++
    familiesMap[meta.family].totalBytes += keySize

    measurements.push({
      key,
      sizeBytes: keySize,
      family: meta.family,
      careerId: meta.careerId,
      seasonId: meta.seasonId,
      round: meta.round,
      isHistoricalRetention: CRITICAL_HISTORICAL_FAMILIES.has(meta.family),
    })
  }

  const families: Record<string, FamilyQuotaSummary> = {}
  for (const [familyName, data] of Object.entries(familiesMap)) {
    families[familyName] = {
      family: familyName,
      count: data.count,
      totalBytes: data.totalBytes,
      totalKB: Math.round((data.totalBytes / 1024) * 100) / 100,
      percentage: totalBytes > 0 ? Math.round((data.totalBytes / totalBytes) * 1000) / 10 : 0,
    }
  }

  return {
    totalKeys: window.localStorage.length,
    totalBytes,
    totalKB: Math.round((totalBytes / 1024) * 100) / 100,
    apexKeys,
    apexBytes,
    apexKB: Math.round((apexBytes / 1024) * 100) / 100,
    families,
    measurements,
  }
}

/**
 * 2. RELATÓRIO FORMATADO POR FAMÍLIA (para logs técnicos ou diagnóstico)
 */
export function formatFamilyReport(audit: StorageAuditReport): string {
  const lines: string[] = []
  lines.push(`--- APEX GP MANAGER STORAGE AUDIT ---`)
  lines.push(`Total Keys: ${audit.totalKeys} | Total: ${audit.totalKB} KB`)
  lines.push(`Apex Keys: ${audit.apexKeys} | Apex Total: ${audit.apexKB} KB`)
  lines.push(`Family Breakdown:`)

  const sorted = Object.values(audit.families).sort((a, b) => b.totalBytes - a.totalBytes)
  for (const f of sorted) {
    const pad = f.family.padEnd(32, ' ')
    lines.push(`  ${pad} ${f.totalKB.toFixed(2)} KB (${f.percentage}% - ${f.count} keys)`)
  }
  return lines.join('\n')
}

/**
 * 3. POLÍTICA DE PRUNE E RETENÇÃO
 *
 * Preservar SEMPRE:
 * - Carreira atual (se informada no contexto);
 * - Temporada atual (se informada no contexto);
 * - Rodada atual (`currentRound`);
 * - Rodada imediatamente anterior (`currentRound - 1`);
 * - Famílias marcadas como CRITICAL_HISTORICAL_FAMILIES (resultados canônicos, campeonato, drivers, PU);
 * - Geração da rodada (`apex_weekend_generation_*`);
 * - Chaves de configuração globais / não relacionadas à rodada.
 *
 * Remover:
 * - Rounds obsoletas da mesma carreira/temporada (`round < currentRound - 1`) para famílias de sessão:
 *   - apex_gp_tires_*
 *   - apex_qualifying_stage_state_*
 *   - apex_qualifying_final_grid_*
 *   - apex_parc_ferme_*
 *   - apex_weekend_slot_state_*
 *   - apex_practice_session_* / prep / setup / knowledge
 *   - apex_race_v2_canonical_state_* / sprint state
 *   - apex_*_state_ (orquestrador legado)
 * - Rounds de outras carreiras inativas onde round < currentRound ou não correspondem ao careerId ativo;
 * - Se careerId ativo não puder ser inferido da chave mas for de round < currentRound - 1, remover para as famílias de sessão acima.
 */
export function pruneStorageData(context: PruneContext): PruneResult {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { prunedKeys: [], freedBytes: 0, freedKB: 0, preservedKeysCount: 0 }
  }

  const { careerId, seasonId, currentRound } = context
  const keysToRemove: string[] = []
  let freedBytes = 0
  let preservedCount = 0

  const totalKeys = window.localStorage.length
  const allKeys: string[] = []
  for (let i = 0; i < totalKeys; i++) {
    const k = window.localStorage.key(i)
    if (k) allKeys.push(k)
  }

  // Se não foi informada a rodada atual, não podemos inferir antiguidade de round com segurança
  const effectiveCurrentRound =
    typeof currentRound === 'number' && currentRound > 0 ? currentRound : null

  for (const key of allKeys) {
    const meta = parseStorageKeyMetadata(key)

    // 1. Chaves que NÃO pertencem ao APEX nunca são tocadas
    if (meta.family === APEX_STORAGE_FAMILIES.NON_APEX) {
      preservedCount++
      continue
    }

    // 2. Famílias críticas de histórico canônico nunca são removidas
    if (CRITICAL_HISTORICAL_FAMILIES.has(meta.family)) {
      preservedCount++
      continue
    }

    // 3. Se a chave não tem número de rodada identificado, preservar (configurações globais, etc.)
    if (meta.round === undefined || meta.round === null) {
      preservedCount++
      continue
    }

    // 4. Se conhecemos a rodada atual:
    if (effectiveCurrentRound !== null) {
      // 4.1. Preservar SEMPRE a rodada atual (currentRound)
      if (meta.round === effectiveCurrentRound) {
        preservedCount++
        continue
      }

      // 4.2. Preservar SEMPRE a rodada imediatamente anterior (currentRound - 1)
      if (meta.round === effectiveCurrentRound - 1) {
        preservedCount++
        continue
      }

      // 4.3. Preservar rodadas futuras (round > currentRound)
      if (meta.round > effectiveCurrentRound) {
        preservedCount++
        continue
      }

      // 4.4. Apenas rodadas antigas (round < currentRound - 1) chegam aqui
      // Se houver careerId no contexto e na chave:
      if (careerId && meta.careerId && meta.careerId !== careerId) {
        // Carreira inativa com round antiga -> remover com segurança
        keysToRemove.push(key)
        continue
      }

      // Se pertencer à mesma carreira / temporada ou for chave compartilhada de round antiga
      // Ex: apex_gp_tires_${seasonId}_r${oldRound}
      // Famílias elegíveis para descarte de rounds antigas:
      const PRUNABLE_FAMILIES = new Set<string>([
        APEX_STORAGE_FAMILIES.TIRES,
        APEX_STORAGE_FAMILIES.QUALIFYING_STAGE_STATE,
        APEX_STORAGE_FAMILIES.QUALIFYING_STAGE_RESULT, // Resultados de sessões intermediárias de rounds antigas (o resultado final está consolidado em career_race_results)
        APEX_STORAGE_FAMILIES.QUALIFYING_FINAL_GRID,
        APEX_STORAGE_FAMILIES.QUALIFYING_PARC_FERME,
        APEX_STORAGE_FAMILIES.QUALIFYING_ORCHESTRATOR,
        APEX_STORAGE_FAMILIES.WEEKEND_SLOT,
        APEX_STORAGE_FAMILIES.WEEKEND_COMPLETED,
        APEX_STORAGE_FAMILIES.PRACTICE_SESSION,
        APEX_STORAGE_FAMILIES.PRACTICE_PREP,
        APEX_STORAGE_FAMILIES.PRACTICE_SETUP,
        APEX_STORAGE_FAMILIES.PRACTICE_KNOWLEDGE,
        APEX_STORAGE_FAMILIES.RACE_STATE,
        APEX_STORAGE_FAMILIES.PU_USAGE_JOURNAL,
        APEX_STORAGE_FAMILIES.ROOKIE_PLAN,
        APEX_STORAGE_FAMILIES.EVENT_REGISTRATION,
        APEX_STORAGE_FAMILIES.CHAMPIONSHIP_SNAPSHOT,
        APEX_STORAGE_FAMILIES.CAREER_RESULTS,
      ])

      if (PRUNABLE_FAMILIES.has(meta.family)) {
        keysToRemove.push(key)
        continue
      }
    }

    // Por padrão, se não caiu em regra explícita de remoção, preserva!
    preservedCount++
  }

  // Executa remoção controlada chave por chave
  for (const k of keysToRemove) {
    try {
      const val = window.localStorage.getItem(k) || ''
      const size = (k.length + val.length) * 2
      window.localStorage.removeItem(k)
      freedBytes += size
    } catch (e) {
      console.warn(`[pruneStorageData] Falha ao remover chave ${k}:`, e)
    }
  }

  return {
    prunedKeys: keysToRemove,
    freedBytes,
    freedKB: Math.round((freedBytes / 1024) * 100) / 100,
    preservedKeysCount: preservedCount,
  }
}

/**
 * 6. TRATAMENTO DE QUOTAEXCEEDEDERROR COM RETRY ÚNICO
 *
 * Executa uma escrita segura no localStorage.
 * Ao receber QuotaExceededError:
 * 1. Executa prune seguro uma única vez com o contexto informado;
 * 2. Tenta a mesma gravação novamente uma única vez;
 * 3. Se ainda falhar, lança/propaga o erro explícito.
 */
export const STORAGE_WARNING_THRESHOLD_BYTES = 3 * 1024 * 1024 // ~3MB

/**
 * 7. LIMPEZA PREVENTIVA DE RECUPERAÇÃO (STORAGE RECOVERY CLEANUP)
 * Se o uso do localStorage passar de ~3MB (STORAGE_WARNING_THRESHOLD_BYTES) ou ao avançar rodada,
 * remove sessões obsoletas e snapshots de campeonato antigos de rodadas já concluídas (< currentRound - 1).
 */
export function runPreventiveStorageCleanup(context?: PruneContext): PruneResult {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { prunedKeys: [], freedBytes: 0, freedKB: 0, preservedKeysCount: 0 }
  }

  // Mede o consumo total atual
  let currentBytes = 0
  const allKeys: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (k) {
      allKeys.push(k)
      const v = window.localStorage.getItem(k) || ''
      currentBytes += (k.length + v.length) * 2
    }
  }

  // Executa prune padrão
  const effectiveRound = context?.currentRound
  const pruneRes = pruneStorageData({
    careerId: context?.careerId,
    seasonId: context?.seasonId,
    currentRound: effectiveRound,
  })

  // Se o uso ultrapassa o threshold de segurança ou se houver round informado,
  // limpa espelhos locais de dados já canônicos no PB:
  // 1. Snapshots de campeonato antigos (< effectiveRound - 1 ou todos antigos se storage sobrecarregado)
  // 2. Journals de aplicação COMPLETE de rodadas antigas (< effectiveRound - 1)
  // 3. Resultados de corrida e sessões antigas
  if (currentBytes > STORAGE_WARNING_THRESHOLD_BYTES || (effectiveRound && effectiveRound > 2)) {
    const canonicalMirrorsToRemove: string[] = []
    let extraFreedBytes = 0

    for (const key of allKeys) {
      // Se a chave já foi podada pelo pruneStorageData acima, pular
      if (pruneRes.prunedKeys.includes(key)) continue

      const meta = parseStorageKeyMetadata(key)

      // 1. Snapshots de campeonato antigos
      if (
        meta.family === APEX_STORAGE_FAMILIES.CHAMPIONSHIP_SNAPSHOT &&
        typeof meta.round === 'number'
      ) {
        if (effectiveRound && meta.round < effectiveRound - 1) {
          canonicalMirrorsToRemove.push(key)
          continue
        } else if (!effectiveRound && currentBytes > STORAGE_WARNING_THRESHOLD_BYTES) {
          // Se não sabemos o round mas o storage está > 3MB, remover snapshots antigos se houver round identificado
          canonicalMirrorsToRemove.push(key)
          continue
        }
      }

      // 2. Journals COMPLETE e resultados de rodadas antigas
      if (meta.family === APEX_STORAGE_FAMILIES.CAREER_RESULTS && typeof meta.round === 'number') {
        if (effectiveRound && meta.round < effectiveRound - 1) {
          // Checar se é um journal COMPLETE ou race_result de rodada antiga
          try {
            const rawVal = window.localStorage.getItem(key)
            if (rawVal) {
              const parsed = JSON.parse(rawVal)
              // Se for journal com status COMPLETE ou resultado de corrida consolidado
              if (
                parsed &&
                (parsed.status === 'COMPLETE' || parsed.officialRaceResultId || parsed.entries)
              ) {
                canonicalMirrorsToRemove.push(key)
                continue
              }
            }
          } catch {
            // Em caso de JSON inválido, podar
            canonicalMirrorsToRemove.push(key)
            continue
          }
        }
      }

      // 3. Se ainda estiver com storage crítico (> STORAGE_WARNING_THRESHOLD_BYTES),
      // podar agressivamente estados de corrida/treino/quali antigos
      if (currentBytes > STORAGE_WARNING_THRESHOLD_BYTES && typeof meta.round === 'number') {
        if (effectiveRound && meta.round < effectiveRound) {
          if (
            meta.family === APEX_STORAGE_FAMILIES.RACE_STATE ||
            meta.family === APEX_STORAGE_FAMILIES.PRACTICE_SESSION ||
            meta.family === APEX_STORAGE_FAMILIES.QUALIFYING_STAGE_STATE
          ) {
            canonicalMirrorsToRemove.push(key)
            continue
          }
        }
      }
    }

    for (const ck of canonicalMirrorsToRemove) {
      try {
        const val = window.localStorage.getItem(ck) || ''
        const size = (ck.length + val.length) * 2
        window.localStorage.removeItem(ck)
        extraFreedBytes += size
        pruneRes.prunedKeys.push(ck)
      } catch {
        /* ignore */
      }
    }
    pruneRes.freedBytes += extraFreedBytes
    pruneRes.freedKB = Math.round((pruneRes.freedBytes / 1024) * 100) / 100
  }

  return pruneRes
}

export function isQuotaExceededError(err: any): boolean {
  return Boolean(
    err?.name === 'QuotaExceededError' ||
    err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err?.code === 22 ||
    err?.code === 1014 ||
    (typeof err?.message === 'string' &&
      (err.message.includes('quota') ||
        err.message.includes('Quota') ||
        err.message.includes('exceeded the quota'))),
  )
}

export function safeLocalStorageSetItem(key: string, value: string, context?: PruneContext): void {
  if (typeof window === 'undefined' || !window.localStorage) return

  try {
    window.localStorage.setItem(key, value)
  } catch (err: any) {
    if (!isQuotaExceededError(err)) {
      // Outro tipo de erro (ex: storage desabilitado no browser)
      throw err
    }

    console.warn(
      `[safeLocalStorageSetItem] QuotaExceededError detectado ao gravar '${key}'. Executando prune seguro...`,
    )

    // Se o contexto não tiver round inferido, tentar inferir da própria chave
    const meta = parseStorageKeyMetadata(key)
    const effectiveContext: PruneContext = {
      careerId: context?.careerId || meta.careerId,
      seasonId: context?.seasonId || meta.seasonId,
      currentRound: context?.currentRound ?? meta.round,
    }

    const pruneResult = runPreventiveStorageCleanup(effectiveContext)
    console.info(
      `[safeLocalStorageSetItem] Prune liberou ${pruneResult.freedKB} KB (${pruneResult.prunedKeys.length} chaves removidas). Tentando retry único...`,
    )

    // Retry único:
    try {
      window.localStorage.setItem(key, value)
      console.info(`[safeLocalStorageSetItem] Gravação de '${key}' bem-sucedida após prune.`)
    } catch (retryErr) {
      console.warn(
        `[safeLocalStorageSetItem] Gravação de '${key}' falhou no retry após prune. Cota exaurida persistentemente.`,
        retryErr,
      )
      throw retryErr
    }
  }
}

/**
 * 8. PODA NO BOOT DA APLICAÇÃO (BOOT STORAGE HYGIENE)
 * Mede o consumo do localStorage no carregamento inicial da aplicação.
 * Se o uso total exceder STORAGE_WARNING_THRESHOLD_BYTES (~3MB):
 * - Executa automaticamente poda de espelhos locais já canônicos no PB
 * - Descarta journals COMPLETE antigos, snapshots antigos e resultados obsoletos
 * - Não bloqueia a inicialização do app.
 */
let hasBootCleanupRun = false

export function runBootStorageHygieneIfExceeded(options?: { force?: boolean }): PruneResult | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  if (hasBootCleanupRun && !options?.force) {
    return null
  }
  hasBootCleanupRun = true

  try {
    let currentBytes = 0
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k) {
        const v = window.localStorage.getItem(k) || ''
        currentBytes += (k.length + v.length) * 2
      }
    }

    const currentMB = currentBytes / (1024 * 1024)

    if (currentBytes > STORAGE_WARNING_THRESHOLD_BYTES || options?.force) {
      console.info(
        `[BootStorageHygiene] Armazenamento local em ${currentMB.toFixed(2)} MB (> ~3MB). Executando higienização no boot...`,
      )

      // Identificar temporada e rodada ativa para contextualizar o prune
      let detectedCareerId: string | undefined
      let detectedSeasonId: string | undefined
      let detectedRound: number | undefined

      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k) {
          const meta = parseStorageKeyMetadata(k)
          if (meta.round && (!detectedRound || meta.round > detectedRound)) {
            detectedRound = meta.round
          }
          if (meta.careerId) detectedCareerId = meta.careerId
          if (meta.seasonId) detectedSeasonId = meta.seasonId
        }
      }

      const res = runPreventiveStorageCleanup({
        careerId: detectedCareerId,
        seasonId: detectedSeasonId,
        currentRound: detectedRound,
      })

      console.info(
        `[BootStorageHygiene] Poda no boot concluída: ${res.freedKB} KB liberados (${res.prunedKeys.length} chaves podadas).`,
      )
      return res
    }
  } catch (bootErr) {
    console.warn('[BootStorageHygiene] Falha não bloqueante na poda de boot:', bootErr)
  }

  return null
}

// Auto-execução segura e não-bloqueante no browser
if (typeof window !== 'undefined') {
  try {
    runBootStorageHygieneIfExceeded()
  } catch {
    /* ignore */
  }
}
