/**
 * balance-audit-persist.test.ts
 *
 * Teste dedicado permanente que materializa no disco o artefato canônico:
 * src/artifacts/audits/balance-audit-01.json
 *
 * Executado diretamente pelo runner do Vitest durante o ciclo de QA,
 * garantindo a existência do arquivo com todas as 18 seções diagnósticas
 * sem depender de console.log ou comandos manuais de shell.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { executeAndPersistBalanceAudit } from '@/scripts/dump-audit'
import { POST_02C_AUDIT_DATA } from '@/artifacts/audits/balanceAuditPost02cArtifact'

describe('BALANCE-AUDIT-01D: Persistência Permanente do Artefato JSON', () => {
  it('materializa e valida src/artifacts/audits/balance-audit-post02c.json e balance-audit-01.json no disco', () => {
    // 1. Materialização e validação de balance-audit-post02c.json (CALIBRATION-01A)
    const post02cPath = path.resolve(
      process.cwd(),
      'src/artifacts/audits/balance-audit-post02c.json',
    )
    fs.writeFileSync(post02cPath, JSON.stringify(POST_02C_AUDIT_DATA, null, 2), 'utf-8')
    expect(fs.existsSync(post02cPath)).toBe(true)

    const rawPost02c = fs.readFileSync(post02cPath, 'utf-8')
    expect(rawPost02c.length).toBeGreaterThan(1000)
    const parsedPost02c = JSON.parse(rawPost02c)
    expect(parsedPost02c.metadata.auditPhase).toBe('CALIBRATION-01A')
    expect(parsedPost02c.metadata.v0Checksum).toBe('sha_v0_cf5fe0ee')
    expect(parsedPost02c.structuralRanking29).toHaveLength(29)
    expect(parsedPost02c.grid2026Ranking12).toHaveLength(12)
    expect(parsedPost02c.grid2026Qualifying).toHaveLength(12)
    expect(parsedPost02c.grid2026Race).toHaveLength(12)

    // 2. Materialização e validação de balance-audit-01.json (BALANCE-AUDIT-01)
    const result = executeAndPersistBalanceAudit()
    expect(result).toBeDefined()
    expect(result.report).toBeDefined()
    expect(result.diagnosis).toBeDefined()

    const targetPath = path.resolve(process.cwd(), 'src/artifacts/audits/balance-audit-01.json')
    expect(fs.existsSync(targetPath)).toBe(true)

    const rawContent = fs.readFileSync(targetPath, 'utf-8')
    expect(rawContent.length).toBeGreaterThan(50000)

    // Dump das seções necessárias para a resposta final fiel aos dados reais
    console.warn('--- BEGIN BALANCE AUDIT ARTIFACT EXTRACTION ---')
    const parsed = JSON.parse(rawContent)
    console.warn(
      'AUDIT_METRICS:',
      JSON.stringify({
        auditId: parsed.auditId,
        teamsAudited: parsed.teamsAudited,
        tracksAudited: parsed.tracksAudited,
        baselineChecksum: parsed.baselineChecksum,
        structuralRanking: parsed.diagnostics.structuralRankingP1P29,
        championshipRanking: parsed.diagnostics.championshipRankingP1P29,
        structuralVsChampionship: parsed.diagnostics.structuralVsChampionship,
        top10Gains: parsed.diagnostics.top10Gains,
        top10Losses: parsed.diagnostics.top10Losses,
        largeGapInversionsSection: parsed.diagnostics.largeGapInversionsSection,
        dominanceStats: parsed.diagnostics.dominanceStats,
        audiVsHaasFull: parsed.diagnostics.audiVsHaasFull,
        groupHierarchies: parsed.diagnostics.groupHierarchies,
        groupHeadToHead: parsed.diagnostics.groupHeadToHead,
        trackRankingByShift: parsed.diagnostics.trackRankingByShift,
        globalTrackFitStats: parsed.diagnostics.globalTrackFitStats,
        teamTrackFitBias: parsed.diagnostics.teamTrackFitBias,
        trackTrackFitBias: parsed.diagnostics.trackTrackFitBias,
        diagnostico8Respostas: parsed.diagnostics.diagnostico8Respostas,
        maxPaceBreakdownResidual: result.report.maxPaceBreakdownResidual,
        paceBreakdownIntegrityPassed: result.report.paceBreakdownIntegrityPassed,
        duplicationAudit: result.report.duplicationAudit,
      }),
    )
    console.warn('--- END BALANCE AUDIT ARTIFACT EXTRACTION ---')
    expect(parsed.auditId).toBe('BALANCE-AUDIT-01')
    expect(parsed.teamsAudited).toBe(29)
    expect(parsed.tracksAudited).toBe(24)
    expect(parsed.baselineChecksum).toBe('sha_v0_cf5fe0ee')
    expect(parsed.diagnostics).toBeDefined()

    // Validação das 18 seções estruturadas no artefato persistido
    const d = parsed.diagnostics
    expect(d.structuralRankingP1P29).toHaveLength(29) // 1. Structural Ranking
    expect(d.championshipRankingP1P29).toHaveLength(29) // 2. Championship Ranking
    expect(d.structuralVsChampionship).toHaveLength(29) // 3. Δ Rank
    expect(d.top10Gains.length).toBeGreaterThan(0) // 4. Top Ganhos
    expect(d.top10Losses.length).toBeGreaterThan(0) // 4. Top Perdas
    expect(d.teamsAboveExpected.length).toBeGreaterThan(0) // 5. Equipes Acima
    expect(d.teamsBelowExpected.length).toBeGreaterThan(0) // 6. Equipes Abaixo
    expect(d.largeGapInversionsSection).toBeDefined() // 7. Large Gap Inversions
    expect(d.trackFitDominanceTop20).toHaveLength(20) // 8. Dominance Top 20
    expect(d.dominanceStats.totalComparisons).toBeGreaterThan(0) // 8. Dominance Stats
    expect(d.closeGapAnalysis.pairs.length).toBeGreaterThan(0) // 9. Close-Gap
    expect(d.groupHierarchies).toHaveLength(4) // 10. Grupos A–D
    expect(d.groupHeadToHead).toHaveLength(6) // 10. Head-to-Head Grupos
    expect(d.audiVsHaasFull.all24Tracks).toHaveLength(24) // 11. Audi x Haas
    expect(d.trackRankingByShift).toHaveLength(24) // 12. Ranking 24 pistas
    expect(d.globalTrackFitStats.meanTf).toBeGreaterThan(0) // 13. Distribuição Global
    expect(d.teamTrackFitBias).toHaveLength(29) // 14. Viés por equipe
    expect(d.trackTrackFitBias).toHaveLength(24) // 15. Viés por pista
    expect(d.diagnosticHypothesesAF).toHaveLength(6) // 16. Hipóteses A–F
    expect(d.decisionTable.length).toBeGreaterThan(0) // 17. Decision Table
    expect(d.diagnostico8Respostas.q1_escalaAdequada).toBeDefined() // 18. Diagnóstico 8 respostas
  })
})
