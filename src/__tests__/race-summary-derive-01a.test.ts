import { describe, it, expect } from 'vitest'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import type { CanonicalRaceState, OfficialRaceResultEntry } from '@/types/canonical-race-v2'

describe('RACE-SUMMARY-DERIVE-01A: Verificação focal das derivações esportivas canônicas', () => {
  it('1. VOLTA MAIS RÁPIDA: deriva da menor bestLapSec numérica válida (>0, não-DNS) das entries e marca fastestLap=true SOMENTE nela', () => {
    // Cenário da R1: state.fastestLap dessincronizou apontando para ferrari_d2 (Leclerc, 1:14.200),
    // enquanto o menor tempo real das entradas é mercedes_d2 (Kimi, 1:13.475).
    const mockState: CanonicalRaceState = {
      version: '2.0',
      careerId: 'test_career',
      season: 2026,
      round: 1,
      raceId: 'race_melbourne',
      circuitName: 'Albert Park',
      circuitCountry: 'Australia',
      totalLaps: 58,
      currentLap: 58,
      status: 'completed',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      playerTeamId: 'team_mercedes',
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: new Date().toISOString(),
      // Rastreador dessincronizado:
      fastestLap: {
        driverId: 'ferrari_d2',
        driverName: 'Charles Leclerc',
        lapTimeSec: 74.2,
        lapTimeFormatted: '1:14.200',
        lap: 45,
      },
      drivers: [
        {
          driverId: 'mercedes_d1',
          driverName: 'George Russell',
          teamId: 'team_mercedes',
          teamName: 'Mercedes-AMG',
          currentPosition: 1,
          gridPosition: 1,
          lap: 58,
          raceTime: 5200,
          tyreCompound: 'duro',
          tyreAge: 20,
          fuel: 5,
          carCondition: 90,
          raceStatus: 'finished',
          isDnf: false,
          pitStops: 1,
          bestLapSec: 74.5,
          bestLapFormatted: '1:14.500',
          bestLapNumber: 40,
        } as any,
        {
          driverId: 'mercedes_d2',
          driverName: 'Kimi Antonelli',
          teamId: 'team_mercedes',
          teamName: 'Mercedes-AMG',
          currentPosition: 2,
          gridPosition: 2,
          lap: 58,
          raceTime: 5202,
          tyreCompound: 'duro',
          tyreAge: 20,
          fuel: 5,
          carCondition: 90,
          raceStatus: 'finished',
          isDnf: false,
          pitStops: 1,
          bestLapSec: 73.475, // MENOR TEMPO REAL (1:13.475)
          bestLapFormatted: '1:13.475',
          bestLapNumber: 52,
        } as any,
        {
          driverId: 'ferrari_d2',
          driverName: 'Charles Leclerc',
          teamId: 'team_ferrari',
          teamName: 'Scuderia Ferrari',
          currentPosition: 3,
          gridPosition: 3,
          lap: 58,
          raceTime: 5205,
          tyreCompound: 'duro',
          tyreAge: 20,
          fuel: 5,
          carCondition: 88,
          raceStatus: 'finished',
          isDnf: false,
          pitStops: 1,
          bestLapSec: 74.2, // RASTREADOR APONTAVA ESTE
          bestLapFormatted: '1:14.200',
          bestLapNumber: 45,
        } as any,
      ],
      driverLookup: {},
      events: [],
      allEvents: [],
    }

    const officialResult = canonicalRaceResultService.officializeRace(mockState)

    // A volta mais rápida oficializada DEVE ser do mercedes_d2 (Kimi)
    expect(officialResult.fastestLapDriverId).toBe('mercedes_d2')
    expect(officialResult.fastestLapSec).toBe(73.475)
    expect(officialResult.fastestLapFormatted).toBe('1:13.475')
    expect(officialResult.fastestLapNumber).toBe(52)

    // entry.fastestLap = true SOMENTE na entrada do Kimi; false nas demais
    const kimiEntry = officialResult.entries.find((e) => e.driverId === 'mercedes_d2')
    const leclercEntry = officialResult.entries.find((e) => e.driverId === 'ferrari_d2')
    const russellEntry = officialResult.entries.find((e) => e.driverId === 'mercedes_d1')

    expect(kimiEntry?.fastestLap).toBe(true)
    expect(leclercEntry?.fastestLap).toBe(false)
    expect(russellEntry?.fastestLap).toBe(false)

    // Exatamente uma entrada marcada com fastestLap = true
    const fastestCount = officialResult.entries.filter((e) => e.fastestLap).length
    expect(fastestCount).toBe(1)
  })

  it('2. TOTAL OVERTAKES: deriva do acumulador completo allEvents sem truncamento destrutivo', () => {
    // 28 eventos de ultrapassagem espalhados pela prova de 58 voltas
    const overtakeEvents: any[] = []
    for (let i = 1; i <= 28; i++) {
      overtakeEvents.push({
        id: `ev_ot_${i}`,
        lap: Math.min(58, Math.ceil(i * 2)),
        type: 'overtake',
        message: `Ultrapassagem ${i}: Piloto A ultrapassou Piloto B`,
        timestamp: '15:30:00',
      })
    }

    // Buffer visual live contém apenas os últimos 5 eventos
    const liveBuffer = overtakeEvents.slice(-5)

    const mockState: CanonicalRaceState = {
      version: '2.0',
      careerId: 'test_career',
      season: 2026,
      round: 1,
      raceId: 'race_melbourne',
      circuitName: 'Albert Park',
      circuitCountry: 'Australia',
      totalLaps: 58,
      currentLap: 58,
      status: 'completed',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      playerTeamId: 'team_mercedes',
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: new Date().toISOString(),
      drivers: [
        {
          driverId: 'mercedes_d1',
          driverName: 'George Russell',
          teamId: 'team_mercedes',
          teamName: 'Mercedes-AMG',
          currentPosition: 1,
          gridPosition: 1,
          lap: 58,
          raceTime: 5200,
          tyreCompound: 'duro',
          tyreAge: 20,
          fuel: 5,
          carCondition: 90,
          raceStatus: 'finished',
          isDnf: false,
          pitStops: 1,
          bestLapSec: 74.5,
        } as any,
      ],
      driverLookup: {},
      events: liveBuffer, // Truncado para o HUD
      allEvents: overtakeEvents, // Acumulador completo não-truncado
    }

    const officialResult = canonicalRaceResultService.officializeRace(mockState)

    // totalOvertakes no eventsSummary deve ser 28 (extraído de allEvents), não 5 (de events)
    expect((officialResult.eventsSummary as any).totalOvertakes).toBe(28)
  })

  it('3. DNFCOUNT: usa as entries oficiais como autoridade (8 abandonos na R1)', () => {
    // 24 pilotos: 16 finished e 8 dnf
    const drivers: any[] = []
    for (let i = 1; i <= 24; i++) {
      const isDnf = i > 16 // 8 pilotos DNF (17 a 24), ex: Drugovich e Colapinto
      drivers.push({
        driverId: `driver_${i}`,
        driverName: `Driver ${i}`,
        teamId: `team_${Math.ceil(i / 2)}`,
        teamName: `Team ${Math.ceil(i / 2)}`,
        currentPosition: i,
        gridPosition: i,
        lap: isDnf ? 10 : 58,
        raceTime: isDnf ? 900 : 5200,
        tyreCompound: 'duro',
        tyreAge: 20,
        fuel: 5,
        carCondition: isDnf ? 0 : 90,
        raceStatus: isDnf ? 'dnf' : 'finished',
        status: isDnf ? 'dnf' : 'finished',
        isDnf,
        dnf: isDnf,
        pitStops: 1,
        bestLapSec: 75.0,
      })
    }

    // Mesmo que o feed de eventos live esteja vazio (expurgado pelo slice(-60))
    const mockState: CanonicalRaceState = {
      version: '2.0',
      careerId: 'test_career',
      season: 2026,
      round: 1,
      raceId: 'race_melbourne',
      circuitName: 'Albert Park',
      circuitCountry: 'Australia',
      totalLaps: 58,
      currentLap: 58,
      status: 'completed',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      playerTeamId: 'team_1',
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: new Date().toISOString(),
      drivers,
      driverLookup: {},
      events: [], // vazio no feed
      allEvents: [],
    }

    const officialResult = canonicalRaceResultService.officializeRace(mockState)

    expect(officialResult.eventsSummary.dnfCount).toBe(8)
    const dnfEntries = officialResult.entries.filter((e) => e.dnf || e.status === 'dnf')
    expect(dnfEntries.length).toBe(8)
  })

  it('4. SC/VSC SEPARADOS: conta acionamentos reais ignorando recolhimentos e mantém contadores estritamente separados', () => {
    // Cenário R1: 1 acionamento de Safety Car e 2 acionamentos de VSC,
    // mais mensagens de recolhimento ("SAFETY CAR IN THIS LAP", "VSC ENDING") que antes inflavam a contagem.
    const allEvents: any[] = [
      // Acionamento SC 1:
      {
        id: 'sc_1',
        lap: 12,
        type: 'safety_car_deployed',
        message: '🚨 SAFETY CAR ENPLOYED: Bernd Mayländer na pista para comboio controlado.',
      },
      // Recolhimento SC 1 (NÃO deve contar como acionamento):
      {
        id: 'sc_in_1',
        lap: 15,
        type: 'info',
        message: '🟢 SAFETY CAR IN THIS LAP: Preparar para relargada em bandeira verde!',
      },
      // Acionamento VSC 1:
      {
        id: 'vsc_1',
        lap: 25,
        type: 'vsc_deployed',
        message:
          '🟡 VIRTUAL SAFETY CAR (VSC): Pista em neutralização para recolhimento de detritos.',
      },
      // Encerramento VSC 1 (NÃO deve contar):
      {
        id: 'vsc_end_1',
        lap: 27,
        type: 'info',
        message: '🟢 VIRTUAL SAFETY CAR ENDING: Pista liberada! Bandeira verde acionada.',
      },
      // Acionamento VSC 2:
      {
        id: 'vsc_2',
        lap: 40,
        type: 'vsc_deployed',
        message:
          '🟡 VIRTUAL SAFETY CAR (VSC): Procedimento de delta ativo para remoção de veículo.',
      },
      // Encerramento VSC 2 (NÃO deve contar):
      {
        id: 'vsc_end_2',
        lap: 42,
        type: 'info',
        message: '🟢 VIRTUAL SAFETY CAR ENDING: Pista liberada!',
      },
    ]

    const mockState: CanonicalRaceState = {
      version: '2.0',
      careerId: 'test_career',
      season: 2026,
      round: 1,
      raceId: 'race_melbourne',
      circuitName: 'Albert Park',
      circuitCountry: 'Australia',
      totalLaps: 58,
      currentLap: 58,
      status: 'completed',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      playerTeamId: 'team_mercedes',
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: new Date().toISOString(),
      drivers: [
        {
          driverId: 'mercedes_d1',
          driverName: 'George Russell',
          teamId: 'team_mercedes',
          teamName: 'Mercedes-AMG',
          currentPosition: 1,
          gridPosition: 1,
          lap: 58,
          raceTime: 5200,
          tyreCompound: 'duro',
          tyreAge: 20,
          fuel: 5,
          carCondition: 90,
          raceStatus: 'finished',
          isDnf: false,
          pitStops: 1,
          bestLapSec: 74.5,
        } as any,
      ],
      driverLookup: {},
      events: allEvents.slice(-2),
      allEvents,
    }

    const officialResult = canonicalRaceResultService.officializeRace(mockState)

    // Expectativa R1: 1 SC, 2 VSC
    expect(officialResult.eventsSummary.safetyCarPeriods).toBe(1)
    expect(officialResult.eventsSummary.vscPeriods).toBe(2)
    // VSC nunca soma como SC
    expect((officialResult.eventsSummary as any).safetyCarDeployments).toBe(1)
    expect((officialResult.eventsSummary as any).virtualSafetyCarDeployments).toBe(2)
  })

  it('5. DUPLICAÇÃO eventSummary/eventsSummary: eventsSummary é primário e eventSummary aponta para o mesmo objeto sem divergência', () => {
    const mockState: CanonicalRaceState = {
      version: '2.0',
      careerId: 'test_career',
      season: 2026,
      round: 1,
      raceId: 'race_melbourne',
      circuitName: 'Albert Park',
      circuitCountry: 'Australia',
      totalLaps: 58,
      currentLap: 58,
      status: 'completed',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      playerTeamId: 'team_mercedes',
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: new Date().toISOString(),
      drivers: [
        {
          driverId: 'mercedes_d1',
          driverName: 'George Russell',
          teamId: 'team_mercedes',
          teamName: 'Mercedes-AMG',
          currentPosition: 1,
          gridPosition: 1,
          lap: 58,
          raceTime: 5200,
          tyreCompound: 'duro',
          tyreAge: 20,
          fuel: 5,
          carCondition: 90,
          raceStatus: 'finished',
          isDnf: false,
          pitStops: 1,
          bestLapSec: 74.5,
        } as any,
      ],
      driverLookup: {},
      events: [],
      allEvents: [],
    }

    const officialResult = canonicalRaceResultService.officializeRace(mockState)

    expect(officialResult.eventsSummary).toBeDefined()
    expect(officialResult.eventSummary).toBeDefined()
    // Mesma referência (sem reprocessamento) e conteúdo idêntico
    expect(officialResult.eventsSummary).toEqual(officialResult.eventSummary)
  })
})
