import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import PaddockPage from '@/pages/PaddockPage'
import { ALL_GRID_TEAMS_DATABASE, OFFICIAL_2026_GRID_KEYS } from '@/lib/grid-teams-database'

// Mock do hook useUnifiedSeason com dados canônicos controlados
const mockUseUnifiedSeason = vi.fn()

vi.mock('@hooks/use-unified-season', () => ({
  useUnifiedSeason: () => mockUseUnifiedSeason(),
}))

vi.mock('@/hooks/use-unified-season', () => ({
  useUnifiedSeason: () => mockUseUnifiedSeason(),
}))

describe('MICROENTREGA 1 — PÁGINA EQUIPES (src/pages/PaddockPage.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // TESTE A: Participação (participante com 0 pontos não vira não participante)
  it('TESTE A: Participante com 0 pontos continua participante com "NO CAMPEONATO" e 0 pontos na UI', () => {
    mockUseUnifiedSeason.mockReturnValue({
      team: {
        id: 'team_audi',
        name: 'Audi F1 Team',
        team_key: 'audi',
        color: '#FF2A00',
        engine_supplier: 'Audi',
      },
      season: { id: 'season_2026', year: 2026, current_round: 1, total_rounds: 24 },
      constructorStandings: [
        {
          id: 'ferrari',
          name: 'Scuderia Ferrari',
          points: 25,
          wins: 1,
          podiums: 1,
          isPlayer: false,
        },
        { id: 'audi', name: 'Audi F1 Team', points: 0, wins: 0, podiums: 0, isPlayer: true },
        { id: 'haas', name: 'Haas F1 Team', points: 0, wins: 0, podiums: 0, isPlayer: false },
      ],
      playerDrivers: [],
      loading: false,
    })

    render(<PaddockPage />)

    // A contagem do universo deve ser exatamente a quantidade de equipes estruturadas (28)
    const todasBtn = screen.getByTestId('filter-tab-todas')
    expect(todasBtn.textContent).toContain(`(${ALL_GRID_TEAMS_DATABASE.length})`)

    // Haas e Audi (com 0 pontos) pertencem ao grid participante
    const haasRow = screen.getByTestId('team-row-haas')
    expect(haasRow).toBeDefined()

    // Clicar em Haas
    fireEvent.click(haasRow)

    const panel = screen.getByTestId('team-detail-panel')
    expect(within(panel).getByText('Haas')).toBeDefined()
    // Deve mostrar o selo NO CAMPEONATO e pontuação 0 pts (NÃO "—")
    expect(within(panel).getByTestId('status-badge-active')).toBeDefined()
    expect(within(panel).getByText('0 pts')).toBeDefined()
    // Não deve conter a mensagem de não participante
    expect(within(panel).queryByTestId('non-participating-notice')).toBeNull()
  })

  // TESTE B: Filtros + busca funcionam em conjunto
  it('TESTE B: Filtros [Todas], [No campeonato], [Fora do campeonato] e busca operam em conjunto', () => {
    mockUseUnifiedSeason.mockReturnValue({
      team: {
        id: 'team_audi',
        name: 'Audi F1 Team',
        team_key: 'audi',
        color: '#FF2A00',
        engine_supplier: 'Audi',
      },
      season: { id: 'season_2026', year: 2026, current_round: 1, total_rounds: 24 },
      constructorStandings: OFFICIAL_2026_GRID_KEYS.map((k, i) => ({
        id: k,
        name: k.toUpperCase(),
        points: (12 - i) * 10,
        wins: i === 0 ? 1 : 0,
        podiums: i < 3 ? 1 : 0,
        isPlayer: k === 'audi',
      })),
      playerDrivers: [],
      loading: false,
    })

    render(<PaddockPage />)

    // Filtro "No campeonato"
    const noCampBtn = screen.getByTestId('filter-tab-no-campeonato')
    fireEvent.click(noCampBtn)

    // Ferrari deve estar visível; Jordan (fora do campeonato) não
    expect(screen.queryByTestId('team-row-ferrari')).not.toBeNull()
    expect(screen.queryByTestId('team-row-jordan')).toBeNull()

    // Filtro "Fora do campeonato"
    const foraCampBtn = screen.getByTestId('filter-tab-fora-campeonato')
    fireEvent.click(foraCampBtn)

    // Agora Jordan visível, Ferrari invisível
    expect(screen.queryByTestId('team-row-jordan')).not.toBeNull()
    expect(screen.queryByTestId('team-row-ferrari')).toBeNull()

    // Testar busca em conjunto com "Fora do campeonato"
    const searchInput = screen.getByTestId('team-search-input')
    fireEvent.change(searchInput, { target: { value: 'Copersucar' } })

    expect(screen.queryByTestId('team-row-copersucar')).not.toBeNull()
    expect(screen.queryByTestId('team-row-jordan')).toBeNull()

    // Busca sem correspondência -> Estado vazio
    fireEvent.change(searchInput, { target: { value: 'InexistenteXYZ' } })
    expect(screen.getByTestId('empty-teams-state')).toBeDefined()
  })

  // TESTE C: Não participantes sem posição/pontos/pilotos fictícios e com motor "A definir" quando aplicável
  it('TESTE C: Não participantes exibem "—" nas métricas esportivas e aviso de não disputa', () => {
    mockUseUnifiedSeason.mockReturnValue({
      team: {
        id: 'team_audi',
        name: 'Audi F1 Team',
        team_key: 'audi',
        color: '#FF2A00',
        engine_supplier: 'Audi',
      },
      season: { id: 'season_2026', year: 2026, current_round: 1, total_rounds: 24 },
      constructorStandings: [
        { id: 'audi', name: 'Audi F1 Team', points: 10, wins: 0, podiums: 0, isPlayer: true },
      ],
      playerDrivers: [],
      loading: false,
    })

    render(<PaddockPage />)

    // Jordan é uma equipe fora do grid oficial de 2026
    const jordanRow = screen.getByTestId('team-row-jordan')
    expect(jordanRow).toBeDefined()

    // Na linha, todas as métricas esportivas devem ser "—"
    const cells = jordanRow.querySelectorAll('td')
    // cells[0] = POS, cells[1] = EQUIPE, cells[2] = MOTOR, cells[3] = PONTOS, cells[4] = VITÓRIAS, cells[5] = PÓDIOS
    expect(cells[0].textContent).toBe('—')
    expect(cells[3].textContent).toBe('—')
    expect(cells[4].textContent).toBe('—')
    expect(cells[5].textContent).toBe('—')

    // Clicar em Jordan atualiza o painel
    fireEvent.click(jordanRow)
    const panel = screen.getByTestId('team-detail-panel')
    expect(within(panel).getByText('Jordan')).toBeDefined()
    expect(within(panel).getByTestId('status-badge-inactive')).toBeDefined()
    expect(within(panel).getByTestId('non-participating-notice').textContent).toContain(
      'Esta equipe não disputa a temporada atual.',
    )
  })

  // TESTE D: Seleção atualiza o painel lateral com estilo ativo
  it('TESTE D: Clicar em uma linha destaca a seleção com borda e atualiza o painel', () => {
    mockUseUnifiedSeason.mockReturnValue({
      team: {
        id: 'team_audi',
        name: 'Audi F1 Team',
        team_key: 'audi',
        color: '#FF2A00',
        engine_supplier: 'Audi',
      },
      season: { id: 'season_2026', year: 2026, current_round: 1, total_rounds: 24 },
      constructorStandings: [
        {
          id: 'ferrari',
          name: 'Scuderia Ferrari',
          points: 25,
          wins: 1,
          podiums: 1,
          isPlayer: false,
        },
        { id: 'audi', name: 'Audi F1 Team', points: 18, wins: 0, podiums: 1, isPlayer: true },
      ],
      playerDrivers: [],
      loading: false,
    })

    render(<PaddockPage />)

    const ferrariRow = screen.getByTestId('team-row-ferrari')
    fireEvent.click(ferrariRow)

    // Linha selecionada deve ter aria-selected="true"
    expect(ferrariRow.getAttribute('aria-selected')).toBe('true')

    const panel = screen.getByTestId('team-detail-panel')
    expect(within(panel).getByText('Scuderia Ferrari')).toBeDefined()
    expect(within(panel).getByText('25 pts')).toBeDefined()
  })

  // TESTE E: Pontos conferem com os standings do Campeonato
  it('TESTE E: Pontos e vitórias exibidos batem exatamente com constructorStandings do Campeonato', () => {
    const mockStandings = [
      { id: 'mclaren', name: 'McLaren F1 Team', points: 43, wins: 1, podiums: 2, isPlayer: false },
      { id: 'ferrari', name: 'Scuderia Ferrari', points: 30, wins: 1, podiums: 1, isPlayer: false },
      {
        id: 'mercedes',
        name: 'Mercedes-AMG Petronas',
        points: 22,
        wins: 0,
        podiums: 1,
        isPlayer: false,
      },
    ]

    mockUseUnifiedSeason.mockReturnValue({
      team: {
        id: 'team_mclaren',
        name: 'McLaren F1 Team',
        team_key: 'mclaren',
        color: '#FF8000',
        engine_supplier: 'Mercedes',
      },
      season: { id: 'season_2026', year: 2026, current_round: 2, total_rounds: 24 },
      constructorStandings: mockStandings,
      playerDrivers: [],
      loading: false,
    })

    render(<PaddockPage />)

    // McLaren
    const mclarenRow = screen.getByTestId('team-row-mclaren')
    expect(mclarenRow.textContent).toContain('43')
    expect(mclarenRow.textContent).toContain('1') // Vitórias
    expect(mclarenRow.textContent).toContain('2') // Pódios

    // Ferrari
    const ferrariRow = screen.getByTestId('team-row-ferrari')
    expect(ferrariRow.textContent).toContain('30')

    // Mercedes
    const mercRow = screen.getByTestId('team-row-mercedes')
    expect(mercRow.textContent).toContain('22')
  })
})
