/**
 * fc02d-baseline-audit.test.ts
 *
 * Suíte de Testes FC02D-01..10 cobrindo:
 * - Auditoria consome a engine canônica existente sem desvios
 * - Monte Carlo determinístico com mesma seed
 * - Tabela BEFORE gerada com as 12 equipes completas
 * - Audi vs Haas medido e reportado como finding
 * - Williams e Andretti medidos e reportados
 * - Formato e persistência do relatório BEFORE de referência
 */

import { describe, it, expect } from 'vitest'
import {
  teamPerformanceBaselineAuditService,
  auditTeamPerformanceBaseline,
} from '@/services/teamPerformanceBaselineAuditService'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import baselineBeforeData from '@/data/baseline-2026-before.json'

describe('FC02D — FASE A: Auditoria e Medição do Baseline de Performance 2026', () => {
  // --------------------------------------------------------------------------
  // FC02D-01: Auditoria cobre exatamente as 12 equipes e 24 pilotos oficiais
  // --------------------------------------------------------------------------
  it('FC02D-01: Auditoria cobre exatamente as 12 equipes oficiais e 24 pilotos titulares de 2026', () => {
    expect(OFFICIAL_GRID_TEAMS).toHaveLength(12)

    const sample = auditTeamPerformanceBaseline({
      seed: 42,
      qualifyingIterations: 5,
      raceIterations: 5,
      totalRaceLaps: 5,
    })

    expect(sample.teamsCount).toBe(12)
    expect(sample.totalDriversCount).toBe(24)
    expect(sample.teamsStats).toHaveLength(12)

    const teamKeys = sample.teamsStats.map((t) => t.teamKey)
    OFFICIAL_GRID_TEAMS.forEach((official) => {
      expect(teamKeys).toContain(official.key)
    })
  })

  // --------------------------------------------------------------------------
  // FC02D-02: Monte Carlo é 100% determinístico com a mesma seed
  // --------------------------------------------------------------------------
  it('FC02D-02: Monte Carlo determinístico — mesma seed produz métricas idênticas', () => {
    const run1 = auditTeamPerformanceBaseline({
      seed: 9999,
      qualifyingIterations: 10,
      raceIterations: 10,
      totalRaceLaps: 5,
    })

    const run2 = auditTeamPerformanceBaseline({
      seed: 9999,
      qualifyingIterations: 10,
      raceIterations: 10,
      totalRaceLaps: 5,
    })

    expect(run1.teamsStats).toEqual(run2.teamsStats)
    expect(run1.findings).toEqual(run2.findings)
  })

  // --------------------------------------------------------------------------
  // FC02D-03: Sementes diferentes produzem variações estocásticas naturais
  // --------------------------------------------------------------------------
  it('FC02D-03: Sementes diferentes produzem distribuições estocásticas distintas sem scripts fixos', () => {
    const runA = auditTeamPerformanceBaseline({
      seed: 1234,
      qualifyingIterations: 10,
      raceIterations: 10,
      totalRaceLaps: 5,
    })

    const runB = auditTeamPerformanceBaseline({
      seed: 5678,
      qualifyingIterations: 10,
      raceIterations: 10,
      totalRaceLaps: 5,
    })

    // Alguma equipe terá variação de avgGridPosition ou avgFinishPosition
    const diff = runA.teamsStats.some(
      (t, idx) => t.avgFinishPosition !== runB.teamsStats[idx].avgFinishPosition,
    )
    expect(diff).toBe(true)
  })

  // --------------------------------------------------------------------------
  // FC02D-04: Tabela BEFORE computa todas as colunas obrigatórias
  // --------------------------------------------------------------------------
  it('FC02D-04: Tabela BEFORE computa métricas obrigatórias de grid, corrida, vitórias, pódios e pontos', () => {
    const report = auditTeamPerformanceBaseline({
      seed: 2026,
      qualifyingIterations: 15,
      raceIterations: 15,
      totalRaceLaps: 5,
    })

    report.teamsStats.forEach((t) => {
      expect(typeof t.avgGridPosition).toBe('number')
      expect(t.avgGridPosition).toBeGreaterThanOrEqual(1)
      expect(t.avgGridPosition).toBeLessThanOrEqual(24)

      expect(typeof t.avgFinishPosition).toBe('number')
      expect(t.avgFinishPosition).toBeGreaterThanOrEqual(1)
      expect(t.avgFinishPosition).toBeLessThanOrEqual(24)

      expect(typeof t.polePercentage).toBe('number')
      expect(typeof t.winPercentage).toBe('number')
      expect(typeof t.podiumPercentage).toBe('number')
      expect(typeof t.avgPointsPerRace).toBe('number')
      expect(typeof t.dnfPercentage).toBe('number')
    })
  })

  // --------------------------------------------------------------------------
  // FC02D-05: Auditoria consome engine canônica sem teamPositionCap ou winChance artificiais
  // --------------------------------------------------------------------------
  it('FC02D-05: Proibição de scripts arbitrários — sem teamPositionCap, winChance, podiumChance forçados', () => {
    const report = auditTeamPerformanceBaseline({
      seed: 777,
      qualifyingIterations: 5,
      raceIterations: 5,
      totalRaceLaps: 5,
    })

    // Checar que o relatório lista as proibições respeitadas
    expect(report.targetHierarchy.specialRules).toContain(
      'Proibido: teamPositionCap, winChance, podiumChance, forcedGridPosition, frontRunnerFlag',
    )

    // E os dados técnicos são os oficiais da engine canônica (ex: chassisRating derivado de carTechnicalService)
    const merc = report.teamsStats.find((t) => t.teamKey === 'mercedes')!
    expect(merc.chassisRating).toBeGreaterThanOrEqual(95)
    expect(merc.engineSupplier).toBe('Mercedes')
  })

  // --------------------------------------------------------------------------
  // FC02D-06: Audi vs Haas é APENAS MEDIDO e registrado como finding
  // --------------------------------------------------------------------------
  it('FC02D-06: Audi vs Haas é estritamente medido e registrado (sem calibrar nem forçar nesta Fase A)', () => {
    const report = auditTeamPerformanceBaseline({
      seed: 20260315,
      qualifyingIterations: 20,
      raceIterations: 20,
      totalRaceLaps: 5,
    })

    const audiHaasFinding = report.findings.find((f) => f.rule.includes('Audi > Haas'))

    expect(audiHaasFinding).toBeDefined()
    expect(['SATISFIED', 'DIVERGENT']).toContain(audiHaasFinding?.status)
    expect(audiHaasFinding?.actualValue).toMatch(/Audi P\d+(\.\d+)? vs Haas P\d+(\.\d+)?/)
  })

  // --------------------------------------------------------------------------
  // FC02D-07: Williams e Andretti têm verificação de não dominância top-3
  // --------------------------------------------------------------------------
  it('FC02D-07: Williams e Andretti são monitoradas para garantir que não dominem top-3 como ritmo médio', () => {
    const report = auditTeamPerformanceBaseline({
      seed: 20260315,
      qualifyingIterations: 20,
      raceIterations: 20,
      totalRaceLaps: 5,
    })

    const williamsFinding = report.findings.find((f) =>
      f.rule.includes('Williams NÃO pode ter ritmo médio de top-3'),
    )
    const andrettiFinding = report.findings.find((f) =>
      f.rule.includes('Andretti NÃO pode ter ritmo médio de top-3'),
    )

    expect(williamsFinding).toBeDefined()
    expect(andrettiFinding).toBeDefined()
  })

  // --------------------------------------------------------------------------
  // FC02D-08: Relação 70/30 preservada nos ratings técnicos
  // --------------------------------------------------------------------------
  it('FC02D-08: Relação canônica 70% chassi e 30% motor preservada nos atributos de cada equipe', () => {
    const report = auditTeamPerformanceBaseline({
      seed: 20260315,
      qualifyingIterations: 2,
      raceIterations: 2,
      totalRaceLaps: 2,
    })

    report.teamsStats.forEach((t) => {
      const expectedCarPerf = Number((t.chassisRating * 0.7 + t.puRating * 0.3).toFixed(1))
      expect(Math.abs(t.carPerfRating - expectedCarPerf)).toBeLessThanOrEqual(0.1)
    })
  })

  // --------------------------------------------------------------------------
  // FC02D-09: Integridade do gerador Mulberry32 centralizado
  // --------------------------------------------------------------------------
  it('FC02D-09: createRng gera números pseudo-aleatórios uniformes no intervalo [0, 1)', () => {
    const rng = teamPerformanceBaselineAuditService.createRng(12345)
    for (let i = 0; i < 100; i++) {
      const val = rng()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })

  // --------------------------------------------------------------------------
  // FC02D-10: Resumo textual e identificação da Fase A BEFORE
  // --------------------------------------------------------------------------
  it('FC02D-10: Relatório exporta sumário textual e fase FASE_A_BEFORE para posterior comparação com B e C', () => {
    const report = auditTeamPerformanceBaseline({
      seed: 20260315,
      qualifyingIterations: 5,
      raceIterations: 5,
      totalRaceLaps: 3,
    })

    expect(report.phase).toBe('FASE_A_BEFORE')
    expect(report.summaryText).toContain(
      'FC02D FASE A — Relatório BEFORE de Baseline de Desempenho 2026',
    )
    expect(report.summaryText).toContain('Ordem Média de Chegada')
  })

  // --------------------------------------------------------------------------
  // FC02D-11: Arquivo canônico BEFORE gerado e persistido com 12 equipes
  // --------------------------------------------------------------------------
  it('FC02D-11: Arquivo canônico baseline-2026-before.json contém 12 equipes e relatório FASE_A_BEFORE', () => {
    expect(baselineBeforeData).toBeDefined()
    expect(baselineBeforeData.phase).toBe('FASE_A_BEFORE')
    expect(baselineBeforeData.teamsCount).toBe(12)
    expect(baselineBeforeData.totalDriversCount).toBe(24)
    expect(baselineBeforeData.teamsStats).toHaveLength(12)
    expect(baselineBeforeData.findings.length).toBeGreaterThanOrEqual(5)

    const keys = baselineBeforeData.teamsStats.map((t: any) => t.teamKey)
    OFFICIAL_GRID_TEAMS.forEach((t) => {
      expect(keys).toContain(t.key)
    })
  })

  // --------------------------------------------------------------------------
  // FC02D-12: Análise e auditoria dos Gaps BEFORE vs Hierarquia Alvo 2026
  // --------------------------------------------------------------------------
  it('FC02D-12: Identificação de Gaps na tabela BEFORE sem aplicar alterações no baseline', () => {
    expect(baselineBeforeData.targetHierarchy.groupA).toEqual([
      'Mercedes',
      'Ferrari',
      'McLaren',
      'Red Bull',
    ])
    expect(baselineBeforeData.targetHierarchy.groupB).toEqual(['Racing Bulls', 'Alpine', 'Audi'])
    expect(baselineBeforeData.targetHierarchy.groupC).toEqual(['Haas', 'Williams', 'Aston Martin'])
    expect(baselineBeforeData.targetHierarchy.groupD).toEqual(['Cadillac', 'Andretti'])

    // Williams e Andretti não podem ter ritmo médio de top-3
    const williamsFinding = baselineBeforeData.findings.find((f: any) =>
      f.rule.includes('Williams NÃO pode ter ritmo médio de top-3'),
    )
    const andrettiFinding = baselineBeforeData.findings.find((f: any) =>
      f.rule.includes('Andretti NÃO pode ter ritmo médio de top-3'),
    )
    expect(williamsFinding?.status).toBe('SATISFIED')
    expect(andrettiFinding?.status).toBe('SATISFIED')

    // Audi vs Haas: registrar status atual (observacional para Fase B futura)
    const audiHaasFinding = baselineBeforeData.findings.find((f: any) =>
      f.rule.includes('Audi > Haas'),
    )
    expect(audiHaasFinding).toBeDefined()
    expect(typeof audiHaasFinding.detail).toBe('string')
  })
})
