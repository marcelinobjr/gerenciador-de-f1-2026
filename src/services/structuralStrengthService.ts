/**
 * structuralStrengthService.ts
 *
 * BALANCE-EQUATION-02A — Structural Strength Foundation Service
 *
 * Implementa a medição e auditoria da Força Estrutural (sem MGU-K inventado,
 * sem team bonus por nome, sem RNG no score, sem trackFit, sem setup/pneu/fuel/chaos).
 *
 * FÓRMULAS OFICIAIS CANÔNICAS:
 * - TECHNICAL: PARTS 50% + EFFECTIVE_PU 30% + RELIABILITY 10% + CONDITION 10%
 * - DRIVER: DRIVER ATTRIBUTES 80% + MORALE 10% + ADAPTATION 10% (Adaptation é neutra/placeholder)
 * - TEAM: INFRASTRUCTURE 80% + TEAM MORALE 20%
 * - STRUCTURAL_STRENGTH = TECHNICAL × 0.60 + DRIVER × 0.25 + TEAM × 0.15
 */

import {
  DataQualityStatus,
  StructuralStrengthBreakdown,
  TechnicalScoreBreakdown,
  DriverScoreBreakdown,
  TeamScoreBreakdown,
  StructuralStrengthAuditReport,
  TechnicalScoreWeights,
  DriverScoreWeights,
  TeamScoreWeights,
  StructuralStrengthWeights,
  DriverDetailSummary,
  BalanceBaselineV0,
  BalanceBaselineTeamEntry,
} from '@/types/structural-strength'
import { ALL_GRID_TEAMS_DATABASE } from '@/lib/grid-teams-database'
import {
  OFFICIAL_TEAMS_TECHNICAL_DATA,
  OFFICIAL_POWER_UNITS,
  generateDefaultComponentsFromMacro,
} from '@/lib/car-technical-data'
import { canonicalPowerUnitIntegrationService } from '@/services/canonicalPowerUnitIntegrationService'
import { getInitialTeamFacilities } from '@/data/initial-team-facilities'
import { getOverallRating } from '@/lib/mbj-drivers-data'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'

// Constantes de Pesos Oficiais
export const TECHNICAL_WEIGHTS: TechnicalScoreWeights = {
  parts: 0.5,
  effectivePu: 0.3,
  reliability: 0.1,
  condition: 0.1,
}

export const DRIVER_WEIGHTS: DriverScoreWeights = {
  driverAttributes: 0.8,
  morale: 0.1,
  adaptation: 0.1,
}

export const TEAM_WEIGHTS: TeamScoreWeights = {
  infrastructure: 0.8,
  teamMorale: 0.2,
}

export const STRUCTURAL_STRENGTH_WEIGHTS: StructuralStrengthWeights = {
  technical: 0.6,
  driver: 0.25,
  team: 0.15,
}

// Valor neutro fixo para adaptation (placeholder até expansão futura)
export const NEUTRAL_ADAPTATION_VALUE = 75

export class StructuralStrengthService {
  private activeOverrides: Map<string, Partial<BalanceBaselineTeamEntry>> = new Map()

  /**
   * Calcula o Technical Score de uma equipe:
   * PARTS 50% + EFFECTIVE_PU 30% + RELIABILITY 10% + CONDITION 10%
   */
  public calculateTechnicalScore(params: {
    components: Record<string, number>
    effectivePuRating: number
    reliability?: number
    condition?: number
    puSupplier?: string
    effectiveIntegration?: number
    nominalPuRating?: number
  }): TechnicalScoreBreakdown {
    const compValues = Object.values(params.components)
    const partsAvg =
      compValues.length > 0 ? compValues.reduce((sum, val) => sum + val, 0) / compValues.length : 50
    const partsScore = Number(partsAvg.toFixed(2))

    const effectivePuScore = Number(params.effectivePuRating.toFixed(2))
    const relScore = Number((params.reliability ?? 85).toFixed(2))
    const condScore = Number((params.condition ?? 100).toFixed(2))

    const technicalScore = Number(
      (
        partsScore * TECHNICAL_WEIGHTS.parts +
        effectivePuScore * TECHNICAL_WEIGHTS.effectivePu +
        relScore * TECHNICAL_WEIGHTS.reliability +
        condScore * TECHNICAL_WEIGHTS.condition
      ).toFixed(2),
    )

    return {
      partsScore,
      effectivePuScore,
      reliabilityScore: relScore,
      conditionScore: condScore,
      technicalScore,
      weights: TECHNICAL_WEIGHTS,
      componentsMap: { ...params.components },
      puSupplier: params.puSupplier || 'Desconhecido',
      effectiveIntegration: params.effectiveIntegration ?? 0.9,
      nominalPuRating: params.nominalPuRating ?? 88,
    }
  }

  /**
   * Calcula o Driver Score de uma equipe:
   * DRIVER ATTRIBUTES 80% + MORALE 10% + ADAPTATION 10%
   * adaptation é explicitamente neutra (NEUTRAL_ADAPTATION_VALUE = 75).
   */
  public calculateDriverScore(params: {
    drivers: DriverDetailSummary[]
    adaptationOverride?: number
  }): DriverScoreBreakdown {
    const titulars = params.drivers.filter((d) => d.role === 'driver1' || d.role === 'driver2')
    const evalList = titulars.length > 0 ? titulars : params.drivers

    const driverAttributesAvg =
      evalList.length > 0
        ? evalList.reduce((acc, d) => acc + d.overallRating, 0) / evalList.length
        : 75
    const driverAttributesScore = Number(driverAttributesAvg.toFixed(2))

    const moraleAvg =
      evalList.length > 0
        ? evalList.reduce((acc, d) => acc + (d.morale ?? 80), 0) / evalList.length
        : 80
    const moraleScore = Number(moraleAvg.toFixed(2))

    const adaptationScore = Number(
      (params.adaptationOverride ?? NEUTRAL_ADAPTATION_VALUE).toFixed(2),
    )

    const driverScore = Number(
      (
        driverAttributesScore * DRIVER_WEIGHTS.driverAttributes +
        moraleScore * DRIVER_WEIGHTS.morale +
        adaptationScore * DRIVER_WEIGHTS.adaptation
      ).toFixed(2),
    )

    return {
      driverAttributesScore,
      moraleScore,
      adaptationScore,
      driverScore,
      isAdaptationNeutral: true,
      adaptationStatus: 'NEUTRAL_PLACEHOLDER',
      weights: DRIVER_WEIGHTS,
      drivers: params.drivers.map((d) => ({ ...d })),
      notes: 'Adaptation é neutra/placeholder (75) sem valor funcional inventado.',
    }
  }

  /**
   * Calcula o Team Score de uma equipe:
   * INFRASTRUCTURE 80% + TEAM MORALE 20%
   * Infrastructure 1 a 5 convertida para escala 0 a 100: (nivel / 5) * 100
   */
  public calculateTeamScore(params: {
    facilities: Record<string, number>
    teamMorale?: number
  }): TeamScoreBreakdown {
    const facilityVals = Object.values(params.facilities)
    const avgFacility =
      facilityVals.length > 0
        ? facilityVals.reduce((acc, val) => acc + val, 0) / facilityVals.length
        : 3
    // Converte média de 1-5 para escala percentual (0-100)
    const infrastructureScore = Number(((avgFacility / 5) * 100).toFixed(2))
    const teamMoraleScore = Number((params.teamMorale ?? 80).toFixed(2))

    const teamScore = Number(
      (
        infrastructureScore * TEAM_WEIGHTS.infrastructure +
        teamMoraleScore * TEAM_WEIGHTS.teamMorale
      ).toFixed(2),
    )

    return {
      infrastructureScore,
      teamMoraleScore,
      teamScore,
      weights: TEAM_WEIGHTS,
      facilitiesLevels: { ...params.facilities },
      averageFacilityLevel: Number(avgFacility.toFixed(2)),
    }
  }

  /**
   * Calcula a Força Estrutural consolidada:
   * STRUCTURAL_STRENGTH = TECHNICAL × 0.60 + DRIVER × 0.25 + TEAM × 0.15
   */
  public calculateStructuralStrength(params: {
    teamKey: string
    teamName?: string
    components: Record<string, number>
    effectivePuRating: number
    reliability?: number
    condition?: number
    puSupplier?: string
    effectiveIntegration?: number
    nominalPuRating?: number
    drivers: DriverDetailSummary[]
    adaptationOverride?: number
    facilities: Record<string, number>
    teamMorale?: number
    dataQuality?: DataQualityStatus
    dataQualityNotes?: string
  }): StructuralStrengthBreakdown {
    const technicalBreakdown = this.calculateTechnicalScore({
      components: params.components,
      effectivePuRating: params.effectivePuRating,
      reliability: params.reliability,
      condition: params.condition,
      puSupplier: params.puSupplier,
      effectiveIntegration: params.effectiveIntegration,
      nominalPuRating: params.nominalPuRating,
    })

    const driverBreakdown = this.calculateDriverScore({
      drivers: params.drivers,
      adaptationOverride: params.adaptationOverride,
    })

    const teamBreakdown = this.calculateTeamScore({
      facilities: params.facilities,
      teamMorale: params.teamMorale,
    })

    const structuralStrengthScore = Number(
      (
        technicalBreakdown.technicalScore * STRUCTURAL_STRENGTH_WEIGHTS.technical +
        driverBreakdown.driverScore * STRUCTURAL_STRENGTH_WEIGHTS.driver +
        teamBreakdown.teamScore * STRUCTURAL_STRENGTH_WEIGHTS.team
      ).toFixed(2),
    )

    return {
      teamKey: params.teamKey,
      teamName: params.teamName || params.teamKey,
      structuralStrengthScore,
      technicalScore: technicalBreakdown.technicalScore,
      driverScore: driverBreakdown.driverScore,
      teamScore: teamBreakdown.teamScore,
      weights: STRUCTURAL_STRENGTH_WEIGHTS,
      technicalBreakdown,
      driverBreakdown,
      teamBreakdown,
      dataQuality: params.dataQuality ?? 'COMPLETE',
      dataQualityNotes: params.dataQualityNotes || 'Dados canônicos íntegros.',
      calculatedAt: new Date().toISOString(),
    }
  }

  /**
   * Avalia a Força Estrutural para uma dada chave de equipe (usando catálogo ou baseline).
   */
  public getTeamStructuralStrength(teamKey: string): StructuralStrengthBreakdown {
    const cleanKey = teamKey.toLowerCase().trim()
    const baseline = this.getBaselineV0()
    const baselineEntry = baseline.teams[cleanKey]

    if (baselineEntry) {
      return this.calculateStructuralStrength({
        teamKey: baselineEntry.teamKey,
        teamName: baselineEntry.teamName,
        components: baselineEntry.chassisComponents,
        effectivePuRating: baselineEntry.effectivePuRating,
        reliability: baselineEntry.carReliabilityRating,
        condition: baselineEntry.initialCondition,
        puSupplier: baselineEntry.engineSupplier,
        effectiveIntegration: baselineEntry.effectiveIntegration,
        nominalPuRating: baselineEntry.nominalPuRating,
        drivers: baselineEntry.drivers,
        facilities: baselineEntry.facilities,
        teamMorale: baselineEntry.teamMoraleRating,
        dataQuality: baselineEntry.dataQuality,
        dataQualityNotes: baselineEntry.dataQualityReason,
      })
    }

    // Fallback gracioso para custom_team ou equipe não listada
    const defComponents = generateDefaultComponentsFromMacro(70)
    const facilities = getInitialTeamFacilities(cleanKey)
    return this.calculateStructuralStrength({
      teamKey: cleanKey,
      teamName: cleanKey === 'custom_team' ? 'Equipe Personalizada' : cleanKey,
      components: defComponents,
      effectivePuRating: 75,
      reliability: 80,
      condition: 100,
      puSupplier: 'Audi',
      effectiveIntegration: 0.9,
      nominalPuRating: 88,
      drivers: [
        {
          name: 'Piloto #1',
          role: 'driver1',
          overallRating: 75,
          speed: 75,
          consistency: 75,
          rain: 75,
          defense: 75,
          morale: 80,
        },
        {
          name: 'Piloto #2',
          role: 'driver2',
          overallRating: 73,
          speed: 73,
          consistency: 73,
          rain: 73,
          defense: 73,
          morale: 80,
        },
      ],
      facilities: facilities as any,
      teamMorale: 75,
      dataQuality: cleanKey === 'custom_team' ? 'DEFAULTED' : 'MISSING',
      dataQualityNotes: 'Gerado a partir de valores padrão (fallback).',
    })
  }

  /**
   * Auditoria completa do sistema de força estrutural:
   * Calcula e rankeia todas as 29 equipes jogáveis/selecionáveis.
   */
  public auditStructuralStrengthSystem(): StructuralStrengthAuditReport {
    const baseline = this.getBaselineV0()
    const allKeys = Object.keys(baseline.teams)

    const allTeams: StructuralStrengthBreakdown[] = allKeys.map((key) =>
      this.getTeamStructuralStrength(key),
    )

    // Ordena por Força Estrutural decrescente
    allTeams.sort((a, b) => b.structuralStrengthScore - a.structuralStrengthScore)

    const qualityCounts = {
      COMPLETE: 0,
      PARTIAL: 0,
      DEFAULTED: 0,
      MISSING: 0,
    }

    allTeams.forEach((t) => {
      qualityCounts[t.dataQuality] = (qualityCounts[t.dataQuality] || 0) + 1
    })

    const rankings = allTeams.map((t, index) => ({
      rank: index + 1,
      teamKey: t.teamKey,
      teamName: t.teamName,
      structuralStrengthScore: t.structuralStrengthScore,
      technicalScore: t.technicalScore,
      driverScore: t.driverScore,
      teamScore: t.teamScore,
      dataQuality: t.dataQuality,
    }))

    const divergences: string[] = []

    // Validações de integridade
    if (allTeams.length < 29) {
      divergences.push(
        `Esperado no mínimo 29 equipes (28 catálogo + custom), encontrado ${allTeams.length}`,
      )
    }

    // Regras de topo esperadas: Grupo A no Top 4
    const top4Keys = allTeams.slice(0, 4).map((t) => t.teamKey)
    const expectedGroupA = ['mercedes', 'ferrari', 'mclaren', 'redbull']
    for (const k of expectedGroupA) {
      if (!top4Keys.includes(k)) {
        divergences.push(`Equipe do Grupo A '${k}' não está no Top 4 estrutural`)
      }
    }

    return {
      timestamp: new Date().toISOString(),
      baselineVersion: baseline.schemaVersion,
      totalTeams: allTeams.length,
      qualityCounts,
      rankings,
      allTeams,
      auditPassed: divergences.length === 0,
      divergences,
      notes: [
        'Mapeamento 100% puro sem RNG.',
        'Zero team bonus por nome.',
        'Adaptation neutra em 75.',
        'Zero trackFit ou variáveis dinâmicas de corrida.',
      ],
    }
  }

  /**
   * Retorna a baseline histórica imutável V0 em memória.
   */
  public getBaselineV0(): BalanceBaselineV0 {
    return BASELINE_V0_DATA
  }

  /**
   * Restaura os parâmetros de balanceamento para a baseline solicitada ('v0').
   * RESTAURA SOMENTE PARÂMETROS DE BALANCEAMENTO.
   * NÃO apaga/restaura saves, contratos, campeonatos ou histórico de carreira.
   * É estritamente IDEMPOTENTE.
   */
  public restoreBalanceBaseline(version: 'v0' | string): {
    success: boolean
    versionRestored: string
    restoredTeamsCount: number
    checksum: string
    message: string
  } {
    if (version !== 'v0') {
      throw new Error(
        `[StructuralStrengthService] Versão desconhecida '${version}'. Baselines disponíveis: 'v0'.`,
      )
    }

    const baseline = this.getBaselineV0()
    // Limpa quaisquer overrides voláteis em memória
    this.activeOverrides.clear()

    return {
      success: true,
      versionRestored: baseline.schemaVersion,
      restoredTeamsCount: baseline.totalTeamsCount,
      checksum: baseline.checksum,
      message: `Baseline '${baseline.schemaVersion}' restaurada com sucesso. ${baseline.totalTeamsCount} equipes ativas. Nenhum dado de save de carreira foi alterado.`,
    }
  }
}

export const structuralStrengthService = new StructuralStrengthService()
