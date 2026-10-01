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
      // Regra de DNF (Parte F):
      // (1) DNF mecânico/técnico -> impacto 0 ou máx -1 (adotamos 0)
      // (2) DNF por erro do piloto -> -4 (-3 a -5)
      // (3) DNF sem causa confiável -> -1 (conservador)
      dnfCategory = this.categorizeDnf(input.dnfReason)
      if (dnfCategory === 'mechanical') {
        dnfDelta = 0
      } else if (dnfCategory === 'driver_error') {
        dnfDelta = -4
      } else {
        dnfDelta = -1
      }
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
   * Gera a chave única conceitual de idempotência
   */
  public getIdempotencyKey(params: {
    careerId?: string
    season: number | string
    round: number | string
    driverId: string
  }): string {
    const career = params.careerId || 'default'
    const season = params.season || 2026
    const round = params.round || 1
    return `driver_morale_${career}_${season}_${round}_${params.driverId}`
  }

  /**
   * Verifica se a corrida já foi processada para um dado piloto
   */
  public isMoraleAlreadyProcessed(params: {
    careerId?: string
    season: number | string
    round: number | string
    driverId: string
  }): boolean {
    if (typeof localStorage === 'undefined') return false
    const key = this.getIdempotencyKey(params)
    return Boolean(localStorage.getItem(key))
  }

  /**
   * Marca a corrida como processada para o piloto
   */
  public markMoraleProcessed(
    params: {
      careerId?: string
      season: number | string
      round: number | string
      driverId: string
    },
    meta?: {
      before: number
      after: number
      delta: number
      officializedAt?: string
    },
  ): void {
    if (typeof localStorage === 'undefined') return
    const key = this.getIdempotencyKey(params)
    const payload = {
      ...params,
      processedAt: new Date().toISOString(),
      ...(meta || {}),
    }
    try {
      localStorage.setItem(key, JSON.stringify(payload))
    } catch (e) {
      console.warn('[DriverMoraleService] Failed to set idempotency flag in localStorage:', e)
    }
  }

  /**
   * Processa a moral de todos os pilotos de uma corrida oficializada
   * de forma estritamente idempotente e persistente.
   */
  public async processOfficialRaceMorale(params: {
    officialResult: {
      careerId?: string
      season: number | string
      round: number | string
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
      }>
    }
    driverCurrentMoraleMap?: Record<string, number>
    onSaveDriverMorale?: (driverId: string, newMorale: number) => Promise<void>
  }): Promise<DriverMoraleCalculationResult[]> {
    const { officialResult, driverCurrentMoraleMap = {}, onSaveDriverMorale } = params
    const results: DriverMoraleCalculationResult[] = []

    for (const entry of officialResult.entries) {
      const isAlreadyDone = this.isMoraleAlreadyProcessed({
        careerId: officialResult.careerId,
        season: officialResult.season,
        round: officialResult.round,
        driverId: entry.driverId,
      })

      if (isAlreadyDone) {
        // Idempotência: não reprocessa e não incrementa novamente
        continue
      }

      const currentMorale = driverCurrentMoraleMap[entry.driverId] ?? 80
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

      // Persistência canônica via hook ou callback
      if (onSaveDriverMorale) {
        try {
          await onSaveDriverMorale(entry.driverId, calculation.afterMorale)
        } catch (err) {
          console.warn(
            `[DriverMoraleService] Error saving morale for driver ${entry.driverId}:`,
            err,
          )
        }
      }

      // Grava flag de idempotência
      this.markMoraleProcessed(
        {
          careerId: officialResult.careerId,
          season: officialResult.season,
          round: officialResult.round,
          driverId: entry.driverId,
        },
        {
          before: calculation.beforeMorale,
          after: calculation.afterMorale,
          delta: calculation.clampedRaceDelta,
          officializedAt: officialResult.officializedAt,
        },
      )
    }

    return results
  }
}

export const driverMoraleService = new DriverMoraleService()
