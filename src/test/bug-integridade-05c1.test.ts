import { describe, it, expect, beforeEach } from 'vitest'
import { f1Service, FREE_ENGINE_QUOTA } from '@/services/f1Service'
import type { TeamModel } from '@/types/f1'

describe('BUG-INTEGRIDADE-05C1 — Cota de Unidades de Potência sem Bloqueio e Idempotência', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  const createMockTeam = (overrides: Partial<TeamModel> = {}): TeamModel => ({
    id: 'team_ferrari_05c1',
    name: 'Scuderia Ferrari HP',
    color: '#E8002D',
    chassis_level: 80,
    aero_level: 80,
    strategy_level: 80,
    budget: 150000000,
    cost_cap_spent: 40000000,
    engine_pool_used: 1,
    engine_supplier: 'Ferrari',
    active_engine_wear: 15,
    engine_history: [
      {
        id: 1,
        wear: 15,
        status: 'instalado',
        supplier: 'Ferrari',
        introducedRound: 1,
      },
    ],
    ...overrides,
  })

  it('1. Cota regulamentar exportada é exatamente 4 (FREE_ENGINE_QUOTA = 4)', () => {
    expect(FREE_ENGINE_QUOTA).toBe(4)
    expect(f1Service.FREE_ENGINE_QUOTA).toBe(4)
    expect(f1Service.MAX_ALLOWED_ENGINES).toBe(4)
  })

  it('2. Introdução de PU2, PU3 e PU4 (dentro da cota) tem penalidade ZERO', async () => {
    let currentTeam = createMockTeam()

    // PU 2
    const res2 = await f1Service.introduceNewEngine(currentTeam, 18000000)
    expect(res2.engineNumber).toBe(2)
    expect(res2.penaltyPositions).toBe(0)
    expect(res2.team.engine_pool_used).toBe(2)
    currentTeam = res2.team

    // PU 3
    const res3 = await f1Service.introduceNewEngine(currentTeam, 18000000)
    expect(res3.engineNumber).toBe(3)
    expect(res3.penaltyPositions).toBe(0)
    expect(res3.team.engine_pool_used).toBe(3)
    currentTeam = res3.team

    // PU 4 (limite da cota)
    const res4 = await f1Service.introduceNewEngine(currentTeam, 18000000)
    expect(res4.engineNumber).toBe(4)
    expect(res4.penaltyPositions).toBe(0)
    expect(res4.team.engine_pool_used).toBe(4)

    // Nenhuma penalidade acumulada
    const penalties = res4.team.grid_penalties || []
    expect(penalties.length).toBe(0)
  })

  it('3. Introdução de PU5 (1ª fora da cota) é criada, NÃO é bloqueada e recebe 10 posições de penalidade', async () => {
    const teamAtQuota = createMockTeam({
      engine_pool_used: 4,
      engine_history: [
        { id: 1, wear: 60, status: 'reserva', supplier: 'Ferrari', introducedRound: 1 },
        { id: 2, wear: 45, status: 'reserva', supplier: 'Ferrari', introducedRound: 5 },
        { id: 3, wear: 40, status: 'reserva', supplier: 'Ferrari', introducedRound: 10 },
        { id: 4, wear: 20, status: 'instalado', supplier: 'Ferrari', introducedRound: 15 },
      ],
    })

    const res5 = await f1Service.introduceNewEngine(teamAtQuota, 18000000)
    expect(res5.engineNumber).toBe(5)
    expect(res5.penaltyPositions).toBe(10)
    expect(res5.team.engine_pool_used).toBe(5)

    const history = res5.team.engine_history || []
    expect(history.length).toBe(5)
    const pu5 = history.find((e) => e.id === 5)
    expect(pu5).toBeDefined()
    expect(pu5?.status).toBe('instalado')
    expect(pu5?.exceedsQuota).toBe(true)

    // Penalidade registrada no array regulamentar
    const penalties = res5.team.grid_penalties || []
    expect(penalties.length).toBe(1)
    expect(penalties[0].unitIndex).toBe(5)
    expect(penalties[0].positions).toBe(10)
  })

  it('4. Introdução de PU6 (2ª fora da cota) é criada, NÃO é bloqueada e recebe 5 posições de penalidade', async () => {
    const teamWithPU5 = createMockTeam({
      engine_pool_used: 5,
      engine_history: [
        { id: 1, wear: 60, status: 'reserva', supplier: 'Ferrari', introducedRound: 1 },
        { id: 2, wear: 45, status: 'reserva', supplier: 'Ferrari', introducedRound: 5 },
        { id: 3, wear: 40, status: 'reserva', supplier: 'Ferrari', introducedRound: 10 },
        { id: 4, wear: 35, status: 'reserva', supplier: 'Ferrari', introducedRound: 15 },
        {
          id: 5,
          wear: 25,
          status: 'instalado',
          supplier: 'Ferrari',
          introducedRound: 18,
          exceedsQuota: true,
        },
      ],
      grid_penalties: [
        {
          id: 'pu_pen_team_ferrari_05c1_u5',
          unitIndex: 5,
          positions: 10,
          reason: 'Excesso de cota anual',
          appliedAt: new Date().toISOString(),
        },
      ],
    })

    const res6 = await f1Service.introduceNewEngine(teamWithPU5, 18000000)
    expect(res6.engineNumber).toBe(6)
    expect(res6.penaltyPositions).toBe(5)
    expect(res6.team.engine_pool_used).toBe(6)

    const history = res6.team.engine_history || []
    expect(history.length).toBe(6)
    const pu6 = history.find((e) => e.id === 6)
    expect(pu6).toBeDefined()
    expect(pu6?.status).toBe('instalado')
    expect(pu6?.exceedsQuota).toBe(true)

    // Penalidades acumuladas: PU5 (10) + PU6 (5)
    const penalties = res6.team.grid_penalties || []
    expect(penalties.length).toBe(2)
    expect(penalties.some((p) => p.unitIndex === 6 && p.positions === 5)).toBe(true)
  })

  it('5. PU1–PU4 permanecem intactas ao introduzir PU5 e PU6', async () => {
    const originalPU1to4 = [
      { id: 1, wear: 75, status: 'reserva' as const, supplier: 'Ferrari', introducedRound: 1 },
      { id: 2, wear: 50, status: 'reserva' as const, supplier: 'Ferrari', introducedRound: 5 },
      { id: 3, wear: 40, status: 'reserva' as const, supplier: 'Ferrari', introducedRound: 10 },
      { id: 4, wear: 30, status: 'instalado' as const, supplier: 'Ferrari', introducedRound: 15 },
    ]

    const team = createMockTeam({
      engine_pool_used: 4,
      engine_history: [...originalPU1to4],
    })

    const res5 = await f1Service.introduceNewEngine(team, 18000000)
    const res6 = await f1Service.introduceNewEngine(res5.team, 18000000)

    const history = res6.team.engine_history || []
    // Verificar que PU1, PU2 e PU3 mantiveram seus desgastes originais
    expect(history.find((e) => e.id === 1)?.wear).toBe(75)
    expect(history.find((e) => e.id === 2)?.wear).toBe(50)
    expect(history.find((e) => e.id === 3)?.wear).toBe(40)
    // PU4 agora é reserva, mantendo seu desgaste
    expect(history.find((e) => e.id === 4)?.wear).toBe(30)
    expect(history.find((e) => e.id === 4)?.status).toBe('reserva')
    // Não foram removidas ou corrompidas
    expect(history.map((e) => e.id)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('6. IDs são únicos, fornecedor e atributos-base são preservados, e desgaste inicial é padrão (0%)', async () => {
    const team = createMockTeam({
      engine_supplier: 'Audi',
      engine_pool_used: 4,
      engine_history: [
        { id: 1, wear: 80, status: 'reserva', supplier: 'Audi', introducedRound: 1 },
        { id: 2, wear: 70, status: 'reserva', supplier: 'Audi', introducedRound: 5 },
        { id: 3, wear: 50, status: 'reserva', supplier: 'Audi', introducedRound: 10 },
        { id: 4, wear: 30, status: 'instalado', supplier: 'Audi', introducedRound: 14 },
      ],
    })

    const res5 = await f1Service.introduceNewEngine(team, 18000000)
    const res6 = await f1Service.introduceNewEngine(res5.team, 18000000)

    const history = res6.team.engine_history || []
    const ids = history.map((e) => e.id)
    const uniqueIds = new Set(ids)
    expect(ids.length).toBe(uniqueIds.size) // Unicidade estrita

    const pu5 = history.find((e) => e.id === 5)
    const pu6 = history.find((e) => e.id === 6)

    expect(pu5?.supplier).toBe('Audi')
    expect(pu6?.supplier).toBe('Audi')
    expect(pu5?.wear).toBe(0)
    expect(pu6?.wear).toBe(0)
    expect(pu6?.status).toBe('instalado')
    expect(pu5?.status).toBe('reserva')
  })

  it('7. Idempotência: chamadas repetidas ou save/reload não duplicam PU nem penalidades regulamentares', async () => {
    const teamWithPU5 = createMockTeam({
      engine_pool_used: 5,
      engine_history: [
        { id: 1, wear: 80, status: 'reserva', supplier: 'Ferrari', introducedRound: 1 },
        { id: 2, wear: 70, status: 'reserva', supplier: 'Ferrari', introducedRound: 5 },
        { id: 3, wear: 50, status: 'reserva', supplier: 'Ferrari', introducedRound: 10 },
        { id: 4, wear: 30, status: 'reserva', supplier: 'Ferrari', introducedRound: 14 },
        {
          id: 5,
          wear: 0,
          status: 'instalado',
          supplier: 'Ferrari',
          introducedRound: 18,
          exceedsQuota: true,
        },
      ],
      grid_penalties: [
        {
          id: 'pu_pen_team_ferrari_05c1_u5',
          unitIndex: 5,
          positions: 10,
          reason: 'Excesso de cota anual',
          appliedAt: '2026-05-01T12:00:00Z',
        },
      ],
    })

    // Simular que o usuário ou interface recarrega a página onde o estado já continha a PU5
    // Ou uma segunda chamada de save/reload
    // Se a função for chamada com uma equipe cujo histórico já tem a PU5 e engine_pool_used = 4 (ou 5),
    // a verificação por ID não duplica.
    const resDuplicate = await f1Service.introduceNewEngine(
      {
        ...teamWithPU5,
        engine_pool_used: 4, // Simulando discrepância de cache/reload
      },
      18000000,
    )

    // Não deve criar PU5 duplicada (deve reconhecer que PU5 já existe e retornar de forma idempotente)
    const history = resDuplicate.team.engine_history || []
    const pu5Count = history.filter((e) => e.id === 5).length
    expect(pu5Count).toBe(1)

    // Penalidade também não pode ser duplicada
    const penalties = resDuplicate.team.grid_penalties || []
    const pen5Count = penalties.filter((p) => p.unitIndex === 5).length
    expect(pen5Count).toBe(1)
  })

  it('8. Generalização estrita: funciona para qualquer quota além de 4 (ex: PU7, PU8...) com 5 posições de penalidade', async () => {
    let team = createMockTeam({
      engine_pool_used: 6,
      engine_history: [
        { id: 1, wear: 80, status: 'reserva', supplier: 'Ferrari', introducedRound: 1 },
        { id: 2, wear: 70, status: 'reserva', supplier: 'Ferrari', introducedRound: 4 },
        { id: 3, wear: 60, status: 'reserva', supplier: 'Ferrari', introducedRound: 8 },
        { id: 4, wear: 50, status: 'reserva', supplier: 'Ferrari', introducedRound: 12 },
        {
          id: 5,
          wear: 40,
          status: 'reserva',
          supplier: 'Ferrari',
          introducedRound: 16,
          exceedsQuota: true,
        },
        {
          id: 6,
          wear: 20,
          status: 'instalado',
          supplier: 'Ferrari',
          introducedRound: 20,
          exceedsQuota: true,
        },
      ],
      grid_penalties: [
        { id: 'p5', unitIndex: 5, positions: 10, reason: '', appliedAt: '' },
        { id: 'p6', unitIndex: 6, positions: 5, reason: '', appliedAt: '' },
      ],
    })

    // PU 7
    const res7 = await f1Service.introduceNewEngine(team, 18000000)
    expect(res7.engineNumber).toBe(7)
    expect(res7.penaltyPositions).toBe(5)
    expect(res7.team.grid_penalties?.length).toBe(3)
    team = res7.team

    // PU 8
    const res8 = await f1Service.introduceNewEngine(team, 18000000)
    expect(res8.engineNumber).toBe(8)
    expect(res8.penaltyPositions).toBe(5)
    expect(res8.team.grid_penalties?.length).toBe(4)
  })
})
