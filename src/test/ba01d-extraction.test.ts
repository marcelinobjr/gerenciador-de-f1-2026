/**
 * ba01d-extraction.test.ts
 *
 * Suíte de Testes de Sanidade para o Bloco BALANCE-AUDIT-01D:
 * - Valida a integridade da extração diagnóstica read-only (18 seções).
 * - 29 equipes canônicas.
 * - 24 pistas canônicas.
 * - 696 células na matriz.
 * - Checksum V0 intacto: sha_v0_cf5fe0ee.
 * - Nada esportivo mutado (zero bônus, zero recalibração, Audi > Haas respeitado).
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { executeAndPersistBalanceAudit } from '@/scripts/dump-audit'
import { diagnosticExtractionService } from '@/services/diagnosticExtractionService'
import { balanceAuditService } from '@/services/balanceAuditService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { balanceBaselineService } from '@/services/balanceBaselineService'

describe('BALANCE-AUDIT-01D: Extração Diagnóstica Read-Only & Sanidade do Modelo', () => {
  const diagnosis = diagnosticExtractionService.extractFullDiagnosis()
  const rawAudit = diagnosis.rawAudit

  // Executa e assegura persistência antes dos testes
  executeAndPersistBalanceAudit()

  // 1. Integridade do Artefato JSON Persistido
  it('BA01D-01: artefato balance-audit-01.json existe e é válido', () => {
    const artifactPath = path.resolve(process.cwd(), 'src/artifacts/audits/balance-audit-01.json')

    expect(fs.existsSync(artifactPath)).toBe(true)
    const rawContent = fs.readFileSync(artifactPath, 'utf-8')
    const parsed = JSON.parse(rawContent)
    expect(parsed.auditId).toBe('BALANCE-AUDIT-01')
    expect(parsed.teamsAudited).toBe(29)
    expect(parsed.tracksAudited).toBe(24)
    expect(parsed.baselineChecksum).toBe('sha_v0_cf5fe0ee')
    expect(parsed.diagnostics).toBeDefined()
    expect(parsed.diagnostics.structuralRankingP1P29).toHaveLength(29)
    expect(parsed.diagnostics.championshipRankingP1P29).toHaveLength(29)
  })

  // 2. 29 equipes e 24 pistas (696 células)
  it('BA01D-02: matriz exata 29 equipes × 24 pistas = 696 células', () => {
    expect(rawAudit.teamsAudited).toBe(29)
    expect(rawAudit.tracksAudited).toBe(24)
    expect(diagnosis.structuralRankingP1P29).toHaveLength(29)
    expect(diagnosis.championshipRankingP1P29).toHaveLength(29)
    expect(diagnosis.structuralVsChampionship).toHaveLength(29)
    expect(diagnosis.teamTrackFitBias).toHaveLength(29)
    expect(diagnosis.trackTrackFitBias).toHaveLength(24)

    const teamKeys = Object.keys(rawAudit.positionMatrix)
    expect(teamKeys).toHaveLength(29)

    let totalCells = 0
    for (const key of teamKeys) {
      const row = rawAudit.positionMatrix[key]
      expect(Object.keys(row)).toHaveLength(24)
      totalCells += Object.keys(row).length
    }
    expect(totalCells).toBe(696)
  })

  // 3. Baseline V0 intacta com Checksum sha_v0_cf5fe0ee
  it('BA01D-03: baseline V0 intacta e checksum inalterado sha_v0_cf5fe0ee', () => {
    const v0 = BASELINE_V0_DATA
    expect(v0.checksum).toBe('sha_v0_cf5fe0ee')
    expect(v0.schemaVersion).toBe('v0')
    expect(v0.totalTeamsCount).toBe(29)

    const baseline = structuralStrengthService.getBaselineV0()
    expect(baseline.checksum).toBe('sha_v0_cf5fe0ee')
    expect(Object.keys(baseline.teams)).toHaveLength(29)

    const compareResult = balanceBaselineService.compareBalanceWithBaseline('v0')
    expect(compareResult.hasDifferences).toBe(false)
    expect(compareResult.checksumValid).toBe(true)
  })

  // 4. Seção 1 & 2: Rankings P1–P29 consistentes
  it('BA01D-04: rankings estrutural e de campeonato cobrem P1–P29 sem buracos', () => {
    for (let i = 0; i < 29; i++) {
      expect(diagnosis.structuralRankingP1P29[i].pos).toBe(i + 1)
      expect(diagnosis.structuralRankingP1P29[i].structuralStrength).toBeGreaterThan(0)
      expect(diagnosis.championshipRankingP1P29[i].pos).toBe(i + 1)
      expect(diagnosis.championshipRankingP1P29[i].averageNeutralPace).toBeGreaterThan(0)
      expect(diagnosis.championshipRankingP1P29[i].medianNeutralPace).toBeGreaterThan(0)
    }

    // P1 estrutural >= P29 estrutural
    expect(diagnosis.structuralRankingP1P29[0].structuralStrength).toBeGreaterThan(
      diagnosis.structuralRankingP1P29[28].structuralStrength,
    )
    // P1 campeonato >= P29 campeonato
    expect(diagnosis.championshipRankingP1P29[0].averageNeutralPace).toBeGreaterThan(
      diagnosis.championshipRankingP1P29[28].averageNeutralPace,
    )
  })

  // 5. Seção 3 & 4: Δ Rank (Structural - Championship) e Top 10 Ganhos/Perdas
  it('BA01D-05: delta de rank definido com convenção canônica e top ganhos/perdas populados', () => {
    for (const item of diagnosis.structuralVsChampionship) {
      expect(item.rankDelta).toBe(item.structuralRank - item.championshipRank)
      expect(item.absRankDelta).toBe(Math.abs(item.rankDelta))
    }

    expect(diagnosis.top10Gains.length).toBeGreaterThan(0)
    expect(diagnosis.top10Gains.length).toBeLessThanOrEqual(10)
    for (const g of diagnosis.top10Gains) {
      expect(g.rankDelta).toBeGreaterThan(0)
      expect(g.bestTrack).toBeTruthy()
      expect(g.worstTrack).toBeTruthy()
    }

    expect(diagnosis.top10Losses.length).toBeGreaterThan(0)
    expect(diagnosis.top10Losses.length).toBeLessThanOrEqual(10)
    for (const l of diagnosis.top10Losses) {
      expect(l.rankDelta).toBeLessThan(0)
      expect(l.bestTrack).toBeTruthy()
      expect(l.worstTrack).toBeTruthy()
    }
  })

  // 6. Seções 5 & 6: Equipes Acima e Abaixo do esperado
  it('BA01D-06: equipes acima e abaixo do esperado contêm métricas completas de pistas', () => {
    for (const a of diagnosis.teamsAboveExpected) {
      expect(a.rankDelta).toBeGreaterThan(0)
      expect(a.tracksAbove + a.tracksEqual + a.tracksBelow).toBe(24)
      expect(a.pctTracksAbove).toBeGreaterThanOrEqual(0)
      expect(a.pctTracksAbove).toBeLessThanOrEqual(100)
    }

    for (const b of diagnosis.teamsBelowExpected) {
      expect(b.rankDelta).toBeLessThan(0)
      expect(b.tracksAbove + b.tracksEqual + b.tracksBelow).toBe(24)
      expect(b.pctTracksAbove).toBeGreaterThanOrEqual(0)
      expect(b.pctTracksAbove).toBeLessThanOrEqual(100)
    }
  })

  // 7. Seção 7: Large Gap Inversions
  it('BA01D-07: large gap inversions registradas de forma segura', () => {
    expect(diagnosis.largeGapInversionsSection.count).toBe(rawAudit.largeGapInversions.length)
    expect(diagnosis.largeGapInversionsSection.label).toBeTruthy()
    if (diagnosis.largeGapInversionsSection.count === 0) {
      expect(diagnosis.largeGapInversionsSection.label).toBe('LARGE_GAP_INVERSION: 0')
    }
  })

  // 8. Seção 8 & 9: Dominance e Close-gap
  it('BA01D-08: top 20 dominance e close-gap com frequências de inversão válidas', () => {
    expect(diagnosis.trackFitDominanceTop20).toHaveLength(20)
    expect(diagnosis.dominanceStats.totalComparisons).toBeGreaterThan(0)
    expect(diagnosis.dominanceStats.highInfluencePct).toBeGreaterThanOrEqual(0)

    expect(diagnosis.closeGapAnalysis.totalPairs).toBeGreaterThan(0)
    expect(diagnosis.closeGapAnalysis.highestAlternationPairs.length).toBeGreaterThan(0)
    for (const p of diagnosis.closeGapAnalysis.highestAlternationPairs) {
      expect(p.structuralGap).toBeLessThanOrEqual(1.5)
      expect(p.inversionFrequency).toBeGreaterThanOrEqual(0)
      expect(p.inversionFrequency).toBeLessThanOrEqual(100)
    }
  })

  // 9. Seção 10: Grupos A–D e Upset Rate
  it('BA01D-09: hierarquia dos grupos canônicos respeitada', () => {
    expect(diagnosis.groupHierarchies).toHaveLength(4)
    expect(diagnosis.groupHeadToHead).toHaveLength(6)

    // Grupo A pace > Grupo B pace > Grupo C pace > Grupo D pace
    const pA = diagnosis.groupHierarchies[0].averageNeutralPace
    const pB = diagnosis.groupHierarchies[1].averageNeutralPace
    const pC = diagnosis.groupHierarchies[2].averageNeutralPace
    const pD = diagnosis.groupHierarchies[3].averageNeutralPace
    expect(pA).toBeGreaterThan(pB)
    expect(pB).toBeGreaterThan(pC)
    expect(pC).toBeGreaterThan(pD)
  })

  // 10. Seção 11: Audi vs Haas
  it('BA01D-10: Audi vence Haas na média e na maioria dos circuitos', () => {
    const ah = diagnosis.audiVsHaasFull
    expect(ah.summary.status).toBe('AUDI_HAAS_RULE_PASS')
    expect(ah.summary.audiWins).toBeGreaterThan(ah.summary.haasWins)
    expect(ah.all24Tracks).toHaveLength(24)
    expect(ah.audiWinsCount + ah.haasWinsCount + ah.tiesCount).toBe(24)
    expect(ah.tracksWhereHaasBeatAudi.length).toBe(ah.haasWinsCount)
  })

  // 11. Seções 12, 13, 14, 15: Pistas e Distribuições
  it('BA01D-11: métricas de pistas, estatísticas globais e viés calculados', () => {
    expect(diagnosis.trackRankingByShift).toHaveLength(24)
    expect(diagnosis.globalTrackFitStats.minTf).toBeGreaterThan(0)
    expect(diagnosis.globalTrackFitStats.maxTf).toBeLessThanOrEqual(100)
    expect(diagnosis.teamTrackFitBias).toHaveLength(29)
    expect(diagnosis.trackTrackFitBias).toHaveLength(24)
  })

  // 12. Seções 16, 17, 18: Hipóteses, Decision Table e 8 Respostas
  it('BA01D-12: hipóteses A–F, decision table e 8 respostas preenchidas objetivamente', () => {
    expect(diagnosis.diagnosticHypothesesAF).toHaveLength(6)
    expect(diagnosis.decisionTable.length).toBeGreaterThan(0)

    const r = diagnosis.diagnostico8Respostas
    expect(r.q1_escalaAdequada.resposta).toBeTruthy()
    expect(r.q2_clampAdequado.resposta).toBeTruthy()
    expect(r.q3_distribuicaoCentrada.resposta).toBeTruthy()
    expect(r.q4_audiHaasResolvido.resposta).toBeTruthy()
    expect(r.q5_gruposRespeitados.resposta).toBeTruthy()
    expect(r.q6_inversoesGrandesControladas.resposta).toBeTruthy()
    expect(r.q7_alternanciaCurtoAlcance.resposta).toBeTruthy()
    expect(r.q8_prontoParaCalibracao01.resposta).toBeTruthy()
  })
})
