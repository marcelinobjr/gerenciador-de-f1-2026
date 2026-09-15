/**
 * Serviço Canônico de Aposentadoria de Pilotos (DriverRetirementService)
 * F1 Manager 2026 — Implementação Nº 8B
 *
 * Princípios Fundamentais (Regras 56 a 70):
 * 1. Aposentadoria não é fórmula linear ("if age > 36 retire").
 * 2. Estados Qualitativos: NO_THOUGHTS -> CONSIDERING -> LIKELY -> ANNOUNCED -> RETIRED.
 * 3. Considera: idade, performance atual, demanda de mercado, contratos vigentes,
 *    satisfação, ambição, reputação e assentos disponíveis.
 * 4. Piloto com contrato em vigor tem baixa probabilidade de rompimento sem forte contexto.
 * 5. Free Agent veterano sem proposta vê seu Retirement Intent subir progressivamente.
 * 6. Piloto anunciado abre vaga futura e impacta a Silly Season.
 * 7. Piloto aposentado NUNCA é deletado: status vira RETIRED, estatísticas e memórias congeladas.
 */

import pb from '@/lib/pocketbase/client'
import type { DriverModel, TeamModel } from '@/types/f1'
import type { RetirementIntentState, RetirementEvaluation } from '@/types/driver-development'

export interface RetirementTransitionResult {
  updatedDrivers: DriverModel[]
  announcedRetirements: RetirementEvaluation[]
  effectiveRetirements: RetirementEvaluation[]
  paddockNews: {
    headline: string
    details: string
    driverName: string
    driverAge: number
    type: 'announcement' | 'retirement'
  }[]
}

export class DriverRetirementService {
  /**
   * Avalia o Retirement Intent de um piloto de forma multifatorial e determinística
   */
  public evaluateDriverRetirementIntent(
    driver: DriverModel,
    currentSeasonYear: number,
    options: {
      seed?: number
      teams?: TeamModel[]
      isFreeAgent?: boolean
      recentPoints?: number
    } = {},
  ): RetirementEvaluation {
    const age = driver.age || 25
    const isAlreadyRetired =
      driver.career_status === 'retired' || driver.retirement_intent === 'RETIRED'

    if (isAlreadyRetired) {
      return {
        driverId: driver.id,
        driverName: driver.name,
        age,
        currentState: 'RETIRED',
        score: 100,
        primaryFactors: ['Carreira profissional concluída com honras'],
      }
    }

    const currentIntent = (driver.retirement_intent as RetirementIntentState) || 'NO_THOUGHTS'
    const hasContract = Boolean(
      driver.team_id && (driver.contract_end || currentSeasonYear) >= currentSeasonYear,
    )
    const contractRemainingYears = Math.max(
      0,
      (driver.contract_end || currentSeasonYear) - currentSeasonYear,
    )

    const psych = (driver as any).psychology_data || {}
    const ambition = psych.ambition || 75
    const resilience = psych.resilience || 75
    const satisfaction = psych.temporaryStates?.satisfaction || 70

    // Seed determinística por piloto e temporada
    const hash = this.hashString(`${driver.id}_ret_${currentSeasonYear}_${options.seed || 0}`)
    const rng = (offset: number) => {
      const x = Math.sin(hash + offset) * 10000
      return x - Math.floor(x)
    }

    const primaryFactors: string[] = []
    let score = 0 // 0 a 100 de propensão à aposentadoria

    // Fator 1: Idade cronológica ponderada (curva suave, sem cliff)
    if (age < 32) {
      score += 0
    } else if (age < 35) {
      score += (age - 32) * 4 // até +12
    } else if (age < 38) {
      score += 15 + (age - 35) * 8 // 15 a 39
      primaryFactors.push('Fase avançada de carreira')
    } else if (age < 41) {
      score += 40 + (age - 38) * 12 // 40 a 76
      primaryFactors.push('Veterano consagrado no grid')
    } else {
      score += 75 + Math.min(20, (age - 41) * 6) // 75 a 95
      primaryFactors.push('Longevidade histórica nas pistas')
    }

    // Fator 2: Situação de Mercado e Assento (Regra 63)
    const isFreeAgent =
      !driver.team_id || driver.career_status === 'free_agent' || options.isFreeAgent
    if (isFreeAgent && age >= 34) {
      score += 25
      primaryFactors.push('Sem vaga ativa no mercado de titulares')
    } else if (driver.role === 'reserva' && age >= 35) {
      score += 15
      primaryFactors.push('Papel secundário de piloto reserva')
    }

    // Fator 3: Performance e Competitividade atual
    const speed = driver.speed || 75
    const consistency = driver.consistency || 75
    if (speed < 76 && age >= 36) {
      score += 18
      primaryFactors.push('Queda acentuada no ritmo de classificação')
    }

    // Fator 4: Contrato vigente (Regra 62: Piloto com contrato tem menor chance de sair)
    if (hasContract && contractRemainingYears >= 1) {
      score -= Math.min(30, contractRemainingYears * 18)
      primaryFactors.push(
        `Contrato plurianual em vigência (${contractRemainingYears} ano(s) restante(s))`,
      )
    }

    // Fator 5: Psicologia e Ambição
    if (ambition > 85 && satisfaction < 40 && age >= 35) {
      score += 12
      primaryFactors.push('Frustração com falta de equipamento competitivo')
    }
    if (resilience > 85) {
      score -= 10 // Pilotos resilientes lutam mais tempo
    }

    // Variância pessoal controlada
    const personalVariance = (rng(1) - 0.5) * 14 // -7 a +7
    score = Math.max(0, Math.min(100, Math.round(score + personalVariance)))

    // Transição de Estados (Regra 56)
    let nextState: RetirementIntentState = 'NO_THOUGHTS'

    if (currentIntent === 'ANNOUNCED') {
      // Já anunciado: se o ano do contrato/temporada encerra, vira RETIRED
      if (!hasContract || contractRemainingYears === 0) {
        nextState = 'RETIRED'
        primaryFactors.push('Aposentadoria formalmente consumada')
      } else {
        nextState = 'ANNOUNCED'
        primaryFactors.push('Temporada de despedida em andamento')
      }
    } else if (score >= 82) {
      // Propensão altíssima: anuncia aposentadoria
      nextState = 'ANNOUNCED'
      primaryFactors.push('Decisão comunicada: esta é a última temporada')
    } else if (score >= 65) {
      nextState = 'LIKELY'
      primaryFactors.push('Forte inclinação a pendurar as luvas')
    } else if (score >= 42 && age >= 34) {
      nextState = 'CONSIDERING'
      primaryFactors.push('Avaliando continuidade no automobilismo')
    } else {
      nextState = 'NO_THOUGHTS'
    }

    return {
      driverId: driver.id,
      driverName: driver.name,
      age,
      currentState: nextState,
      score,
      primaryFactors,
    }
  }

  /**
   * Processa a virada anual de aposentadorias para todo o grid/banco de pilotos
   */
  public processAnnualRetirements(params: {
    drivers: DriverModel[]
    teams?: TeamModel[]
    currentSeasonYear: number
    seed?: number
  }): RetirementTransitionResult {
    const { drivers, teams, currentSeasonYear, seed } = params
    const updatedDrivers: DriverModel[] = []
    const announcedRetirements: RetirementEvaluation[] = []
    const effectiveRetirements: RetirementEvaluation[] = []
    const paddockNews: RetirementTransitionResult['paddockNews'] = []

    for (const driver of drivers) {
      const evaluation = this.evaluateDriverRetirementIntent(driver, currentSeasonYear, {
        seed,
        teams,
      })

      const prevIntent = (driver.retirement_intent as RetirementIntentState) || 'NO_THOUGHTS'
      const newIntent = evaluation.currentState

      let isUpdated = false
      const updated: DriverModel = { ...driver }

      if (newIntent !== prevIntent) {
        updated.retirement_intent = newIntent
        isUpdated = true
      }

      // 1. Piloto que acabou de ANUNCIAR aposentadoria
      if (newIntent === 'ANNOUNCED' && prevIntent !== 'ANNOUNCED') {
        announcedRetirements.push(evaluation)
        paddockNews.push({
          headline: `🏁 Despedida Anunciada: ${driver.name} confirma que este será seu último ano na F1!`,
          details: `Aos ${driver.age} anos, o piloto declarou que encerrará sua vitoriosa carreira ao fim da temporada: "${evaluation.primaryFactors.slice(0, 2).join(', ')}".`,
          driverName: driver.name,
          driverAge: driver.age,
          type: 'announcement',
        })
      }

      // 2. Piloto que efetivamente SE APOSENTOU (Regras 66 e 67: NUNCA DELETAR)
      if (newIntent === 'RETIRED' && prevIntent !== 'RETIRED') {
        effectiveRetirements.push(evaluation)
        updated.career_status = 'retired'
        updated.role = null
        updated.team_id = null
        updated.reserve_team_id = null
        updated.category = 'mercado'
        updated.salary = 0
        updated.seat_security = 0

        // Congelar registros de carreira (Regra 133)
        const stats = (driver as any).f1CareerStats ||
          (driver as any).career_records || {
            starts: (driver as any).f1RacesCompleted || 40,
            wins: 0,
            podiums: 0,
            poles: 0,
            championships: 0,
            points: 0,
          }
        updated.career_records = stats
        isUpdated = true

        paddockNews.push({
          headline: `🏁 Fim de uma Era: ${driver.name} se aposenta oficialmente do automobilismo!`,
          details: `Com uma trajetória exemplar de dedicação ao esporte, ${driver.name} pendura o capacete aos ${driver.age} anos. Seu legado permanece para sempre nos anais da categoria.`,
          driverName: driver.name,
          driverAge: driver.age,
          type: 'retirement',
        })
      }

      updatedDrivers.push(isUpdated ? updated : driver)
    }

    return {
      updatedDrivers,
      announcedRetirements,
      effectiveRetirements,
      paddockNews,
    }
  }

  private hashString(str: string): number {
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) + hash + str.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash)
  }
}

export const driverRetirementService = new DriverRetirementService()
