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
import { racePracticeSetupService, PracticeSessionId } from './racePracticeSetupService'
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

    // Sincroniza também com a persistência canônica atômica (session_setups / racePracticeSetupService)
    try {
      for (const res of results) {
        await racePracticeSetupService.processAndPersistPracticeSetup(sourceSession, {
          careerId: params.careerId,
          seasonId: params.seasonId,
          round: params.round,
          session: sourceSession,
          teamId: res.teamId,
          carIndex: res.carIndex,
          driverId: res.driverId,
          configVersion: params.configVersion,
          completedLaps: res.completedLaps,
          consistency: res.consistency,
          previousSetup: res.previousSetup,
          uniformSetupDraw: res.uniformSetupDraw,
          isSprint: params.isSprint,
        })
      }
    } catch (e) {
      console.warn(
        '[CanonicalPracticeIntegrationAdapter] Falha ao sincronizar com racePracticeSetupService:',
        e,
      )
    }

    return {
      persistedState: state,
      nextStep,
      isAlreadyCompleted,
      results,
    }
  }

  /**
   * Apura e persiste diretamente o acerto do carro/piloto após uma sessão completada na interface.
   * Utiliza o racePracticeSetupService canônico para garantir gravação em session_setups,
   * checagem de concorrência e não duplicação.
   */
  public static async persistSessionCarSetup(params: {
    careerId: string
    seasonId: string
    round: number
    sessionType: 'tp1' | 'tp2' | 'tp3'
    teamId: string
    carIndex: 1 | 2
    driverId: string
    configVersion: string
    completedLaps: number
    consistency: number
    previousSetup?: number
    uniformSetupDraw?: number
    isSprint?: boolean
  }) {
    const session = this.mapSessionTypeToSource(params.sessionType)
    return await racePracticeSetupService.processAndPersistPracticeSetup(session, {
      careerId: params.careerId,
      seasonId: params.seasonId,
      round: params.round,
      session,
      teamId: params.teamId,
      carIndex: params.carIndex,
      driverId: params.driverId,
      configVersion: params.configVersion,
      completedLaps: params.completedLaps,
      consistency: params.consistency,
      previousSetup: params.previousSetup,
      uniformSetupDraw: params.uniformSetupDraw,
      isSprint: params.isSprint,
    })
  }
}
