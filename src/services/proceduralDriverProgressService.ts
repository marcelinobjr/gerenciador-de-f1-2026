/**
 * Serviço de Progressão, Desenvolvimento e Categorias de Base (ProceduralDriverProgressService)
 * F1 Manager 2026 — Implementação Nº 4C
 *
 * Princípios Invioláveis:
 * 1. PROIBIDO +1 FIXO: "Academy Level 4 = +4 pontos por temporada" é expressamente vetado.
 * 2. Dinâmica Não-Linear: velocidades diferentes, platôs, estagnação, surtos de evolução e declínio futuro.
 * 3. Potencial Não é Destino: ter truePotential alto não garante chegada se faltar tempo de pista ou oportunidade.
 * 4. Fatores de Desenvolvimento:
 *    - Idade & Curva de Crescimento
 *    - truePotential (teto oculto)
 *    - talentDevelopmentCapacity & academySupportQuality (via InfrastructureCapabilityService)
 *    - Manager talentDevelopment modifier (via ManagerEffectService)
 *    - Quilometragem de pista e testes executados
 *    - Nível da categoria de base (F4 -> FRECA -> F3 -> F2)
 * 5. Abstração de Categorias de Base: gera resultados de temporada coerentes sem simular volta a volta.
 */

import {
  ProceduralDriverMetadata,
  CareerSeasonHistory,
  JuniorCategory,
} from '@/types/procedural-driver'
import { DriverModel, TeamModel } from '@/types/f1'
import { infrastructureCapabilityService } from './infrastructureCapabilityService'

export interface SeasonProgressionResult {
  updatedDriver: DriverModel
  updatedMetadata: ProceduralDriverMetadata
  gainsSummary: {
    speedDelta: number
    consistencyDelta: number
    rainDelta: number
    defenseDelta: number
    feedbackDelta: number
  }
  seasonReport: CareerSeasonHistory
  evolutionNarrative: string
}

export class ProceduralDriverProgressService {
  /**
   * Simula o progresso e temporada de um piloto na base / academia
   */
  public advanceSeasonForJuniorDriver(
    driver: DriverModel,
    team: TeamModel | null | undefined,
    currentYear: number = 2026,
  ): SeasonProgressionResult {
    const meta = (driver as any).procedural_data as ProceduralDriverMetadata | undefined
    const age = (driver.age || 18) + 1 // envelhece 1 ano

    // Capacidades de infraestrutura da equipe se estiver vinculado
    let talentDevCap = 45
    let academySupport = 40
    let managerTalentMod = 0

    if (team && (driver.team_id === team.id || meta?.currentAcademyTeamId === team.id)) {
      const audit = infrastructureCapabilityService.auditInfrastructure(team)
      talentDevCap = audit.capabilities.talentDevelopmentCapacity
      academySupport = audit.capabilities.academySupportQuality
      managerTalentMod = audit.managerTalentModifier
    }

    const truePot = meta?.truePotential || (driver as any).true_potential || 75
    const currentSpeed = driver.speed || 60
    const currentConsistency = driver.consistency || 60
    const currentRain = driver.rain || 60
    const currentDefense = driver.defense || 60
    const currentFeedback = driver.technical_feedback || 60

    // Curva por idade:
    // 15-18 anos: fase de aprendizado rápido
    // 19-22 anos: consolidação e refinamento técnico
    // 23-26 anos: aproximação do auge
    // 27-31 anos: auge / platô
    // 32+ anos: desaceleração ou declínio eventual
    let ageMultiplier = 1.0
    if (age <= 18) ageMultiplier = 1.35
    else if (age <= 21) ageMultiplier = 1.15
    else if (age <= 25) ageMultiplier = 0.95
    else if (age <= 29) ageMultiplier = 0.65
    else ageMultiplier = 0.2

    // Distância até o teto real
    const headroom = Math.max(0, truePot - currentSpeed)

    // Fator de desenvolvimento da academia (0.5 a 1.4)
    // Academy Nível 1 (~35) vs Nível 5 (~95)
    const facilityFactor = 0.6 + (talentDevCap / 100) * 0.6 + (academySupport / 100) * 0.2
    const managerFactor = 1 + managerTalentMod

    // Dinâmica com platôs e surtos orgânicos (Regra de Ouro)
    const rollEvent = Math.random()
    let breakthroughFactor = 1.0

    if (rollEvent < 0.12 && headroom > 4) {
      // 12% Surto de evolução (Breakthrough season)
      breakthroughFactor = 1.6
    } else if (rollEvent > 0.85) {
      // 15% Platô / Temporada difícil de adaptação
      breakthroughFactor = 0.45
    }

    // Ganho de Velocidade não-linear
    const rawSpeedGain =
      (headroom * 0.18 + Math.random() * 1.5) *
      ageMultiplier *
      facilityFactor *
      managerFactor *
      breakthroughFactor

    const speedDelta = Math.min(6, Math.max(0, Math.round(rawSpeedGain)))
    const consistencyDelta = Math.min(
      5,
      Math.max(0, Math.round((headroom * 0.14 + Math.random() * 1.2) * facilityFactor)),
    )
    const rainDelta = Math.min(4, Math.max(0, Math.round(Math.random() * 2.2 * ageMultiplier)))
    const defenseDelta = Math.min(4, Math.max(0, Math.round(Math.random() * 2.0 * ageMultiplier)))
    const feedbackDelta = Math.min(
      5,
      Math.max(0, Math.round(1 + (talentDevCap > 70 ? 1 : 0) + (managerTalentMod > 0.04 ? 1 : 0))),
    )

    const newSpeed = Math.min(truePot, currentSpeed + speedDelta)
    const newConsistency = Math.min(truePot, currentConsistency + consistencyDelta)
    const newRain = Math.min(95, currentRain + rainDelta)
    const newDefense = Math.min(95, currentDefense + defenseDelta)
    const newFeedback = Math.min(95, currentFeedback + feedbackDelta)

    // Simulação dos Resultados da Temporada na categoria atual
    const cat = meta?.juniorCategory || 'f4'
    const overallSkill = (newSpeed + newConsistency) / 2

    // Posição no campeonato coerente com habilidade + variância
    let targetPos = 1
    if (overallSkill > 78) targetPos = Math.floor(Math.random() * 3) + 1
    else if (overallSkill > 72) targetPos = Math.floor(Math.random() * 6) + 2
    else if (overallSkill > 66) targetPos = Math.floor(Math.random() * 8) + 4
    else targetPos = Math.floor(Math.random() * 10) + 8

    const races = cat === 'karting' ? 12 : cat === 'f4' ? 18 : 24
    const wins =
      targetPos === 1
        ? Math.floor(Math.random() * 5) + 3
        : targetPos <= 3
          ? Math.floor(Math.random() * 3) + 1
          : 0
    const podiums = Math.max(
      wins,
      targetPos <= 3 ? Math.floor(Math.random() * 6) + 4 : Math.floor(Math.random() * 3),
    )
    const poles = wins > 0 ? Math.floor(Math.random() * wins) + 1 : 0
    const points = Math.max(10, Math.round(podiums * 20 + (races - targetPos) * 5))

    const seasonHistory: CareerSeasonHistory = {
      year: currentYear,
      category: cat,
      teamName: meta?.currentAcademyTeamId ? `${team?.name || 'Academia'} Junior` : 'Independente',
      championshipPosition: targetPos,
      races,
      wins,
      podiums,
      poles,
      points,
      bestFinish: wins > 0 ? 1 : Math.min(targetPos, 3),
      notes:
        targetPos === 1
          ? 'Campeão da categoria!'
          : targetPos <= 3
            ? 'Disputou o título até o final'
            : 'Temporada de aprendizado',
    }

    // Possível promoção de categoria de base ao final do ano
    let nextCategory: JuniorCategory = cat
    if (targetPos <= 3 || age >= 18) {
      if (cat === 'karting') nextCategory = 'f4'
      else if (cat === 'f4') nextCategory = 'regional'
      else if (cat === 'regional') nextCategory = 'f3'
      else if (cat === 'f3' && targetPos <= 5) nextCategory = 'f2'
    }

    let narrative = `${driver.name} completou a temporada da ${cat.toUpperCase()} em ${targetPos}º lugar.`
    if (breakthroughFactor > 1.2) {
      narrative += ` Apresentou um salto técnico notável (+${speedDelta} ritmo)!`
    } else if (breakthroughFactor < 0.6) {
      narrative += ' Enfrentou um período de estagnação e adaptação difícil.'
    } else {
      narrative += ` Evolução consistente com o plano de desenvolvimento (+${speedDelta} ritmo, +${consistencyDelta} consistência).`
    }

    const updatedMetadata: ProceduralDriverMetadata = {
      ...(meta || ({} as any)),
      driverId: driver.id,
      juniorCategory: nextCategory,
      seasonsHistory: [seasonHistory, ...(meta?.seasonsHistory || [])],
      milestones: [
        ...(meta?.milestones || []),
        {
          date: `${currentYear}-11-20`,
          type: 'promocao_categoria',
          teamName: team?.name || 'Base',
          description: `Concluiu o ano em ${targetPos}º na ${cat.toUpperCase()}. Categoria seguinte: ${nextCategory.toUpperCase()}.`,
        },
      ],
    }

    const updatedDriver: DriverModel = {
      ...driver,
      age,
      speed: newSpeed,
      consistency: newConsistency,
      rain: newRain,
      defense: newDefense,
      technical_feedback: newFeedback,
      superlicense_points:
        (driver.superlicense_points || 0) + (targetPos === 1 ? 12 : targetPos <= 3 ? 8 : 4),
      category: nextCategory === 'f2' ? 'f2' : driver.category || 'mercado',
      ...({
        procedural_data: updatedMetadata,
      } as any),
    }

    return {
      updatedDriver,
      updatedMetadata,
      gainsSummary: {
        speedDelta,
        consistencyDelta,
        rainDelta,
        defenseDelta,
        feedbackDelta,
      },
      seasonReport: seasonHistory,
      evolutionNarrative: narrative,
    }
  }
}

export const proceduralDriverProgressService = new ProceduralDriverProgressService()
