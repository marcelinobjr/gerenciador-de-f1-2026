/**
 * src/services/canonicalPracticeIntegrationAdapter.ts
 *
 * Adaptador de integração para conectar o fluxo de fim de semana (WeekendV2Page,
 * practiceSessionService, RookiePracticeRequirementService) ao motor de treinos
 * versionado RACE-TL-01 (quando ativado explicitamente para carreiras de teste).
 *
 * Preserva:
 * - Carreira normal segue no motor legado sem qualquer alteração.
 * - Carreira de teste com `configVersion` registrada ativa o cálculo puro com acerto persistido.
 * - Pilotos reservas substituem exclusivamente no TL1 sem afetar contratos ou sessões futuras.
 * - Idempotência estrita: recarregar ou clicar duas vezes recupera o mesmo resultado e bônus.
 */

import { racePracticeService } from './racePracticeService'
import type {
  SessionParticipant,
  PersistedWeekendSetupState,
} from '../lib/race/practiceSessionIntegrator'

export interface PracticeSessionExecutionParams {
  careerId: string
  seasonId: string
  round: number
  sessionType: 'tp1' | 'tp2' | 'tp3'
  isSprint: boolean
  configVersion?: string // Obrigatório para ativar o motor RACE-TL-01
  participants: {
    teamId: string
    carIndex: 1 | 2
    driverId: string
    isReserve?: boolean
    consistency?: number
  }[]
  deterministicDraws?: Record<
    string,
    {
      lapVariationDraw?: number
      setupDraw?: number
      compoundDraw?: number
      forcedLaps?: number
    }
  >
}

export class CanonicalPracticeIntegrationAdapter {
  /**
   * Converte identificador de sessão interna ('tp1', 'tp2', 'tp3') para o formato da fonte ('TL1', 'TL2', 'TL3').
   */
  public static mapSessionTypeToSource(sessionType: 'tp1' | 'tp2' | 'tp3'): 'TL1' | 'TL2' | 'TL3' {
    switch (sessionType) {
      case 'tp1':
        return 'TL1'
      case 'tp2':
        return 'TL2'
      case 'tp3':
        return 'TL3'
    }
  }

  /**
   * Executa a sessão sob o motor versionado se uma versão foi informada.
   * Caso contrário, retorna null indicando que a carreira permanece no fluxo legado.
   */
  public static async executeIfVersioned(params: PracticeSessionExecutionParams): Promise<{
    persistedState: PersistedWeekendSetupState
    nextStep: ReturnType<typeof racePracticeService.getNextStep>
    isAlreadyCompleted: boolean
    results: any[]
  } | null> {
    if (!params.configVersion || params.configVersion.trim() === '') {
      return null // Carreira legada: não intervenha
    }

    const sourceSession = this.mapSessionTypeToSource(params.sessionType)

    const sessionParticipants: SessionParticipant[] = params.participants.map((p) => ({
      teamId: p.teamId,
      carIndex: p.carIndex,
      driverId: p.driverId,
      isReserve: Boolean(p.isReserve),
      consistency: p.consistency ?? 80,
    }))

    const { state, results, isAlreadyCompleted } = await racePracticeService.executeSession({
      careerId: params.careerId,
      seasonId: params.seasonId,
      round: params.round,
      session: sourceSession,
      participants: sessionParticipants,
      configVersion: params.configVersion,
      isSprint: params.isSprint,
      deterministicDraws: params.deterministicDraws,
    })

    const nextStep = racePracticeService.getNextStep(state, params.isSprint)

    return {
      persistedState: state,
      nextStep,
      isAlreadyCompleted,
      results,
    }
  }
}
