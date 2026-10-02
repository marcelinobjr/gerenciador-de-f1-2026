import { describe, it, expect, beforeEach } from 'vitest'
import { CanonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { raceControlService } from '@/services/raceControlService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'
import type { TireCompound, TireSetItem } from '@/types/f1'

describe('RED-FLAG-RESTART-01 — Suspensão, Snapshot Canônico e Relargada (RF01–RF24)', () => {
  let engine: CanonicalRaceEngineService
  const careerId = 'career_rf_test'
  const season = 2026
  const round = 1
  const raceId = 'gp_rf_test'

  function createMockRaceState(options?: {
    totalLaps?: number
    currentLap?: number
    activeCars?: number
    dnfCars?: number
  }): CanonicalRaceState {
    const totalLaps = options?.totalLaps ?? 50
    const currentLap = options?.currentLap ?? 20
    const dnfCount = options?.dnfCars ?? 3
    const totalCars = 24

    const drivers: CanonicalRaceDriverState[] = Array.from({ length: totalCars }, (_, i) => {
      const pos = i + 1
      const isDnf = pos > totalCars - dnfCount
      const teamIdx = Math.floor(i / 2) + 1
      const driverId = `drv_${pos.toString().padStart(2, '0')}`
      return {
        careerId,
        season,
        raceId,
        driverId,
        teamId: `team_${teamIdx.toString().padStart(2, '0')}`,
        driverName: `Driver ${pos}`,
        teamName: `Team ${teamIdx}`,
        teamColor: '#FF0000',
        gridPosition: pos,
        currentPosition: pos,
        lap: isDnf ? 12 : currentLap,
        raceTime: isDnf ? 1200 : 1800 + (pos - 1) * 1.5,
        gap: pos === 1 ? 'LÍDER' : isDnf ? 'ABANDONO' : `+${((pos - 1) * 1.5).toFixed(3)}s`,
        gapToLeaderSec: isDnf ? undefined : (pos - 1) * 1.5,
        gapToFrontSec: isDnf ? undefined : 1.5,
        tyreCompound: 'macio' as TireCompound,
        tyreSetId: `set_${driverId}_soft_1`,
        tyreAge: isDnf ? 12 : 20,
        fuel: isDnf ? 60 : 50,
        carCondition: 95,
        raceStatus: isDnf ? 'dnf' : 'racing',
        isDnf,
        dnfReason: isDnf ? 'Falha Elétrica' : undefined,
        dnfLap: isDnf ? 12 : undefined,
        pitStops: 1,
        isPlayer: pos <= 2,
      }
    })

    const lookup: Record<string, CanonicalRaceDriverState> = {}
    drivers.forEach((d) => {
      lookup[d.driverId] = d
    })

    return {
      version: '2.0',
      careerId,
      season,
      round,
      raceId,
      circuitName: 'Silverstone',
      circuitCountry: 'GBR',
      totalLaps,
      currentLap,
      status: 'running',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      drivers,
      driverLookup: lookup,
      playerTeamId: 'team_01',
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: new Date().toISOString(),
      events: [],
    }
  }

  function seedMockTyreInventory(driverId: string, sets: TireSetItem[]) {
    canonicalWeekendTyrePersistence.updateDriverInventory(String(season), round, driverId, sets)
  }

  beforeEach(() => {
    engine = new CanonicalRaceEngineService()
    try {
      localStorage.clear()
    } catch {
      // In-memory fallback
    }
  })

  // RF01 red flag interrompe progressão de volta
  it('RF01: red flag interrompe progressão de volta (currentLap não avança)', () => {
    const state = createMockRaceState({ currentLap: 22 })
    const suspended = engine.triggerRedFlag(state, { persistState: false })
    expect(suspended.status).toBe('suspended')
    expect(suspended.redFlagActive).toBe(true)

    // Tentar avançar volta comum sob suspensão não deve aumentar a volta competitiva
    const advanced = engine.advanceOneLap(suspended, { persistState: false })
    expect(advanced.currentLap).toBe(22)
    expect(advanced.status).toBe('suspended')
  })

  // RF02 classificação congelada
  it('RF02: classificação e posições relativas são congeladas no momento da interrupção', () => {
    const state = createMockRaceState({ currentLap: 22 })
    const leaderBefore = state.drivers.find((d) => d.currentPosition === 1)?.driverId
    const p5Before = state.drivers.find((d) => d.currentPosition === 5)?.driverId

    const suspended = engine.triggerRedFlag(state, { persistState: false })
    expect(suspended.redFlagSnapshot).toBeDefined()
    expect(suspended.redFlagSnapshot?.standingGridOrder[0]).toBe(leaderBefore)
    expect(suspended.redFlagSnapshot?.standingGridOrder[4]).toBe(p5Before)
  })

  // RF03 ativos não viram DNF
  it('RF03: carros ativos NÃO viram DNF por causa da bandeira vermelha', () => {
    const state = createMockRaceState({ activeCars: 21, dnfCars: 3 })
    const suspended = engine.triggerRedFlag(state, { persistState: false })

    const activeList = suspended.drivers.filter((d) => !d.isDnf && d.raceStatus !== 'dnf')
    expect(activeList.length).toBe(21)
    expect(suspended.redFlagSnapshot?.activeDriverIds.length).toBe(21)
  })

  // RF04 DNF anteriores continuam DNF
  it('RF04: carros já abandonados (DNF) continuam estritamente DNF', () => {
    const state = createMockRaceState({ activeCars: 21, dnfCars: 3 })
    const suspended = engine.triggerRedFlag(state, { persistState: false })

    const dnfList = suspended.drivers.filter((d) => d.isDnf || d.raceStatus === 'dnf')
    expect(dnfList.length).toBe(3)
    expect(suspended.redFlagSnapshot?.dnfDriverIds.length).toBe(3)
  })

  // RF05 ativos retornam a estado pit/suspensão
  it('RF05: todos os carros ativos entram em estado suspended (boxes)', () => {
    const state = createMockRaceState({ activeCars: 21, dnfCars: 3 })
    const suspended = engine.triggerRedFlag(state, { persistState: false })

    suspended.drivers.forEach((d) => {
      if (d.isDnf) {
        expect(d.raceStatus).toBe('dnf')
      } else {
        expect(d.raceStatus).toBe('suspended')
      }
    })
  })

  // RF06 red flag não incrementa pit stop count
  it('RF06: interrupção por bandeira vermelha NÃO incrementa pit-stop count', () => {
    const state = createMockRaceState()
    const p1PitsBefore = state.drivers[0].pitStops

    const suspended = engine.triggerRedFlag(state, { persistState: false })
    expect(suspended.drivers[0].pitStops).toBe(p1PitsBefore)
  })

  // RF07 fuel não consumido na suspensão
  it('RF07: combustível NÃO é consumido durante a suspensão', () => {
    const state = createMockRaceState()
    const fuelBefore = state.drivers[0].fuel

    const suspended = engine.triggerRedFlag(state, { persistState: false })
    const advanced = engine.advanceOneLap(suspended, { persistState: false })

    expect(advanced.drivers[0].fuel).toBe(fuelBefore)
  })

  // RF08 tyre wear não avança na suspensão
  it('RF08: desgaste de pneus (tyreAge / tyreWear) NÃO avança na suspensão', () => {
    const state = createMockRaceState()
    const tyreAgeBefore = state.drivers[0].tyreAge

    const suspended = engine.triggerRedFlag(state, { persistState: false })
    const advanced = engine.advanceOneLap(suspended, { persistState: false })

    expect(advanced.drivers[0].tyreAge).toBe(tyreAgeBefore)
  })

  // RF09 component wear não avança na suspensão
  it('RF09: integridade mecânica (carCondition) NÃO degrada na suspensão', () => {
    const state = createMockRaceState()
    const conditionBefore = state.drivers[0].carCondition

    const suspended = engine.triggerRedFlag(state, { persistState: false })
    const advanced = engine.advanceOneLap(suspended, { persistState: false })

    expect(advanced.drivers[0].carCondition).toBe(conditionBefore)
  })

  // RF10 troca de pneus permitida na suspensão
  it('RF10: troca de pneus é permitida para carros ativos durante a suspensão', () => {
    const state = createMockRaceState()
    const suspended = engine.triggerRedFlag(state, { persistState: false })

    const res = engine.changeTyresDuringSuspension({
      raceState: suspended,
      driverId: 'drv_01',
      newCompound: 'duro',
      persistState: false,
    })

    expect(res.success).toBe(true)
    const driver = res.updatedState.drivers.find((d) => d.driverId === 'drv_01')
    expect(driver?.tyreCompound).toBe('duro')
    expect(driver?.tyreAge).toBe(0)
    expect(driver?.pitStops).toBe(1) // Não incrementa pitStop competitivo
  })

  // RF11 troca consome set real disponível do inventário
  it('RF11: troca consome set real disponível do inventário', () => {
    const state = createMockRaceState()
    seedMockTyreInventory('drv_01', [
      {
        id: 'set_med_01',
        tyreSetId: 'set_med_01',
        compound: 'medio',
        status: 'disponivel',
        wear: 10,
        lapsUsed: 2,
        isFitted: false,
      },
    ])

    const suspended = engine.triggerRedFlag(state, { persistState: false })
    const res = engine.changeTyresDuringSuspension({
      raceState: suspended,
      driverId: 'drv_01',
      newCompound: 'medio',
      persistState: false,
    })

    expect(res.success).toBe(true)
    const inv = canonicalWeekendTyrePersistence.readWeekendTireData(String(season), round)
    const updatedSet = inv?.inventoriesByDriver['drv_01']?.find((s) => s.id === 'set_med_01')
    expect(updatedSet?.isFitted).toBe(true)
    expect(updatedSet?.status).toBe('instalado')
  })

  // RF12 set indisponível não pode ser usado
  it('RF12: set indisponível ou esgotado (>90% wear) NÃO pode ser instalado', () => {
    const state = createMockRaceState()
    seedMockTyreInventory('drv_01', [
      {
        id: 'set_dead_01',
        tyreSetId: 'set_dead_01',
        compound: 'duro',
        status: 'devolvido_indisponivel',
        wear: 95,
        lapsUsed: 35,
        isFitted: false,
      },
    ])

    const suspended = engine.triggerRedFlag(state, { persistState: false })
    const res = engine.changeTyresDuringSuspension({
      raceState: suspended,
      driverId: 'drv_01',
      newCompound: 'duro',
      newTyreSetId: 'set_dead_01',
      persistState: false,
    })

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/indisponível|esgotado/)
  })

  // RF13 restart preserva ordem
  it('RF13: relargada (standing restart) preserva rigorosamente a ordem do snapshot', () => {
    const state = createMockRaceState()
    const suspended = engine.triggerRedFlag(state, { persistState: false })
    const restartPending = engine.prepareRedFlagRestart(suspended, { persistState: false })
    const resumed = engine.resumeRaceAfterRedFlag(restartPending, { persistState: false })

    const orderBefore = suspended.redFlagSnapshot!.standingGridOrder
    const orderAfter = resumed.drivers.map((d) => d.driverId)

    expect(orderAfter).toEqual(orderBefore)
  })

  // RF14 restart não zera completed laps
  it('RF14: relargada NÃO zera completed laps nem reinicia a corrida do zero', () => {
    const state = createMockRaceState({ currentLap: 25 })
    const suspended = engine.triggerRedFlag(state, { persistState: false })
    const resumed = engine.resumeRaceAfterRedFlag(suspended, { persistState: false })

    expect(resumed.currentLap).toBe(25)
    expect(resumed.drivers[0].lap).toBe(25)
  })

  // RF15 restart normaliza gaps via start mechanism
  it('RF15: restart normaliza gaps com grid escalonado padronizado mantendo liderança', () => {
    const state = createMockRaceState()
    const suspended = engine.triggerRedFlag(state, { persistState: false })
    const restartPending = engine.prepareRedFlagRestart(suspended, { persistState: false })

    const p1 = restartPending.drivers[0]
    const p2 = restartPending.drivers[1]
    const p3 = restartPending.drivers[2]

    expect(p1.gap).toBe('LÍDER')
    expect(p2.gap).toBe('+0.200s')
    expect(p3.gap).toBe('+0.400s')
  })

  // RF16 novo compound permanece após restart
  it('RF16: composto trocado durante a suspensão permanece ativo após a relargada', () => {
    const state = createMockRaceState()
    const suspended = engine.triggerRedFlag(state, { persistState: false })

    const changed = engine.changeTyresDuringSuspension({
      raceState: suspended,
      driverId: 'drv_02',
      newCompound: 'duro',
      persistState: false,
    }).updatedState

    const resumed = engine.resumeRaceAfterRedFlag(changed, { persistState: false })
    const drv2 = resumed.drivers.find((d) => d.driverId === 'drv_02')
    expect(drv2?.tyreCompound).toBe('duro')
  })

  // RF17 DNF não é revivido
  it('RF17: carros DNF anteriores NÃO são revividos na relargada', () => {
    const state = createMockRaceState({ activeCars: 21, dnfCars: 3 })
    const suspended = engine.triggerRedFlag(state, { persistState: false })
    const resumed = engine.resumeRaceAfterRedFlag(suspended, { persistState: false })

    const dnfCars = resumed.drivers.filter((d) => d.isDnf)
    expect(dnfCars.length).toBe(3)
    dnfCars.forEach((c) => {
      expect(c.raceStatus).toBe('dnf')
      expect(c.gap).toBe('ABANDONO')
    })
  })

  // RF18 driverId/teamId permanecem
  it('RF18: driverId e teamId permanecem rigorosamente idênticos em todos os 24 carros', () => {
    const state = createMockRaceState()
    const suspended = engine.triggerRedFlag(state, { persistState: false })
    const resumed = engine.resumeRaceAfterRedFlag(suspended, { persistState: false })

    for (let i = 0; i < 24; i++) {
      expect(resumed.drivers[i].driverId).toBe(state.drivers[i].driverId)
      expect(resumed.drivers[i].teamId).toBe(state.drivers[i].teamId)
    }
  })

  // RF19 segundo processamento da mesma red flag não duplica efeito (idempotência)
  it('RF19: segundo processamento da mesma bandeira vermelha não duplica o snapshot', () => {
    const state = createMockRaceState()
    const suspended1 = engine.triggerRedFlag(state, { persistState: false })
    const interruptionId1 = suspended1.redFlagSnapshot?.interruptionId

    const suspended2 = engine.triggerRedFlag(suspended1, { persistState: false })
    expect(suspended2.redFlagSnapshot?.interruptionId).toBe(interruptionId1)
    expect(suspended2.revision).toBe(suspended1.revision)
  })

  // RF20 restart não dispara duas vezes
  it('RF20: autorização de relargada é idempotente e não re-executa se já em running', () => {
    const state = createMockRaceState()
    const suspended = engine.triggerRedFlag(state, { persistState: false })
    const resumed1 = engine.resumeRaceAfterRedFlag(suspended, { persistState: false })
    expect(resumed1.status).toBe('running')

    const resumed2 = engine.resumeRaceAfterRedFlag(resumed1, { persistState: false })
    expect(resumed2.status).toBe('running')
    expect(resumed2.revision).toBe(resumed1.revision)
  })

  // RF21 save/reload em suspensão preserva estado
  it('RF21: salvar e recarregar em suspensão preserva snapshot, grid congelado e pneus', () => {
    const state = createMockRaceState()
    const suspended = engine.triggerRedFlag(state, { persistState: false })
    canonicalRaceInitializationService.saveCanonicalRaceState(suspended)

    const reloaded = canonicalRaceInitializationService.readCanonicalRaceState(
      careerId,
      season,
      round,
    )
    expect(reloaded).toBeDefined()
    expect(reloaded?.status).toBe('suspended')
    expect(reloaded?.redFlagActive).toBe(true)
    expect(reloaded?.redFlagSnapshot?.standingGridOrder.length).toBe(24)
  })

  // RF22 Race Control recebe estado red flag
  it('RF22: Race Control recebe e registra evento de bandeira vermelha', () => {
    const state = createMockRaceState()
    const suspended = engine.triggerRedFlag(state, { persistState: false })

    expect(suspended.raceControl?.currentFlag).toBe('RED_FLAG')
    expect(suspended.redFlagActive).toBe(true)
    const rfEvent = suspended.events.find((e) => e.message.includes('BANDEIRA VERMELHA'))
    expect(rfEvent).toBeDefined()
  })

  // RF23 Race Control recebe estado restart
  it('RF23: Race Control transiciona para RESTART / GREEN e registra no log', () => {
    const state = createMockRaceState()
    const suspended = engine.triggerRedFlag(state, { persistState: false })
    const restartPending = engine.prepareRedFlagRestart(suspended, { persistState: false })

    expect(restartPending.raceControl?.restartPending).toBe(true)

    const resumed = engine.resumeRaceAfterRedFlag(restartPending, { persistState: false })
    expect(resumed.raceControl?.currentFlag).toBe('GREEN')
    expect(resumed.raceControl?.restartPending).toBe(false)
    const restartEvent = resumed.events.find((e) => e.message.includes('BANDEIRA VERDE'))
    expect(restartEvent).toBeDefined()
  })

  // RF24 corrida continua normalmente após restart
  it('RF24: corrida avança normalmente volta a volta após a relargada', () => {
    const state = createMockRaceState({ currentLap: 20 })
    const suspended = engine.triggerRedFlag(state, { persistState: false })
    const resumed = engine.resumeRaceAfterRedFlag(suspended, { persistState: false })

    const nextLap = engine.advanceOneLap(resumed, { persistState: false })
    expect(nextLap.currentLap).toBe(21)
    expect(nextLap.status).toBe('running')
    expect(nextLap.redFlagActive).toBe(false)
  })

  // Cenário de Integração 1: 24 carros iniciam, 3 DNF (21 ativos), Red Flag -> suspensos + 3 DNF -> restart -> 21 reiniciam
  it('CENÁRIO 1: 24 carros, 3 DNF, Red Flag, troca pneus e relargada consistente', () => {
    const state = createMockRaceState({ activeCars: 21, dnfCars: 3, currentLap: 15 })
    const suspended = engine.triggerRedFlag(state, { persistState: false })

    expect(suspended.redFlagSnapshot?.activeDriverIds.length).toBe(21)
    expect(suspended.redFlagSnapshot?.dnfDriverIds.length).toBe(3)

    // Trocar pneu de P1 e P2
    engine.changeTyresDuringSuspension({
      raceState: suspended,
      driverId: 'drv_01',
      newCompound: 'medio',
      persistState: false,
    })

    const resumed = engine.resumeRaceAfterRedFlag(suspended, { persistState: false })
    expect(resumed.status).toBe('running')

    // 21 correndo, 3 DNF
    const activeAfter = resumed.drivers.filter((d) => d.raceStatus === 'racing')
    const dnfAfter = resumed.drivers.filter((d) => d.isDnf)
    expect(activeAfter.length).toBe(21)
    expect(dnfAfter.length).toBe(3)

    // Próxima volta ocorre normalmente
    const nextLap = engine.advanceOneLap(resumed, { persistState: false })
    expect(nextLap.currentLap).toBe(16)
  })

  // Cenário de Integração 2: Mudança de clima na bandeira vermelha (seco -> chuva_fraca) e seleção de pneus de chuva
  it('CENÁRIO 2: Red Flag com chuva repentina permite troca para intermediário e IA adapta', () => {
    const state = createMockRaceState({ currentLap: 18 })
    const suspended = engine.triggerRedFlag(state, { persistState: false })

    // Clima vira chuva fraca durante a bandeira vermelha
    suspended.weather = 'chuva_fraca'

    // Jogador troca para intermediário no carro 1
    const changed = engine.changeTyresDuringSuspension({
      raceState: suspended,
      driverId: 'drv_01',
      newCompound: 'intermediario',
      persistState: false,
    }).updatedState

    // IA prepara relargada e adapta pneus automaticamente devido à chuva
    const restartPending = engine.prepareRedFlagRestart(changed, { persistState: false })
    const resumed = engine.resumeRaceAfterRedFlag(restartPending, { persistState: false })

    const p1 = resumed.drivers.find((d) => d.driverId === 'drv_01')
    expect(p1?.tyreCompound).toBe('intermediario')

    // Carros de IA também trocaram para pneus de chuva
    const aiCars = resumed.drivers.filter((d) => !d.isPlayer && !d.isDnf)
    const hasRainTyres = aiCars.some((d) => d.tyreCompound === 'intermediario')
    expect(hasRainTyres).toBe(true)
  })
})
