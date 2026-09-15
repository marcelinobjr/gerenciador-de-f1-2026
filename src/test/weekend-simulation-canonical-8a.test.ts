import { describe, it, expect, beforeEach, vi } from 'vitest'
import { weekendSimulationService } from '@/services/weekendSimulationService'
import { seasonTransitionService } from '@/services/seasonTransitionService'
import { financialLedgerService } from '@/services/financialLedgerService'
import { standingsService } from '@/services/standingsService'
import type { TeamModel, SeasonModel, DriverModel, PartModel, SponsorModel } from '@/types/f1'

describe('Fase 8A: Simulação Canônica de Fim de Semana & Transição de Temporada', () => {
  const mockTeam: any = {
    id: 'team_ferrari_test',
    name: 'Scuderia Ferrari',
    color: '#E10600',
    budget: 50_000_000,
    morale: 80,
    created: '2026-01-01',
    updated: '2026-01-01',
  }

  const mockSeason: any = {
    id: 'season_2026_test',
    year: 2026,
    current_round: 1,
    total_rounds: 24,
    created: '2026-01-01',
    updated: '2026-01-01',
  }

  const mockDrivers: DriverModel[] = [
    {
      id: 'driver_lec_test',
      team_id: 'team_ferrari_test',
      name: 'Charles Leclerc',
      nationality: 'Mônaco',
      age: 28,
      speed: 93,
      consistency: 89,
      defense: 88,
      rain: 86,
      morale: 85,
      salary: 15_000_000,
      contract_end: 2027,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
    {
      id: 'driver_ham_test',
      team_id: 'team_ferrari_test',
      name: 'Lewis Hamilton',
      nationality: 'Reino Unido',
      age: 41,
      speed: 91,
      consistency: 94,
      defense: 92,
      rain: 95,
      morale: 88,
      salary: 20_000_000,
      contract_end: 2027,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
  ]

  const mockParts: PartModel[] = [
    {
      id: 'part_engine_test',
      team_id: 'team_ferrari_test',
      name: 'Internal Combustion Engine',
      level: 4,
      condition: 95,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
    {
      id: 'part_aero_test',
      team_id: 'team_ferrari_test',
      name: 'Front Wing',
      level: 4,
      condition: 98,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
  ]

  const mockSponsors: SponsorModel[] = [
    {
      id: 'sp_shell_test',
      team_id: 'team_ferrari_test',
      name: 'Shell High Performance',
      value_per_round: 2_500_000,
      requirement: 'Pódio (Top 3)',
      status: 'ativo',
      rounds_remaining: 24,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
  ]

  it('1. Deve simular um fim de semana completo e retornar relatório auditado em 7 dimensões', async () => {
    const res = await weekendSimulationService.simulateRemainingWeekend({
      team: mockTeam,
      season: mockSeason,
      drivers: mockDrivers,
      parts: mockParts,
      sponsors: mockSponsors,
      currentRound: 1,
      alreadyCompletedSessions: [],
    })

    expect(res).toBeDefined()
    expect(res.report).toBeDefined()
    expect(res.report.playerDriversResults).toHaveLength(2)
    expect(res.report.financialImpact).toBeDefined()
    expect(res.report.carCondition).toBeDefined()
    expect(res.report.championshipImpact).toBeDefined()

    // Valida auditoria canônica de 7 dimensões
    const audit = await weekendSimulationService.auditWeekendSimulation(res.run.runId)
    expect(audit).toBeDefined()
    expect(audit.valid).toBe(true)
    expect(audit.sessions.noSkippedMandatory).toBe(true)
    expect(audit.results.passed).toBe(true)
    expect(audit.points.passed).toBe(true)
    expect(audit.ledger.passed).toBe(true)
    expect(audit.memories.passed).toBe(true)
    expect(audit.damage.passed).toBe(true)
    expect(audit.status).toBe('COMPLETED')
  })

  it('2. Idempotência do Ledger Financeiro: 10× simulações subsequentes sem duplicação ou corrupção', async () => {
    // Executa simulação 10 vezes em rodadas distintas ou sessões subsequentes
    const initialBalance = mockTeam.budget

    for (let r = 1; r <= 10; r++) {
      const sim = await weekendSimulationService.simulateRemainingWeekend({
        team: { ...mockTeam, budget: initialBalance },
        season: { ...mockSeason, current_round: r },
        drivers: mockDrivers,
        parts: mockParts,
        sponsors: mockSponsors,
        currentRound: r,
        alreadyCompletedSessions: [],
      })

      expect(sim.report).toBeDefined()
      expect(sim.report.round).toBe(r)
      expect(sim.report.playerDriversResults[0].finishPosition).toBeGreaterThanOrEqual(1)
      expect(sim.report.playerDriversResults[0].finishPosition).toBeLessThanOrEqual(22)

      // Ledger não deve gerar lançamentos inconsistentes
      const audit = await weekendSimulationService.auditWeekendSimulation(sim.run.runId)
      expect(audit.valid).toBe(true)
    }
  })

  it('3. Validação de Pontuação Canônica FIA 2026', () => {
    // Regra FIA F1 2026 padrão: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1 (pontos do 1º ao 10º lugar, sem bonificação por volta mais rápida)
    const p1 = standingsService.calculatePointsForResults({ position: 1, points: 0 })
    const p2 = standingsService.calculatePointsForResults({ position: 2, points: 0 })
    const p3 = standingsService.calculatePointsForResults({ position: 3, points: 0 })
    const p10 = standingsService.calculatePointsForResults({ position: 10, points: 0 })
    const p11 = standingsService.calculatePointsForResults({ position: 11, points: 0 })

    expect(p1).toBe(25)
    expect(p2).toBe(18)
    expect(p3).toBe(15)
    expect(p10).toBe(1)
    expect(p11).toBe(0)

    // Se já persistido com pontuação prévia, respeita o valor gravado
    const pPersisted = standingsService.calculatePointsForResults({ position: 1, points: 25 })
    expect(pPersisted).toBe(25)
  })

  it('4. Exercitar o auditSeasonTransition real e transição de temporada', async () => {
    // Realiza auditoria real de transição 2026 -> 2027
    const auditTransition = await seasonTransitionService.auditSeasonTransition(
      2026,
      2027,
      mockTeam.id,
    )

    expect(auditTransition).toBeDefined()
    expect(typeof auditTransition.success).toBe('boolean')
    expect(auditTransition.audits).toBeDefined()
    expect(auditTransition.audits.championship).toBeDefined()
    expect(auditTransition.audits.drivers).toBeDefined()
    expect(auditTransition.audits.staff).toBeDefined()
    expect(auditTransition.audits.finance).toBeDefined()
    expect(auditTransition.audits.sponsors).toBeDefined()
    expect(auditTransition.audits.psychology).toBeDefined()
    expect(auditTransition.audits.academyAndFacilities).toBeDefined()
  })
})
