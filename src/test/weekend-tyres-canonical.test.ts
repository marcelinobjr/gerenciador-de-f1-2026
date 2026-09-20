/**
 * SUÍTE DE TESTES T23–T32 — REVISÃO CANÔNICA DA ALOCAÇÃO DE PNEUS FIA 2026
 *
 * Testes especificados:
 * - T23 GP Padrão: 2 Hard, 3 Medium, 8 Soft, 4 Inter, 3 Wet = 20 jogos por piloto
 * - T24 Independência: Piloto 1 gasta Soft -> inventário do Piloto 2 intacto
 * - T25 Persistência: TL1 consome pneus -> reload -> TL2 com mesmos tyreSetIds e desgaste
 * - T26 Classificação: pneu usado no TL permanece usado na quali sem alocação nova
 * - T27 Corrida: pneu usado mantém condição real e só é elegível se < 90% desgaste
 * - T28 Reserva (17G): substituto herda inventário restante do assento sem reset nem duplicação
 * - T29 Chuva (17K): intermediários (4) e wets (3) finitos e persistentes
 * - T30 Sprint: distribuição própria 2/4/6 + 4/3 = 19 jogos por piloto
 * - T31 Duplicação: reload, retries e troca de sessão mantêm estritamente os 20 tyreSetIds
 * - T32 Soma Canônica: 20 jogos × 2 pilotos × 12 equipes = 480 jogos no evento
 * + Teste de ponta a ponta do fluxo completo de sessão até parada nos boxes
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  STANDARD_GP_TYRE_ALLOCATION,
  SPRINT_GP_TYRE_ALLOCATION,
  getCanonicalTyreAllocation,
  getCanonicalTireAllotment,
  getEventPhysicalCompounds,
  resolvePhysicalCompoundForRole,
  ROUND_PHYSICAL_COMPOUND_MAP,
} from '@/services/canonicalTyreAllocationService'
import {
  canonicalWeekendTyrePersistence,
  getWeekendTireStorageKey,
} from '@/services/canonicalWeekendTyrePersistence'
import { createInitialTireInventory } from '@/lib/f1-tire-system'
import type { TireSetItem } from '@/types/f1'

// Mock simples de window.localStorage em ambiente Node/Vitest
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  })
}

describe('REVISÃO CANÔNICA DE ALOCAÇÃO DE PNEUS FIA 2026 — T23 a T32', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  // T23: GP Padrão — 2 Duro, 3 Médio, 8 Macio, 4 Inter, 3 Wet (20 jogos = 80 pneus por piloto)
  it('T23: GP padrão aloca exatamente 20 jogos (2 Hard, 3 Medium, 8 Soft, 4 Inter, 3 Wet) por piloto', () => {
    const rules = getCanonicalTyreAllocation(1, false)
    expect(rules.totalSetsPerDriver).toBe(20)
    expect(rules.totalTyresPerDriver).toBe(80)
    expect(rules.slicks.duro).toBe(2)
    expect(rules.slicks.medio).toBe(3)
    expect(rules.slicks.macio).toBe(8)
    expect(rules.slicks.total).toBe(13)
    expect(rules.wet.intermediario).toBe(4)
    expect(rules.wet.chuva_extrema).toBe(3)
    expect(rules.wet.total).toBe(7)

    const inventory = createInitialTireInventory('driver_1', { isSprint: false, round: 1 })
    expect(inventory).toHaveLength(20)
    expect(inventory.filter((s) => s.compound === 'duro')).toHaveLength(2)
    expect(inventory.filter((s) => s.compound === 'medio')).toHaveLength(3)
    expect(inventory.filter((s) => s.compound === 'macio')).toHaveLength(8)
    expect(inventory.filter((s) => s.compound === 'intermediario')).toHaveLength(4)
    expect(inventory.filter((s) => s.compound === 'chuva_extrema')).toHaveLength(3)
  })

  // T24: Independência entre pilotos
  it('T24: Cada piloto tem inventário próprio e isolado; uso do Carro 1 não afeta Carro 2', () => {
    const seasonId = 'season_2026_test'
    const round = 1
    const p1 = 'drv_bortoleto'
    const p2 = 'drv_hulkenberg'

    const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [p1, p2],
    })

    expect(inventories[p1]).toHaveLength(20)
    expect(inventories[p2]).toHaveLength(20)

    // Piloto 1 usa 1 jogo de pneus Macios no TL1
    const p1Softs = inventories[p1].filter((s) => s.compound === 'macio')
    const targetSetId = p1Softs[0].id

    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId: p1,
      tyreSetId: targetSetId,
      lapsAdded: 12,
      finalWearPct: 35,
    })

    const reloaded = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [p1, p2],
    })

    // Carro 1 sofreu desgaste
    const p1UpdatedSet = reloaded[p1].find((s) => s.id === targetSetId)
    expect(p1UpdatedSet?.wear).toBe(35)
    expect(p1UpdatedSet?.lapsUsed).toBe(12)

    // Carro 2 permaneceu 100% zerado e intacto
    const p2Softs = reloaded[p2].filter((s) => s.compound === 'macio')
    p2Softs.forEach((set) => {
      expect(set.wear).toBe(0)
      expect(set.lapsUsed).toBe(0)
    })
  })

  // T25: Persistência entre sessões (TL1 -> Reload -> TL2)
  it('T25: Desgaste e identificadores de pneus persistem de TL1 até TL2 através de recarregamentos', () => {
    const seasonId = 'season_2026_persist'
    const round = 1
    const driverId = 'drv_norris'

    // Início do evento: alocação inicial
    const initial = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [driverId],
    })
    const initialSetIds = initial[driverId].map((s) => s.id)

    // Simula uso no TL1
    const mediumSet = initial[driverId].find((s) => s.compound === 'medio')!
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId,
      tyreSetId: mediumSet.id,
      lapsAdded: 15,
      finalWearPct: 28,
    })

    // Simula reload da página antes do TL2
    const reloadedForTL2 = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [driverId],
    })

    expect(reloadedForTL2[driverId]).toHaveLength(20)
    expect(reloadedForTL2[driverId].map((s) => s.id)).toEqual(initialSetIds)
    const checkedMedium = reloadedForTL2[driverId].find((s) => s.id === mediumSet.id)!
    expect(checkedMedium.wear).toBe(28)
    expect(checkedMedium.lapsUsed).toBe(15)
    expect(checkedMedium.condition).toBe(72)
  })

  // T26: Classificação mantém histórico sem nova alocação
  it('T26: Sessão de Classificação utiliza o mesmo inventário sem regenerar 20 jogos novos', () => {
    const seasonId = 'season_quali'
    const round = 1
    const driverId = 'drv_leclerc'

    canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [driverId],
    })

    // Piloto gastou 2 jogos de Soft no TL2 e TL3
    const inv = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)!
      .inventoriesByDriver[driverId]
    const softSets = inv.filter((s) => s.compound === 'macio')
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId,
      tyreSetId: softSets[0].id,
      lapsAdded: 6,
      finalWearPct: 40,
    })
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId,
      tyreSetId: softSets[1].id,
      lapsAdded: 10,
      finalWearPct: 65,
    })

    // Entra na Classificação
    const qualiInventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [driverId],
    })

    const qualiSofts = qualiInventories[driverId].filter((s) => s.compound === 'macio')
    expect(qualiSofts).toHaveLength(8)
    const usedInPractice = qualiSofts.filter((s) => s.wear > 0)
    expect(usedInPractice).toHaveLength(2)
    const freshSofts = qualiSofts.filter((s) => s.wear === 0)
    expect(freshSofts).toHaveLength(6)
  })

  // T27: Corrida mantém desgaste real e respeita elegibilidade
  it('T27: Pneu usado previamente mantém desgaste real e jogo com >= 90% não fica elegível para pit stop normal', () => {
    const seasonId = 'season_race_pit'
    const round = 1
    const driverId = 'drv_piastri'

    const initial = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [driverId],
    })

    const hardSet = initial[driverId].find((s) => s.compound === 'duro')!
    // Pneu levado à exaustão (92% desgaste)
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId,
      tyreSetId: hardSet.id,
      lapsAdded: 35,
      finalWearPct: 92,
    })

    const currentInv = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)!
      .inventoriesByDriver[driverId]
    const eligibleSets = currentInv.filter((s) => !s.isFitted && (s.wear || 0) < 90)

    expect(eligibleSets.find((s) => s.id === hardSet.id)).toBeUndefined()
    expect(eligibleSets.length).toBe(19) // 20 - 1 exaurido
  })

  // T28: Piloto Reserva (17G)
  it('T28: Piloto reserva assume inventário restante do carro/titular sem gerar segunda alocação de 20 jogos', () => {
    const seasonId = 'season_reserve_17g'
    const round = 1
    const primaryDriver = 'drv_albon'
    const reserveDriver = 'drv_colapinto'

    // Albon inicia o fim de semana e roda no TL1
    const invPrimary = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [primaryDriver],
      primaryDriverIds: [primaryDriver],
    })

    const setUsed = invPrimary[primaryDriver][0]
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId: primaryDriver,
      tyreSetId: setUsed.id,
      lapsAdded: 14,
      finalWearPct: 45,
    })

    // Albon tem indisposição; Colapinto (reserva) assume a vaga no Carro 1
    const invWithReserve = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [reserveDriver],
      primaryDriverIds: [primaryDriver], // vaga herdada do Albon
    })

    // Reserva deve possuir exatamente 20 jogos (os mesmos da vaga), sem criar 20 novos
    expect(invWithReserve[reserveDriver]).toHaveLength(20)
    const reserveUsedSet = invWithReserve[reserveDriver].find((s) => s.id === setUsed.id)
    expect(reserveUsedSet).toBeDefined()
    expect(reserveUsedSet?.wear).toBe(45)
    expect(reserveUsedSet?.lapsUsed).toBe(14)
    expect(reserveUsedSet?.driverId).toBe(reserveDriver)

    // O arquivo de dados do fim de semana NÃO pode conter 40 jogos para esse carro
    const rawData = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)!
    expect(rawData.driverAliases?.[reserveDriver]).toBe(primaryDriver)
  })

  // T29: Chuva (17K) — Finitos e persistentes
  it('T29: Pneus de chuva (4 Intermediários e 3 Chuva Extrema) são estoque finito e não infinitos', () => {
    const seasonId = 'season_wet_17k'
    const round = 1
    const driverId = 'drv_hamilton'

    const inv = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [driverId],
    })

    const inters = inv[driverId].filter((s) => s.compound === 'intermediario')
    const wets = inv[driverId].filter((s) => s.compound === 'chuva_extrema')

    expect(inters).toHaveLength(4)
    expect(wets).toHaveLength(3)

    // Gasta o primeiro intermediário
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId,
      tyreSetId: inters[0].id,
      lapsAdded: 18,
      finalWearPct: 52,
    })

    const reloaded = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)!
      .inventoriesByDriver[driverId]
    const updatedInter = reloaded.find((s) => s.id === inters[0].id)!
    expect(updatedInter.wear).toBe(52)
    expect(updatedInter.lapsUsed).toBe(18)
    // Quantidade total permanece 4, nunca vira infinita
    expect(reloaded.filter((s) => s.compound === 'intermediario')).toHaveLength(4)
  })

  // T30: Formato Sprint — 19 jogos (2/4/6 + 4/3)
  it('T30: Weekend no formato Sprint utiliza distribuição canônica de 19 jogos (2 Duros, 4 Médios, 6 Macios)', () => {
    // Rodada 2 é China (Sprint)
    const rules = getCanonicalTyreAllocation(2, true)
    expect(rules.format).toBe('sprint')
    expect(rules.totalSetsPerDriver).toBe(19)
    expect(rules.totalTyresPerDriver).toBe(76)
    expect(rules.slicks.duro).toBe(2)
    expect(rules.slicks.medio).toBe(4)
    expect(rules.slicks.macio).toBe(6)
    expect(rules.slicks.total).toBe(12)
    expect(rules.wet.intermediario).toBe(4)
    expect(rules.wet.chuva_extrema).toBe(3)

    const sprintInv = createInitialTireInventory('drv_sprint', { isSprint: true, round: 2 })
    expect(sprintInv).toHaveLength(19)
    expect(sprintInv.filter((s) => s.compound === 'duro')).toHaveLength(2)
    expect(sprintInv.filter((s) => s.compound === 'medio')).toHaveLength(4)
    expect(sprintInv.filter((s) => s.compound === 'macio')).toHaveLength(6)
    expect(sprintInv.filter((s) => s.compound === 'intermediario')).toHaveLength(4)
    expect(sprintInv.filter((s) => s.compound === 'chuva_extrema')).toHaveLength(3)
  })

  // T31: Duplicação — Reload, retries e trocas de tela não acumulam jogos
  it('T31: Múltiplas chamadas de recuperação mantêm estritamente 20 tyreSetIds sem duplicação', () => {
    const seasonId = 'season_dup_check'
    const round = 1
    const driverId = 'drv_russell'

    for (let i = 0; i < 5; i++) {
      const inv = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId,
        round,
        driverIds: [driverId],
      })
      expect(inv[driverId]).toHaveLength(20)
      const ids = new Set(inv[driverId].map((s) => s.id))
      expect(ids.size).toBe(20)
    }
  })

  // T32: Soma Canônica — 20 jogos × 2 pilotos × 12 equipes = 480 jogos no GP Padrão
  it('T32: Equivalência canônica no grid de 24 pilotos (12 equipes) totaliza 480 jogos no GP padrão', () => {
    const rules = getCanonicalTyreAllocation(1, false)
    const driversCount = 24 // 12 equipes × 2 carros
    const totalEventSets = rules.totalSetsPerDriver * driversCount
    const totalEventTyres = rules.totalTyresPerDriver * driversCount

    expect(totalEventSets).toBe(480)
    expect(totalEventTyres).toBe(1920) // 480 jogos × 4 pneus

    // Na Sprint (19 jogos):
    const sprintRules = getCanonicalTyreAllocation(2, true)
    const sprintEventSets = sprintRules.totalSetsPerDriver * driversCount
    expect(sprintEventSets).toBe(456)
  })

  // Teste integrado do fluxo de box e persistência
  it('Fluxo Integrado UI / Boxes: Parada consome e marca pneu como instalado e persiste', () => {
    const seasonId = 'season_ui_flow'
    const round = 1
    const driverId = 'drv_alonso'

    const initial = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [driverId],
    })

    const chosenSet = initial[driverId].find((s) => s.compound === 'duro')!
    expect(chosenSet.isFitted).toBeFalsy()

    // Realiza pit stop instalando o jogo
    const updatedSets = initial[driverId].map((s) => {
      if (s.id === chosenSet.id) {
        return { ...s, isFitted: true, status: 'instalado' as const }
      }
      return s.isFitted ? { ...s, isFitted: false, status: 'usado' as const } : s
    })

    canonicalWeekendTyrePersistence.updateDriverInventory(seasonId, round, driverId, updatedSets)

    const reloaded = canonicalWeekendTyrePersistence.readWeekendTireData(seasonId, round)!
      .inventoriesByDriver[driverId]
    const fittedSet = reloaded.find((s) => s.id === chosenSet.id)!
    expect(fittedSet.isFitted).toBe(true)
    expect(fittedSet.status).toBe('instalado')
  })
})
