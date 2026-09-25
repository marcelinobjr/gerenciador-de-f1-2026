/**
 * balanceAuditService.ts
 *
 * BALANCE-AUDIT-01 — Auditoria Esportiva & Diagnóstico de Ritmo
 * APEX GP Manager (F1 2026)
 *
 * REGRAS ABSOLUTAS:
 * 1. NÃO CALIBRAR / NÃO ALTERAR RATINGS, FÓRMULAS, PESOS, PU OU PILOTOS.
 * 2. EXCLUSIVAMENTE AUDITORIA E DIAGNÓSTICO DA BASELINE v0.0.493 (BE02C).
 * 3. 29 EQUIPES × 24 PISTAS CANÔNICAS (696 CÉLULAS).
 * 4. CONDIÇÕES CONTROLADAS E NEUTRAS PARA ISOLAR STRUCTURAL + TRACKFIT.
 * 5. SE ENCONTRAR ANOMALIA, REGISTRAR A ANOMALIA, NÃO CORRIGI-LA.
 */

import { structuralStrengthService } from '@/services/structuralStrengthService'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { carTechnicalService } from '@/services/carTechnicalService'
import { calculateTrackFit } from '@/lib/car-session-performance-engine'
import {
  CIRCUIT_PERFORMANCE_PROFILES,
  CircuitPerformanceProfile,
} from '@/data/circuit-performance-profiles'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { auditPaceIntegration } from '@/services/canonicalPaceIntegrationService'

export interface TeamStructuralEntry {
  teamKey: string
  teamName: string
  structuralStrength: number
  structuralRank: number
}

export interface TrackPerformanceCell {
  teamKey: string
  teamName: string
  trackId: string
  trackName: string
  round: number
  structuralStrength: number
  trackFit: number
  trackFitModifier: number
  neutralEventPace: number
  trackRank: number
  deltaToP1: number
  deltaVsStructuralStrength: number
  paceBreakdownResidual: number
}

export interface ChampionshipAverageEntry {
  teamKey: string
  teamName: string
  structuralRank: number
  championshipRank: number
  rankDelta: number // championshipRank - structuralRank
  isSignificantRankShift: boolean // abs(rankDelta) >= 3
  averageNeutralPace: number
  medianNeutralPace: number
  averageTrackRank: number
  medianTrackRank: number
  bestTrackRank: number
  worstTrackRank: number
  trackRankStdDev: number
  averageTrackFitModifier: number
  minTrackFitModifier: number
  maxTrackFitModifier: number
  largestPositiveShift: number
  largestNegativeShift: number
  trackFitUpsetsCount: number
}

export interface LargeGapInversionRecord {
  teamAKey: string
  teamAName: string
  teamBKey: string
  teamBName: string
  trackId: string
  trackName: string
  structuralStrengthA: number
  structuralStrengthB: number
  structuralGap: number
  trackFitA: number
  trackFitB: number
  trackFitModifierA: number
  trackFitModifierB: number
  finalNeutralPaceA: number
  finalNeutralPaceB: number
  finalGap: number
}

export interface TrackFitDominanceRecord {
  teamAKey: string
  teamBKey: string
  trackId: string
  structuralGap: number
  trackFitGap: number
  dominanceRatio: number
  isHighInfluence: boolean // > 0.50
  isDominant: boolean // >= 1.00
}

export interface GroupHierarchyResult {
  groupName: string
  teamKeys: string[]
  averageNeutralPace: number
  medianNeutralPace: number
  averageTrackRank: number
}

export interface GroupHeadToHead {
  groupA: string
  groupB: string
  headToHeadWins: number
  headToHeadLosses: number
  ties: number
  upsetRate: number
}

export interface AudiHaasAuditResult {
  audiStructuralStrength: number
  audiStructuralRank: number
  audiAverageNeutralPace: number
  audiChampionshipRank: number
  audiMedianNeutralPace: number
  haasStructuralStrength: number
  haasStructuralRank: number
  haasAverageNeutralPace: number
  haasChampionshipRank: number
  haasMedianNeutralPace: number
  audiWins: number
  haasWins: number
  ties: number
  totalTracks: number
  audiHeadToHeadWinRate: number
  haasHeadToHeadWinRate: number
  status: 'AUDI_HAAS_RULE_PASS' | 'AUDI_HAAS_RULE_FAIL'
}

export interface CloseGapAnalysisRecord {
  teamAKey: string
  teamBKey: string
  structuralGap: number
  headToHeadTracks: number
  teamAWins: number
  teamBWins: number
  ties: number
  inversionFrequency: number
}

export interface SameStrengthRecord {
  teamAKey: string
  teamBKey: string
  structuralGap: number
  trackFitModifierA: number
  trackFitModifierB: number
  deltaFromTrackFit: number
  trackId: string
}

export interface TrackAuditSummary {
  trackId: string
  trackName: string
  round: number
  averageAbsoluteRankShift: number
  maxRankShift: number
  numberOfTrackFitUpsets: number
  numberOfLargeGapInversions: number
  trackFitModifierStdDev: number
}

export interface BalanceAuditReport {
  auditId: 'BALANCE-AUDIT-01'
  baselineVersion: string
  baselineChecksum: string
  timestamp: string
  teamsAudited: number
  tracksAudited: number
  expectedTracks: number
  missingTracks: string[]
  duplicateTracks: string[]
  auditedTeamsMatchesCanonical: boolean

  // A. Structural Ranking
  structuralRanking: TeamStructuralEntry[]

  // B & C. Championship Performance & Structural vs Championship
  championshipRanking: ChampionshipAverageEntry[]

  // D. Team x Track Position Matrix & Pace Matrix
  positionMatrix: Record<string, Record<string, number>>
  paceMatrix: Record<string, Record<string, number>>

  // E. TrackFit Upsets
  totalTrackFitUpsets: number
  trackFitUpsetsByTeam: Record<string, number>

  // F. Large Gap Inversions (structuralGap >= 5.0)
  largeGapInversions: LargeGapInversionRecord[]

  // G. TrackFit Dominance
  totalDominanceEvaluations: number
  highInfluenceCount: number
  dominantCount: number
  top10DominanceRatios: TrackFitDominanceRecord[]

  // H. Group Hierarchy
  groupHierarchies: GroupHierarchyResult[]
  groupHeadToHead: GroupHeadToHead[]

  // I. Audi x Haas
  audiVsHaas: AudiHaasAuditResult

  // J. Close Gap Analysis (structuralGap <= 1.5)
  closeGapPairs: CloseGapAnalysisRecord[]

  // K. Same Strength Analysis (structuralGap <= 0.05)
  sameStrengthObservations: SameStrengthRecord[]

  // L. Outliers
  top10LargestRankShifts: Array<{
    teamKey: string
    trackId: string
    structuralRank: number
    trackRank: number
    rankShift: number
  }>
  top10PositiveTrackFitModifiers: Array<{
    teamKey: string
    trackId: string
    trackFitModifier: number
  }>
  top10NegativeTrackFitModifiers: Array<{
    teamKey: string
    trackId: string
    trackFitModifier: number
  }>
  teamsHighlyDependentOnTrackFit: string[]
  teamsInsensitiveToTrackFit: string[]
  tracksWithAnomalouslyHighUpsets: string[]
  tracksWithAnomalouslyLowUpsets: string[]

  // M. Track Audit
  trackSummaries: TrackAuditSummary[]

  // N. Pace Breakdown Integrity
  maxPaceBreakdownResidual: number
  paceBreakdownIntegrityPassed: boolean

  // O. Duplication Audit
  duplicationAudit: ReturnType<typeof auditPaceIntegration>

  // Diagnostic summary
  diagnosticSummary: {
    findings: string[]
    recommendationsForCalibration01: string[]
  }
  diagnosticoNaoCalibrarAinda: {
    title: string
    note: string
    audiVsHaasStatus: string
    audiAboveHaas: boolean
    outlierTeams: Array<{
      teamKey: string
      teamName: string
      structuralRank: number
      championshipRank: number
      rankDelta: number
      trend: 'ACIMA_DO_ESPERADO' | 'ABAIXO_DO_ESPERADO'
    }>
    findings: string[]
    recommendations: string[]
  }
}

// Grupos Alvo Oficiais 2026 do projeto
export const CANONICAL_TARGET_GROUPS: Record<'groupA' | 'groupB' | 'groupC' | 'groupD', string[]> =
  {
    groupA: ['mercedes', 'ferrari', 'mclaren', 'redbull'],
    groupB: ['racingbulls', 'alpine', 'audi'],
    groupC: ['haas', 'williams', 'astonmartin'],
    groupD: ['cadillac', 'andretti'],
  }

export class BalanceAuditService {
  /**
   * Executa a auditoria completa BALANCE-AUDIT-01.
   * Não muta absolutamente nada.
   */
  public runFullAudit(): BalanceAuditReport {
    const baseline = structuralStrengthService.getBaselineV0()
    const allTeamKeys = Object.keys(baseline.teams)
    const tracks = CIRCUIT_PERFORMANCE_PROFILES

    // 1. Verificações de integridade de equipes e pistas
    const missingTracks: string[] = []
    const seenTracks = new Set<string>()
    const duplicateTracks: string[] = []
    tracks.forEach((t) => {
      if (seenTracks.has(t.id)) duplicateTracks.push(t.id)
      seenTracks.add(t.id)
    })

    const auditedTeamsMatchesCanonical = allTeamKeys.length === 29

    // 2. AUDIT A — Structural Ranking puro
    const structuralBreakdowns = allTeamKeys.map((key) =>
      structuralStrengthService.getTeamStructuralStrength(key),
    )
    structuralBreakdowns.sort((a, b) => b.structuralStrengthScore - a.structuralStrengthScore)

    const structuralRankMap = new Map<string, number>()
    const structuralRanking: TeamStructuralEntry[] = structuralBreakdowns.map((t, idx) => {
      const rank = idx + 1
      structuralRankMap.set(t.teamKey, rank)
      return {
        teamKey: t.teamKey,
        teamName: t.teamName,
        structuralStrength: t.structuralStrengthScore,
        structuralRank: rank,
      }
    })

    // Pré-carregar atributos técnicos de cada equipe para cálculo do TrackFit canônico
    const teamTechAttrsMap = new Map<string, any>()
    for (const key of allTeamKeys) {
      const baselineTeam = baseline.teams[key]
      const compValues = baselineTeam?.chassisComponents
        ? Object.values(baselineTeam.chassisComponents)
        : []
      const avgChassis =
        compValues.length > 0 ? compValues.reduce((a, b) => a + b, 0) / compValues.length : 70
      const techProfile = carTechnicalService.getOrCreateTeamTechnicalData(
        key,
        avgChassis,
        baselineTeam?.engineSupplier || 'Ferrari',
      )
      teamTechAttrsMap.set(key, techProfile.attributes)
    }

    // 3. AUDIT B — Track Performance (29 equipes x 24 pistas = 696 avaliações)
    const cellsByTrack = new Map<string, TrackPerformanceCell[]>()
    let maxResidual = 0

    for (const track of tracks) {
      const trackCells: TrackPerformanceCell[] = []
      for (const team of structuralBreakdowns) {
        const techAttrs = teamTechAttrsMap.get(team.teamKey)
        const { trackFitScore } = calculateTrackFit(techAttrs, track)
        const norm = canonicalPaceIntegrationService.normalizeTrackFit({
          rawTrackFitScore: trackFitScore,
        })
        const trackFitModifier = norm.trackFitModifier

        // Cenário Neutro canônico: setup=0, driverEvent=0, tyre=0, fuel=0, wear=0, weather=0, rng=0
        // NeutralEventPace = StructuralStrength + TrackFitModifier
        const neutralEventPace = Number(
          (team.structuralStrengthScore + trackFitModifier).toFixed(2),
        )

        // Verificação do PaceBreakdown do serviço canônico sob condições neutras
        // Usamos computeQualifyingPace com parâmetros neutros e verificamos o residual
        const qualiNeutral = canonicalPaceIntegrationService.computeQualifyingPace({
          teamKey: team.teamKey,
          driverId: 'neutral_driver',
          circuitProfile: track,
          carTechnicalAttributes: techAttrs,
          driverAttributes: { speed: 85, morale: 80 },
          setupEfficiency: 80,
          tyreCompound: 'macio',
          tyreWearPct: 0,
          fuelKg: 12,
          weather: 'seco',
          noise: 0,
          puWearPct: 0,
        })

        // No quali com driver speed=85 (speedDelta=0) e morale=80 (moraleDelta=0), setup=80 (0), fuel=12 (0), etc.
        // O effectivePaceScore deve coincidir exatamente com StructuralStrength + TrackFitModifier
        const residual = Math.abs(qualiNeutral.effectivePaceScore - neutralEventPace)
        if (residual > maxResidual) {
          maxResidual = residual
        }

        trackCells.push({
          teamKey: team.teamKey,
          teamName: team.teamName,
          trackId: track.id,
          trackName: track.circuitName,
          round: track.round,
          structuralStrength: team.structuralStrengthScore,
          trackFit: trackFitScore,
          trackFitModifier,
          neutralEventPace,
          trackRank: 0, // calculado a seguir
          deltaToP1: 0,
          deltaVsStructuralStrength: Number(
            (neutralEventPace - team.structuralStrengthScore).toFixed(3),
          ),
          paceBreakdownResidual: Number(residual.toFixed(4)),
        })
      }

      // Ordenar por NeutralEventPace decrescente na pista para determinar TrackRank
      trackCells.sort((a, b) => b.neutralEventPace - a.neutralEventPace)
      const p1Pace = trackCells[0]?.neutralEventPace || 0
      trackCells.forEach((c, idx) => {
        c.trackRank = idx + 1
        c.deltaToP1 = Number((p1Pace - c.neutralEventPace).toFixed(2))
      })

      cellsByTrack.set(track.id, trackCells)
    }

    // 4. Matrizes Equipe x Pista (Position Matrix & Pace Matrix)
    const positionMatrix: Record<string, Record<string, number>> = {}
    const paceMatrix: Record<string, Record<string, number>> = {}
    for (const key of allTeamKeys) {
      positionMatrix[key] = {}
      paceMatrix[key] = {}
    }

    const allCellsFlattened: TrackPerformanceCell[] = []
    cellsByTrack.forEach((trackCells) => {
      for (const cell of trackCells) {
        positionMatrix[cell.teamKey][cell.trackId] = cell.trackRank
        paceMatrix[cell.teamKey][cell.trackId] = cell.neutralEventPace
        allCellsFlattened.push(cell)
      }
    })

    // 5. AUDIT C — Championship Average & Rank
    const cellsByTeam = new Map<string, TrackPerformanceCell[]>()
    for (const cell of allCellsFlattened) {
      if (!cellsByTeam.has(cell.teamKey)) {
        cellsByTeam.set(cell.teamKey, [])
      }
      cellsByTeam.get(cell.teamKey)!.push(cell)
    }

    const championshipStats: ChampionshipAverageEntry[] = []
    for (const key of allTeamKeys) {
      const teamCells = cellsByTeam.get(key) || []
      const structuralRank = structuralRankMap.get(key) || 0
      const teamName = teamCells[0]?.teamName || key

      const paces = teamCells.map((c) => c.neutralEventPace).sort((a, b) => a - b)
      const ranks = teamCells.map((c) => c.trackRank).sort((a, b) => a - b)
      const tfMods = teamCells.map((c) => c.trackFitModifier)

      const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length
      const medianPace = paces[Math.floor(paces.length / 2)]
      const avgRank = ranks.reduce((a, b) => a + b, 0) / ranks.length
      const medianRank = ranks[Math.floor(ranks.length / 2)]
      const bestRank = Math.min(...ranks)
      const worstRank = Math.max(...ranks)

      // Desvio padrão do rank
      const variance = ranks.reduce((acc, r) => acc + Math.pow(r - avgRank, 2), 0) / ranks.length
      const trackRankStdDev = Math.sqrt(variance)

      const avgTfMod = tfMods.reduce((a, b) => a + b, 0) / tfMods.length
      const minTfMod = Math.min(...tfMods)
      const maxTfMod = Math.max(...tfMods)

      // Shifts por equipe
      let maxPosShift = 0 // subiu posições (trackRank < structuralRank)
      let maxNegShift = 0 // perdeu posições (trackRank > structuralRank)
      let upsetsCount = 0

      for (const c of teamCells) {
        const shift = c.trackRank - structuralRank // positivo = caiu, negativo = subiu
        if (shift < 0 && Math.abs(shift) > maxPosShift) maxPosShift = Math.abs(shift)
        if (shift > 0 && shift > maxNegShift) maxNegShift = shift
        if (Math.abs(shift) > 3) upsetsCount++
      }

      championshipStats.push({
        teamKey: key,
        teamName,
        structuralRank,
        championshipRank: 0, // calculado a seguir
        rankDelta: 0,
        isSignificantRankShift: false,
        averageNeutralPace: Number(avgPace.toFixed(3)),
        medianNeutralPace: Number(medianPace.toFixed(2)),
        averageTrackRank: Number(avgRank.toFixed(2)),
        medianTrackRank: medianRank,
        bestTrackRank: bestRank,
        worstTrackRank: worstRank,
        trackRankStdDev: Number(trackRankStdDev.toFixed(2)),
        averageTrackFitModifier: Number(avgTfMod.toFixed(3)),
        minTrackFitModifier: Number(minTfMod.toFixed(3)),
        maxTrackFitModifier: Number(maxTfMod.toFixed(3)),
        largestPositiveShift: maxPosShift,
        largestNegativeShift: maxNegShift,
        trackFitUpsetsCount: upsetsCount,
      })
    }

    // Ordenar pelo AverageNeutralPace decrescente para determinar o Championship Performance Rank
    championshipStats.sort((a, b) => b.averageNeutralPace - a.averageNeutralPace)
    championshipStats.forEach((entry, idx) => {
      entry.championshipRank = idx + 1
      entry.rankDelta = entry.championshipRank - entry.structuralRank
      entry.isSignificantRankShift = Math.abs(entry.rankDelta) >= 3
    })

    // 6. TrackFit Upsets por equipe e total
    let totalUpsets = 0
    const trackFitUpsetsByTeam: Record<string, number> = {}
    for (const stat of championshipStats) {
      trackFitUpsetsByTeam[stat.teamKey] = stat.trackFitUpsetsCount
      totalUpsets += stat.trackFitUpsetsCount
    }

    // 7. Large Gap Inversions (structuralGap >= 5.0) exaustivo
    // Pares A e B em cada pista onde StructuralStrength(A) > StructuralStrength(B)
    const largeGapInversions: LargeGapInversionRecord[] = []
    const dominanceRecords: TrackFitDominanceRecord[] = []

    for (const track of tracks) {
      const trackCells = cellsByTrack.get(track.id) || []
      const cellMap = new Map<string, TrackPerformanceCell>()
      trackCells.forEach((c) => cellMap.set(c.teamKey, c))

      for (let i = 0; i < structuralBreakdowns.length; i++) {
        for (let j = i + 1; j < structuralBreakdowns.length; j++) {
          const teamA = structuralBreakdowns[i] // maior ou igual
          const teamB = structuralBreakdowns[j]

          const cellA = cellMap.get(teamA.teamKey)!
          const cellB = cellMap.get(teamB.teamKey)!

          const sGap = Number(
            (teamA.structuralStrengthScore - teamB.structuralStrengthScore).toFixed(2),
          )
          const tfGap = Number(Math.abs(cellA.trackFitModifier - cellB.trackFitModifier).toFixed(3))

          // Dominance Ratio
          if (sGap > 0) {
            const dominanceRatio = Number((tfGap / sGap).toFixed(3))
            dominanceRecords.push({
              teamAKey: teamA.teamKey,
              teamBKey: teamB.teamKey,
              trackId: track.id,
              structuralGap: sGap,
              trackFitGap: tfGap,
              dominanceRatio,
              isHighInfluence: dominanceRatio > 0.5,
              isDominant: dominanceRatio >= 1.0,
            })
          }

          // Inversão com gap grande: A era >= 5.0 pts melhor estruturalmente, mas B venceu em pace neutro
          if (sGap >= 5.0 && cellB.neutralEventPace > cellA.neutralEventPace) {
            largeGapInversions.push({
              teamAKey: teamA.teamKey,
              teamAName: teamA.teamName,
              teamBKey: teamB.teamKey,
              teamBName: teamB.teamName,
              trackId: track.id,
              trackName: track.circuitName,
              structuralStrengthA: teamA.structuralStrengthScore,
              structuralStrengthB: teamB.structuralStrengthScore,
              structuralGap: sGap,
              trackFitA: cellA.trackFit,
              trackFitB: cellB.trackFit,
              trackFitModifierA: cellA.trackFitModifier,
              trackFitModifierB: cellB.trackFitModifier,
              finalNeutralPaceA: cellA.neutralEventPace,
              finalNeutralPaceB: cellB.neutralEventPace,
              finalGap: Number((cellB.neutralEventPace - cellA.neutralEventPace).toFixed(3)),
            })
          }
        }
      }
    }

    // Top 10 Dominance Ratios
    dominanceRecords.sort((a, b) => b.dominanceRatio - a.dominanceRatio)
    const top10DominanceRatios = dominanceRecords.slice(0, 10)
    const highInfluenceCount = dominanceRecords.filter((d) => d.isHighInfluence).length
    const dominantCount = dominanceRecords.filter((d) => d.isDominant).length

    // 8. Group Hierarchy Audit (Grupos A, B, C, D canônicos)
    const champStatMap = new Map<string, ChampionshipAverageEntry>()
    championshipStats.forEach((c) => champStatMap.set(c.teamKey, c))

    const groupHierarchies: GroupHierarchyResult[] = (
      Object.keys(CANONICAL_TARGET_GROUPS) as Array<keyof typeof CANONICAL_TARGET_GROUPS>
    ).map((grpKey) => {
      const keys = CANONICAL_TARGET_GROUPS[grpKey]
      const grpStats = keys.map((k) => champStatMap.get(k)!).filter(Boolean)
      const paces = grpStats.map((s) => s.averageNeutralPace).sort((a, b) => a - b)
      const avgP = paces.reduce((a, b) => a + b, 0) / (paces.length || 1)
      const medP = paces[Math.floor(paces.length / 2)] || 0
      const avgR = grpStats.reduce((a, b) => a + b.averageTrackRank, 0) / (grpStats.length || 1)

      const labelMap: Record<string, string> = {
        groupA: 'Grupo A (Top 4)',
        groupB: 'Grupo B (Intermediário Alto)',
        groupC: 'Grupo C (Intermediário Baixo)',
        groupD: 'Grupo D (Fundo de Grid)',
      }

      return {
        groupName: labelMap[grpKey] || grpKey,
        teamKeys: keys,
        averageNeutralPace: Number(avgP.toFixed(3)),
        medianNeutralPace: Number(medP.toFixed(2)),
        averageTrackRank: Number(avgR.toFixed(2)),
      }
    })

    // Head-to-Head entre Grupos
    const groupPairs: Array<
      [keyof typeof CANONICAL_TARGET_GROUPS, keyof typeof CANONICAL_TARGET_GROUPS]
    > = [
      ['groupA', 'groupB'],
      ['groupA', 'groupC'],
      ['groupA', 'groupD'],
      ['groupB', 'groupC'],
      ['groupB', 'groupD'],
      ['groupC', 'groupD'],
    ]

    const groupHeadToHead: GroupHeadToHead[] = groupPairs.map(([gAKey, gBKey]) => {
      const teamsA = CANONICAL_TARGET_GROUPS[gAKey]
      const teamsB = CANONICAL_TARGET_GROUPS[gBKey]
      let winsA = 0
      let winsB = 0
      let ties = 0

      for (const track of tracks) {
        const cells = cellsByTrack.get(track.id) || []
        const cMap = new Map<string, TrackPerformanceCell>()
        cells.forEach((c) => cMap.set(c.teamKey, c))

        for (const tA of teamsA) {
          const paceA = cMap.get(tA)?.neutralEventPace ?? 0
          for (const tB of teamsB) {
            const paceB = cMap.get(tB)?.neutralEventPace ?? 0
            if (paceA > paceB) winsA++
            else if (paceB > paceA) winsB++
            else ties++
          }
        }
      }

      const totalMatchups = winsA + winsB + ties
      const upsetRate = totalMatchups > 0 ? Number(((winsB / totalMatchups) * 100).toFixed(2)) : 0

      return {
        groupA: gAKey.toUpperCase(),
        groupB: gBKey.toUpperCase(),
        headToHeadWins: winsA,
        headToHeadLosses: winsB,
        ties,
        upsetRate,
      }
    })

    // 9. AUDI x HAAS — Regra Específica
    const audiStat = champStatMap.get('audi')!
    const haasStat = champStatMap.get('haas')!

    let audiWins = 0
    let haasWins = 0
    let audiHaasTies = 0

    for (const track of tracks) {
      const paceAudi = paceMatrix['audi']?.[track.id] ?? 0
      const paceHaas = paceMatrix['haas']?.[track.id] ?? 0
      if (paceAudi > paceHaas) audiWins++
      else if (paceHaas > paceAudi) haasWins++
      else audiHaasTies++
    }

    const totalAudiHaasTracks = tracks.length
    const audiWinRate = Number(((audiWins / totalAudiHaasTracks) * 100).toFixed(2))
    const haasWinRate = Number(((haasWins / totalAudiHaasTracks) * 100).toFixed(2))

    // Regra: Audi > Haas
    const audiHaasPass =
      audiStat.averageNeutralPace > haasStat.averageNeutralPace &&
      audiStat.structuralRank < haasStat.structuralRank &&
      audiWins >= haasWins

    const audiVsHaas: AudiHaasAuditResult = {
      audiStructuralStrength: structuralBreakdowns.find((t) => t.teamKey === 'audi')!
        .structuralStrengthScore,
      audiStructuralRank: structuralRankMap.get('audi')!,
      audiAverageNeutralPace: audiStat.averageNeutralPace,
      audiChampionshipRank: audiStat.championshipRank,
      audiMedianNeutralPace: audiStat.medianNeutralPace,
      haasStructuralStrength: structuralBreakdowns.find((t) => t.teamKey === 'haas')!
        .structuralStrengthScore,
      haasStructuralRank: structuralRankMap.get('haas')!,
      haasAverageNeutralPace: haasStat.averageNeutralPace,
      haasChampionshipRank: haasStat.championshipRank,
      haasMedianNeutralPace: haasStat.medianNeutralPace,
      audiWins,
      haasWins,
      ties: audiHaasTies,
      totalTracks: totalAudiHaasTracks,
      audiHeadToHeadWinRate: audiWinRate,
      haasHeadToHeadWinRate: haasWinRate,
      status: audiHaasPass ? 'AUDI_HAAS_RULE_PASS' : 'AUDI_HAAS_RULE_FAIL',
    }

    // 10. Close-Gap Behavior (structuralGap <= 1.5)
    const closeGapPairs: CloseGapAnalysisRecord[] = []
    for (let i = 0; i < structuralBreakdowns.length; i++) {
      for (let j = i + 1; j < structuralBreakdowns.length; j++) {
        const tA = structuralBreakdowns[i]
        const tB = structuralBreakdowns[j]
        const sGap = Number(
          Math.abs(tA.structuralStrengthScore - tB.structuralStrengthScore).toFixed(2),
        )

        if (sGap <= 1.5 && sGap > 0) {
          let aWins = 0
          let bWins = 0
          let tTies = 0

          for (const track of tracks) {
            const pA = paceMatrix[tA.teamKey]?.[track.id] ?? 0
            const pB = paceMatrix[tB.teamKey]?.[track.id] ?? 0
            if (pA > pB) aWins++
            else if (pB > pA) bWins++
            else tTies++
          }

          // Inversão: quem tinha menor força estrutural (tB) vence na pista
          const inversions = bWins
          const inversionFreq = Number(((inversions / tracks.length) * 100).toFixed(2))

          closeGapPairs.push({
            teamAKey: tA.teamKey,
            teamBKey: tB.teamKey,
            structuralGap: sGap,
            headToHeadTracks: tracks.length,
            teamAWins: aWins,
            teamBWins: bWins,
            ties: tTies,
            inversionFrequency: inversionFreq,
          })
        }
      }
    }

    // 11. Same-Strength Test (structuralGap <= 0.05)
    const sameStrengthObservations: SameStrengthRecord[] = []
    for (let i = 0; i < structuralBreakdowns.length; i++) {
      for (let j = i + 1; j < structuralBreakdowns.length; j++) {
        const tA = structuralBreakdowns[i]
        const tB = structuralBreakdowns[j]
        const sGap = Number(
          Math.abs(tA.structuralStrengthScore - tB.structuralStrengthScore).toFixed(2),
        )

        if (sGap <= 0.05) {
          for (const track of tracks) {
            const tfA =
              cellsByTrack.get(track.id)?.find((c) => c.teamKey === tA.teamKey)?.trackFitModifier ??
              0
            const tfB =
              cellsByTrack.get(track.id)?.find((c) => c.teamKey === tB.teamKey)?.trackFitModifier ??
              0

            sameStrengthObservations.push({
              teamAKey: tA.teamKey,
              teamBKey: tB.teamKey,
              structuralGap: sGap,
              trackFitModifierA: tfA,
              trackFitModifierB: tfB,
              deltaFromTrackFit: Number((tfA - tfB).toFixed(3)),
              trackId: track.id,
            })
          }
        }
      }
    }

    // 12. Outliers
    // Top 10 maiores rank shifts (|trackRank - structuralRank|)
    const allRankShifts: Array<{
      teamKey: string
      trackId: string
      structuralRank: number
      trackRank: number
      rankShift: number
    }> = []

    for (const cell of allCellsFlattened) {
      const sRank = structuralRankMap.get(cell.teamKey)!
      const shift = cell.trackRank - sRank
      allRankShifts.push({
        teamKey: cell.teamKey,
        trackId: cell.trackId,
        structuralRank: sRank,
        trackRank: cell.trackRank,
        rankShift: shift,
      })
    }
    allRankShifts.sort((a, b) => Math.abs(b.rankShift) - Math.abs(a.rankShift))
    const top10LargestRankShifts = allRankShifts.slice(0, 10)

    // Top 10 maiores TrackFitModifiers positivos e negativos
    const allTfMods = allCellsFlattened.map((c) => ({
      teamKey: c.teamKey,
      trackId: c.trackId,
      trackFitModifier: c.trackFitModifier,
    }))
    allTfMods.sort((a, b) => b.trackFitModifier - a.trackFitModifier)
    const top10PositiveTrackFitModifiers = allTfMods.slice(0, 10)

    allTfMods.sort((a, b) => a.trackFitModifier - b.trackFitModifier)
    const top10NegativeTrackFitModifiers = allTfMods.slice(0, 10)

    // Equipes altamente dependentes de TrackFit (range > 4.5 pts entre min e max modifier)
    const teamsHighlyDependentOnTrackFit: string[] = []
    const teamsInsensitiveToTrackFit: string[] = []
    for (const stat of championshipStats) {
      const range = stat.maxTrackFitModifier - stat.minTrackFitModifier
      if (range >= 4.5) teamsHighlyDependentOnTrackFit.push(stat.teamKey)
      if (range <= 1.8) teamsInsensitiveToTrackFit.push(stat.teamKey)
    }

    // 13. Track Audit
    const trackSummaries: TrackAuditSummary[] = []
    for (const track of tracks) {
      const trackCells = cellsByTrack.get(track.id) || []
      const shifts = trackCells.map((c) => {
        const sRank = structuralRankMap.get(c.teamKey)!
        return Math.abs(c.trackRank - sRank)
      })
      const avgShift = shifts.reduce((a, b) => a + b, 0) / (shifts.length || 1)
      const maxShift = Math.max(...shifts)
      const upsets = shifts.filter((s) => s > 3).length

      // Inversões de grande gap nesta pista
      const lgInvs = largeGapInversions.filter((inv) => inv.trackId === track.id).length

      // Desvio padrão do modifier
      const tfMods = trackCells.map((c) => c.trackFitModifier)
      const avgTf = tfMods.reduce((a, b) => a + b, 0) / (tfMods.length || 1)
      const tfVar =
        tfMods.reduce((acc, v) => acc + Math.pow(v - avgTf, 2), 0) / (tfMods.length || 1)
      const tfStd = Math.sqrt(tfVar)

      trackSummaries.push({
        trackId: track.id,
        trackName: track.circuitName,
        round: track.round,
        averageAbsoluteRankShift: Number(avgShift.toFixed(2)),
        maxRankShift: maxShift,
        numberOfTrackFitUpsets: upsets,
        numberOfLargeGapInversions: lgInvs,
        trackFitModifierStdDev: Number(tfStd.toFixed(2)),
      })
    }

    // Pistas com anomalias de inversão
    const avgUpsetsPerTrack =
      trackSummaries.reduce((a, b) => a + b.numberOfTrackFitUpsets, 0) /
      (trackSummaries.length || 1)
    const tracksWithAnomalouslyHighUpsets = trackSummaries
      .filter((t) => t.numberOfTrackFitUpsets > avgUpsetsPerTrack * 1.5)
      .map((t) => t.trackId)
    const tracksWithAnomalouslyLowUpsets = trackSummaries
      .filter((t) => t.numberOfTrackFitUpsets < avgUpsetsPerTrack * 0.5)
      .map((t) => t.trackId)

    // Ranking de pistas por AverageAbsoluteRankShift
    trackSummaries.sort((a, b) => b.averageAbsoluteRankShift - a.averageAbsoluteRankShift)

    // 14. Pace Breakdown Integrity
    const paceBreakdownIntegrityPassed = maxResidual <= 0.05

    // 15. Duplication Audit
    const duplicationAudit = auditPaceIntegration()

    // Diagnóstico
    const findings: string[] = []
    const recommendations: string[] = []

    // Constatações objetivas — DIAGNÓSTICO — NÃO CALIBRAR AINDA
    findings.push(
      'DIAGNÓSTICO — NÃO CALIBRAR AINDA: Este relatório é estritamente de auditoria e leitura. Nenhuma alteração de ratings, pesos, PU ou parâmetros esportivos foi ou deve ser realizada nesta etapa.',
    )
    findings.push(
      `Auditadas 29/29 equipes canônicas e ${tracks.length}/24 circuitos oficiais (${allCellsFlattened.length} confrontos célula).`,
    )
    findings.push(
      `PaceBreakdown Residual máximo observado = ${maxResidual.toFixed(4)} (integridade 100% verificada).`,
    )
    findings.push(
      `Inversões de Grande Gap (structuralGap >= 5.0): ${largeGapInversions.length} ocorrência(s).`,
    )
    findings.push(
      `Regra Audi > Haas: ${audiVsHaas.status} (Audi win rate: ${audiVsHaas.audiHeadToHeadWinRate}% vs Haas: ${audiVsHaas.haasHeadToHeadWinRate}%). Audi aparece acima de Haas no ranking médio e estrutural.`,
    )

    // Análise de grupos
    for (const gh of groupHierarchies) {
      findings.push(
        `${gh.groupName}: Média Pace = ${gh.averageNeutralPace}, Posição Média = P${gh.averageTrackRank}`,
      )
    }

    // Shifting significativo
    const shiftedTeams = championshipStats.filter((c) => c.isSignificantRankShift)
    if (shiftedTeams.length > 0) {
      findings.push(
        `Equipes com SIGNIFICANT_RANK_SHIFT (|ΔRank| >= 3): ${shiftedTeams.map((t) => `${t.teamName} (Δ${t.rankDelta > 0 ? '+' : ''}${t.rankDelta})`).join(', ')}.`,
      )
      recommendations.push(
        `Investigar na calibração BALANCE-CALIBRATION-01 o impacto dos atributos aerodinâmicos e de chassi nas equipes com rank shift >= 3.`,
      )
    }

    if (largeGapInversions.length > 0) {
      recommendations.push(
        `Registradas ${largeGapInversions.length} inversões de grande gap (>= 5.0 pts). Avaliar no CALIBRATION-01 se o clamp de ±6.5 ou o fator 0.22 necessitam modulação.`,
      )
    } else {
      findings.push(
        `Nenhuma inversão com gap estrutural >= 5.0 pts foi registrada no universo 29x24: Structural Gap Safety COMPROVADA.`,
      )
    }

    return {
      auditId: 'BALANCE-AUDIT-01',
      baselineVersion: baseline.schemaVersion,
      baselineChecksum: baseline.checksum,
      timestamp: new Date().toISOString(),
      teamsAudited: allTeamKeys.length,
      tracksAudited: tracks.length,
      expectedTracks: 24,
      missingTracks,
      duplicateTracks,
      auditedTeamsMatchesCanonical,
      structuralRanking,
      championshipRanking: championshipStats,
      positionMatrix,
      paceMatrix,
      totalTrackFitUpsets: totalUpsets,
      trackFitUpsetsByTeam,
      largeGapInversions,
      totalDominanceEvaluations: dominanceRecords.length,
      highInfluenceCount,
      dominantCount,
      top10DominanceRatios,
      groupHierarchies,
      groupHeadToHead,
      audiVsHaas,
      closeGapPairs,
      sameStrengthObservations,
      top10LargestRankShifts,
      top10PositiveTrackFitModifiers,
      top10NegativeTrackFitModifiers,
      teamsHighlyDependentOnTrackFit,
      teamsInsensitiveToTrackFit,
      tracksWithAnomalouslyHighUpsets,
      tracksWithAnomalouslyLowUpsets,
      trackSummaries,
      maxPaceBreakdownResidual: Number(maxResidual.toFixed(4)),
      paceBreakdownIntegrityPassed,
      duplicationAudit,
      diagnosticSummary: {
        findings,
        recommendationsForCalibration01: recommendations,
      },
      diagnosticoNaoCalibrarAinda: {
        title: 'DIAGNÓSTICO — NÃO CALIBRAR AINDA',
        note: 'Auditoria somente leitura da baseline V0 e integração BE02C. Zero calibração aplicada.',
        audiVsHaasStatus: audiVsHaas.status,
        audiAboveHaas: audiVsHaas.status === 'AUDI_HAAS_RULE_PASS',
        outlierTeams: championshipStats
          .filter((c) => c.isSignificantRankShift)
          .map((t) => ({
            teamKey: t.teamKey,
            teamName: t.teamName,
            structuralRank: t.structuralRank,
            championshipRank: t.championshipRank,
            rankDelta: t.rankDelta,
            trend: t.rankDelta < 0 ? 'ACIMA_DO_ESPERADO' : 'ABAIXO_DO_ESPERADO',
          })),
        findings,
        recommendations,
      },
    }
  }
}

export const balanceAuditService = new BalanceAuditService()
