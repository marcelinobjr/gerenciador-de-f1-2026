/**
 * DRIVER MORALE SERVICE — APEX GP Manager
 * Tarefa: DRIVER-MORALE-01
 *
 * Regras Canônicas:
 * - Variação dinâmica após corridas de acordo com RESULTADO REAL × RESULTADO ESPERADO.
 * - Expectativa pré-corrida:
 *   1. Pre-race expected position / projected rank quando fornecido.
 *   2. Fallback determinístico: Starting Grid Position (posição de largada).
 *   A expectativa NUNCA é calculada usando o resultado final da própria corrida.
 * - Performance Delta: performanceDelta = expectedPosition - finishPosition.
 *   (Expected P10 / Finish P6 -> +4; Expected P4 / Finish P9 -> -5).
 * - Tabela Base (impacto moderado):
 *   * superou em 5+ posições (performanceDelta >= 5) -> +4
 *   * superou em 2 a 4 posições (2 <= performanceDelta <= 4) -> +2
 *   * dentro de ±1 (-1 <= performanceDelta <= 1) -> 0
 *   * abaixo em 2 a 4 posições (-4 <= performanceDelta <= -2) -> -2
 *   * abaixo em 5+ posições (performanceDelta <= -5) -> -4
 * - Bônus Especiais:
 *   * Vitória (P1): +3
 *   * Pódio sem vitória (P2, P3): +2
 * - DNF:
 *   * Mecânico/técnico (engine, gearbox, hydraulics, electrical, brakes, suspension, radiator, pu): 0 ou -1 (-1 se sem mitigação) -> 0 a -1 (padrão 0 para pura falha mecânica, máx -1)
 *   * Erro do piloto (driver error, crash, spin, collision atribuível): -4 (intervalo -3 a -5)
 *   * Sem causa confiável / desconhecido: -1 (conservador sem inferir culpa)
 * - Clamp por GP: [-8, +8]
 * - Clamp Global da Moral: [0, 100]
 * - Preservação estrita: Driver Strength = Attributes 80% + Morale 10% + Adaptation 10%.
 * - Totalmente agnóstico a piloto/equipe (zero hardcoding).
 * - Idempotência: chave conceitual driver_morale_{career}_{season}_{round}_{driver}
 */

export interface DriverMoraleInput {
  driverId: string
  teamId?: string
  driverName?: string
  teamName?: string
  currentMorale: number // 0-100
  finishPosition: number // 1..N
  gridPosition?: number
  expectedPosition?: number // Projeção pré-corrida (se indisponível, usa gridPosition como fallback)
  status?: 'finished' | 'dnf' | string
  isDnf?: boolean
  dnfReason?: string
  isWinner?: boolean
  isPodium?: boolean
}

export interface DriverMoraleCalculationResult {
  driverId: string
  beforeMorale: number
  expectedPosition: number
  finishPosition: number
  performanceDelta: number
  baseDelta: number
  specialBonus: number
  dnfDelta?: number
  clampedRaceDelta: number
  afterMorale: number
  usedFallbackGrid: boolean
  dnfCategory?: 'mechanical' | 'driver_error' | 'unknown'
  diagnosticLog: string
}

export type DriverMoraleProcessStatus = 'success' | 'already_processed' | 'failed'

export interface DriverMoraleItemResult {
  driverId: string
  status: DriverMoraleProcessStatus
  calculation?: DriverMoraleCalculationResult
  savedMorale?: number
  error?: string
}

export interface DriverMoraleBatchResult {
  allSucceeded: boolean
  successCount: number
  alreadyProcessedCount: number
  failedCount: number
  totalEntries: number
  items: DriverMoraleItemResult[]
}

export type DnfCategory = 'mechanical' | 'driver_error' | 'unknown'

const MECHANICAL_KEYWORDS = [
  'engine',
  'motor',
  'gearbox',
  'câmbio',
  'cambio',
  'transmission',
  'transmissao',
  'transmissão',
  'hydraulics',
  'hidraulico',
  'hidráulico',
  'electrical',
  'eletrico',
  'elétrico',
  'eletronica',
  'eletrônica',
  'brakes',
  'freio',
  'freios',
  'suspension',
  'suspensao',
  'suspensão',
  'radiator',
  'radiador',
  'power_unit',
  'power unit',
  'pu',
  'mgu',
  'turbo',
  'oil',
  'oleo',
  'óleo',
  'exhaust',
  'escapamento',
  'failure',
  'falha mecanica',
  'falha mecânica',
  'mechanical',
  'mecanico',
  'mecânico',
]

const DRIVER_ERROR_KEYWORDS = [
  'driver error',
  'erro do piloto',
  'driver_error',
  'spin',
  'rodou',
  'rodada',
  'crash into wall',
  'batida no muro',
  'driver mistake',
  'erro de pilotagem',
  'driver crash',
  'collision caused',
  'atribuivel ao piloto',
  'atribuível ao piloto',
  'pilot error',
]

export class DriverMoraleService {
  /**
   * Identifica a categoria do DNF a partir do texto/código de motivo
   */
  public categorizeDnf(reason?: string): DnfCategory {
    if (!reason || typeof reason !== 'string') {
      return 'unknown'
    }
    const lower = reason.toLowerCase()

    // 1. Checa erro de piloto explícito
    for (const kw of DRIVER_ERROR_KEYWORDS) {
      if (lower.includes(kw)) {
        return 'driver_error'
      }
    }

    // 2. Checa falha mecânica/técnica
    for (const kw of MECHANICAL_KEYWORDS) {
      if (lower.includes(kw)) {
        return 'mechanical'
      }
    }

    return 'unknown'
  }

  /**
   * Calcula o delta base de performance:
   * performanceDelta = expectedPosition - finishPosition
   * 5+ posições acima -> +4
   * 2 a 4 posições acima -> +2
   * dentro de ±1 -> 0
   * 2 a 4 posições abaixo -> -2
   * 5+ posições abaixo -> -4
   */
  public calculateBasePerformanceDelta(performanceDelta: number): number {
    if (performanceDelta >= 5) {
      return 4
    }
    if (performanceDelta >= 2) {
      return 2
    }
    if (performanceDelta <= -5) {
      return -4
    }
    if (performanceDelta <= -2) {
      return -2
    }
    return 0
  }

  /**
   * Calcula bônus especial:
   * Vitória (P1) -> +3
   * Pódio sem vitória (P2, P3) -> +2
   */
  public calculateSpecialBonus(
    finishPosition: number,
    isWinner?: boolean,
    isPodium?: boolean,
  ): number {
    if (finishPosition === 1 || isWinner) {
      return 3
    }
    if (finishPosition === 2 || finishPosition === 3 || isPodium) {
      return 2
    }
    return 0
  }

  /**
   * Calcula a nova moral de um piloto individual a partir dos resultados reais da corrida
   */
  public calculateDriverMoraleDelta(input: DriverMoraleInput): DriverMoraleCalculationResult {
    const isDnf = Boolean(
      input.isDnf ||
      input.status === 'dnf' ||
      (input.finishPosition && input.finishPosition >= 900),
    )

    // Resolução da expectativa pré-corrida:
    // 1. input.expectedPosition (se fornecido explicitamente)
    // 2. input.gridPosition (fallback canônico temporário)
    // 3. input.finishPosition (último recurso se absolutamente nada fornecido)
    let expectedPosition = input.expectedPosition
    let usedFallbackGrid = false

    if (typeof expectedPosition !== 'number' || expectedPosition <= 0) {
      if (typeof input.gridPosition === 'number' && input.gridPosition > 0) {
        expectedPosition = input.gridPosition
        usedFallbackGrid = true
      } else {
        expectedPosition = input.finishPosition || 10
      }
    }

    const beforeMorale = Math.max(0, Math.min(100, input.currentMorale ?? 80))
    let performanceDelta = 0
    let baseDelta = 0
    let specialBonus = 0
    let dnfDelta: number | undefined
    let dnfCategory: DnfCategory | undefined
    let rawRaceDelta = 0

    if (isDnf) {
      // Regra MORAL-DNF-01A:
      // Todo piloto que não terminou a prova (DNF) recebe delta fixo -1,
      // independentemente da causa (mecânica, erro do piloto ou desconhecida).
      // dnfCategory é mantido calculado e registrado para diagnóstico.
      dnfCategory = this.categorizeDnf(input.dnfReason)
      dnfDelta = -1
      rawRaceDelta = dnfDelta
      performanceDelta = 0
      baseDelta = 0
      specialBonus = 0
    } else {
      // Piloto terminou a prova
      performanceDelta = expectedPosition - input.finishPosition
      baseDelta = this.calculateBasePerformanceDelta(performanceDelta)
      specialBonus = this.calculateSpecialBonus(
        input.finishPosition,
        input.isWinner,
        input.isPodium,
      )
      rawRaceDelta = baseDelta + specialBonus
    }

    // Clamp por GP: [-8, +8]
    const clampedRaceDelta = Math.max(-8, Math.min(8, rawRaceDelta))

    // Clamp Global da moral: [0, 100]
    const afterMorale = Math.max(0, Math.min(100, Math.round(beforeMorale + clampedRaceDelta)))

    const diagnosticLog = `Driver Morale: before: ${beforeMorale} / expected: P${expectedPosition} / finish: P${input.finishPosition} / performanceDelta: ${performanceDelta >= 0 ? '+' : ''}${performanceDelta} / raceMoraleDelta: ${baseDelta >= 0 ? '+' : ''}${baseDelta} / podiumBonus: ${specialBonus} / finalDelta: ${clampedRaceDelta >= 0 ? '+' : ''}${clampedRaceDelta} / after: ${afterMorale}${isDnf ? ` / DNF (${dnfCategory}): ${dnfDelta}` : ''}`

    return {
      driverId: input.driverId,
      beforeMorale,
      expectedPosition,
      finishPosition: input.finishPosition,
      performanceDelta,
      baseDelta,
      specialBonus,
      dnfDelta,
      clampedRaceDelta,
      afterMorale,
      usedFallbackGrid,
      dnfCategory,
      diagnosticLog,
    }
  }

  /**
   * Gera chaves únicas conceituais de idempotência, cobrindo aliases (slug canônico e/ou ID real)
   */
  public getIdempotencyKey(params: {
    careerId?: string
    season: number | string
    round: number | string
    sessionType?: string
    driverId: string
    driverAliases?: string[]
  }): string {
    const career = params.careerId || 'default'
    const season = params.season || 2026
    const round = params.round || 1
    const session = params.sessionType ? `_${params.sessionType}` : ''
    return `driver_morale_${career}_${season}_${round}${session}_${params.driverId}`
  }

  private getCandidateDriverKeys(params: {
    careerId?: string
    season: number | string
    round: number | string
    sessionType?: string
    driverId: string
    driverAliases?: string[]
  }): string[] {
    const ids = new Set<string>()
    if (params.driverId) ids.add(params.driverId)
    if (params.driverAliases) {
      for (const a of params.driverAliases) {
        if (a) ids.add(a)
      }
    }
    return Array.from(ids)
  }

  /**
   * Consulta recibo autoritativo no backend (PocketBase) via endpoint ou collection
   */
  public async fetchBackendReceipt(params: {
    careerId?: string
    season: number | string
    round: number | string
    sessionType?: string
    driverId: string
    driverName?: string
  }): Promise<{
    exists: boolean
    operationKey?: string
    beforeMorale?: number
    delta?: number
    finalMorale?: number
    appliedAt?: string
    currentDriverMorale?: number
  } | null> {
    const careerId = params.careerId || 'default'
    const season = params.season || 2026
    const round = params.round || 1
    const sessionType = params.sessionType || 'MAIN_RACE'
    const driverId = params.driverId

    try {
      const pbModule = await import('@/lib/pocketbase/client')
      const pb = pbModule.default
      if (pb?.send) {
        const queryParams = new URLSearchParams({
          careerId: String(careerId),
          season: String(season),
          round: String(round),
          sessionType,
          driverId,
          ...(params.driverName ? { driverName: params.driverName } : {}),
        })
        const res = await pb.send<any>(
          `/backend/v1/driver-morale/receipt?${queryParams.toString()}`,
          {
            method: 'GET',
          },
        )
        if (res && typeof res.exists === 'boolean') {
          return res
        }
      }
    } catch {
      // Endpoint indisponível ou offline; tenta via collection direta
    }

    try {
      const pbModule = await import('@/lib/pocketbase/client')
      const pb = pbModule.default
      if (pb?.collection) {
        const sessSuffix = sessionType ? `_${sessionType}` : '_MAIN_RACE'
        const opKey = `driver_morale_receipt_${careerId}_${season}_${round}${sessSuffix}_${driverId}`
        const record = await pb
          .collection('canonical_driver_morale_receipts')
          .getFirstListItem(
            `operation_key = "${opKey}" || (career_id = "${careerId}" && season = ${season} && round = ${round} && (driver_id = "${driverId}" || driver_slug = "${driverId}"))`,
          )
        if (record) {
          return {
            exists: true,
            operationKey: record.operation_key,
            beforeMorale: record.before_morale,
            delta: record.delta,
            finalMorale: record.final_morale,
            appliedAt: record.applied_at,
          }
        }
      }
    } catch {
      // Sem recibo ou erro de rede
    }

    return null
  }

  /**
   * Recupera o registro persistido de processamento ou confirmação de moral prévia
   */
  public getStoredMoraleRecord(params: {
    careerId?: string
    season: number | string
    round: number | string
    sessionType?: string
    driverId: string
    driverAliases?: string[]
  }): {
    after?: number
    before?: number
    delta?: number
    persistedAt?: string
    processedAt?: string
    isFullyProcessed?: boolean
    isPersisted?: boolean
  } | null {
    if (typeof localStorage === 'undefined') return null

    const candidateIds = this.getCandidateDriverKeys(params)
    const career = params.careerId || 'default'
    const season = params.season || 2026
    const round = params.round || 1
    const session = params.sessionType ? `_${params.sessionType}` : ''

    for (const cId of candidateIds) {
      // 1. Verificar chave principal de processamento
      const mainKey = `driver_morale_${career}_${season}_${round}${session}_${cId}`
      try {
        const raw = localStorage.getItem(mainKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          return {
            ...parsed,
            isFullyProcessed: true,
          }
        }
      } catch {
        // fallback
      }

      // Se sessionType foi passado mas chave sem session existir (legada)
      if (session) {
        const legacyKey = `driver_morale_${career}_${season}_${round}_${cId}`
        try {
          const rawLegacy = localStorage.getItem(legacyKey)
          if (rawLegacy) {
            const parsed = JSON.parse(rawLegacy)
            return {
              ...parsed,
              isFullyProcessed: true,
            }
          }
        } catch {
          // fallback
        }
      }

      // 2. Verificar chave de persistência confirmada (caso B: save concluído, mark falhou)
      const updateKey = `driver_morale_applied_${career}_${season}_${round}${session}_${cId}`
      try {
        const rawUpdate = localStorage.getItem(updateKey)
        if (rawUpdate) {
          const parsed = JSON.parse(rawUpdate)
          return {
            ...parsed,
            isPersisted: true,
            isFullyProcessed: false,
          }
        }
      } catch {
        // fallback
      }

      if (session) {
        const legacyUpdateKey = `driver_morale_applied_${career}_${season}_${round}_${cId}`
        try {
          const rawLegacyUpdate = localStorage.getItem(legacyUpdateKey)
          if (rawLegacyUpdate) {
            const parsed = JSON.parse(rawLegacyUpdate)
            return {
              ...parsed,
              isPersisted: true,
              isFullyProcessed: false,
            }
          }
        } catch {
          // fallback
        }
      }
    }

    return null
  }

  /**
   * Verifica se a corrida já foi processada para um dado piloto (ou qualquer de seus aliases)
   */
  public isMoraleAlreadyProcessed(params: {
    careerId?: string
    season: number | string
    round: number | string
    sessionType?: string
    driverId: string
    driverAliases?: string[]
  }): boolean {
    const record = this.getStoredMoraleRecord(params)
    // Se foi totalmente processado ou se o save foi persistido com evidência
    return Boolean(record && (record.isFullyProcessed || record.isPersisted))
  }

  /**
   * Registra confirmação direta de persistência executada com sucesso com valor final de moral
   * Protege contra reaplicação de delta em retries mesmo se markMoraleProcessed falhar (Caso B)
   */
  public markMoralePersisted(params: {
    careerId?: string
    season: number | string
    round: number | string
    sessionType?: string
    driverId: string
    driverAliases?: string[]
    finalMorale?: number
    delta?: number
    before?: number
  }): void {
    if (typeof localStorage === 'undefined') return
    const candidateIds = this.getCandidateDriverKeys(params)
    const career = params.careerId || 'default'
    const season = params.season || 2026
    const round = params.round || 1
    const session = params.sessionType ? `_${params.sessionType}` : ''

    const payload = JSON.stringify({
      careerId: career,
      season,
      round,
      sessionType: params.sessionType,
      driverId: params.driverId,
      persistedAt: new Date().toISOString(),
      after: params.finalMorale,
      finalMorale: params.finalMorale,
      delta: params.delta,
      before: params.before,
    })

    for (const cId of candidateIds) {
      try {
        const updateKey = `driver_morale_applied_${career}_${season}_${round}${session}_${cId}`
        localStorage.setItem(updateKey, payload)
      } catch (e) {
        console.warn(`[DriverMoraleService] Failed to set update flag for ${cId}:`, e)
      }
    }
  }

  /**
   * Remove a marcação de processamento de um piloto (útil para retentativas ou testes)
   */
  public clearMoraleProcessed(params: {
    careerId?: string
    season: number | string
    round: number | string
    sessionType?: string
    driverId: string
    driverAliases?: string[]
  }): void {
    if (typeof localStorage === 'undefined') return
    const candidateIds = this.getCandidateDriverKeys(params)
    const career = params.careerId || 'default'
    const season = params.season || 2026
    const round = params.round || 1
    const session = params.sessionType ? `_${params.sessionType}` : ''

    for (const cId of candidateIds) {
      try {
        localStorage.removeItem(`driver_morale_${career}_${season}_${round}${session}_${cId}`)
        localStorage.removeItem(`driver_morale_${career}_${season}_${round}_${cId}`)
        localStorage.removeItem(
          `driver_morale_applied_${career}_${season}_${round}${session}_${cId}`,
        )
        localStorage.removeItem(`driver_morale_applied_${career}_${season}_${round}_${cId}`)
      } catch (e) {
        console.warn(`[DriverMoraleService] Failed to clear flags for ${cId}:`, e)
      }
    }
  }

  /**
   * Marca a corrida como processada para o piloto (e propaga para todos os aliases)
   */
  public markMoraleProcessed(
    params: {
      careerId?: string
      season: number | string
      round: number | string
      sessionType?: string
      driverId: string
      driverAliases?: string[]
    },
    meta?: {
      before: number
      after: number
      delta: number
      officializedAt?: string
    },
  ): void {
    if (typeof localStorage === 'undefined') return
    const candidateIds = this.getCandidateDriverKeys(params)
    const career = params.careerId || 'default'
    const season = params.season || 2026
    const round = params.round || 1
    const session = params.sessionType ? `_${params.sessionType}` : ''

    const payload = JSON.stringify({
      careerId: career,
      season,
      round,
      sessionType: params.sessionType,
      driverId: params.driverId,
      processedAt: new Date().toISOString(),
      ...(meta || {}),
    })

    for (const cId of candidateIds) {
      const key = `driver_morale_${career}_${season}_${round}${session}_${cId}`
      try {
        localStorage.setItem(key, payload)
      } catch (e) {
        console.warn(`[DriverMoraleService] Failed to set idempotency flag for ${cId}:`, e)
        throw e
      }
    }
  }

  /**
   * Processa a moral de todos os pilotos de uma corrida oficializada
   * de forma estritamente idempotente e persistente.
   *
   * Retorna array de cálculos compatível com assinatura existente (DriverMoraleCalculationResult[])
   * com propriedade .batchResult anexada para inspeção detalhada do lote.
   */
  public async processOfficialRaceMorale(params: {
    officialResult: {
      careerId?: string
      season: number | string
      round: number | string
      sessionType?: string
      officializedAt?: string
      entries: Array<{
        driverId: string
        teamId?: string
        driverName?: string
        teamName?: string
        finalPosition: number
        gridPosition?: number
        status?: string
        isDnf?: boolean
        dnf?: boolean
        dnfReason?: string
        aliases?: string[]
      }>
    }
    driverCurrentMoraleMap?: Record<string, number>
    driverAliasesMap?: Record<string, string[]>
    onSaveDriverMorale?: (
      driverId: string,
      newMorale: number,
      context?: { beforeMorale: number; delta: number },
    ) => Promise<boolean | void>
  }): Promise<DriverMoraleCalculationResult[] & { batchResult?: DriverMoraleBatchResult }> {
    const {
      officialResult,
      driverCurrentMoraleMap = {},
      driverAliasesMap = {},
      onSaveDriverMorale,
    } = params

    const results: DriverMoraleCalculationResult[] = []
    const itemResults: DriverMoraleItemResult[] = []

    for (const entry of officialResult.entries) {
      const aliases = entry.aliases || driverAliasesMap[entry.driverId] || []

      // 0. Consulta AUTORITATIVA no backend (PocketBase) se disponível
      let backendReceipt: any = null
      try {
        backendReceipt = await this.fetchBackendReceipt({
          careerId: officialResult.careerId,
          season: officialResult.season,
          round: officialResult.round,
          sessionType: officialResult.sessionType,
          driverId: entry.driverId,
          driverName: entry.driverName,
        })
      } catch {
        backendReceipt = null
      }

      // Se o backend confirmar existência de recibo prévio:
      // O efeito JÁ FOI APLICADO de forma atômica no servidor.
      // Reconcilia o cache local e conclui sem alterar a moral novamente.
      // IMPORTANTE: NÃO restaura finalMorale do recibo sobre a moral atual se esta
      // tiver sido alterada posteriormente por outro evento (requisito 2).
      if (backendReceipt && backendReceipt.exists) {
        // Atualiza cache local
        this.markMoralePersisted({
          careerId: officialResult.careerId,
          season: officialResult.season,
          round: officialResult.round,
          sessionType: officialResult.sessionType,
          driverId: entry.driverId,
          driverAliases: aliases,
          finalMorale: backendReceipt.finalMorale,
          delta: backendReceipt.delta,
          before: backendReceipt.beforeMorale,
        })
        try {
          this.markMoraleProcessed(
            {
              careerId: officialResult.careerId,
              season: officialResult.season,
              round: officialResult.round,
              sessionType: officialResult.sessionType,
              driverId: entry.driverId,
              driverAliases: aliases,
            },
            {
              before: backendReceipt.beforeMorale ?? 80,
              after: backendReceipt.finalMorale ?? 80,
              delta: backendReceipt.delta ?? 0,
              officializedAt: officialResult.officializedAt,
            },
          )
        } catch {
          /* intentionally ignored */
        }

        itemResults.push({
          driverId: entry.driverId,
          status: 'already_processed',
          savedMorale: backendReceipt.finalMorale,
        })
        continue
      }

      const stored = this.getStoredMoraleRecord({
        careerId: officialResult.careerId,
        season: officialResult.season,
        round: officialResult.round,
        sessionType: officialResult.sessionType,
        driverId: entry.driverId,
        driverAliases: aliases,
      })

      // Caso 1: Já totalmente processado anteriormente (segundo cache local)
      if (stored && stored.isFullyProcessed) {
        itemResults.push({
          driverId: entry.driverId,
          status: 'already_processed',
          savedMorale: stored.after,
        })
        continue
      }

      // Caso 2: Persistência (save) foi confirmada anteriormente, mas a marcação falhou (Caso B)
      // Em retry, reconcilia a marcação preservando o valor final registrado (NÃO reaplica o delta!)
      if (stored && stored.isPersisted && !stored.isFullyProcessed) {
        const finalMorale = typeof stored.after === 'number' ? stored.after : (stored.before ?? 80)
        let markOk = true
        try {
          this.markMoraleProcessed(
            {
              careerId: officialResult.careerId,
              season: officialResult.season,
              round: officialResult.round,
              sessionType: officialResult.sessionType,
              driverId: entry.driverId,
              driverAliases: aliases,
            },
            {
              before: stored.before ?? finalMorale,
              after: finalMorale,
              delta: stored.delta ?? 0,
              officializedAt: officialResult.officializedAt,
            },
          )
        } catch (markErr) {
          markOk = false
          console.warn(
            `[DriverMoraleService] Retry markMoraleProcessed failed for ${entry.driverId}:`,
            markErr,
          )
        }

        if (markOk) {
          itemResults.push({
            driverId: entry.driverId,
            status: 'success',
            savedMorale: finalMorale,
          })
        } else {
          itemResults.push({
            driverId: entry.driverId,
            status: 'failed',
            error: 'Save already confirmed, but markMoraleProcessed failed during reconciliation',
          })
        }
        continue
      }

      // Caso 3: Não processado -> calcular delta de moral
      const rawMoraleVal = driverCurrentMoraleMap[entry.driverId]
      const currentMorale = typeof rawMoraleVal === 'number' ? rawMoraleVal : 80
      const isWinner = entry.finalPosition === 1
      const isPodium = entry.finalPosition === 2 || entry.finalPosition === 3
      const isDnf = Boolean(entry.isDnf || entry.dnf || entry.status === 'dnf')

      const calculation = this.calculateDriverMoraleDelta({
        driverId: entry.driverId,
        teamId: entry.teamId,
        driverName: entry.driverName,
        teamName: entry.teamName,
        currentMorale,
        finishPosition: entry.finalPosition,
        gridPosition: entry.gridPosition,
        isDnf,
        dnfReason: entry.dnfReason,
        status: entry.status,
        isWinner,
        isPodium,
      })

      results.push(calculation)

      let saveSuccess = true
      let saveErrorMsg: string | undefined

      // Persistência canônica via hook ou callback
      if (onSaveDriverMorale) {
        try {
          const saveRes = await onSaveDriverMorale(entry.driverId, calculation.afterMorale, {
            beforeMorale: calculation.beforeMorale,
            delta: calculation.clampedRaceDelta,
          })
          if (saveRes === false) {
            saveSuccess = false
            saveErrorMsg = 'onSaveDriverMorale returned false'
          }
        } catch (err: any) {
          saveSuccess = false
          saveErrorMsg = err?.message || String(err)
          console.warn(
            `[DriverMoraleService] Error saving morale for driver ${entry.driverId}:`,
            err,
          )
        }
      }

      // Grava flag de persistência e idempotência SOMENTE quando a gravação foi confirmada com sucesso
      if (saveSuccess) {
        // Marca persistência confirmada primeiro com valor final calculado (protege contra duplo delta se mark falhar)
        this.markMoralePersisted({
          careerId: officialResult.careerId,
          season: officialResult.season,
          round: officialResult.round,
          sessionType: officialResult.sessionType,
          driverId: entry.driverId,
          driverAliases: aliases,
          finalMorale: calculation.afterMorale,
          delta: calculation.clampedRaceDelta,
          before: calculation.beforeMorale,
        })

        let markSuccess = true
        try {
          this.markMoraleProcessed(
            {
              careerId: officialResult.careerId,
              season: officialResult.season,
              round: officialResult.round,
              sessionType: officialResult.sessionType,
              driverId: entry.driverId,
              driverAliases: aliases,
            },
            {
              before: calculation.beforeMorale,
              after: calculation.afterMorale,
              delta: calculation.clampedRaceDelta,
              officializedAt: officialResult.officializedAt,
            },
          )
        } catch (markErr: any) {
          markSuccess = false
          console.warn(
            `[DriverMoraleService] Warning: markMoraleProcessed failed for ${entry.driverId}:`,
            markErr,
          )
        }

        if (markSuccess) {
          itemResults.push({
            driverId: entry.driverId,
            status: 'success',
            calculation,
            savedMorale: calculation.afterMorale,
          })
        } else {
          // Gravação funcionou, mas marcação falhou (Caso B) -> pendência registrada para retry
          itemResults.push({
            driverId: entry.driverId,
            status: 'failed',
            calculation,
            error: 'Save confirmed but markMoraleProcessed failed',
          })
        }
      } else {
        // Falha no save (Caso A) -> NÃO marcar como processado; permitir nova tentativa
        itemResults.push({
          driverId: entry.driverId,
          status: 'failed',
          calculation,
          error: saveErrorMsg || 'Save failed',
        })
        console.warn(
          `[DriverMoraleService] Morale processing for driver ${entry.driverId} not marked as processed due to save failure (eligible for retry).`,
        )
      }
    }

    const successCount = itemResults.filter((r) => r.status === 'success').length
    const alreadyProcessedCount = itemResults.filter((r) => r.status === 'already_processed').length
    const failedCount = itemResults.filter((r) => r.status === 'failed').length
    const totalEntries = officialResult.entries.length
    const allSucceeded = failedCount === 0

    const batchResult: DriverMoraleBatchResult = {
      allSucceeded,
      successCount,
      alreadyProcessedCount,
      failedCount,
      totalEntries,
      items: itemResults,
    }

    ;(results as any).batchResult = batchResult
    return results as DriverMoraleCalculationResult[] & { batchResult?: DriverMoraleBatchResult }
  }
}

export const driverMoraleService = new DriverMoraleService()
