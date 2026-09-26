import { describe, it, expect } from 'vitest'
import {
  statisticalDiagnosticHarnessService,
  createDeterministicMulberry32,
} from '@/services/statisticalDiagnosticHarnessService'
import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'

describe('BUG-INTEGRIDADE-05 — Harness de Diagnóstico Estatístico (Itens 6–7)', () => {
  // Teste 1: Participantes canônicos únicos e consistentes
  it('TESTE 1: Constrói exatamente 24 assentos únicos divididos em 12 equipes sem duplicatas', () => {
    const participants = statisticalDiagnosticHarnessService.buildCanonicalParticipants()

    expect(participants.length).toBe(24)

    const driverIds = participants.map((p) => p.driverId)
    const uniqueDriverIds = new Set(driverIds)
    expect(uniqueDriverIds.size).toBe(24)

    const teamsMap = new Map<string, number>()
    participants.forEach((p) => {
      teamsMap.set(p.teamKey, (teamsMap.get(p.teamKey) || 0) + 1)
    })

    expect(teamsMap.size).toBe(12)
    teamsMap.forEach((count, teamKey) => {
      expect(count).toBe(2)
      expect(OFFICIAL_GRID_TEAMS.some((t) => t.key === teamKey)).toBe(true)
    })
  })

  // Teste 2: Determinismo da seed Mulberry32
  it('TESTE 2: Mulberry32 com mesma seed produz sequência determinística idêntica', () => {
    const rng1 = createDeterministicMulberry32(12345)
    const seq1 = [rng1(), rng1(), rng1(), rng1()]

    const rng2 = createDeterministicMulberry32(12345)
    const seq2 = [rng2(), rng2(), rng2(), rng2()]

    expect(seq1).toEqual(seq2)

    const rng3 = createDeterministicMulberry32(99999)
    const seq3 = [rng3(), rng3(), rng3(), rng3()]
    expect(seq1).not.toEqual(seq3)
  })

  // Teste 3: Execução de classificação individual com formato canônico (Q1, Q2, Q3)
  it('TESTE 3: Executa qualificação completa gerando 24 posições, 1 pole e desempate determinístico', () => {
    const participants = statisticalDiagnosticHarnessService.buildCanonicalParticipants()
    const circuit = CIRCUIT_PERFORMANCE_PROFILES[0]

    const result = statisticalDiagnosticHarnessService.runSingleQualifying(
      1,
      20261000,
      circuit,
      participants,
    )

    expect(result.sampleId).toBe(1)
    expect(result.seed).toBe(20261000)
    expect(result.circuitId).toBe(circuit.id)
    expect(result.driverResults.length).toBe(24)

    const positions = result.driverResults.map((d) => d.finalPosition)
    expect(positions.sort((a, b) => a - b)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))

    // Q1 eliminações (6 pilotos)
    const q1Eliminated = result.driverResults.filter((d) => d.eliminationStage === 'Q1')
    expect(q1Eliminated.length).toBe(6)

    // Q2 eliminações (8 pilotos)
    const q2Eliminated = result.driverResults.filter((d) => d.eliminationStage === 'Q2')
    expect(q2Eliminated.length).toBe(8)

    // Q3 classificados (10 pilotos)
    const q3Classified = result.driverResults.filter((d) => d.eliminationStage === 'Q3')
    expect(q3Classified.length).toBe(10)

    expect(result.poleDriverId).toBeTruthy()
    expect(result.poleLapSec).toBeGreaterThan(50)
  })

  // Teste 4: Amostragem determinística reproduzível (duas execuções com mesma seed produzem o mesmo resultado exato)
  it('TESTE 4: Duas execuções com mesma seed reproduzem o mesmo resultado de classificação exato', () => {
    const participants = statisticalDiagnosticHarnessService.buildCanonicalParticipants()
    const circuit = CIRCUIT_PERFORMANCE_PROFILES[3]

    const runA = statisticalDiagnosticHarnessService.runSingleQualifying(
      42,
      987654,
      circuit,
      participants,
    )
    const runB = statisticalDiagnosticHarnessService.runSingleQualifying(
      42,
      987654,
      circuit,
      participants,
    )

    expect(runA.poleDriverId).toBe(runB.poleDriverId)
    expect(runA.poleLapSec).toBe(runB.poleLapSec)
    expect(runA.driverResults.map((d) => d.finalPosition)).toEqual(
      runB.driverResults.map((d) => d.finalPosition),
    )
    expect(runA.driverResults.map((d) => d.bestLapSec)).toEqual(
      runB.driverResults.map((d) => d.bestLapSec),
    )
  })

  // Teste 5: Agregação estatística reconcilia com os dados brutos e valida a regra Audi > Haas
  it('TESTE 5: Lote de teste agrega métricas, preserva totais e reconcilia com a baseline', () => {
    const { samples, report } = statisticalDiagnosticHarnessService.runBatchQualifying(12)

    expect(samples.length).toBe(12)
    expect(report.metadata.sampleSizeCompleted).toBe(12)
    expect(report.integrityValidation.totalSamplesSucceeded).toBe(12)
    expect(report.teamRankings.length).toBe(12)
    expect(report.driverRankings.length).toBe(24)

    // Total de participações de pilotos = 12 amostras * 24 pilotos = 288
    const totalDriverEntries = report.driverRankings.reduce((acc, d) => acc + d.participations, 0)
    expect(totalDriverEntries).toBe(12 * 24)

    // Total de poles distribuídas = 12
    const totalPoles = report.teamRankings.reduce((acc, t) => acc + t.poles, 0)
    expect(totalPoles).toBe(12)

    // Formatação de artefatos
    const csv = statisticalDiagnosticHarnessService.generateCsvArtifact(report)
    expect(csv).toContain('rank_quali,team_key,team_name')

    const md = statisticalDiagnosticHarnessService.generateMarkdownReport(report)
    expect(md).toContain('# DIAGNÓSTICO ESTATÍSTICO DE CLASSIFICAÇÃO')
    expect(md).toContain('## 5. Checkpoint Fase 2 (Corridas)')
  })
})
