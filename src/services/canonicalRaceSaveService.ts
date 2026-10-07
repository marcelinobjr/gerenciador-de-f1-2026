/**
 * canonicalRaceSaveService.ts
 *
 * FW2.1E-E — RACE SAVE/RELOAD (APEX GP MANAGER - F1 2026)
 *
 * Princípio Central:
 * "save -> reload -> continue" deve produzir o mesmo estado e os mesmos resultados futuros
 * que "continue without reload" com as mesmas decisões e a mesma seed.
 *
 * Requisitos Implementados:
 * 1. NÃO RECONSTRUIR A CORRIDA: serializa/desserializa o CanonicalRaceState completo;
 *    nunca re-deriva pilotos, grid ou seed no reload.
 * 2. ESTADO PERSISTIDO: careerId, season, round, raceId, playerTeamId, saveSchemaVersion ("race-save-v1"),
 *    volta atual, total de voltas, status, raceControlState completo, classificação, estado dos 24 carros,
 *    event feed, fastestLap, raceSeed e RNG determinístico.
 * 3. DOIS CARROS DO JOGADOR: driverStrategies isoladas por driverId/carSlot, sem compartilhamento de referência.
 * 4. PIT PENDENTE: pitRequested preservado intacto.
 * 5. DOUBLE STACK PENDENTE: dois pedidos, pitPriority e delay preservados.
 * 6. RACE CONTROL: Safety Car, VSC, Red Flag, scQueuedOrder, gaps congelados. DNF nunca ressuscita.
 * 7. EVENT FEED: preservado sem duplicação após reload.
 * 8. IDEMPOTÊNCIA DE LOAD: carregar N vezes não simula, não altera estado, não consome combustível.
 * 9. SAVE ATÔMICO: snapshot imutável via deep clone antes de persistir.
 * 10. VALIDAÇÃO NO LOAD: 24 entradas, unicidade de IDs, continuidade P1..P24, compatibilidade de careerId/raceId.
 *     Snapshot inválido falha de forma controlada e diagnosticável.
 * 11. ISOLAMENTO: Career A não carrega Career B; Race A não carrega Race B; drivers_base_2026 intocada.
 * 12. REINICIAR: descarta snapshot salvo sem tocar na base global nem na qualificação.
 * 13. CORRIDA FINISHED: bloqueio de retomada como ativa.
 * 14. CONCORRÊNCIA: verificação de revision/sequence para evitar sobrescrita por estado desatualizado.
 */

import type {
  CanonicalRaceState,
  CanonicalRaceDriverState,
  RaceControlState,
} from '@/types/canonical-race-v2'

export const RACE_SAVE_SCHEMA_VERSION = 'race-save-v1' as const

import { safeLocalStorageSetItem } from '@/services/storageQuotaService'
import { canonicalRaceStateBackendService } from '@/services/canonicalRaceStateBackendService'

export const CANONICAL_RACE_STORAGE_PREFIX_V2 = 'f1_2026_canonical_race_v2'

export interface SaveValidationResult {
  valid: boolean
  errors: string[]
}

export class CanonicalRaceSaveService {
  /**
   * Deep clone independente para garantir snapshot imutável
   */
  public deepClone<T>(obj: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj)
    }
    return JSON.parse(JSON.stringify(obj))
  }

  /**
   * Constrói a chave canônica canônica de armazenamento no padrão FW2.1E:
   * f1_2026_canonical_race_v2_${careerId}_s${season}_r${round}
   */
  public buildStorageKey(
    careerId: string,
    season: number,
    round: number,
    raceVariant: import('@/types/canonical-race-v2').RaceVariant = 'MAIN_RACE',
  ): string {
    if (raceVariant === 'SPRINT_RACE') {
      return `${CANONICAL_RACE_STORAGE_PREFIX_V2}_sprint_${careerId}_s${season}_r${round}`
    }
    return `${CANONICAL_RACE_STORAGE_PREFIX_V2}_${careerId}_s${season}_r${round}`
  }

  /**
   * Chave legada/retrocompatível para garantir continuidade
   */
  public buildLegacyStorageKey(
    careerId: string,
    season: number,
    round: number,
    raceVariant: import('@/types/canonical-race-v2').RaceVariant = 'MAIN_RACE',
  ): string {
    if (raceVariant === 'SPRINT_RACE') {
      return `apex_sprint_race_canonical_state_${careerId}_s${season}_r${round}`
    }
    return `apex_race_v2_canonical_state_${careerId}_s${season}_r${round}`
  }

  /**
   * Validação estrita de um snapshot antes de salvar ou ao carregar (Requisito 10).
   * Snapshot inválido produz erro controlado e diagnosticável sem consertos silenciosos.
   */
  public validateRaceSnapshot(
    rawState: unknown,
    expectedContext?: { careerId?: string; raceId?: string; season?: number; round?: number },
  ): SaveValidationResult {
    const errors: string[] = []

    if (!rawState || typeof rawState !== 'object') {
      return { valid: false, errors: ['Snapshot nulo ou formato não-objeto'] }
    }

    const state = rawState as Partial<CanonicalRaceState>

    // 1. Schema version
    if (state.saveSchemaVersion && state.saveSchemaVersion !== RACE_SAVE_SCHEMA_VERSION) {
      errors.push(
        `saveSchemaVersion incompatível: esperado '${RACE_SAVE_SCHEMA_VERSION}', encontrado '${state.saveSchemaVersion}'`,
      )
    }

    // 2. Identificadores canônicos
    if (!state.careerId || typeof state.careerId !== 'string') {
      errors.push('careerId ausente ou inválido no snapshot')
    }
    if (!state.raceId || typeof state.raceId !== 'string') {
      errors.push('raceId ausente ou inválido no snapshot')
    }
    if (typeof state.season !== 'number') {
      errors.push('season ausente ou não numérica')
    }
    if (typeof state.round !== 'number') {
      errors.push('round ausente ou não numérico')
    }
    if (!state.playerTeamId || typeof state.playerTeamId !== 'string') {
      errors.push('playerTeamId ausente ou inválido')
    }

    // Contexto esperado (isolamento por carreira e etapa - Requisito 11)
    if (expectedContext) {
      if (expectedContext.careerId && state.careerId !== expectedContext.careerId) {
        errors.push(
          `Incompatibilidade de Carreira: snapshot pertence a '${state.careerId}', esperado '${expectedContext.careerId}'`,
        )
      }
      if (expectedContext.raceId && state.raceId !== expectedContext.raceId) {
        errors.push(
          `Incompatibilidade de Corrida: snapshot pertence a '${state.raceId}', esperado '${expectedContext.raceId}'`,
        )
      }
      if (expectedContext.season && state.season !== expectedContext.season) {
        errors.push(
          `Incompatibilidade de Temporada: snapshot season ${state.season}, esperado ${expectedContext.season}`,
        )
      }
      if (expectedContext.round && state.round !== expectedContext.round) {
        errors.push(
          `Incompatibilidade de Round: snapshot round ${state.round}, esperado ${expectedContext.round}`,
        )
      }
    }

    // 3. Voltas e status
    if (typeof state.totalLaps !== 'number' || state.totalLaps < 1) {
      errors.push(`totalLaps inválido: ${state.totalLaps}`)
    }
    if (typeof state.currentLap !== 'number' || state.currentLap < 1) {
      errors.push(`currentLap inválido: ${state.currentLap}`)
    }
    if (!state.status) {
      errors.push('status da corrida ausente')
    }

    // 4. Drivers: exatamente 24 entidades
    if (!Array.isArray(state.drivers)) {
      errors.push('drivers ausente ou não é array')
    } else {
      if (state.drivers.length !== 24) {
        errors.push(
          `drivers deve conter exatamente 24 entradas, encontrado ${state.drivers.length}`,
        )
      }

      const seenIds = new Set<string>()
      const seenPositions = new Set<number>()
      let playerCount = 0

      for (let i = 0; i < state.drivers.length; i++) {
        const d = state.drivers[i]
        if (!d.driverId || typeof d.driverId !== 'string') {
          errors.push(`driver[${i}] com driverId inválido`)
          continue
        }
        if (seenIds.has(d.driverId)) {
          errors.push(`driverId duplicado detectado: ${d.driverId}`)
        }
        seenIds.add(d.driverId)

        if (d.currentPosition < 1 || d.currentPosition > 24) {
          errors.push(
            `currentPosition fora da faixa 1..24 para ${d.driverId}: ${d.currentPosition}`,
          )
        }
        if (seenPositions.has(d.currentPosition)) {
          errors.push(`currentPosition duplicada detectada: P${d.currentPosition}`)
        }
        seenPositions.add(d.currentPosition)

        if (d.gridPosition < 1 || d.gridPosition > 24) {
          errors.push(`gridPosition inválida para ${d.driverId}: ${d.gridPosition}`)
        }

        if (typeof d.fuel !== 'number' || d.fuel < 0) {
          errors.push(`combustível inválido para ${d.driverId}: ${d.fuel}`)
        }

        if (d.raceStatus === 'dnf' && !d.isDnf) {
          errors.push(`inconsistência de flag DNF para ${d.driverId}`)
        }

        if (d.isPlayer || d.teamId === state.playerTeamId) {
          playerCount++
        }
      }

      if (playerCount !== 2) {
        errors.push(`esperado exatamente 2 pilotos da equipe do jogador, encontrado ${playerCount}`)
      }
    }

    // 5. Race Control
    if (state.raceControl) {
      const rc = state.raceControl
      if (!rc.currentFlag) {
        errors.push('raceControl.currentFlag ausente')
      }
      if (typeof rc.safetyCarLaps !== 'number' || rc.safetyCarLaps < 0) {
        errors.push('raceControl.safetyCarLaps inválido')
      }
      if (typeof rc.vscLaps !== 'number' || rc.vscLaps < 0) {
        errors.push('raceControl.vscLaps inválido')
      }
    }

    // 5.1 Red Flag Snapshot (RED-FLAG-RESTART-01)
    if (state.redFlagSnapshot) {
      const rfs = state.redFlagSnapshot
      if (typeof rfs.suspendedAtLap !== 'number') {
        errors.push('redFlagSnapshot.suspendedAtLap deve ser numérico')
      }
      if (!Array.isArray(rfs.standingGridOrder)) {
        errors.push('redFlagSnapshot.standingGridOrder deve ser um array')
      }
      if (!Array.isArray(rfs.driverSnapshots)) {
        errors.push('redFlagSnapshot.driverSnapshots deve ser um array')
      }
    }

    // 5.5 Pending Weather Decision (RACE-PROVENANCE-AUDIT-02B-E1A)
    if (state.pendingWeatherDecision) {
      const pwd = state.pendingWeatherDecision
      if (typeof pwd.active !== 'boolean') {
        errors.push('pendingWeatherDecision.active deve ser boolean')
      }
      if (!pwd.transition || (pwd.transition !== 'DRY_TO_WET' && pwd.transition !== 'WET_TO_DRY')) {
        errors.push(`pendingWeatherDecision.transition inválida: ${pwd.transition}`)
      }
      if (!Array.isArray(pwd.drivers)) {
        errors.push('pendingWeatherDecision.drivers deve ser um array')
      }
    }

    // 6. Estratégias
    if (state.driverStrategies) {
      for (const [drvId, strat] of Object.entries(state.driverStrategies)) {
        if (!strat.driverId || strat.driverId !== drvId) {
          errors.push(`driverStrategies chave mismatch para ${drvId}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Salva o estado canônico de forma atômica e imutável.
   * Aplica saveSchemaVersion, atualiza updatedAt e incrementa revision caso necessário.
   * Não sobrescreve se o snapshot em disco tiver revision mais recente (controle de concorrência).
   */
  public saveCanonicalRaceState(state: CanonicalRaceState): { success: boolean; error?: string } {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { success: false, error: 'localStorage indisponível' }
    }

    try {
      // 1. Snapshot imutável
      const snapshot = this.deepClone(state)
      snapshot.saveSchemaVersion = RACE_SAVE_SCHEMA_VERSION
      snapshot.updatedAt = new Date().toISOString()
      snapshot.revision = (snapshot.revision || 0) + 1

      // 2. Validar antes de persistir
      const validation = this.validateRaceSnapshot(snapshot)
      if (!validation.valid) {
        const errorMsg = `Validação de snapshot falhou: ${validation.errors.join('; ')}`
        console.error('[CanonicalRaceSaveService]', errorMsg)
        return { success: false, error: errorMsg }
      }

      // 3. Checagem de concorrência com snapshot anterior em disco
      const raceVariant = snapshot.raceVariant || 'MAIN_RACE'
      const keyV2 = this.buildStorageKey(
        snapshot.careerId,
        snapshot.season,
        snapshot.round,
        raceVariant,
      )
      const existingRaw = window.localStorage.getItem(keyV2)
      if (existingRaw) {
        try {
          const existing = JSON.parse(existingRaw) as CanonicalRaceState
          if (existing.revision && existing.revision > snapshot.revision) {
            return {
              success: false,
              error: `Concorrência: snapshot em disco tem revisão mais recente (disco: ${existing.revision}, atual: ${snapshot.revision})`,
            }
          }
        } catch {
          // ignora falha de parse do anterior
        }
      }

      const serialized = JSON.stringify(snapshot)
      const pruneCtx = {
        careerId: snapshot.careerId,
        seasonId: `s${snapshot.season}`,
        currentRound: snapshot.round,
      }
      // Grava na chave canônica v2
      safeLocalStorageSetItem(keyV2, serialized, pruneCtx)
      // Grava espelho na chave retrocompatível
      const keyLegacy = this.buildLegacyStorageKey(
        snapshot.careerId,
        snapshot.season,
        snapshot.round,
        raceVariant,
      )
      safeLocalStorageSetItem(keyLegacy, serialized, pruneCtx)

      // STORAGE-QUOTA-01B1-B: Espelhar a escrita no PocketBase
      // 1. Manter ordem segura: localStorage gravado primeiro;
      // 2. Não bloquear o fluxo local em caso de erro transitório do backend;
      // 3. Tornar o erro backend observável via log e/ou retorno de promise;
      // 4. Salvar com a mesma identidade lógica (careerId, season, round, variant) e payload idêntico.
      try {
        const backendContext = {
          careerId: snapshot.careerId,
          season: snapshot.season,
          round: snapshot.round,
          variant: raceVariant,
        }
        canonicalRaceStateBackendService
          .saveRaceState(backendContext, snapshot)
          .then((backendRes) => {
            if (!backendRes.success) {
              console.warn(
                `[CanonicalRaceSaveService] Falha ao espelhar race state no PocketBase: ${backendRes.error}`,
              )
            }
          })
          .catch((err) => {
            console.warn(
              '[CanonicalRaceSaveService] Erro inesperado ao espelhar race state no PocketBase:',
              err?.message || err,
            )
          })
      } catch (backendDispatchErr: any) {
        console.warn(
          '[CanonicalRaceSaveService] Exceção ao despachar salvamento no backend:',
          backendDispatchErr?.message || backendDispatchErr,
        )
      }

      return { success: true }
    } catch (e: any) {
      console.error('[CanonicalRaceSaveService] Erro ao persistir snapshot canônico:', e)
      return { success: false, error: e?.message || 'Erro desconhecido ao salvar' }
    }
  }

  /**
   * Lê e restaura o snapshot canônico com validação estrita.
   * Idempotente: leitura repetida não executa simulação nem altera o estado.
   * Rejeita snapshots incompatíveis com erro diagnosticável.
   */
  /**
   * STORAGE-QUOTA-01B1-C — Leitura/Resume preferindo PocketBase com fallback explícito em localStorage.
   *
   * Ordem de leitura:
   * 1. Consulta primeiro o PocketBase via canonicalRaceStateBackendService.readRaceState(context);
   * 2. Se backend retornar payload válido, usa-o como fonte preferencial (backend vence local divergente);
   * 3. Se backend retornar null (NOT_FOUND) ou erro de rede (BACKEND_ERROR), executa fallback para localStorage;
   * 4. Validação estrita do payload (mesmo contrato canônico de validateRaceSnapshot);
   * 5. Não sobrescreve nem apaga o localStorage nesta rodada;
   * 6. Não regrava backend (leitura pura e idempotente sem efeitos colaterais de escrita).
   */
  public async loadCanonicalRaceStatePreferred(
    careerId: string,
    season: number,
    round: number,
    raceVariant: import('@/types/canonical-race-v2').RaceVariant = 'MAIN_RACE',
  ): Promise<{
    state: CanonicalRaceState | null
    source: 'backend' | 'local' | 'local_migrated' | 'local_migration_failed' | 'none'
    error?: string
    backendError?: string
    migrationError?: string
    isFinished?: boolean
  }> {
    const backendContext = {
      careerId,
      season,
      round,
      variant: raceVariant,
    }

    let backendState: CanonicalRaceState | null = null
    let backendError: string | undefined = undefined
    let isBackendNetworkError = false

    // 1. Consultar primeiro o PocketBase
    try {
      backendState = await canonicalRaceStateBackendService.readRaceState(backendContext)
    } catch (err: any) {
      isBackendNetworkError = true
      backendError = err?.message || 'Erro de rede ou indisponibilidade ao consultar PocketBase'
      console.warn(
        `[CanonicalRaceSaveService] Erro ao consultar backend para race_state (${careerId}, s${season}, r${round}, ${raceVariant}):`,
        err,
      )
    }

    // 2. Se o backend retornou estado, validar pelo contrato canônico
    if (backendState) {
      const validation = this.validateRaceSnapshot(backendState, { careerId, season, round })

      // Validação adicional de isolamento estrito de raceVariant
      const stateVariant = backendState.raceVariant || 'MAIN_RACE'
      if (stateVariant !== raceVariant) {
        validation.valid = false
        validation.errors.push(
          `Incompatibilidade de Variante: snapshot pertence a '${stateVariant}', esperado '${raceVariant}'`,
        )
      }

      if (validation.valid) {
        // Backend válido encontrado: backend vence (não migra pois backend já possui state)
        const resolvedState = this.deepClone(backendState)

        if (!resolvedState.driverLookup || Object.keys(resolvedState.driverLookup).length === 0) {
          resolvedState.driverLookup = {}
          for (const d of resolvedState.drivers) {
            resolvedState.driverLookup[d.driverId] = d
          }
        }

        const isFinished =
          resolvedState.status === 'completed' ||
          resolvedState.raceControl?.currentFlag === 'FINISHED'

        return {
          state: resolvedState,
          source: 'backend',
          isFinished,
        }
      } else {
        // Payload backend inválido / corrompido: rejeitar e registrar erro observável
        const errorMsg = `Payload inválido no PocketBase: ${validation.errors.join('; ')}`
        console.warn('[CanonicalRaceSaveService]', errorMsg)
        backendError = errorMsg
      }
    }

    // 3. Fallback para localStorage local
    const localResult = this.loadCanonicalRaceState(careerId, season, round, raceVariant)

    // STORAGE-QUOTA-01B1-D: LAZY MIGRATION DO RACE STATE LOCAL PARA BACKEND
    // Condições estritas para promoção:
    // 1. Backend respondeu NOT_FOUND: backendState === null E NÃO ocorreu erro de rede (isBackendNetworkError === false) E sem erro de payload prévio
    // 2. Local possui state válido: localResult.state !== null
    // 3. Se houve erro de rede/indisponibilidade (BACKEND_ERROR), NÃO tenta migrar (retorna local normal com fallback explícito)
    const isBackendNotFound = !backendState && !isBackendNetworkError && !backendError

    if (localResult.state && isBackendNotFound) {
      try {
        const saveRes = await canonicalRaceStateBackendService.saveRaceState(
          backendContext,
          localResult.state,
        )

        if (saveRes.success) {
          return {
            state: localResult.state,
            source: 'local_migrated',
            isFinished: localResult.isFinished,
          }
        } else {
          const migrationError =
            saveRes.error || 'Falha desconhecida ao promover race state ao PocketBase'
          console.warn(
            `[CanonicalRaceSaveService] Lazy migration falhou ao salvar no backend: ${migrationError}`,
          )
          return {
            state: localResult.state,
            source: 'local_migration_failed',
            migrationError,
            error: migrationError,
            isFinished: localResult.isFinished,
          }
        }
      } catch (migrationEx: any) {
        const migrationError =
          migrationEx?.message || 'Exceção ao executar lazy migration para o PocketBase'
        console.warn(`[CanonicalRaceSaveService] Exceção durante lazy migration: ${migrationError}`)
        return {
          state: localResult.state,
          source: 'local_migration_failed',
          migrationError,
          error: migrationError,
          isFinished: localResult.isFinished,
        }
      }
    }

    // Se local existe mas backend teve erro (BACKEND_ERROR), ou payload backend corrompido:
    if (localResult.state) {
      return {
        state: localResult.state,
        source: 'local',
        error: localResult.error,
        backendError,
        isFinished: localResult.isFinished,
      }
    }

    // 4. Ambos ausentes ou inválidos (NOT_FOUND ou erro sem local)
    return {
      state: null,
      source: 'none',
      error: localResult.error,
      backendError,
    }
  }

  public loadCanonicalRaceState(
    careerId: string,
    season: number,
    round: number,
    raceVariant: import('@/types/canonical-race-v2').RaceVariant = 'MAIN_RACE',
  ): {
    state: CanonicalRaceState | null
    error?: string
    isFinished?: boolean
  } {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { state: null, error: 'localStorage indisponível' }
    }

    try {
      const keyV2 = this.buildStorageKey(careerId, season, round, raceVariant)
      let raw = window.localStorage.getItem(keyV2)
      if (!raw) {
        // Tenta chave retrocompatível
        const keyLegacy = this.buildLegacyStorageKey(careerId, season, round, raceVariant)
        raw = window.localStorage.getItem(keyLegacy)
      }

      if (!raw) {
        return { state: null }
      }

      let parsed: any
      try {
        parsed = JSON.parse(raw)
      } catch (err: any) {
        return {
          state: null,
          error: `JSON corrompido no snapshot: ${err?.message || 'parse error'}`,
        }
      }

      // Validar snapshot lido contra o contexto esperado
      const validation = this.validateRaceSnapshot(parsed, { careerId, season, round })
      if (!validation.valid) {
        const msg = `Snapshot em disco corrompido ou incompatível: ${validation.errors.join('; ')}`
        console.error('[CanonicalRaceSaveService]', msg)
        return { state: null, error: msg }
      }

      const state = parsed as CanonicalRaceState

      // Reconstruir driverLookup se necessário
      if (!state.driverLookup || Object.keys(state.driverLookup).length === 0) {
        state.driverLookup = {}
        for (const d of state.drivers) {
          state.driverLookup[d.driverId] = d
        }
      }

      // Requisito 14 & FW2.1E-F: Corrida concluída (FINISHED) ou com resultado oficial
      // não pode ser retomada como corrida ativa.
      const isFinished =
        state.status === 'completed' || state.raceControl?.currentFlag === 'FINISHED'

      return {
        state: this.deepClone(state),
        isFinished,
      }
    } catch (e: any) {
      console.error('[CanonicalRaceSaveService] Falha ao carregar estado da corrida:', e)
      return { state: null, error: e?.message || 'Falha ao ler snapshot' }
    }
  }

  /**
   * Remove o snapshot salvo (Requisito 13: Reiniciar Corrida descarta save).
   * FW2.1E-F (Requisito 18): Se a corrida já possui resultado oficial, NÃO permitir
   * que seja reiniciada silenciosamente ou que seu save seja descartado.
   */
  public clearCanonicalRaceState(
    careerId: string,
    season: number,
    round: number,
    options?: { force?: boolean; raceVariant?: import('@/types/canonical-race-v2').RaceVariant },
  ): { success: boolean; blockedReason?: string } {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { success: false, blockedReason: 'localStorage indisponível' }
    }

    const raceVariant = options?.raceVariant || 'MAIN_RACE'
    const resultKeyPrefix =
      raceVariant === 'SPRINT_RACE'
        ? `${CANONICAL_RACE_STORAGE_PREFIX_V2.replace('_canonical_race_v2', '_canonical_official_result')}_sprint`
        : `${CANONICAL_RACE_STORAGE_PREFIX_V2.replace('_canonical_race_v2', '_canonical_official_result')}`
    const officialResultKey = `${resultKeyPrefix}_${careerId}_s${season}_r${round}`
    const hasOfficialResult = !!window.localStorage.getItem(officialResultKey)

    if (hasOfficialResult && !options?.force) {
      const blockedMsg =
        'A corrida já possui Resultado Oficial homologado. Não é permitido reiniciar a prova para não corromper o histórico da temporada.'
      console.warn('[CanonicalRaceSaveService]', blockedMsg)
      return { success: false, blockedReason: blockedMsg }
    }

    try {
      const keyV2 = this.buildStorageKey(careerId, season, round, raceVariant)
      const keyLegacy = this.buildLegacyStorageKey(careerId, season, round, raceVariant)
      window.localStorage.removeItem(keyV2)
      window.localStorage.removeItem(keyLegacy)
      return { success: true }
    } catch (e: any) {
      console.warn('[CanonicalRaceSaveService] Falha ao limpar snapshot:', e)
      return { success: false, blockedReason: e?.message }
    }
  }

  /**
   * Verifica se existe um snapshot salvo para a sessão especificada.
   */
  public hasSavedRace(careerId: string, season: number, round: number): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const keyV2 = this.buildStorageKey(careerId, season, round)
    const keyLegacy = this.buildLegacyStorageKey(careerId, season, round)
    return !!(window.localStorage.getItem(keyV2) || window.localStorage.getItem(keyLegacy))
  }
}

export const canonicalRaceSaveService = new CanonicalRaceSaveService()
