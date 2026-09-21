import type { DriverModel, TeamModel } from '@/types/f1'
import { getDriverCareerStats } from '@/lib/mbj-drivers-data'
import {
  ROOKIE_MAX_CAREER_STARTS,
  ROOKIE_REQUIRED_PER_CAR,
  ROOKIE_REQUIRED_TOTAL_TEAM,
  type RookieSeatRequirement,
  type RookieTeamRequirement,
  type RookieCreditParticipationRecord,
  type RookieEligibilityCheck,
  type RookieTemporaryFP1Assignment,
} from '@/types/rookie-practice'

const STORAGE_PREFIX_REQUIREMENT = 'rookie_practice_req_v1_'
const STORAGE_PREFIX_CREDIT = 'rookie_fp1_credit_'
const STORAGE_PREFIX_ASSIGNMENT = 'rookie_fp1_assignment_'
const STORAGE_PREFIX_RIVAL_AI = 'rookie_rival_ai_schedule_v1_'

export class RookiePracticeRequirementService {
  /**
   * Chave única idempotente para registro de crédito de novato no TL1.
   */
  public static buildCreditKey(
    seasonId: string,
    round: number,
    teamId: string,
    carId: 'car1' | 'car2',
  ): string {
    return `${STORAGE_PREFIX_CREDIT}${seasonId}_${round}_${teamId}_${carId}`
  }

  /**
   * Verifica a elegibilidade canônica de um piloto como novato no TL1.
   * Definição FIA: disputou NO MÁXIMO 2 Grandes Prêmios de F1 na carreira (careerF1GrandPrixStarts <= 2).
   * Idade, overall, categoria ou função NÃO desclassificam o piloto.
   */
  public static checkDriverEligibility(
    pilot: Partial<DriverModel> | null | undefined,
    raceResults?: any[],
    seasonHistories?: any[],
  ): RookieEligibilityCheck {
    if (!pilot || !pilot.id) {
      return {
        driverId: '',
        driverName: 'Desconhecido',
        careerGPs: 0,
        isEligible: false,
        reason: 'Piloto não especificado ou inválido.',
      }
    }

    const stats = getDriverCareerStats({
      pilot: pilot as any,
      raceResults,
      seasonHistories,
    })

    const careerGPs =
      stats?.races ??
      Number((pilot as any).f1RacesCompleted ?? (pilot as any).f1_career_starts ?? 0)

    const isEligible = careerGPs <= ROOKIE_MAX_CAREER_STARTS

    return {
      driverId: pilot.id,
      driverName: pilot.name || 'Piloto',
      role: pilot.role || 'reserva',
      category: pilot.category || 'f1',
      careerGPs,
      isEligible,
      reason: isEligible
        ? `Elegível (${careerGPs} GP${careerGPs === 1 ? '' : 's'} na carreira - máx: ${ROOKIE_MAX_CAREER_STARTS}).`
        : `Inelegível: ${careerGPs} GPs disputados na carreira (máximo permitido: ${ROOKIE_MAX_CAREER_STARTS}).`,
    }
  }

  /**
   * Retorna os requisitos de novatos de uma equipe na temporada, por assento (Carro 1 e Carro 2).
   * Persistido em localStorage por seasonId + teamId.
   * Pertence ao CARRO/assento: troca de titular não reseta nem transfere.
   */
  public static getTeamRequirement(seasonId: string, teamId: string): RookieTeamRequirement {
    const defaultCar1: RookieSeatRequirement = {
      carId: 'car1',
      carNumber: 1,
      required: ROOKIE_REQUIRED_PER_CAR,
      completed: 0,
      remaining: ROOKIE_REQUIRED_PER_CAR,
      completedRounds: [],
      participatingDriverIds: [],
    }

    const defaultCar2: RookieSeatRequirement = {
      carId: 'car2',
      carNumber: 2,
      required: ROOKIE_REQUIRED_PER_CAR,
      completed: 0,
      remaining: ROOKIE_REQUIRED_PER_CAR,
      completedRounds: [],
      participatingDriverIds: [],
    }

    if (!seasonId || !teamId) {
      return {
        seasonId: seasonId || 'default',
        teamId: teamId || 'default',
        requiredTotal: ROOKIE_REQUIRED_TOTAL_TEAM,
        completedTotal: 0,
        remainingTotal: ROOKIE_REQUIRED_TOTAL_TEAM,
        car1: defaultCar1,
        car2: defaultCar2,
        isCompliant: false,
      }
    }

    try {
      const storageKey = `${STORAGE_PREFIX_REQUIREMENT}${seasonId}_${teamId}`
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as RookieTeamRequirement
        // Assegurar consistência dos cálculos
        const c1Completed = Math.min(ROOKIE_REQUIRED_PER_CAR, parsed.car1?.completed || 0)
        const c2Completed = Math.min(ROOKIE_REQUIRED_PER_CAR, parsed.car2?.completed || 0)
        const totalCompleted = c1Completed + c2Completed
        return {
          seasonId,
          teamId,
          requiredTotal: ROOKIE_REQUIRED_TOTAL_TEAM,
          completedTotal: totalCompleted,
          remainingTotal: Math.max(0, ROOKIE_REQUIRED_TOTAL_TEAM - totalCompleted),
          car1: {
            carId: 'car1',
            carNumber: 1,
            required: ROOKIE_REQUIRED_PER_CAR,
            completed: c1Completed,
            remaining: Math.max(0, ROOKIE_REQUIRED_PER_CAR - c1Completed),
            completedRounds: parsed.car1?.completedRounds || [],
            participatingDriverIds: parsed.car1?.participatingDriverIds || [],
          },
          car2: {
            carId: 'car2',
            carNumber: 2,
            required: ROOKIE_REQUIRED_PER_CAR,
            completed: c2Completed,
            remaining: Math.max(0, ROOKIE_REQUIRED_PER_CAR - c2Completed),
            completedRounds: parsed.car2?.completedRounds || [],
            participatingDriverIds: parsed.car2?.participatingDriverIds || [],
          },
          isCompliant:
            totalCompleted === ROOKIE_REQUIRED_TOTAL_TEAM && c1Completed === 2 && c2Completed === 2,
        }
      }
    } catch (e) {
      console.warn('[RookiePracticeRequirementService] Erro ao carregar requisitos:', e)
    }

    return {
      seasonId,
      teamId,
      requiredTotal: ROOKIE_REQUIRED_TOTAL_TEAM,
      completedTotal: 0,
      remainingTotal: ROOKIE_REQUIRED_TOTAL_TEAM,
      car1: defaultCar1,
      car2: defaultCar2,
      isCompliant: false,
    }
  }

  /**
   * Salva os requisitos de novatos de uma equipe.
   */
  /**
   * Helper simplificado de status regulamentar da equipe (usado em testes e UI).
   */
  public static getTeamRequirementStatus(
    seasonId: string,
    teamId: string,
    teamName?: string,
  ): {
    seasonId: string
    teamId: string
    teamName?: string
    car1Credits: number
    car2Credits: number
    totalCredits: number
    car1Remaining: number
    car2Remaining: number
    totalRemaining: number
    isCompliant: boolean
    requirement: RookieTeamRequirement
  } {
    const req = this.getTeamRequirement(seasonId, teamId)
    return {
      seasonId,
      teamId,
      teamName,
      car1Credits: req.car1.completed,
      car2Credits: req.car2.completed,
      totalCredits: req.completedTotal,
      car1Remaining: req.car1.remaining,
      car2Remaining: req.car2.remaining,
      totalRemaining: req.remainingTotal,
      isCompliant: req.isCompliant,
      requirement: req,
    }
  }

  public static saveTeamRequirement(requirement: RookieTeamRequirement): void {
    if (!requirement?.seasonId || !requirement?.teamId) return
    try {
      const storageKey = `${STORAGE_PREFIX_REQUIREMENT}${requirement.seasonId}_${requirement.teamId}`
      localStorage.setItem(storageKey, JSON.stringify(requirement))
    } catch (e) {
      console.warn('[RookiePracticeRequirementService] Erro ao salvar requisitos:', e)
    }
  }

  /**
   * Concede crédito formal e idempotente para a equipe e assento no TL1.
   * Regras:
   * - Apenas TL1 (PracticeSessionType === 'tp1')
   * - Piloto deve ter disputado <= 2 GPs
   * - Deve ter completado ao menos 1 volta válida na pista (lapsCompleted >= 1)
   * - Idempotente: se a chave rookie_fp1_credit_{seasonId}_{round}_{teamId}_{carId} já existir, não duplica.
   */
  public static grantRookieFP1Credit(params: {
    seasonId: string
    round: number
    teamId: string
    carId: 'car1' | 'car2'
    driverId: string
    driverName: string
    lapsCompleted: number
    isRookieEligible: boolean
  }): { granted: boolean; reason: string; requirement: RookieTeamRequirement } {
    const {
      seasonId,
      round,
      teamId,
      carId,
      driverId,
      driverName,
      lapsCompleted,
      isRookieEligible,
    } = params
    const requirement = this.getTeamRequirement(seasonId, teamId)

    if (!isRookieEligible) {
      return {
        granted: false,
        reason: `Piloto ${driverName} não é elegível como novato regulamentar (> 2 GPs disputados).`,
        requirement,
      }
    }

    if (lapsCompleted < 1) {
      return {
        granted: false,
        reason: `Piloto ${driverName} não completou voltas válidas de pista no TL1 (mínimo: 1 volta).`,
        requirement,
      }
    }

    const creditKey = this.buildCreditKey(seasonId, round, teamId, carId)
    const existingRaw = localStorage.getItem(creditKey)
    if (existingRaw) {
      return {
        granted: false,
        reason: `Crédito de novato para o Carro ${carId === 'car1' ? 1 : 2} já concedido nesta rodada (idempotência garantida).`,
        requirement,
      }
    }

    // Grava o registro idempotente
    const creditRecord: RookieCreditParticipationRecord = {
      creditKey,
      seasonId,
      round,
      teamId,
      carId,
      driverId,
      driverName,
      lapsCompleted,
      timestamp: new Date().toISOString(),
    }
    try {
      localStorage.setItem(creditKey, JSON.stringify(creditRecord))
    } catch (e) {
      console.warn('[RookiePracticeRequirementService] Erro ao registrar chave de crédito:', e)
    }

    // Atualiza o contador do carro correspondente (máximo 2 créditos por carro)
    const targetCarReq = carId === 'car1' ? requirement.car1 : requirement.car2
    if (!targetCarReq.completedRounds.includes(round)) {
      targetCarReq.completedRounds.push(round)
    }
    if (!targetCarReq.participatingDriverIds.includes(driverId)) {
      targetCarReq.participatingDriverIds.push(driverId)
    }
    targetCarReq.completed = Math.min(ROOKIE_REQUIRED_PER_CAR, targetCarReq.completed + 1)
    targetCarReq.remaining = Math.max(0, ROOKIE_REQUIRED_PER_CAR - targetCarReq.completed)

    requirement.completedTotal = requirement.car1.completed + requirement.car2.completed
    requirement.remainingTotal = Math.max(
      0,
      ROOKIE_REQUIRED_TOTAL_TEAM - requirement.completedTotal,
    )
    requirement.isCompliant =
      requirement.completedTotal === ROOKIE_REQUIRED_TOTAL_TEAM &&
      requirement.car1.completed === ROOKIE_REQUIRED_PER_CAR &&
      requirement.car2.completed === ROOKIE_REQUIRED_PER_CAR

    this.saveTeamRequirement(requirement)

    return {
      granted: true,
      reason: `Crédito regulamentar homologado: ${driverName} cumpriu 1 sessão obrigatória de TL1 no Carro ${carId === 'car1' ? 1 : 2}.`,
      requirement,
    }
  }

  /**
   * Armazena ou lê a escalação temporária de novato no TL1 da rodada.
   * Não altera o snapshot principal de inscrição do evento (FIA event registration).
   */
  public static getTemporaryFP1Assignment(
    seasonId: string,
    round: number,
    teamId: string,
    carId: 'car1' | 'car2',
  ): RookieTemporaryFP1Assignment | null {
    try {
      const key = `${STORAGE_PREFIX_ASSIGNMENT}${seasonId}_${round}_${teamId}_${carId}`
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as RookieTemporaryFP1Assignment) : null
    } catch (e) {
      return null
    }
  }

  public static setTemporaryFP1Assignment(assignment: RookieTemporaryFP1Assignment): void {
    try {
      const key = `${STORAGE_PREFIX_ASSIGNMENT}${assignment.seasonId}_${assignment.round}_${assignment.teamId}_${assignment.carId}`
      localStorage.setItem(key, JSON.stringify(assignment))
    } catch (e) {
      console.warn('[RookiePracticeRequirementService] Erro ao salvar escalação temporária:', e)
    }
  }

  public static clearTemporaryFP1Assignment(
    seasonId: string,
    round: number,
    teamId: string,
    carId: 'car1' | 'car2',
  ): void {
    try {
      const key = `${STORAGE_PREFIX_ASSIGNMENT}${seasonId}_${round}_${teamId}_${carId}`
      localStorage.removeItem(key)
    } catch (e) {
      console.warn('[RookiePracticeRequirementService] Erro ao limpar escalação temporária:', e)
    }
  }

  /**
   * Lista de novatos elegíveis e inelegíveis no plantel da equipe ou academia/reserva.
   */
  public static getRosterRookieOptions(
    teamDrivers: Partial<DriverModel>[],
    allDriversCatalog?: Partial<DriverModel>[],
    teamId?: string,
  ): {
    eligible: RookieEligibilityCheck[]
    ineligible: RookieEligibilityCheck[]
  } {
    // Candidatos: reservas, pilotos de academia, pilotos vinculados à equipe ou sem contrato titular em outra equipe de F1
    const pool: Partial<DriverModel>[] = []
    const seenIds = new Set<string>()

    // 1. Pilotos da própria equipe fornecidos
    teamDrivers.forEach((d) => {
      if (d && d.id && !seenIds.has(d.id)) {
        seenIds.add(d.id)
        pool.push(d)
      }
    })

    // 2. Pilotos do catálogo global (reservas, testes, academia vinculados a este teamId ou sem vínculo)
    if (allDriversCatalog && teamId) {
      allDriversCatalog.forEach((d) => {
        if (!d || !d.id || seenIds.has(d.id)) return
        const isTeamReserve = d.reserve_team_id === teamId || d.team_id === teamId
        const isAcademy = d.is_academy || (d as any).academy_origin_team_id === teamId
        const isTest = d.is_test_driver || d.role === 'reserva'
        if (isTeamReserve || isAcademy || isTest) {
          seenIds.add(d.id)
          pool.push(d)
        }
      })
    }

    const eligible: RookieEligibilityCheck[] = []
    const ineligible: RookieEligibilityCheck[] = []

    pool.forEach((driver) => {
      const check = this.checkDriverEligibility(driver)
      if (check.isEligible) {
        eligible.push(check)
      } else {
        ineligible.push(check)
      }
    })

    return { eligible, ineligible }
  }

  /**
   * Planejador da IA dos rivais:
   * Distribui 2 créditos obrigatórios por carro (total 4) de cada equipe rival ao longo das 24 etapas,
   * de forma razoável (evitando concentração excessiva nas últimas 4 etapas),
   * garantindo que cada equipe rival cumpra 4 de 4 ao longo do ano.
   */
  public static getOrGenerateRivalAISchedules(
    seasonId: string,
    rivalTeams: TeamModel[],
    allDrivers: DriverModel[],
  ): Record<
    string,
    {
      teamId: string
      teamName: string
      car1Rounds: number[] // Ex: [4, 14]
      car2Rounds: number[] // Ex: [8, 18]
      car1RookieDriverId: string
      car2RookieDriverId: string
    }
  > {
    const storageKey = `${STORAGE_PREFIX_RIVAL_AI}${seasonId}`
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        return JSON.parse(raw)
      }
    } catch (e) {
      // Ignora e gera novo plano
    }

    const scheduleMap: Record<string, any> = {}

    // Encontrar candidatos elegíveis no catálogo para cada equipe rival
    rivalTeams.forEach((rival, idx) => {
      // Distribuição razoável nas 24 etapas (ex.: rodadas 4 a 20)
      // Carro 1: uma no terço 1 (rounds 3..9) e uma no terço 2 (rounds 11..17)
      // Carro 2: uma no terço 1 (rounds 4..10) e uma no terço 3 (rounds 15..21)
      // Distribuição determinística e distribuída:
      // Carro 1: janelas R3–R9 (terço 1) e R11–R17 (terço 2)
      // Carro 2: janelas R4–R10 (terço 1) e R15–R21 (terço 3)
      // Se restarem <= 6 rodadas (urgência), força alocação nas rodadas imediatas restantes
      const round1A = 3 + (idx % 7) // 3..9
      const round1B = 11 + ((idx + 2) % 7) // 11..17
      const round2A = 4 + ((idx + 1) % 7) // 4..10
      const round2B = 15 + ((idx + 3) % 7) // 15..21

      // Identificar novatos elegíveis associados à equipe (ou no catálogo global de reservas)
      const rivalKey = ((rival as any).team_key || rival.id || '')
        .toLowerCase()
        .replace(/[-_\s]/g, '')
      const candidateRookies = allDrivers.filter((d) => {
        if (!d || !d.id) return false
        const dTeamId = (d.team_id || '').toLowerCase().replace(/[-_\s]/g, '')
        const dReserveTeamId = (d.reserve_team_id || '').toLowerCase().replace(/[-_\s]/g, '')
        const dAcademyId = ((d as any).academy_origin_team_id || '')
          .toLowerCase()
          .replace(/[-_\s]/g, '')
        const dTeamKey = ((d as any).teamKey || '').toLowerCase().replace(/[-_\s]/g, '')

        const isAffiliated =
          d.team_id === rival.id ||
          d.reserve_team_id === rival.id ||
          (d as any).academy_origin_team_id === rival.id ||
          (rivalKey &&
            (dTeamId.includes(rivalKey) ||
              dReserveTeamId.includes(rivalKey) ||
              dAcademyId.includes(rivalKey) ||
              dTeamKey.includes(rivalKey)))

        if (!isAffiliated) return false
        const isEligible = RookiePracticeRequirementService.checkDriverEligibility(d).isEligible
        return isEligible
      })

      // Se não há candidatos filiados, buscar novatos elegíveis disponíveis sem contrato de titular
      let availableRookies = [...candidateRookies]
      if (availableRookies.length < 2) {
        const unassignedRookies = allDrivers.filter((d) => {
          if (!d || !d.id || availableRookies.some((c) => c.id === d.id)) return false
          const isEligible = RookiePracticeRequirementService.checkDriverEligibility(d).isEligible
          return isEligible && d.role !== 'titular'
        })
        availableRookies = [...availableRookies, ...unassignedRookies]
      }

      // Se não houver candidato elegível real, registrar PENDING_NO_ELIGIBLE_ROOKIE (sem criar piloto fictício)
      const rookie1 = availableRookies[0]?.id || 'PENDING_NO_ELIGIBLE_ROOKIE'
      const rookie2 =
        availableRookies[1]?.id && availableRookies[1].id !== rookie1
          ? availableRookies[1].id
          : availableRookies[0]?.id || 'PENDING_NO_ELIGIBLE_ROOKIE'

      scheduleMap[rival.id] = {
        teamId: rival.id,
        teamName: rival.name,
        car1Rounds: [round1A, round1B],
        car2Rounds: [round2A, round2B],
        car1RookieDriverId: rookie1,
        car2RookieDriverId: rookie2,
      }
    })

    try {
      localStorage.setItem(storageKey, JSON.stringify(scheduleMap))
    } catch (e) {
      console.warn('[RookiePracticeRequirementService] Erro ao salvar plano IA dos rivais:', e)
    }

    return scheduleMap
  }

  /**
   * Simula o cumprimento de TL1 da IA para uma rodada concluída, concedendo créditos automáticos
   * se aquela rodada estiver no cronograma planejado da equipe rival.
   */
  /**
   * Homologa crédito rival ao fim do TL1 somente com laps >= 1, idempotente pela chave
   * rookie_fp1_credit_{season}_{round}_{team}_{car}.
   * Se candidateId for 'PENDING_NO_ELIGIBLE_ROOKIE' ou inexistente, não concede crédito nem cria piloto fictício.
   * Pode receber entradas reais da tabela de tempos do TL1 (leaderboard entries) para validar voltas reais.
   */
  /**
   * Verifica se uma equipe está em regime de urgência regulamentar (<= 6 rodadas restantes com créditos pendentes).
   */
  public static isTeamUrgent(
    seasonId: string,
    teamId: string,
    currentRound: number,
  ): { isUrgent: boolean; car1Urgent: boolean; car2Urgent: boolean; remainingRounds: number } {
    const remainingRounds = Math.max(0, 24 - currentRound + 1)
    const req = this.getTeamRequirement(seasonId, teamId)
    const car1Urgent = req.car1.remaining > 0 && remainingRounds <= 6
    const car2Urgent = req.car2.remaining > 0 && remainingRounds <= 6
    return {
      isUrgent: car1Urgent || car2Urgent,
      car1Urgent,
      car2Urgent,
      remainingRounds,
    }
  }

  /**
   * Retorna o registro auditável de um crédito concedido.
   */
  public static getCreditRecord(
    seasonId: string,
    round: number,
    teamId: string,
    carId: 'car1' | 'car2',
  ): RookieCreditParticipationRecord | null {
    try {
      const creditKey = this.buildCreditKey(seasonId, round, teamId, carId)
      const raw = localStorage.getItem(creditKey)
      return raw ? (JSON.parse(raw) as RookieCreditParticipationRecord) : null
    } catch {
      return null
    }
  }

  public static simulateRivalAICreditsForRound(
    seasonId: string,
    round: number,
    rivalTeams: TeamModel[],
    allDrivers: DriverModel[],
    leaderboardEntries?: Array<{
      driverId: string
      laps: number
      teamId?: string
      teamName?: string
      driverName?: string
      isRookie?: boolean
    }>,
  ): void {
    const schedules = this.getOrGenerateRivalAISchedules(seasonId, rivalTeams, allDrivers)

    // Mapa de voltas por driverId a partir do leaderboard real
    const leaderboardByDriver = new Map<
      string,
      { laps: number; driverName: string; teamName?: string }
    >()
    if (leaderboardEntries && leaderboardEntries.length > 0) {
      leaderboardEntries.forEach((entry) => {
        leaderboardByDriver.set(entry.driverId, {
          laps: entry.laps || 0,
          driverName: entry.driverName || '',
          teamName: entry.teamName,
        })
      })
    }

    rivalTeams.forEach((rival) => {
      const plan = schedules[rival.id]
      if (!plan) return

      // Carro 1
      if (plan.car1Rounds.includes(round)) {
        const candidateId = plan.car1RookieDriverId
        if (candidateId && candidateId !== 'PENDING_NO_ELIGIBLE_ROOKIE') {
          const lbEntry = leaderboardByDriver.get(candidateId)
          // Se houver tabela de tempos real do TL1, exigir laps >= 1
          const laps = lbEntry
            ? lbEntry.laps
            : leaderboardEntries && leaderboardEntries.length > 0
              ? 0
              : 15

          if (laps >= 1) {
            const foundDriver = allDrivers.find((d) => d.id === candidateId)
            const driverName =
              foundDriver?.name || lbEntry?.driverName || `Novato TL1 ${rival.name} C1`
            this.grantRookieFP1Credit({
              seasonId,
              round,
              teamId: rival.id,
              carId: 'car1',
              driverId: candidateId,
              driverName,
              lapsCompleted: laps,
              isRookieEligible: true,
            })
          }
        }
      }

      // Carro 2
      if (plan.car2Rounds.includes(round)) {
        const candidateId = plan.car2RookieDriverId
        if (candidateId && candidateId !== 'PENDING_NO_ELIGIBLE_ROOKIE') {
          const lbEntry = leaderboardByDriver.get(candidateId)
          // Se houver tabela de tempos real do TL1, exigir laps >= 1
          const laps = lbEntry
            ? lbEntry.laps
            : leaderboardEntries && leaderboardEntries.length > 0
              ? 0
              : 15

          if (laps >= 1) {
            const foundDriver = allDrivers.find((d) => d.id === candidateId)
            const driverName =
              foundDriver?.name || lbEntry?.driverName || `Novato TL1 ${rival.name} C2`
            this.grantRookieFP1Credit({
              seasonId,
              round,
              teamId: rival.id,
              carId: 'car2',
              driverId: candidateId,
              driverName,
              lapsCompleted: laps,
              isRookieEligible: true,
            })
          }
        }
      }
    })
  }
}

export const rookiePracticeRequirementService = RookiePracticeRequirementService
