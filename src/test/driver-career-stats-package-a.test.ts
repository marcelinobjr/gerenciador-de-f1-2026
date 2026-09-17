import { describe, it, expect } from 'vitest'
import { MBJ_2026_PILOTS, getDriverCareerStats } from '@/lib/mbj-drivers-data'

describe('PACOTE A — STATS DE CARREIRA CANÔNICOS DOS PILOTOS (T37–T39)', () => {
  // Pilotos do catálogo MBJ para fixtures
  const ricciardoCatalog = MBJ_2026_PILOTS.find((p) => p.name === 'Daniel Ricciardo')!
  const bortoletoCatalog = MBJ_2026_PILOTS.find((p) => p.name === 'Gabriel Bortoleto')!
  const verstappenCatalog = MBJ_2026_PILOTS.find((p) => p.name === 'Max Verstappen')!
  const hamiltonCatalog = MBJ_2026_PILOTS.find((p) => p.name === 'Lewis Hamilton')!

  it('T37 baseline puro: piloto sem resultados no save retorna exatamente os valores históricos', () => {
    // Sanity de catálogo
    expect(ricciardoCatalog).toBeDefined()
    expect(bortoletoCatalog).toBeDefined()

    // Ricciardo baseline puro (sem resultados de corrida e sem títulos no save)
    const statsRicciardo = getDriverCareerStats({
      pilot: ricciardoCatalog,
      raceResults: [],
      seasonHistories: [],
    })
    expect(statsRicciardo).toEqual({
      races: 257,
      wins: 8,
      poles: 3,
      championships: 0,
    })

    // Bortoleto baseline puro: zero GPs, zero vitórias, zero poles, zero títulos
    const statsBortoleto = getDriverCareerStats({
      pilot: bortoletoCatalog,
      raceResults: [],
      seasonHistories: [],
    })
    expect(statsBortoleto).toEqual({
      races: 0,
      wins: 0,
      poles: 0,
      championships: 0,
    })

    // Verstappen baseline puro
    const statsVerstappen = getDriverCareerStats({
      pilot: verstappenCatalog,
      raceResults: null,
      seasonHistories: null,
    })
    expect(statsVerstappen).toEqual({
      races: 205,
      wins: 63,
      poles: 40,
      championships: 4,
    })

    // Hamilton baseline puro
    const statsHamilton = getDriverCareerStats({
      pilot: hamiltonCatalog,
    })
    expect(statsHamilton).toEqual({
      races: 350,
      wins: 105,
      poles: 104,
      championships: 7,
    })

    // Piloto nulo retorna zeros seguros
    expect(getDriverCareerStats({ pilot: null })).toEqual({
      races: 0,
      wins: 0,
      poles: 0,
      championships: 0,
    })
  })

  it('T38 baseline + save: com race_results fixture e season_histories soma derivativamente', () => {
    // Fixture de resultados para Ricciardo: 4 corridas disputadas no save, sendo 1 vitória
    const mockRaceResultsRicciardo = [
      { driver_id: ricciardoCatalog.id, position: 1, season_id: 's2026' },
      { driver_id: ricciardoCatalog.id, position: 3, season_id: 's2026' },
      { driver_id: ricciardoCatalog.id, position: 5, season_id: 's2026' },
      { driver_id: ricciardoCatalog.id, position: 2, season_id: 's2026' },
      // Corrida de outro piloto (não deve afetar)
      { driver_id: 'outro_piloto', position: 1, season_id: 's2026' },
    ]

    const statsRicciardo = getDriverCareerStats({
      pilot: ricciardoCatalog,
      raceResults: mockRaceResultsRicciardo,
      seasonHistories: [],
    })

    // races = 257 + 4 = 261; wins = 8 + 1 = 9; poles = 3 (baseline Opção A); championships = 0
    expect(statsRicciardo.races).toBe(261)
    expect(statsRicciardo.wins).toBe(9)
    expect(statsRicciardo.poles).toBe(3)
    expect(statsRicciardo.championships).toBe(0)

    // Fixture de resultados para Bortoleto: 4 corridas disputadas no save (posições 4, 1, 2, 8) e 1 título conquistado
    const mockRaceResultsBortoleto = [
      { driver_id: bortoletoCatalog.id, position: 4, season_id: 's2026' },
      { driver_id: bortoletoCatalog.id, position: 1, season_id: 's2026' },
      { driver_id: bortoletoCatalog.id, position: 2, season_id: 's2026' },
      { driver_id: bortoletoCatalog.id, position: 8, season_id: 's2026' },
    ]

    const mockSeasonHistories = [
      // Teste formato string ID
      { season_year: 2026, drivers_champion: bortoletoCatalog.id },
      // Outra temporada com campeão diferente
      { season_year: 2027, drivers_champion: 'outro_piloto' },
    ]

    const statsBortoleto = getDriverCareerStats({
      pilot: bortoletoCatalog,
      raceResults: mockRaceResultsBortoleto,
      seasonHistories: mockSeasonHistories,
    })

    // races = 0 + 4 = 4; wins = 0 + 1 = 1; poles = 0; championships = 0 + 1 = 1
    expect(statsBortoleto.races).toBe(4)
    expect(statsBortoleto.wins).toBe(1)
    expect(statsBortoleto.poles).toBe(0)
    expect(statsBortoleto.championships).toBe(1)

    // Teste formato drivers_champion como objeto { id: string }
    const mockSeasonHistoriesObject = [
      { season_year: 2026, drivers_champion: { id: bortoletoCatalog.id } },
    ]
    const statsBortoletoObj = getDriverCareerStats({
      pilot: bortoletoCatalog,
      raceResults: mockRaceResultsBortoleto,
      seasonHistories: mockSeasonHistoriesObject,
    })
    expect(statsBortoletoObj.championships).toBe(1)
  })

  it('T39 idempotência: chamar repetidamente produz mesmos valores e não modifica coleções de entrada', () => {
    const raceResultsInput = [
      { driver_id: ricciardoCatalog.id, position: 1 },
      { driver_id: ricciardoCatalog.id, position: 2 },
    ]
    const seasonHistoriesInput = [{ season_year: 2026, drivers_champion: ricciardoCatalog.id }]

    const raceResultsCopy = JSON.parse(JSON.stringify(raceResultsInput))
    const seasonHistoriesCopy = JSON.parse(JSON.stringify(seasonHistoriesInput))

    const run1 = getDriverCareerStats({
      pilot: ricciardoCatalog,
      raceResults: raceResultsInput,
      seasonHistories: seasonHistoriesInput,
    })

    const run2 = getDriverCareerStats({
      pilot: ricciardoCatalog,
      raceResults: raceResultsInput,
      seasonHistories: seasonHistoriesInput,
    })

    const run3 = getDriverCareerStats({
      pilot: ricciardoCatalog,
      raceResults: raceResultsInput,
      seasonHistories: seasonHistoriesInput,
    })

    // Valores idênticos em todas as execuções
    expect(run1).toEqual(run2)
    expect(run2).toEqual(run3)
    expect(run1).toEqual({
      races: 259,
      wins: 9,
      poles: 3,
      championships: 1,
    })

    // Zero efeitos colaterais nos arrays e objetos de entrada
    expect(raceResultsInput).toEqual(raceResultsCopy)
    expect(seasonHistoriesInput).toEqual(seasonHistoriesCopy)
  })
})
