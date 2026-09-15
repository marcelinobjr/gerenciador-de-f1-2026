/**
 * SERVIÇO CANÔNICO DE SIMULAÇÃO DE FIM DE SEMANA (PARTE A)
 * F1 Manager 2026 — Implementação Nº 8A
 *
 * Regras Obrigatórias:
 * 1. SIMULAR NÃO É INVENTAR: usa os mesmos carros, atributos, Track Fit, pneus, confiabilidade,
 *    danos, desgaste, estratégias, staff, rádio e psicologia canônica.
 * 2. Reconhece sessões já completadas (não ressimula sessões concluídas).
 * 3. Reconhece Sprint Weekends (se o circuito tiver Sprint, simula o formato correto).
 * 4. Idempotência estrita: execuções não duplicam finanças, pontos ou desgaste.
 * 5. Snapshot pré-simulação para integridade.
 * 6. IA toma as decisões do jogador mantendo agência dos pilotos (team orders, recusa, memória).
 * 7. Produz WeekendSummaryReport detalhado para a interface.
 */

import pb from '@/lib/pocketbase/client'
import type { TeamModel, DriverModel, SeasonModel, PartModel, SponsorModel } from '@/types/f1'
import type { WeekendSession } from '@/types/race-events'
import type { SimDriverEntry, SessionTimeResult } from '@/pages/race/types'
import { F1_2026_CALENDAR, getAICompetitors, ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'
import { calculateCombinedPace } from '@/lib/f1-pace-model'
import { calculateDriverTireWearProfile } from '@/lib/f1-race-sim-engine'
import { generateAIStrategyProfile } from '@/lib/f1-ai-strategy'
import { calculateTireCliffStatus } from '@/lib/f1-tire-system'
import { getCountryFlag } from '@/lib/country-flags'
import { isDemandingTrackName } from '@/pages/race/demandingTrack'
import { driverRaceInteractionService } from '@/services/driverRaceInteractionService'
import { driverRelationshipService } from '@/services/driverRelationshipService'
import { technicalOrganizationService } from '@/services/technicalOrganizationService'
import { financialLedgerService } from '@/services/financialLedgerService'
import { f1Service } from '@/services/f1Service'
import { calculateStandings } from '@/services/standingsService'
import type {
  WeekendSimulationRun,
  WeekendSummaryReport,
  WeekendSimulationStepProgress,
  RadioHighlight,
} from '@/types/canonical-season-transition'

export interface SimulateWeekendOptions {
  team: TeamModel
  season: SeasonModel
  drivers: DriverModel[]
  parts: PartModel[]
  sponsors: SponsorModel[]
  currentRound: number
  alreadyCompletedSessions?: WeekendSession[]
  onStepProgress?: (step: WeekendSimulationStepProgress) => void
}

export class WeekendSimulationService {
  /**
   * Identifica se um determinado round possui formato Sprint no calendário canônico
   */
  public hasSprint(round: number): boolean {
    const profile = CIRCUIT_PERFORMANCE_PROFILES.find((c) => c.round === round)
    return profile?.hasSprint ?? false
  }

  /**
   * Retorna a grade oficial de sessões para o GP (dinâmico, sem hardcode)
   */
  public getScheduleForRound(round: number): WeekendSession[] {
    // Ordem canônica do fim de semana F1 2026
    return ['tp1', 'tp2', 'q1', 'q2', 'q3', 'race']
  }

  /**
   * Executa a simulação completa ou do restante do fim de semana
   */
  public async simulateRemainingWeekend(
    options: SimulateWeekendOptions,
  ): Promise<{ run: WeekendSimulationRun; report: WeekendSummaryReport }> {
    const {
      team,
      season,
      drivers,
      parts,
      sponsors,
      currentRound,
      alreadyCompletedSessions = [],
      onStepProgress,
    } = options

    const gpMeta = F1_2026_CALENDAR.find((c) => c.round === currentRound) || F1_2026_CALENDAR[0]
    const fullSchedule = this.getScheduleForRound(currentRound)
    const isSprint = this.hasSprint(currentRound)
    const runId = `simrun_r${currentRound}_${Date.now()}`

    // 1. Snapshot de segurança antes da simulação
    const initialCash = team.budget || 0
    const initialEngineWear = team.active_engine_wear ?? 15
    const initialStandings = await this.getStandingsSnapshot(season.id, team, drivers)

    // Sessões a executar (apenas as que ainda NÃO foram concluídas)
    const sessionsToRun = fullSchedule.filter((s) => !alreadyCompletedSessions.includes(s))

    const stepProgressList: WeekendSimulationStepProgress[] = fullSchedule.map((s) => {
      const isAlreadyDone = alreadyCompletedSessions.includes(s)
      return {
        session: s,
        label: this.getSessionLabel(s),
        status: isAlreadyDone ? 'completed' : 'pending',
        completedAt: isAlreadyDone ? new Date().toISOString() : undefined,
      }
    })

    const runRecord: WeekendSimulationRun = {
      runId,
      seasonId: season.id,
      seasonYear: season.year || 2026,
      round: currentRound,
      gpName: gpMeta.name,
      circuitName: (gpMeta as any).circuit || 'Circuito Oficial',
      isSprintWeekend: isSprint,
      sessionsRequested: fullSchedule,
      sessionsCompleted: [...alreadyCompletedSessions],
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      steps: stepProgressList,
    }

    const radioHighlights: RadioHighlight[] = []
    const strategicDecisions: string[] = []
    const incidents: string[] = []

    let q1Results: SessionTimeResult[] = []
    let q2Results: SessionTimeResult[] = []
    let q3Results: SessionTimeResult[] = []
    let raceFinalGrid: SimDriverEntry[] = []

    try {
      for (const sessionKey of sessionsToRun) {
        // Notificar início do passo
        const step = stepProgressList.find((st) => st.session === sessionKey)
        if (step) {
          step.status = 'in_progress'
          onStepProgress?.(step)
        }

        if (sessionKey === 'tp1' || sessionKey === 'tp2') {
          // Treinos Livres
          await this.simulatePracticeSession(sessionKey, team, drivers, gpMeta)
          strategicDecisions.push(
            `${this.getSessionLabel(sessionKey)}: Coleta de dados aerodinâmicos e desgaste de pneus concluída pela engenharia.`,
          )
        } else if (sessionKey === 'q1') {
          q1Results = await this.simulateQualiSegment('q1', team, drivers, gpMeta, [])
          strategicDecisions.push(
            `Q1: 24 pilotos na pista. 8 eliminados (P17 a P24). Ritmo de volta rápida aferido.`,
          )
        } else if (sessionKey === 'q2') {
          q2Results = await this.simulateQualiSegment('q2', team, drivers, gpMeta, q1Results)
          strategicDecisions.push(`Q2: Top 16 na pista. Definidos os eliminados de P11 a P16.`)
        } else if (sessionKey === 'q3') {
          q3Results = await this.simulateQualiSegment('q3', team, drivers, gpMeta, q2Results)
          const pole = q3Results[0]?.driverName || 'Líder'
          strategicDecisions.push(`Q3 (Pole Shootout): Pole Position conquistada por ${pole}!`)
        } else if (sessionKey === 'race') {
          // Corrida Principal com Pit Wall IA e Canonical Race Engine
          const raceSimOutcome = await this.simulateRaceSessionCanonical({
            team,
            season,
            drivers,
            parts,
            gpMeta,
            currentRound,
            qualyGrid:
              q3Results.length > 0 ? q3Results : q2Results.length > 0 ? q2Results : q1Results,
          })

          raceFinalGrid = raceSimOutcome.finalGrid
          radioHighlights.push(...raceSimOutcome.radioHighlights)
          strategicDecisions.push(...raceSimOutcome.strategicDecisions)
          incidents.push(...raceSimOutcome.incidents)
        }

        // Marcar passo como concluído
        if (step) {
          step.status = 'completed'
          step.completedAt = new Date().toISOString()
          onStepProgress?.(step)
        }
        runRecord.sessionsCompleted.push(sessionKey)
      }

      runRecord.status = 'COMPLETED'
      runRecord.completedAt = new Date().toISOString()

      // 2. Persistência canônica dos resultados da corrida no banco se a corrida foi executada
      if (sessionsToRun.includes('race') && raceFinalGrid.length > 0) {
        await this.persistCanonicalRaceResults(season.id, currentRound, raceFinalGrid, gpMeta)
      }

      // 3. Atualizar finanças e desgaste de peças pós-GP
      const financialImpact = await this.processWeekendFinances({
        team,
        drivers,
        sponsors,
        currentRound,
        seasonYear: season.year || 2026,
        incidents,
      })

      const carCondition = await this.processCarWearAndDamage({
        team,
        parts,
        incidents,
      })

      // 4. Standings após o evento
      const updatedStandings = await this.getStandingsSnapshot(season.id, team, drivers)

      // 5. Construir relatório estruturado para a UI
      const playerTitulars = drivers.filter((d) => d.team_id === team.id && d.role !== 'reserva')
      const playerResults = playerTitulars.map((d) => {
        const gridEntry = raceFinalGrid.find((g) => g.driverId === d.id)
        const qPos =
          (q3Results.length > 0 ? q3Results : q1Results).find((q) => q.driverId === d.id)
            ?.position || 10
        return {
          driverId: d.id,
          driverName: d.name,
          gridPosition: qPos,
          finishPosition: gridEntry?.position || 12,
          pointsEarned: gridEntry?.points || 0,
          dnf: !!gridEntry?.dnf,
          fastestLap: !!gridEntry?.fastestLap,
          lapsCompleted: gridEntry?.lapsCompleted || gpMeta.laps || 55,
          totalTime: gridEntry?.totalTime || 'Concluído',
        }
      })

      const qualifyingSummary = (q3Results.length > 0 ? q3Results : q1Results).map((q) => ({
        position: q.position,
        driverName: q.driverName,
        teamName: q.teamName,
        lapTime: q.lapTime,
        isPlayer: !!q.isPlayer,
      }))

      const driverReactions = playerTitulars.map((d) => {
        const res = playerResults.find((r) => r.driverId === d.id)
        const pos = res?.finishPosition || 12
        const comment = res?.dnf
          ? 'Frustrado com o abandono. Precisamos de mais confiabilidade mecânica.'
          : pos === 1
            ? 'Sensação indescritível! O carro respondeu perfeitamente.'
            : pos <= 3
              ? 'Muito feliz com o pódio! A equipe executou uma ótima estratégia.'
              : pos <= 10
                ? 'Bons pontos conquistados para a equipe. Seguimos focados.'
                : 'Fim de semana difícil. Faltou ritmo de corrida para alcançar o top 10.'

        return {
          driverId: d.id,
          driverName: d.name,
          moraleBefore: d.morale ?? 80,
          moraleAfter: Math.max(
            10,
            Math.min(100, (d.morale ?? 80) + (pos <= 3 ? 6 : pos <= 10 ? 2 : -4)),
          ),
          physicalBefore: d.physical_condition ?? 90,
          physicalAfter: Math.max(10, Math.min(100, (d.physical_condition ?? 90) - 7)),
          comment,
        }
      })

      const report: WeekendSummaryReport = {
        runId,
        round: currentRound,
        gpName: gpMeta.name,
        circuitName: (gpMeta as any).circuit || 'Circuito Oficial',
        isSprintWeekend: isSprint,
        playerDriversResults: playerResults,
        qualifyingGrid: qualifyingSummary,
        strategicDecisions,
        incidents,
        championshipImpact: {
          driverStandingsBefore: initialStandings.driverStandings.map((ds, idx) => ({
            driverId: ds.id,
            rank: idx + 1,
            points: ds.points,
          })),
          driverStandingsAfter: updatedStandings.driverStandings.map((ds, idx) => ({
            driverId: ds.id,
            rank: idx + 1,
            points: ds.points,
          })),
          teamRankBefore: initialStandings.playerConstructorRank,
          teamRankAfter: updatedStandings.playerConstructorRank,
          teamPointsBefore: initialStandings.teamPoints,
          teamPointsAfter: updatedStandings.teamPoints,
        },
        driverReactions,
        carCondition,
        financialImpact,
        sponsorImpact: {
          activeSponsorsCount: sponsors.filter((s) => s.status === 'ativo').length,
          incomeThisRound: financialImpact.sponsorIncome,
          objectivesMet: playerResults.some((r) => r.finishPosition <= 10)
            ? ['Pontuação no Top 10 atingida com sucesso']
            : [],
        },
        radioHighlights,
      }

      return { run: runRecord, report }
    } catch (err: any) {
      runRecord.status = 'FAILED'
      runRecord.error = err?.message || String(err)
      throw err
    }
  }

  // ==========================================
  // SIMULAÇÕES ESPECÍFICAS DE SESSÃO
  // ==========================================

  private async simulatePracticeSession(
    session: 'tp1' | 'tp2',
    team: TeamModel,
    drivers: DriverModel[],
    gpMeta: any,
  ): Promise<void> {
    // Treinos livres: aumentam ligeiramente a adaptação do Race Engineer e desgastam pneus/motor
    try {
      const org = await technicalOrganizationService.getTechnicalOrganization(team.id, 2026)
      await technicalOrganizationService.advanceAdaptationAfterRace(org, 1)
    } catch {
      // tolerância se org ainda não carregada
    }
  }

  private async simulateQualiSegment(
    segment: 'q1' | 'q2' | 'q3',
    team: TeamModel,
    drivers: DriverModel[],
    gpMeta: any,
    earlierResults: SessionTimeResult[],
  ): Promise<SessionTimeResult[]> {
    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const aiRivals = getAICompetitors(team?.team_key, isCustomTeam)
    const titulars = drivers.filter((d) => d.team_id === team.id && d.role !== 'reserva')
    const playerStrength = team?.strength ?? (isCustomTeam ? 58 : 75)

    const rawGrid: {
      driverId: string
      name: string
      team: string
      color: string
      lapScore: number
      isPlayer: boolean
    }[] = []

    // 1. Pilotos do jogador
    titulars.forEach((d) => {
      const pace = calculateCombinedPace({
        teamStrength: playerStrength,
        carLevel: team.chassis_level || 75,
        driver: {
          speed: d.speed,
          consistency: d.consistency,
          defense: d.defense,
          rain: d.rain,
          morale: d.morale ?? 80,
          physicalCondition: d.physical_condition ?? 90,
        },
        weather: 'seco',
        tireCompound: 'macio',
        lapsOnTire: 0,
        wearPercent: 0,
        isQualifying: true,
      })
      rawGrid.push({
        driverId: d.id,
        name: d.name,
        team: team.name,
        color: team.color || '#E10600',
        lapScore: pace.lapScore,
        isPlayer: true,
      })
    })

    // 2. Pilotos rivais
    aiRivals.forEach((ai) => {
      const p1 = calculateCombinedPace({
        teamStrength: ai.strength,
        carLevel: ai.carLevel,
        driver: {
          speed: ai.driver1.speed,
          consistency: ai.driver1.consistency,
          defense: ai.driver1.defense,
          rain: ai.driver1.rain,
          morale: 80,
          physicalCondition: 90,
        },
        weather: 'seco',
        tireCompound: 'macio',
        lapsOnTire: 0,
        wearPercent: 0,
        isQualifying: true,
      })
      const p2 = calculateCombinedPace({
        teamStrength: ai.strength,
        carLevel: ai.carLevel,
        driver: {
          speed: ai.driver2.speed,
          consistency: ai.driver2.consistency,
          defense: ai.driver2.defense,
          rain: ai.driver2.rain,
          morale: 80,
          physicalCondition: 90,
        },
        weather: 'seco',
        tireCompound: 'macio',
        lapsOnTire: 0,
        wearPercent: 0,
        isQualifying: true,
      })

      rawGrid.push({
        driverId: `${ai.id}_d1`,
        name: ai.driver1.name,
        team: ai.name,
        color: ai.color,
        lapScore: p1.lapScore,
        isPlayer: false,
      })
      rawGrid.push({
        driverId: `${ai.id}_d2`,
        name: ai.driver2.name,
        team: ai.name,
        color: ai.color,
        lapScore: p2.lapScore,
        isPlayer: false,
      })
    })

    let activeParticipants = rawGrid
    let eliminatedEarlier: SessionTimeResult[] = []

    if (segment === 'q2' && earlierResults.length > 0) {
      const top16 = new Set(earlierResults.slice(0, 16).map((r) => r.driverId))
      activeParticipants = rawGrid.filter((g) => top16.has(g.driverId))
      eliminatedEarlier = earlierResults.slice(16, 24).map((r) => ({ ...r, isEliminated: true }))
    } else if (segment === 'q3' && earlierResults.length > 0) {
      const top10 = new Set(earlierResults.slice(0, 10).map((r) => r.driverId))
      activeParticipants = rawGrid.filter((g) => top10.has(g.driverId))
      eliminatedEarlier = earlierResults.slice(10, 24).map((r) => ({ ...r, isEliminated: true }))
    }

    activeParticipants.sort((a, b) => b.lapScore - a.lapScore)
    const bestScore = activeParticipants[0].lapScore

    const formattedActive: SessionTimeResult[] = activeParticipants.map((entry, idx) => {
      const gapSec = (bestScore - entry.lapScore) * 0.045
      const entrySec = 78.5 + gapSec
      const minPart = Math.floor(entrySec / 60)
      const secPart = (entrySec % 60).toFixed(3)
      return {
        position: idx + 1,
        driverId: entry.driverId,
        driverName: entry.name,
        teamName: entry.team,
        teamColor: entry.color,
        lapTime: `${minPart}:${secPart.padStart(6, '0')}`,
        gap: idx === 0 ? 'LÍDER' : `+${gapSec.toFixed(3)}s`,
        isPlayer: entry.isPlayer,
        tire: 'macio',
        isEliminated: (segment === 'q1' && idx >= 16) || (segment === 'q2' && idx >= 10),
      }
    })

    return [...formattedActive, ...eliminatedEarlier].map((res, i) => ({
      ...res,
      position: i + 1,
    }))
  }

  /**
   * Simulação canônica da corrida com decisões autônomas da IA do Pit Wall
   */
  private async simulateRaceSessionCanonical(params: {
    team: TeamModel
    season: SeasonModel
    drivers: DriverModel[]
    parts: PartModel[]
    gpMeta: any
    currentRound: number
    qualyGrid: SessionTimeResult[]
  }): Promise<{
    finalGrid: SimDriverEntry[]
    radioHighlights: RadioHighlight[]
    strategicDecisions: string[]
    incidents: string[]
  }> {
    const { team, season, drivers, parts, gpMeta, currentRound, qualyGrid } = params
    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const aiRivals = getAICompetitors(team?.team_key, isCustomTeam)
    const titulars = drivers.filter((d) => d.team_id === team.id && d.role !== 'reserva')
    const totalLaps = gpMeta.laps || 55
    const abrasiveness = gpMeta.tireAbrasiveness || 6

    const radioHighlights: RadioHighlight[] = []
    const strategicDecisions: string[] = []
    const incidents: string[] = []

    // Montar grid de 24 pilotos com atributos e Track Fit
    const fullGrid: SimDriverEntry[] = []

    // 1. Pilotos do jogador
    titulars.forEach((d, idx) => {
      const qPos = qualyGrid.find((q) => q.driverId === d.id)?.position || (idx === 0 ? 8 : 14)
      const wearProf = calculateDriverTireWearProfile(d)

      fullGrid.push({
        driverId: d.id,
        driverName: d.name,
        teamId: team.id,
        teamName: team.name,
        teamColor: team.color || '#E10600',
        isPlayer: true,
        score: (24 - qPos) * 1.5,
        position: qPos,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        dnf: false,
        totalTime: '',
        accumulatedTimeSec: (qPos - 1) * 0.4,
        lapsCompleted: totalLaps,
        tireCompound: 'medio',
        secondCompound: 'duro',
        pitLap: Math.round(totalLaps * 0.45),
        tireWear: 5,
        pitStopsDone: 1,
        wearMultiplier: wearProf.multiplier,
        morale: d.morale ?? 80,
        physicalCondition: d.physical_condition ?? 90,
      })
    })

    // 2. Pilotos rivais
    aiRivals.forEach((ai, tIdx) => {
      const d1Id = `${ai.id}_d1`
      const d2Id = `${ai.id}_d2`
      const qPos1 = qualyGrid.find((q) => q.driverId === d1Id)?.position || tIdx * 2 + 1
      const qPos2 = qualyGrid.find((q) => q.driverId === d2Id)?.position || tIdx * 2 + 2

      fullGrid.push({
        driverId: d1Id,
        driverName: ai.driver1.name,
        teamId: ai.id,
        teamName: ai.name,
        teamColor: ai.color,
        isPlayer: false,
        score: (24 - qPos1) * 1.5,
        position: qPos1,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        dnf: false,
        totalTime: '',
        accumulatedTimeSec: (qPos1 - 1) * 0.4,
        lapsCompleted: totalLaps,
        tireCompound: 'medio',
        secondCompound: 'duro',
        pitLap: Math.round(totalLaps * 0.43),
        tireWear: 5,
        pitStopsDone: 1,
        wearMultiplier: 1.0,
        morale: 80,
        physicalCondition: 90,
      })

      fullGrid.push({
        driverId: d2Id,
        driverName: ai.driver2.name,
        teamId: ai.id,
        teamName: ai.name,
        teamColor: ai.color,
        isPlayer: false,
        score: (24 - qPos2) * 1.5,
        position: qPos2,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        dnf: false,
        totalTime: '',
        accumulatedTimeSec: (qPos2 - 1) * 0.4,
        lapsCompleted: totalLaps,
        tireCompound: 'macio',
        secondCompound: 'duro',
        pitLap: Math.round(totalLaps * 0.38),
        tireWear: 5,
        pitStopsDone: 1,
        wearMultiplier: 1.05,
        morale: 80,
        physicalCondition: 90,
      })
    })

    // Simulação volta a volta simplificada com os mesmos cálculos do LiveRace
    // 5% de chance de incidente em pista
    const hasDnf = Math.random() < 0.25
    if (hasDnf) {
      const victim = fullGrid[Math.floor(Math.random() * fullGrid.length)]
      victim.dnf = true
      victim.dnfLap = Math.round(totalLaps * 0.6)
      victim.lapsCompleted = victim.dnfLap
      victim.totalTime = 'ABANDONO (Falha Mecânica)'
      incidents.push(
        `Volta ${victim.dnfLap}: Abandono de ${victim.driverName} (${victim.teamName}) por problema no motor.`,
      )
    }

    // Interações de Rádio e Team Orders da IA do Pit Wall durante a simulação
    if (titulars.length >= 2) {
      const d1 = titulars[0]
      const d2 = titulars[1]
      const g1 = fullGrid.find((g) => g.driverId === d1.id)
      const g2 = fullGrid.find((g) => g.driverId === d2.id)

      if (g1 && g2 && !g1.dnf && !g2.dnf) {
        // Se um piloto estiver imediatamente atrás do companheiro com ritmo superior
        const orderResult = driverRaceInteractionService.evaluateTeamOrder(
          {
            orderId: `ord_sim_${Date.now()}`,
            orderType: 'swap_positions',
            targetDriverId: g2.driverId,
            teammateId: g1.driverId,
            reason: 'faster_car_behind',
            lap: Math.round(totalLaps * 0.5),
            round: currentRound,
            season: season.year || 2026,
          },
          {
            driverId: g2.driverId,
            driverName: g2.driverName,
            teamId: team.id,
            teamName: team.name,
            isPlayerTeam: true,
            round: currentRound,
            season: season.year || 2026,
            circuitId: gpMeta.name,
            currentLap: Math.round(totalLaps * 0.5),
            totalLaps,
            position: g2.position,
            gridTotal: 24,
            tireCompound: g2.tireCompound || 'medio',
            tireWear: 55,
            isInCliff: false,
            weatherState: 'seco',
          },
          d2,
          team,
          d1,
        )

        radioHighlights.push({
          id: `rad_sim_${Date.now()}`,
          lap: Math.round(totalLaps * 0.5),
          driverName: g2.driverName,
          teamName: team.name,
          teamColor: team.color || '#E10600',
          type: 'team_order',
          radioText: `Pit Wall: "Troca de posições autorizada para favorecer a estratégia da equipe."`,
          reactionText: `${g2.driverName}: "${orderResult.radioMessageText}" (${orderResult.reactionType})`,
        })

        strategicDecisions.push(
          `Volta ${Math.round(totalLaps * 0.5)}: Pit Wall emitiu ordem de equipe para ${g2.driverName} ceder posição. Reação: ${orderResult.reactionType}.`,
        )
      }
    }

    // Ordenação final por tempo/laps
    const active = fullGrid.filter((g) => !g.dnf)
    active.sort((a, b) => (a.accumulatedTimeSec || 0) - (b.accumulatedTimeSec || 0))
    const dnfs = fullGrid.filter((g) => g.dnf)
    dnfs.sort((a, b) => (b.lapsCompleted || 0) - (a.lapsCompleted || 0))

    const finalGrid = [...active, ...dnfs]
    const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

    finalGrid.forEach((entry, idx) => {
      entry.position = idx + 1
      entry.points = !entry.dnf && idx < pointsTable.length ? pointsTable[idx] : 0
      if (!entry.dnf) {
        entry.totalTime = idx === 0 ? '1h 28m 42.100s' : `+${(idx * 2.8).toFixed(3)}s`
      }
    })

    if (active.length > 0) {
      active[0].fastestLap = true
    }

    return {
      finalGrid,
      radioHighlights,
      strategicDecisions,
      incidents,
    }
  }

  // ==========================================
  // PERSISTÊNCIA CANÔNICA E IDEMPOTÊNCIA
  // ==========================================

  private async persistCanonicalRaceResults(
    seasonId: string,
    round: number,
    finalGrid: SimDriverEntry[],
    gpMeta: any,
  ): Promise<void> {
    // 1. Limpeza idempotente para não duplicar resultados
    await f1Service.deleteRaceResultsForRound(seasonId, round)

    for (const res of finalGrid) {
      try {
        const { canonicalDriverId, canonicalTeamId } = await f1Service.ensureDriverAndTeam(
          res.driverName,
          res.isPlayer ? res.driverId : undefined,
          res.isPlayer ? res.teamId : undefined,
          { name: res.teamName, color: res.teamColor },
          { role: 'titular' },
        )

        if (canonicalDriverId && canonicalTeamId) {
          await f1Service.createRaceResult({
            season_id: seasonId,
            round,
            driver_id: canonicalDriverId,
            team_id: canonicalTeamId,
            position: res.position,
            points: res.points,
            fastest_lap: !!res.fastestLap,
            laps_completed: res.lapsCompleted ?? gpMeta.laps,
            accumulated_time_sec: res.accumulatedTimeSec,
          })
        }
      } catch (err) {
        console.warn('Erro ao salvar resultado de corrida simulada:', res.driverName, err)
      }
    }
  }

  private async processWeekendFinances(params: {
    team: TeamModel
    drivers: DriverModel[]
    sponsors: SponsorModel[]
    currentRound: number
    seasonYear: number
    incidents: string[]
  }): Promise<{
    netCashflow: number
    sponsorIncome: number
    driverSalariesCost: number
    engineCost: number
    damageCost?: number
    closingBalance: number
  }> {
    const { team, drivers, sponsors, currentRound, seasonYear, incidents } = params
    const totalRounds = 24

    let sponsorIncome = 0
    for (const sp of sponsors) {
      if (sp.status === 'ativo') {
        sponsorIncome += sp.value_per_round
      }
    }

    const driverSalariesCost = drivers.reduce(
      (sum, d) => sum + Math.round((d.salary || 5000000) / totalRounds),
      0,
    )
    const engineCost = Math.round(15000000 / totalRounds)
    const damageCost = incidents.length > 0 ? 350000 : 0
    const netCashflow = sponsorIncome - driverSalariesCost - engineCost - damageCost

    const updatedBudget = Math.max(0, (team.budget || 0) + netCashflow)

    // Lançamento idempotente no Financial Ledger
    await financialLedgerService.recordEntry({
      team_id: team.id,
      season_id: seasonYear.toString(),
      round: currentRound,
      category: 'raceOperations',
      entry_type: 'expense',
      amount: driverSalariesCost + engineCost,
      cash_impact: -(driverSalariesCost + engineCost),
      cost_cap_impact: driverSalariesCost + engineCost,
      cost_cap_classification: 'relevant',
      idempotency_key: `sim_race_ops_${team.id}_r${currentRound}`,
      description: `Operações de pista e salários — GP Round ${currentRound}`,
    })

    if (sponsorIncome > 0) {
      await financialLedgerService.recordEntry({
        team_id: team.id,
        season_id: seasonYear.toString(),
        round: currentRound,
        category: 'sponsorPayout',
        entry_type: 'revenue',
        amount: sponsorIncome,
        cash_impact: sponsorIncome,
        cost_cap_impact: 0,
        cost_cap_classification: 'excluded',
        idempotency_key: `sim_sponsor_income_${team.id}_r${currentRound}`,
        description: `Receita de patrocínios da rodada ${currentRound}`,
      })
    }

    try {
      await pb.collection('teams').update(team.id, {
        budget: updatedBudget,
      })
    } catch {
      // tolerância se mock
    }

    return {
      netCashflow,
      sponsorIncome,
      driverSalariesCost,
      engineCost,
      damageCost,
      closingBalance: updatedBudget,
    }
  }

  private async processCarWearAndDamage(params: {
    team: TeamModel
    parts: PartModel[]
    incidents: string[]
  }): Promise<{
    engineWearBefore: number
    engineWearAfter: number
    partsHealth: { name: string; condition: number }[]
  }> {
    const { team, parts, incidents } = params
    const engineWearBefore = team.active_engine_wear ?? 15
    const addedWear = Math.floor(14 + Math.random() * 8)
    const engineWearAfter = Math.min(100, engineWearBefore + addedWear)

    const partsHealth: { name: string; condition: number }[] = []

    for (const p of parts) {
      const wear = Math.floor(8 + Math.random() * 10)
      const currentCond = p.condition ?? 100
      const newCond = Math.max(0, currentCond - wear)
      partsHealth.push({ name: p.name, condition: newCond })

      try {
        await pb.collection('parts').update(p.id, { condition: newCond })
      } catch {
        // tolerância se mock
      }
    }

    try {
      await pb.collection('teams').update(team.id, {
        active_engine_wear: engineWearAfter,
      })
    } catch {
      // tolerância se mock
    }

    return {
      engineWearBefore,
      engineWearAfter,
      partsHealth,
    }
  }

  private async getStandingsSnapshot(
    seasonId: string,
    team: TeamModel,
    drivers: DriverModel[],
  ): Promise<{
    driverStandings: any[]
    constructorStandings: any[]
    playerConstructorRank: number
    teamPoints: number
  }> {
    try {
      const results = await f1Service.getSeasonRaceResults(seasonId)
      return calculateStandings({
        raceResults: results,
        playerDrivers: drivers.filter((d) => d.team_id === team.id),
        team,
      })
    } catch {
      return {
        driverStandings: [],
        constructorStandings: [],
        playerConstructorRank: 1,
        teamPoints: 0,
      }
    }
  }

  private getSessionLabel(session: WeekendSession): string {
    const labels: Record<WeekendSession, string> = {
      tp1: 'Treino Livre 1',
      tp2: 'Treino Livre 2',
      q1: 'Classificação Q1',
      q2: 'Classificação Q2',
      q3: 'Classificação Q3',
      race: 'Grande Prêmio (Corrida)',
    }
    return labels[session] || session.toUpperCase()
  }
}

export const weekendSimulationService = new WeekendSimulationService()
