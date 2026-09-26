import { describe, it, expect } from 'vitest'
import { generateAndPersistDiagnosticLot } from '@/artifacts/audits/generateStatisticalDiagnosticArtifacts'

describe('BUG-INTEGRIDADE-05 — Lote de 1.000 Classificações Canônicas (Materialização de Artefatos)', () => {
  it('Executa e materializa 1.000 classificações completas (Q1, Q2, Q3) sem falhas', () => {
    const lot = generateAndPersistDiagnosticLot()

    expect(lot.sampleCount).toBe(1000)
    expect(lot.jsonArtifact.samples.length).toBe(1000)
    expect(lot.jsonArtifact.integrityValidation.totalSamplesSucceeded).toBe(1000)
    expect(lot.jsonArtifact.integrityValidation.totalSamplesFailed).toBe(0)
    expect(lot.jsonArtifact.teamRankings.length).toBe(12)
    expect(lot.jsonArtifact.driverRankings.length).toBe(24)

    // Reconciliação: total de poles = 1.000
    const totalPoles = lot.jsonArtifact.teamRankings.reduce(
      (acc: number, t: any) => acc + t.poles,
      0,
    )
    expect(totalPoles).toBe(1000)

    // Reconciliação: total de participações de pilotos = 24.000
    const totalDriverEntries = lot.jsonArtifact.driverRankings.reduce(
      (acc: number, d: any) => acc + d.participations,
      0,
    )
    expect(totalDriverEntries).toBe(24000)

    // CSV gerado
    expect(lot.csvArtifact.split('\n').length).toBe(13) // header + 12 equipes

    // Markdown gerado
    expect(lot.markdownArtifact).toContain('1000 / 1000')
    expect(lot.markdownArtifact).toContain('## 5. Checkpoint Fase 2 (Corridas)')
  }, 120000) // Timeout generoso para computar as 1.000 sessões
})
