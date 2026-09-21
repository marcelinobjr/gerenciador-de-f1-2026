import type { DriverModel } from '@/types/f1'
import type {
  RookieTl1Plan,
  RookiePlanStatus,
  RookieEligibilityCheck,
} from '@/types/rookie-practice'
import { RookiePracticeRequirementService } from '@/services/rookiePracticeRequirementService'
import { hasSprintWeekend } from '@/services/weekendProgressionService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'

const STORAGE_PREFIX_ROOKIE_PLAN = 'apex_rookie_tl1_plan_v1_'

export interface RookieRecommendationInfo {
  isRecommended: boolean
  label: 'Oportunidade para rookie' | 'Evitar' | 'Neutro'
  reason: string
  score: number // score de 0 a 100 de adequabilidade
}

export class RookieTl1PlanningService {
  /**
   * Constrói a chave composta e isolada por careerId + seasonId + teamId
   */
  public static buildPlanStorageKey(careerId: string, seasonId: string, teamId: string): string {
    const safeCareer = careerId || 'default_career'
    const safeSeason = seasonId || 'default_season'
    const safeTeam = teamId || 'default_team'
    return `${STORAGE_PREFIX_ROOKIE_PLAN}${safeCareer}_${safeSeason}_${safeTeam}`
  }

  /**
   * Retorna todos os planos de TL1 para a carreira, temporada e equipe.
   */
  public static getPlans(careerId: string, seasonId: string, teamId: string): RookieTl1Plan[] {
    if (typeof window === 'undefined' || !window.localStorage) return []
    try {
      const key = this.buildPlanStorageKey(careerId, seasonId, teamId)
      const raw = localStorage.getItem(key)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      console.warn('[RookieTl1PlanningService] Erro ao ler planos:', e)
      return []
    }
  }

  /**
   * Salva a lista de planos.
   */
  public static savePlans(
    careerId: string,
    seasonId: string,
    teamId: string,
    plans: RookieTl1Plan[],
  ): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const key = this.buildPlanStorageKey(careerId, seasonId, teamId)
      localStorage.setItem(key, JSON.stringify(plans))
    } catch (e) {
      console.warn('[RookieTl1PlanningService] Erro ao persistir planos:', e)
    }
  }

  /**
   * Retorna o plano específico de um assento (car1 ou car2) em determinada rodada.
   */
  public static getPlanForSeat(
    careerId: string,
    seasonId: string,
    teamId: string,
    round: number,
    carId: 'car1' | 'car2',
  ): RookieTl1Plan | null {
    const plans = this.getPlans(careerId, seasonId, teamId)
    return (
      plans.find(
        (p) =>
          p.round === round &&
          p.carId === carId &&
          p.careerId === (careerId || 'default_career') &&
          p.seasonId === (seasonId || 'default_season') &&
          p.teamId === (teamId || 'default_team') &&
          p.status !== 'CANCELLED',
      ) || null
    )
  }

  /**
   * Define ou atualiza o planejamento de um novato para um assento na rodada.
   * Regras:
   * - Dois novatos diferentes no mesmo GP são permitidos.
   * - O MESMO piloto nos dois carros é expressamente BLOQUEADO.
   * - Piloto deve ter <= 2 GPs F1 disputados.
   * - NÃO CONCEDE CRÉDITO regulamentar aqui. Apenas armazena com status 'PLANNED'.
   */
  public static setSeatPlan(params: {
    careerId: string
    seasonId: string
    teamId: string
    round: number
    carId: 'car1' | 'car2'
    driver: Partial<DriverModel>
    raceResults?: any[]
  }): { success: boolean; message: string; plan?: RookieTl1Plan } {
    const { careerId, seasonId, teamId, round, carId, driver, raceResults } = params
    const safeCareer = careerId || 'default_career'
    const safeSeason = seasonId || 'default_season'
    const safeTeam = teamId || 'default_team'

    if (!driver || !driver.id) {
      return { success: false, message: 'Piloto inválido para planejamento.' }
    }

    // 1. Validação de elegibilidade (<= 2 GPs de carreira)
    const eligibility = RookiePracticeRequirementService.checkDriverEligibility(driver, raceResults)
    if (!eligibility.isEligible) {
      return {
        success: false,
        message: `${driver.name || 'Piloto'} é inelegível: ${eligibility.careerGPs} GPs disputados (limite: 2).`,
      }
    }

    // 2. Validação de conflito entre os dois carros no mesmo GP
    const otherCarId: 'car1' | 'car2' = carId === 'car1' ? 'car2' : 'car1'
    const existingOtherSeatPlan = this.getPlanForSeat(
      safeCareer,
      safeSeason,
      safeTeam,
      round,
      otherCarId,
    )

    if (
      existingOtherSeatPlan &&
      existingOtherSeatPlan.driverId === driver.id &&
      existingOtherSeatPlan.status !== 'CANCELLED'
    ) {
      return {
        success: false,
        message: 'Este piloto já está planejado para o outro carro neste TL1.',
      }
    }

    // 3. Atualizar planos persistidos
    const allPlans = this.getPlans(safeCareer, safeSeason, safeTeam)
    const filtered = allPlans.filter((p) => !(p.round === round && p.carId === carId))

    const newPlan: RookieTl1Plan = {
      careerId: safeCareer,
      seasonId: safeSeason,
      teamId: safeTeam,
      round,
      carId,
      driverId: driver.id,
      driverName: driver.name || 'Piloto Novato',
      status: 'PLANNED',
      createdAt: new Date().toISOString(),
    }

    filtered.push(newPlan)
    this.savePlans(safeCareer, safeSeason, safeTeam, filtered)

    return {
      success: true,
      message: `Planejamento registrado com sucesso para o Carro ${carId === 'car1' ? 1 : 2}.`,
      plan: newPlan,
    }
  }

  /**
   * Remove o planejamento de um assento na rodada (restaura intenção de titular).
   */
  public static clearSeatPlan(
    careerId: string,
    seasonId: string,
    teamId: string,
    round: number,
    carId: 'car1' | 'car2',
  ): void {
    const safeCareer = careerId || 'default_career'
    const safeSeason = seasonId || 'default_season'
    const safeTeam = teamId || 'default_team'

    const allPlans = this.getPlans(safeCareer, safeSeason, safeTeam)
    const filtered = allPlans.filter((p) => !(p.round === round && p.carId === carId))
    this.savePlans(safeCareer, safeSeason, safeTeam, filtered)
  }

  /**
   * Revalida um plano ao abrir o GP:
   * Verifica se o piloto planejado ainda existe, se ainda é elegível (<= 2 GPs) e se não foi transferido.
   * Se inválido, NÃO substitui automaticamente: marca status como 'NEEDS_REVIEW' com o motivo.
   */
  public static validateSeatPlan(params: {
    plan: RookieTl1Plan
    availableDrivers: Partial<DriverModel>[]
    raceResults?: any[]
  }): { isValid: boolean; reason?: string; updatedPlan: RookieTl1Plan } {
    const { plan, availableDrivers, raceResults } = params
    const driver = availableDrivers.find((d) => d.id === plan.driverId)

    if (!driver) {
      const updatedPlan: RookieTl1Plan = {
        ...plan,
        status: 'NEEDS_REVIEW',
        reviewReason: 'Piloto não encontrado no plantel ou foi dispensado.',
        updatedAt: new Date().toISOString(),
      }
      return { isValid: false, reason: updatedPlan.reviewReason, updatedPlan }
    }

    const check = RookiePracticeRequirementService.checkDriverEligibility(driver, raceResults)
    if (!check.isEligible) {
      const updatedPlan: RookieTl1Plan = {
        ...plan,
        status: 'NEEDS_REVIEW',
        reviewReason: `${check.careerGPs} GPs disputados — limite rookie: 2.`,
        updatedAt: new Date().toISOString(),
      }
      return { isValid: false, reason: updatedPlan.reviewReason, updatedPlan }
    }

    const updatedPlan: RookieTl1Plan = {
      ...plan,
      driverName: driver.name || plan.driverName,
      status: plan.status === 'COMPLETED' ? 'COMPLETED' : 'PLANNED',
      reviewReason: undefined,
    }

    return { isValid: true, updatedPlan }
  }

  /**
   * Helper auditável de recomendação de oportunidade para rookie em uma rodada:
   * Fatores considerados:
   * 1. Fim de semana Sprint ou Tradicional (Sprint = penalidade na recomendação, mais pressão regulamentar)
   * 2. Complexidade/Risco do circuito (trackType urbana/muros, safety car probability, abrasividade)
   * 3. Rodadas restantes vs. obrigações pendentes da equipe
   */
  public static getRecommendationForRound(params: {
    round: number
    seasonId: string
    teamId: string
    currentRound: number
  }): RookieRecommendationInfo {
    const { round, seasonId, teamId, currentRound } = params
    const isSprint = hasSprintWeekend(round)

    let profile = null
    try {
      profile = resolveCircuitProfile({ round })
    } catch {
      profile = null
    }

    const req = RookiePracticeRequirementService.getTeamRequirement(seasonId, teamId)
    const remainingReq = req.remainingTotal // 0 a 4
    const remainingRoundsTotal = Math.max(1, 24 - currentRound + 1)

    // Se a equipe já concluiu 4 de 4, não há pressão de obrigações
    if (remainingReq === 0) {
      return {
        isRecommended: false,
        label: 'Neutro',
        reason: 'Obrigações de novatos da temporada já estão 100% cumpridas (4/4).',
        score: 40,
      }
    }

    let score = 70 // Base inicial favorável

    // Fator 1: Sprint
    if (isSprint) {
      score -= 35 // Fim de semana Sprint tem apenas 1 treino livre (TL1) antes do quali da Sprint, pressão máxima
    } else {
      score += 15 // Fim de semana com 3 treinos livres oferece recuperação ampla no TL2 e TL3
    }

    // Fator 2: Dificuldade e risco do circuito
    const isStreet =
      profile?.trackType === 'urbana' ||
      profile?.trackType === 'hibrida_urbana' ||
      round === 8 || // Monaco
      round === 5 || // Jeddah
      round === 17 || // Baku
      round === 18 // Singapura

    if (isStreet) {
      score -= 25 // Muros próximos aumentam risco de danos materiais
    }

    if (profile?.auxiliary?.safetyCarProbability && profile.auxiliary.safetyCarProbability >= 70) {
      score -= 10
    }

    // Fator 3: Urgência regulamentar (se faltam poucas rodadas e há pendências)
    const roundsUntilThis = round - currentRound
    if (roundsUntilThis >= 0 && remainingRoundsTotal <= 8 && remainingReq > 0) {
      score += 30 // Rodada preciosa para não estourar prazo da FIA
    }

    // Categorização final
    if (score >= 60) {
      let reason =
        'Recomendado: fim de semana tradicional com 3 treinos livres e baixo risco de danos.'
      if (roundsUntilThis >= 0 && remainingRoundsTotal <= 8) {
        reason =
          'Altamente recomendado: poucas rodadas restantes na temporada para cumprir as 4 cotas.'
      } else if (!isSprint && !isStreet) {
        reason =
          'Recomendado porque: fim de semana sem Sprint, muitas rodadas restantes e baixa pressão regulamentar.'
      }
      return {
        isRecommended: true,
        label: 'Oportunidade para rookie',
        reason,
        score,
      }
    }

    if (score <= 45) {
      let reason = 'Evitar: fim de semana com Sprint, apenas 1 TL antes do parque fechado.'
      if (isStreet) {
        reason =
          'Evitar: circuito urbano travado com muros próximos e alto risco de colisão para novatos.'
      }
      return {
        isRecommended: false,
        label: 'Evitar',
        reason,
        score,
      }
    }

    return {
      isRecommended: false,
      label: 'Neutro',
      reason: 'Condições intermediárias para teste de novatos.',
      score,
    }
  }

  /**
   * Resumo de contadores de novatos combinando cumprimento oficial (do serviço existente)
   * com os planos futuros registrados.
   */
  public static getPlanningSummary(careerId: string, seasonId: string, teamId: string) {
    const req = RookiePracticeRequirementService.getTeamRequirement(seasonId, teamId)
    const plans = this.getPlans(careerId, seasonId, teamId)

    const activePlans = plans.filter((p) => p.status === 'PLANNED' || p.status === 'NEEDS_REVIEW')
    const car1Planned = activePlans.filter((p) => p.carId === 'car1').length
    const car2Planned = activePlans.filter((p) => p.carId === 'car2').length

    return {
      requiredTotal: req.requiredTotal, // 4
      completedTotal: req.completedTotal, // Oficial cumprido
      remainingTotal: req.remainingTotal, // 4 - completedTotal
      plannedTotal: activePlans.length,
      car1: {
        required: req.car1.required, // 2
        completed: req.car1.completed,
        remaining: req.car1.remaining,
        planned: car1Planned,
      },
      car2: {
        required: req.car2.required, // 2
        completed: req.car2.completed,
        remaining: req.car2.remaining,
        planned: car2Planned,
      },
    }
  }
}
