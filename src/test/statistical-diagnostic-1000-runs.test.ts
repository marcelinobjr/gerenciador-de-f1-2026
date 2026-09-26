import { describe, it, expect } from 'vitest'
import { generateAndPersistDiagnosticLot } from '@/artifacts/audits/generateStatisticalDiagnosticArtifacts'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('STATISTICAL-DIAGNOSTIC-01 — Execução e Materialização do Lote de 1.000 Classificações Canônicas', () => {
  it('Executa e materializa 1.000 classificações completas (Q1, Q2, Q3) com integridade estrita e artefatos em disco', () => {
    const lot = generateAndPersistDiagnosticLot(1000)

    // 1. Amostra
    expect(lot.sampleCount).toBe(1000)
    expect(lot.jsonArtifact.samples.length).toBe(1000)
    expect(lot.jsonArtifact.integrityValidation.totalSamplesAttempted).toBe(1000)
    expect(lot.jsonArtifact.integrityValidation.totalSamplesSucceeded).toBe(1000)
    expect(lot.jsonArtifact.integrityValidation.totalSamplesFailed).toBe(0)

    // 2. Integridade de cada evento: 24 pilotos em Q1, 18 em Q2, 10 em Q3
    for (let i = 0; i < lot.jsonArtifact.samples.length; i++) {
      const s = lot.jsonArtifact.samples[i]
      expect(s.driverResults).toHaveLength(24)
      const uniqueDrivers = new Set(s.driverResults.map((d: any) => d.driverId))
      expect(uniqueDrivers.size).toBe(24)

      const q1Elim = s.driverResults.filter((d: any) => d.eliminationStage === 'Q1')
      const q2Elim = s.driverResults.filter((d: any) => d.eliminationStage === 'Q2')
      const q3Class = s.driverResults.filter((d: any) => d.eliminationStage === 'Q3')
      expect(q1Elim).toHaveLength(6)
      expect(q2Elim).toHaveLength(8)
      expect(q3Class).toHaveLength(10)

      const positions = s.driverResults
        .map((d: any) => d.finalPosition)
        .sort((a: number, b: number) => a - b)
      expect(positions).toEqual(Array.from({ length: 24 }, (_, idx) => idx + 1))
      expect(s.poleDriverId).toBeTruthy()
    }

    // 3. Reconciliação dos totais
    expect(lot.jsonArtifact.teamRankings.length).toBe(12)
    expect(lot.jsonArtifact.driverRankings.length).toBe(24)

    const totalPoles = lot.jsonArtifact.teamRankings.reduce(
      (acc: number, t: any) => acc + t.poles,
      0,
    )
    expect(totalPoles).toBe(1000)

    const totalDriverEntries = lot.jsonArtifact.driverRankings.reduce(
      (acc: number, d: any) => acc + d.participations,
      0,
    )
    expect(totalDriverEntries).toBe(24000)

    // 4. Validação dos artefatos em disco
    const jsonPath = path.resolve(
      process.cwd(),
      'src/artifacts/audits/statistical-diagnostic-1000.json',
    )
    const csvPath = path.resolve(
      process.cwd(),
      'src/artifacts/audits/statistical-diagnostic-1000.csv',
    )
    const mdPath = path.resolve(
      process.cwd(),
      'src/artifacts/audits/statistical-diagnostic-1000.md',
    )

    expect(fs.existsSync(jsonPath)).toBe(true)
    expect(fs.existsSync(csvPath)).toBe(true)
    expect(fs.existsSync(mdPath)).toBe(true)

    const diskJson = fs.readFileSync(jsonPath, 'utf-8')
    const diskCsv = fs.readFileSync(csvPath, 'utf-8')
    const diskMd = fs.readFileSync(mdPath, 'utf-8')

    expect(diskJson.length).toBeGreaterThan(100000)
    expect(diskCsv.split('\n').length).toBe(13) // header + 12 equipes
    expect(diskMd).toContain('# DIAGNÓSTICO ESTATÍSTICO DE CLASSIFICAÇÃO')
    expect(diskMd).toContain('1000 / 1000')
    expect(diskMd).toContain('## 3. Confronto Audi vs Haas')
    expect(diskMd).toContain('## 5. Checkpoint Fase 2 (Corridas)')

    // 5. Dump das métricas reais para auditoria no log
    console.warn('=== STATISTICAL DIAGNOSTIC LOT 1.000 AUDIT EXTRACTION ===')
    console.warn(
      'EXECUTION_METRICS:',
      JSON.stringify({
        sampleCount: lot.sampleCount,
        durationMs: lot.jsonArtifact.metadata?.executionDurationMs,
        audiVsHaas: lot.jsonArtifact.notableFindings?.audiVsHaasAnalysis,
        topTeams: lot.jsonArtifact.teamRankings.map((t: any) => ({
          rank: t.observedQualiRank,
          team: t.teamName,
          avgPos: t.avgPosition,
          medianPos: t.medianPosition,
          poles: t.poles,
          top3: t.eventsWithTop3,
          top10: t.eventsWithTop10,
          bothQ3: t.eventsWithBothInQ3,
          q1Elim: t.totalQ1Eliminations,
          structuralRank: t.structuralRank,
          delta: t.deltaVsStructuralRank,
        })),
        topDrivers: lot.jsonArtifact.driverRankings.slice(0, 10).map((d: any) => ({
          name: d.driverName,
          team: d.teamName,
          avgPos: d.avgPosition,
          medianPos: d.medianPosition,
          poles: d.poles,
          top3: d.top3,
          q3Adv: d.q3Advancements,
          q1Elim: d.q1Eliminations,
        })),
        notableFindings: lot.jsonArtifact.notableFindings,
      }),
    )
    console.warn('=== END STATISTICAL DIAGNOSTIC LOT 1.000 AUDIT EXTRACTION ===')
  }, 180000) // Timeout generoso para simulação de 1.000 sessões completas
})
