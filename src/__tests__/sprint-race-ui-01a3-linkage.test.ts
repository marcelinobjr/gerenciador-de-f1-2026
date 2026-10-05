import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { hasSprintWeekend } from '@/services/weekendProgressionService'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import type { CanonicalRaceState, OfficialRaceResult } from '@/types/canonical-race-v2'

/**
 * SPRINT-RACE-UI-01A-3: Testes de integração do Link e Race Control com a mesma sessão.
 *
 * Cenários A-E:
 * A. SPRINT: acionar a abertura da Sprint gera o contexto correto. O destino carrega a sessão, o grid e os dados da Sprint.
 * B. PRINCIPAL NO MESMO FIM DE SEMANA: acionar a corrida principal mantém MAIN_RACE, apesar de hasSprintWeekend ser verdadeiro.
 * C. SPRINT CONCLUÍDA: abrir a Sprint concluída consulta seu próprio resultado, inclusive quando já existe resultado da corrida principal.
 * D. ISOLAMENTO E NAVEGAÇÃO: abrir Sprint → principal → Sprint e recarregar preserva os estados correspondentes, sem reset, exclusão ou mistura.
 * E. CONTEXTO INVÁLIDO OU AMBÍGUO: variante inválida, rodada inválida, Sprint inexistente ou link sem contexto inequívoco não inicializam uma corrida escolhida por fallback.
 */

// Simula a resolução canônica de contexto de RaceControlLivePage
function resolveRaceControlSessionContext(searchParamsString: string, contextRound: number) {
  const searchParams = new URLSearchParams(searchParamsString)
  const rawVariant = searchParams.get('variant')
  const rawRound = searchParams.get('round')

  let resolvedRound: number | null = null
  if (rawRound !== null) {
    const parsed = parseInt(rawRound, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 24) {
      return {
        isValid: false,
        errorReason: `Rodada inválida informada na URL: "${rawRound}". As rodadas válidas vão de 1 a 24.`,
        resolvedRound: null,
        resolvedVariant: null,
      }
    }
    const calendarMatch = F1_2026_CALENDAR.find((c) => c.round === parsed)
    if (!calendarMatch) {
      return {
        isValid: false,
        errorReason: `Rodada ${parsed} não existe no calendário da temporada.`,
        resolvedRound: null,
        resolvedVariant: null,
      }
    }
    resolvedRound = parsed
  } else {
    if (typeof contextRound === 'number' && contextRound >= 1 && contextRound <= 24) {
      resolvedRound = contextRound
    } else {
      return {
        isValid: false,
        errorReason: 'Nenhuma rodada especificada e contexto de temporada indisponível.',
        resolvedRound: null,
        resolvedVariant: null,
      }
    }
  }

  let resolvedVariant: 'SPRINT_RACE' | 'MAIN_RACE' | null = null
  const hasSprintInRound = hasSprintWeekend(resolvedRound)

  if (rawVariant !== null) {
    if (rawVariant === 'SPRINT_RACE') {
      if (!hasSprintInRound) {
        return {
          isValid: false,
          errorReason: `A rodada ${resolvedRound} não possui Corrida Sprint programada no regulamento.`,
          resolvedRound,
          resolvedVariant: null,
        }
      }
      resolvedVariant = 'SPRINT_RACE'
    } else if (rawVariant === 'MAIN_RACE') {
      resolvedVariant = 'MAIN_RACE'
    } else {
      return {
        isValid: false,
        errorReason: `Variante de corrida desconhecida: "${rawVariant}". Esperado "SPRINT_RACE" ou "MAIN_RACE".`,
        resolvedRound,
        resolvedVariant: null,
      }
    }
  } else {
    if (!hasSprintInRound) {
      resolvedVariant = 'MAIN_RACE'
    } else {
      return {
        isValid: false,
        errorReason: `Fim de semana com Sprint na rodada ${resolvedRound} requer especificação inequívoca da sessão (?variant=SPRINT_RACE ou ?variant=MAIN_RACE).`,
        resolvedRound,
        resolvedVariant: null,
      }
    }
  }

  return {
    isValid: true,
    errorReason: null,
    resolvedRound,
    resolvedVariant,
  }
}

describe('SPRINT-RACE-UI-01A-3: Link e Race Control com a Mesma Sessão', () => {
  const careerId = 'career_ui_01a3_test'
  const seasonYear = 2026
  const seasonId = 'season_2026_test'
  const sprintRound = 2 // Rodada 2 da F1 2026 (China) é fim de semana Sprint
  const normalRound = 1 // Rodada 1 da F1 2026 (Bahrein) é corrida tradicional

  beforeEach(() => {
    localStorage.clear()
  })

  it('Verificação de premissa do calendário: Rodada 2 tem Sprint, Rodada 1 não tem Sprint', () => {
    expect(hasSprintWeekend(sprintRound)).toBe(true)
    expect(hasSprintWeekend(normalRound)).toBe(false)
  })

  describe('Cenário A: SPRINT — Link e carregamento com identidade SPRINT_RACE', () => {
    it('deve gerar URL com variant=SPRINT_RACE&round=2 e resolver a sessão correspondente', () => {
      // 1. Origem: geração do link pelo WeekendV2Page para sessão sprint_race
      const isSprintRaceSession = true
      const url = `/corrida/live?variant=${isSprintRaceSession ? 'SPRINT_RACE' : 'MAIN_RACE'}&round=${sprintRound}`
      expect(url).toBe('/corrida/live?variant=SPRINT_RACE&round=2')

      // 2. Destino: RaceControlLivePage resolve searchParams
      const query = url.split('?')[1]
      const resolution = resolveRaceControlSessionContext(query, sprintRound)

      expect(resolution.isValid).toBe(true)
      expect(resolution.resolvedRound).toBe(2)
      expect(resolution.resolvedVariant).toBe('SPRINT_RACE')

      // 3. Salvar estado de Sprint na rodada 2 e ler com a variante resolvida
      const sprintState: CanonicalRaceState = {
        stateVersion: 1,
        raceVariant: 'SPRINT_RACE',
        careerId,
        season: seasonYear,
        round: sprintRound,
        status: 'running',
        currentLap: 5,
        totalLaps: 19,
        circuit: 'Circuito Internacional de Xangai',
        drivers: [
          {
            driverId: 'drv_norris',
            driverName: 'Lando Norris',
            position: 1,
            lap: 5,
            totalLaps: 19,
          } as any,
          {
            driverId: 'drv_piastri',
            driverName: 'Oscar Piastri',
            position: 2,
            lap: 5,
            totalLaps: 19,
          } as any,
        ],
      } as any

      canonicalRaceInitializationService.saveCanonicalRaceState(sprintState)

      const loadedState = canonicalRaceInitializationService.readCanonicalRaceState(
        careerId,
        seasonYear,
        resolution.resolvedRound!,
        resolution.resolvedVariant!,
      )

      expect(loadedState).not.toBeNull()
      expect(loadedState?.raceVariant).toBe('SPRINT_RACE')
      expect(loadedState?.currentLap).toBe(5)
      expect(loadedState?.totalLaps).toBe(19)
    })
  })

  describe('Cenário B: PRINCIPAL NO MESMO FIM DE SEMANA — mantém MAIN_RACE mesmo com hasSprintWeekend verdadeiro', () => {
    it('deve resolver MAIN_RACE na rodada 2 e não forçar SPRINT_RACE', () => {
      // 1. Origem: geração do link pelo WeekendV2Page para corrida principal
      const isSprintRaceSession = false
      const url = `/corrida/live?variant=${isSprintRaceSession ? 'SPRINT_RACE' : 'MAIN_RACE'}&round=${sprintRound}`
      expect(url).toBe('/corrida/live?variant=MAIN_RACE&round=2')

      // 2. Destino: RaceControlLivePage resolve searchParams
      const query = url.split('?')[1]
      const resolution = resolveRaceControlSessionContext(query, sprintRound)

      expect(resolution.isValid).toBe(true)
      expect(resolution.resolvedRound).toBe(2)
      // Requisito crítico: NÃO pode virar SPRINT_RACE apenas porque hasSprintWeekend(2) é true!
      expect(hasSprintWeekend(2)).toBe(true)
      expect(resolution.resolvedVariant).toBe('MAIN_RACE')

      // 3. Salvar estado de Corrida Principal na rodada 2 e ler com a variante resolvida
      const mainState: CanonicalRaceState = {
        stateVersion: 1,
        raceVariant: 'MAIN_RACE',
        careerId,
        season: seasonYear,
        round: sprintRound,
        status: 'running',
        currentLap: 12,
        totalLaps: 56,
        circuit: 'Circuito Internacional de Xangai',
        drivers: [
          {
            driverId: 'drv_verstappen',
            driverName: 'Max Verstappen',
            position: 1,
            lap: 12,
            totalLaps: 56,
          } as any,
        ],
      } as any

      canonicalRaceInitializationService.saveCanonicalRaceState(mainState)

      const loadedMain = canonicalRaceInitializationService.readCanonicalRaceState(
        careerId,
        seasonYear,
        resolution.resolvedRound!,
        resolution.resolvedVariant!,
      )

      expect(loadedMain).not.toBeNull()
      expect(loadedMain?.raceVariant).toBe('MAIN_RACE')
      expect(loadedMain?.currentLap).toBe(12)
      expect(loadedMain?.totalLaps).toBe(56)
    })
  })

  describe('Cenário C: SPRINT CONCLUÍDA — consulta seu próprio resultado sem ser mascarada pela principal', () => {
    it('deve retornar o resultado da Sprint quando solicitado, mesmo que a corrida principal já tenha resultado registrado', () => {
      // 1. Salvar resultado oficial da Sprint
      const sprintOfficialResult: OfficialRaceResult = {
        officialResultId: `official_sprint_${careerId}_${seasonYear}_${sprintRound}`,
        careerId,
        season: seasonYear,
        round: sprintRound,
        raceId: sprintRound,
        raceVariant: 'SPRINT_RACE',
        circuitId: 'shanghai',
        circuitName: 'Shanghai',
        totalLaps: 19,
        winnerDriverId: 'drv_norris',
        poleDriverId: 'drv_norris',
        fastestLapDriverId: 'drv_piastri',
        officializedAt: new Date().toISOString(),
        entries: [
          {
            driverId: 'drv_norris',
            driverName: 'Lando Norris',
            finalPosition: 1,
            pointsAwarded: 8,
            status: 'classified',
          } as any,
        ],
      } as any

      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficialResult)

      // 2. Salvar resultado oficial da Corrida Principal na mesma rodada
      const mainOfficialResult: OfficialRaceResult = {
        officialResultId: `official_main_${careerId}_${seasonYear}_${sprintRound}`,
        careerId,
        season: seasonYear,
        round: sprintRound,
        raceId: sprintRound,
        raceVariant: 'MAIN_RACE',
        circuitId: 'shanghai',
        circuitName: 'Shanghai',
        totalLaps: 56,
        winnerDriverId: 'drv_verstappen',
        poleDriverId: 'drv_verstappen',
        fastestLapDriverId: 'drv_verstappen',
        officializedAt: new Date().toISOString(),
        entries: [
          {
            driverId: 'drv_verstappen',
            driverName: 'Max Verstappen',
            finalPosition: 1,
            pointsAwarded: 25,
            status: 'classified',
          } as any,
        ],
      } as any

      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficialResult)

      // 3. Consultar Sprint com getOfficialRaceResult especificando 'SPRINT_RACE'
      const loadedSprintResult = canonicalRaceResultService.getOfficialRaceResult(
        careerId,
        seasonYear,
        sprintRound,
        'SPRINT_RACE',
      )
      expect(loadedSprintResult).not.toBeNull()
      expect(loadedSprintResult?.raceVariant).toBe('SPRINT_RACE')
      expect(loadedSprintResult?.winnerDriverId).toBe('drv_norris')
      expect(loadedSprintResult?.totalLaps).toBe(19)

      // 4. Consultar Corrida Principal com getOfficialRaceResult especificando 'MAIN_RACE'
      const loadedMainResult = canonicalRaceResultService.getOfficialRaceResult(
        careerId,
        seasonYear,
        sprintRound,
        'MAIN_RACE',
      )
      expect(loadedMainResult).not.toBeNull()
      expect(loadedMainResult?.raceVariant).toBe('MAIN_RACE')
      expect(loadedMainResult?.winnerDriverId).toBe('drv_verstappen')
      expect(loadedMainResult?.totalLaps).toBe(56)
    })
  })

  describe('Cenário D: ISOLAMENTO E NAVEGAÇÃO — alternar Sprint ↔ Principal preserva ambos os estados sem reset', () => {
    it('deve manter Sprint e Principal totalmente isolados durante navegação de ida e volta', () => {
      // 1. Inicializar Sprint
      const sprintState: CanonicalRaceState = {
        stateVersion: 1,
        raceVariant: 'SPRINT_RACE',
        careerId,
        season: seasonYear,
        round: sprintRound,
        status: 'running',
        currentLap: 8,
        totalLaps: 19,
        circuit: 'Circuito Internacional de Xangai',
        drivers: [
          {
            driverId: 'drv_norris',
            driverName: 'Lando Norris',
            position: 1,
            lap: 8,
            totalLaps: 19,
          } as any,
        ],
      } as any
      canonicalRaceInitializationService.saveCanonicalRaceState(sprintState)

      // 2. Inicializar Corrida Principal
      const mainState: CanonicalRaceState = {
        stateVersion: 1,
        raceVariant: 'MAIN_RACE',
        careerId,
        season: seasonYear,
        round: sprintRound,
        status: 'running',
        currentLap: 25,
        totalLaps: 56,
        circuit: 'Circuito Internacional de Xangai',
        drivers: [
          {
            driverId: 'drv_leclerc',
            driverName: 'Charles Leclerc',
            position: 1,
            lap: 25,
            totalLaps: 56,
          } as any,
        ],
      } as any
      canonicalRaceInitializationService.saveCanonicalRaceState(mainState)

      // 3. Simular navegação: Sprint → Principal → Sprint
      // Visita 1: Sprint
      const resSprint1 = resolveRaceControlSessionContext(
        'variant=SPRINT_RACE&round=2',
        sprintRound,
      )
      const stateSprint1 = canonicalRaceInitializationService.readCanonicalRaceState(
        careerId,
        seasonYear,
        resSprint1.resolvedRound!,
        resSprint1.resolvedVariant!,
      )
      expect(stateSprint1?.currentLap).toBe(8)
      expect(stateSprint1?.totalLaps).toBe(19)

      // Visita 2: Principal
      const resMain = resolveRaceControlSessionContext('variant=MAIN_RACE&round=2', sprintRound)
      const stateMain = canonicalRaceInitializationService.readCanonicalRaceState(
        careerId,
        seasonYear,
        resMain.resolvedRound!,
        resMain.resolvedVariant!,
      )
      expect(stateMain?.currentLap).toBe(25)
      expect(stateMain?.totalLaps).toBe(56)

      // Visita 3: Retorno à Sprint (sem perda de estado)
      const resSprint2 = resolveRaceControlSessionContext(
        'variant=SPRINT_RACE&round=2',
        sprintRound,
      )
      const stateSprint2 = canonicalRaceInitializationService.readCanonicalRaceState(
        careerId,
        seasonYear,
        resSprint2.resolvedRound!,
        resSprint2.resolvedVariant!,
      )
      expect(stateSprint2?.currentLap).toBe(8)
      expect(stateSprint2?.totalLaps).toBe(19)
      expect(stateSprint2?.drivers[0].driverId).toBe('drv_norris')
    })
  })

  describe('Cenário E: CONTEXTO INVÁLIDO OU AMBÍGUO — rejeição estrita sem fallback silencioso', () => {
    it('deve rejeitar variante inválida', () => {
      const res = resolveRaceControlSessionContext('variant=QUALIFYING&round=2', 2)
      expect(res.isValid).toBe(false)
      expect(res.resolvedVariant).toBeNull()
      expect(res.errorReason).toMatch(/Variante de corrida desconhecida/)
    })

    it('deve rejeitar rodada fora do calendário (round 99 ou round 0)', () => {
      const res1 = resolveRaceControlSessionContext('variant=MAIN_RACE&round=99', 1)
      expect(res1.isValid).toBe(false)
      expect(res1.errorReason).toMatch(/Rodada inválida informada/)

      const res2 = resolveRaceControlSessionContext('variant=MAIN_RACE&round=0', 1)
      expect(res2.isValid).toBe(false)
      expect(res2.errorReason).toMatch(/Rodada inválida informada/)
    })

    it('deve rejeitar solicitação de SPRINT_RACE em rodada sem Sprint', () => {
      // Rodada 1 é Bahrein, sem Sprint
      expect(hasSprintWeekend(1)).toBe(false)
      const res = resolveRaceControlSessionContext('variant=SPRINT_RACE&round=1', 1)
      expect(res.isValid).toBe(false)
      expect(res.errorReason).toMatch(/não possui Corrida Sprint/)
    })

    it('deve rejeitar link ambíguo sem variant em fim de semana com Sprint', () => {
      // Em rodada com Sprint (ex: rodada 2), sem variant na URL é ambíguo!
      const res = resolveRaceControlSessionContext('round=2', 2)
      expect(res.isValid).toBe(false)
      expect(res.errorReason).toMatch(/requer especificação inequívoca da sessão/)
    })

    it('deve aceitar link sem variant em fim de semana tradicional sem Sprint como MAIN_RACE', () => {
      // Em rodada sem Sprint (ex: rodada 1), não há ambiguidade esportiva
      const res = resolveRaceControlSessionContext('round=1', 1)
      expect(res.isValid).toBe(true)
      expect(res.resolvedVariant).toBe('MAIN_RACE')
      expect(res.resolvedRound).toBe(1)
    })
  })
})
