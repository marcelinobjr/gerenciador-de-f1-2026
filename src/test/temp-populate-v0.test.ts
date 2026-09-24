import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { ALL_GRID_TEAMS_DATABASE } from '@/lib/grid-teams-database'
import {
  OFFICIAL_TEAMS_TECHNICAL_DATA,
  OFFICIAL_POWER_UNITS,
  generateDefaultComponentsFromMacro,
} from '@/lib/car-technical-data'
import { canonicalPowerUnitIntegrationService } from '@/services/canonicalPowerUnitIntegrationService'
import {
  INITIAL_GRID_FACILITIES,
  DEFAULT_CUSTOM_TEAM_FACILITIES,
} from '@/data/initial-team-facilities'
import { getOverallRating } from '@/lib/mbj-drivers-data'
import {
  TECHNICAL_WEIGHTS,
  DRIVER_WEIGHTS,
  TEAM_WEIGHTS,
  STRUCTURAL_STRENGTH_WEIGHTS,
  NEUTRAL_ADAPTATION_VALUE,
} from '@/services/structuralStrengthService'
import { calculateStableChecksum } from '@/data/balance-baseline-v0'
import {
  BalanceBaselineV0,
  BalanceBaselineTeamEntry,
  DataQualityStatus,
  DriverDetailSummary,
} from '@/types/structural-strength'

function buildTeamBaselineEntry(teamKey: string, gridTeam?: any): BalanceBaselineTeamEntry {
  const cleanKey = teamKey.toLowerCase().trim()
  const isCustom = cleanKey === 'custom_team'

  const teamName = isCustom ? 'Equipe Personalizada' : gridTeam?.name || cleanKey
  const country = isCustom ? 'Internacional' : gridTeam?.country || 'Internacional'
  const supplierName = gridTeam?.engine || 'Audi'

  const normSupplier = canonicalPowerUnitIntegrationService.normalizeSupplier(supplierName)

  const puMeta = canonicalPowerUnitIntegrationService.getRelationshipMetadata(
    cleanKey,
    normSupplier,
  )

  const puSpec = OFFICIAL_POWER_UNITS[puMeta.supplierId] || OFFICIAL_POWER_UNITS.Audi
  const nominalPower = puSpec.powerRating
  const nominalRel = puSpec.reliabilityRating
  const nominalPuRating = Number((nominalPower * 0.6 + nominalRel * 0.4).toFixed(1))

  const consolidatedK = canonicalPowerUnitIntegrationService.calculateConsolidatedKnowledge(
    puMeta.initialGeneralKnowledge,
    puMeta.initialSupplierKnowledge,
  )
  const resolvedEff = canonicalPowerUnitIntegrationService.resolveEffectivePUIntegration({
    integrationKnowledge: consolidatedK,
    relationshipType: puMeta.relationshipType,
    maxIntegrationOverride: puMeta.maxIntegration,
  })

  const effectiveIntegration = resolvedEff.effectiveIntegration
  const effectivePuRating = Number((nominalPuRating * effectiveIntegration).toFixed(1))

  let chassisComponents: Record<string, number>
  let dataQuality: DataQualityStatus
  let dataQualityReason: string

  const officialTech = OFFICIAL_TEAMS_TECHNICAL_DATA[cleanKey]
  if (officialTech) {
    chassisComponents = { ...officialTech.initialComponents }
    dataQuality = 'COMPLETE'
    dataQualityReason = 'Dados completos catalogados na planilha técnica oficial e PU homologada.'
  } else if (gridTeam) {
    const macro = gridTeam.carRating ?? gridTeam.carLevel ?? gridTeam.strength ?? 60
    chassisComponents = generateDefaultComponentsFromMacro(macro)
    dataQuality = 'PARTIAL'
    dataQualityReason = 'Equipe estruturada do catálogo com componentes derivados de rating macro.'
  } else {
    chassisComponents = generateDefaultComponentsFromMacro(65)
    dataQuality = 'DEFAULTED'
    dataQualityReason = 'Equipe personalizada inicializada com especificações padrão.'
  }

  const drivers: DriverDetailSummary[] = []
  if (gridTeam?.driver1) {
    const d1 = gridTeam.driver1
    const ovr = getOverallRating(d1)
    drivers.push({
      name: d1.name,
      role: 'driver1',
      overallRating: ovr,
      speed: d1.speed,
      consistency: d1.consistency,
      rain: d1.rain,
      defense: d1.defense,
      morale: 85,
    })
  } else {
    drivers.push({
      name: 'Piloto Titular #1',
      role: 'driver1',
      overallRating: 75,
      speed: 75,
      consistency: 75,
      rain: 75,
      defense: 75,
      morale: 80,
    })
  }

  if (gridTeam?.driver2) {
    const d2 = gridTeam.driver2
    const ovr = getOverallRating(d2)
    drivers.push({
      name: d2.name,
      role: 'driver2',
      overallRating: ovr,
      speed: d2.speed,
      consistency: d2.consistency,
      rain: d2.rain,
      defense: d2.defense,
      morale: 80,
    })
  } else {
    drivers.push({
      name: 'Piloto Titular #2',
      role: 'driver2',
      overallRating: 73,
      speed: 73,
      consistency: 73,
      rain: 73,
      defense: 73,
      morale: 80,
    })
  }

  if (gridTeam?.reserveDriver) {
    const dr = gridTeam.reserveDriver
    const ovr = getOverallRating(dr)
    drivers.push({
      name: dr.name,
      role: 'reserve',
      overallRating: ovr,
      speed: dr.speed,
      consistency: dr.consistency,
      rain: dr.rain,
      defense: dr.defense,
      morale: 78,
    })
  }

  const facilities = INITIAL_GRID_FACILITIES[cleanKey] || { ...DEFAULT_CUSTOM_TEAM_FACILITIES }
  const facValues = Object.values(facilities)
  const avgFac = facValues.reduce((s, v) => s + v, 0) / Math.max(1, facValues.length)
  const infrastructureRating100 = Number(((avgFac / 5) * 100).toFixed(2))

  const teamMoraleRating = gridTeam?.cultureRating ?? 80
  const carReliabilityRating = nominalRel
  const initialCondition = 100

  const compValues = Object.values(chassisComponents)
  const partsScore = compValues.reduce((s, v) => s + v, 0) / compValues.length
  const technicalScore = Number(
    (
      partsScore * TECHNICAL_WEIGHTS.parts +
      effectivePuRating * TECHNICAL_WEIGHTS.effectivePu +
      carReliabilityRating * TECHNICAL_WEIGHTS.reliability +
      initialCondition * TECHNICAL_WEIGHTS.condition
    ).toFixed(2),
  )

  const titulars = drivers.filter((d) => d.role === 'driver1' || d.role === 'driver2')
  const driverAttrsAvg = titulars.reduce((s, d) => s + d.overallRating, 0) / titulars.length
  const driverMoraleAvg = titulars.reduce((s, d) => s + d.morale, 0) / titulars.length
  const adaptationVal = NEUTRAL_ADAPTATION_VALUE

  const driverScore = Number(
    (
      driverAttrsAvg * DRIVER_WEIGHTS.driverAttributes +
      driverMoraleAvg * DRIVER_WEIGHTS.morale +
      adaptationVal * DRIVER_WEIGHTS.adaptation
    ).toFixed(2),
  )

  const teamScore = Number(
    (
      infrastructureRating100 * TEAM_WEIGHTS.infrastructure +
      teamMoraleRating * TEAM_WEIGHTS.teamMorale
    ).toFixed(2),
  )

  const structuralStrengthScore = Number(
    (
      technicalScore * STRUCTURAL_STRENGTH_WEIGHTS.technical +
      driverScore * STRUCTURAL_STRENGTH_WEIGHTS.driver +
      teamScore * STRUCTURAL_STRENGTH_WEIGHTS.team
    ).toFixed(2),
  )

  return {
    teamKey: cleanKey,
    teamName,
    country,
    engineSupplier: normSupplier,
    relationshipType: puMeta.relationshipType,
    maxIntegration: puMeta.maxIntegration,
    effectiveIntegration,
    nominalPuPower: nominalPower,
    nominalPuReliability: nominalRel,
    nominalPuRating,
    effectivePuRating,
    chassisComponents,
    carReliabilityRating,
    initialCondition,
    drivers,
    driverAttributesAverage: Number(driverAttrsAvg.toFixed(2)),
    driverMoraleAverage: Number(driverMoraleAvg.toFixed(2)),
    driverAdaptationValue: adaptationVal,
    isAdaptationNeutral: true,
    facilities,
    infrastructureRating100,
    teamMoraleRating,
    dataQuality,
    dataQualityReason,
    technicalScore,
    driverScore,
    teamScore,
    structuralStrengthScore,
  }
}

function buildCompleteBaselineV0(): BalanceBaselineV0 {
  const teamsMap: Record<string, BalanceBaselineTeamEntry> = {}

  for (const gridTeam of ALL_GRID_TEAMS_DATABASE) {
    const entry = buildTeamBaselineEntry(gridTeam.key, gridTeam)
    teamsMap[gridTeam.key] = entry
  }

  const customEntry = buildTeamBaselineEntry('custom_team')
  teamsMap['custom_team'] = customEntry

  const partialBaseline: Omit<BalanceBaselineV0, 'checksum'> = {
    schemaVersion: 'v0',
    baselineId: 'balance_baseline_v0_2026',
    baselineName: 'APEX GP Manager 2026 — Balance Baseline Histórica V0',
    generatedAt: '2026-03-15T00:00:00.000Z',
    immutable: true,
    totalTeamsCount: Object.keys(teamsMap).length,
    formulas: {
      technical: 'PARTS 50% + EFFECTIVE_PU 30% + RELIABILITY 10% + CONDITION 10%',
      driver: 'DRIVER ATTRIBUTES 80% + MORALE 10% + ADAPTATION 10% (Adaptation neutra/placeholder)',
      team: 'INFRASTRUCTURE 80% + TEAM MORALE 20%',
      structuralStrength: 'TECHNICAL × 0.60 + DRIVER × 0.25 + TEAM × 0.15',
      weights: {
        technicalSub: TECHNICAL_WEIGHTS,
        driverSub: DRIVER_WEIGHTS,
        teamSub: TEAM_WEIGHTS,
        structuralOverall: STRUCTURAL_STRENGTH_WEIGHTS,
      },
    },
    rngConfiguration: {
      deterministicSeed: 20260315,
      hasRuntimeRng: false,
      rngNotes: 'Zero RNG no cálculo de structural strength. Score puramente determinístico.',
    },
    prohibitedRulesEnforced: [
      'PROIBIDO: MGU-K inventado como rating funcional',
      'PROIBIDO: Team bonus por nome de equipe',
      'PROIBIDO: RNG no structural score',
      'PROIBIDO: TrackFit no structural score',
      'PROIBIDO: Setup, pneu, fuel e chaos no structural score',
      'PROIBIDO: Alterar ratings canônicos de pilotos',
      'PROIBIDO: Ligar structural score no race engine nesta fase 02A',
    ],
    teams: teamsMap,
  }

  const checksum = calculateStableChecksum(partialBaseline)

  return {
    ...partialBaseline,
    checksum,
  }
}

describe('Geração de Baseline V0 Canônica', () => {
  it('grava src/data/balance-baseline-v0.json completo com 29 equipes', () => {
    const filePath = path.resolve(process.cwd(), 'src/data/balance-baseline-v0.json')
    const full = buildCompleteBaselineV0()
    fs.writeFileSync(filePath, JSON.stringify(full, null, 2), 'utf-8')

    expect(fs.existsSync(filePath)).toBe(true)
    const read = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    expect(read.totalTeamsCount).toBe(29)
    expect(Object.keys(read.teams).length).toBe(29)
    expect(read.checksum.startsWith('sha_v0_')).toBe(true)
  })
})
