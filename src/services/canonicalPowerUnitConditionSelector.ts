/**
 * canonicalPowerUnitConditionSelector.ts
 *
 * PU-05A2-P2b-1 — SELETOR DA CONDIÇÃO DA UNIDADE (Helper puro)
 *
 * Responsabilidades:
 * 1. HELPER PURO E DETERMINÍSTICO:
 *    Dado um participante (CanonicalRaceDriverState) e opcionalmente o contexto de referência da sessão,
 *    seleciona e retorna a condição individual (0 a 100) da Unidade de Potência vinculada.
 *
 * 2. REGRAS DO CONTRATO PU-05A2-P2b-1:
 *    (1) Sessão com vínculo individual válido usa os dados da unidade da própria sessão.
 *    (2) Se já existir condição corrente da unidade na sessão (`powerUnitCondition`), respeitar sua semântica
 *        — não restaurar a condição inicial. Se não houver `powerUnitCondition`, mas houver `powerUnitInitialCondition`,
 *        utilizar `powerUnitInitialCondition`.
 *    (3) Sessão legada (sem `powerUnitId` e sem campos de PU individual) segue o caminho anterior conforme a distinção
 *        de legado do P2a: retorna `legacyFallbackCondition` se fornecido (ou a condição agregada do participante
 *        `driver.carCondition` ou `null` caso indicado).
 *    (4) Vínculo incompleto ou inválido (ex: `powerUnitId` presente com id inválido <= 0 ou NaN, ou condição fora da faixa 0-100,
 *        ou `powerUnitId` definido mas com condição não-numérica) NÃO cai silenciosamente no legado nem assume condição 100
 *        — deve ser terminantemente rejeitado com erro explícito.
 *    (5) Sem consultar garagem, backend (PocketBase) ou localStorage.
 *    (6) Escala canônica: integridade mecânica de 0 a 100 (0% = totalmente esgotado/falha, 100% = novo).
 *        Não confundir "condição restante" com "desgaste acumulado" (wear = 100 - condition).
 *        Condição 0 é um valor válido e não pode ser tratada como falsy/ausência.
 */

import type { CanonicalRaceDriverState } from '@/types/canonical-race-v2'

export interface SelectPowerUnitConditionOptions {
  /**
   * Condição de fallback para sessões legadas onde não há vínculo individual de PU
   * (ex: driver.carCondition ou valor de referência da sessão).
   */
  legacyFallbackCondition?: number | null
}

export interface PowerUnitConditionSelectionResult {
  /**
   * Tipo da resolução realizada:
   * - 'current': obtido de powerUnitCondition (já em evolução na sessão)
   * - 'initial': obtido de powerUnitInitialCondition (largada / início de sessão)
   * - 'legacy': sessão legada sem vínculo de PU individual (usa fallback anterior)
   */
  source: 'current' | 'initial' | 'legacy'

  /**
   * Condição individual da unidade (escala 0-100), ou null se legado sem fallback.
   */
  condition: number | null

  /**
   * ID da unidade associada, ou undefined para legado.
   */
  powerUnitId?: number
}

/**
 * Validador puro de integridade numérica no intervalo [0, 100].
 * Rejeita NaN, valores infinitos e números fora da escala regulamentar.
 */
function isValidConditionValue(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val) && val >= 0 && val <= 100
}

/**
 * Validador de ID da Unidade de Potência.
 * Deve ser um inteiro estritamente positivo (PU-1, PU-2, etc.).
 */
function isValidPowerUnitId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id > 0
}

/**
 * Helper puro mínimo para selecionar a condição individual da Power Unit registrada no participante.
 *
 * @throws {Error} Caso haja vínculo incompleto, corrompido ou inválido (ex: ID inválido, condição fora de 0-100).
 */
export function selectParticipantPowerUnitCondition(
  driver: CanonicalRaceDriverState,
  options?: SelectPowerUnitConditionOptions,
): PowerUnitConditionSelectionResult {
  if (!driver) {
    throw new Error('[selectParticipantPowerUnitCondition] Participante inválido ou indefinido.')
  }

  const hasPuId = driver.powerUnitId !== undefined && driver.powerUnitId !== null
  const hasInitialCond = driver.powerUnitInitialCondition !== undefined && driver.powerUnitInitialCondition !== null
  const hasCurrentCond = driver.powerUnitCondition !== undefined && driver.powerUnitCondition !== null

  // CASO 1: Sessão com vínculo individual (powerUnitId presente ou campos de unidade presentes)
  if (hasPuId || hasInitialCond || hasCurrentCond) {
    // Regra (4): Vínculo incompleto / inválido NÃO cai silenciosamente no legado nem assume 100.
    // O ID da unidade deve ser válido (> 0, inteiro).
    if (!isValidPowerUnitId(driver.powerUnitId)) {
      throw new Error(
        `[selectParticipantPowerUnitCondition] Vínculo de Power Unit inválido para o piloto ${driver.driverId}: powerUnitId (${String(driver.powerUnitId)}) deve ser um número inteiro positivo.`,
      )
    }

    // Se houver condição corrente, ela tem prioridade (Regra 2: não restaurar condição inicial se já houver corrente)
    if (hasCurrentCond) {
      if (!isValidConditionValue(driver.powerUnitCondition)) {
        throw new Error(
          `[selectParticipantPowerUnitCondition] powerUnitCondition inválida para o piloto ${driver.driverId}: esperado número entre 0 e 100, recebido ${String(driver.powerUnitCondition)}.`,
        )
      }
      return {
        source: 'current',
        condition: driver.powerUnitCondition,
        powerUnitId: driver.powerUnitId,
      }
    }

    // Se não há corrente, deve haver condição inicial válida
    if (hasInitialCond) {
      if (!isValidConditionValue(driver.powerUnitInitialCondition)) {
        throw new Error(
          `[selectParticipantPowerUnitCondition] powerUnitInitialCondition inválida para o piloto ${driver.driverId}: esperado número entre 0 e 100, recebido ${String(driver.powerUnitInitialCondition)}.`,
        )
      }
      return {
        source: 'initial',
        condition: driver.powerUnitInitialCondition,
        powerUnitId: driver.powerUnitId,
      }
    }

    // powerUnitId informado mas sem nenhuma condição (nem corrente nem inicial): vínculo incompleto!
    throw new Error(
      `[selectParticipantPowerUnitCondition] Vínculo incompleto para o piloto ${driver.driverId}: powerUnitId=${driver.powerUnitId} informado sem powerUnitCondition ou powerUnitInitialCondition.`,
    )
  }

  // CASO 2: Sessão legada sem vínculo de PU individual (Regra 3: distinção de legado)
  let fallback: number | null = null
  if (options && options.legacyFallbackCondition !== undefined) {
    fallback = options.legacyFallbackCondition
  } else if (typeof driver.carCondition === 'number' && isValidConditionValue(driver.carCondition)) {
    fallback = driver.carCondition
  }

  if (fallback !== null && !isValidConditionValue(fallback)) {
    throw new Error(
      `[selectParticipantPowerUnitCondition] Condição legada de fallback inválida: esperado número entre 0 e 100, recebido ${String(fallback)}.`,
    )
  }

  return {
    source: 'legacy',
    condition: fallback,
    powerUnitId: undefined,
  }
}
