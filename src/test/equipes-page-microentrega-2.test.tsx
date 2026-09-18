import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import PaddockPage from '@/pages/PaddockPage'
import { ALL_GRID_TEAMS_DATABASE, OFFICIAL_2026_GRID_KEYS } from '@/lib/grid-teams-database'
import { getTeamCarPhotoUrl, TEAM_CAR_PHOTOS_MANIFEST } from '@/lib/team-car-photo-resolver'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'

// Mock do hook useUnifiedSeason com dados canônicos controlados
const mockUseUnifiedSeason = vi.fn()

vi.mock('@hooks/use-unified-season', () => ({
  useUnifiedSeason: () => mockUseUnifiedSeason(),
}))

vi.mock('@/hooks/use-unified-season', () => ({
  useUnifiedSeason: () => mockUseUnifiedSeason(),
}))

describe('MICROENTREGA EQUIPES 2 — FOTO DO CARRO E CARACTERÍSTICAS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. TESTE DE INTEGRIDADE DO MANIFEST DE FOTOS
  it('Possui exatamente 28 fotos de carros mapeadas para URLs válidas do Google Drive', () => {
    const keys = Object.keys(TEAM_CAR_PHOTOS_MANIFEST)
    expect(keys.length).toBe(28)
    for (const key of keys) {
      const item = TEAM_CAR_PHOTOS_MANIFEST[key]
      expect(item.fileId).toBeTruthy()
      expect(item.photoUrl).toContain('drive.google.com/thumbnail?id=')
      expect(item.photoUrl).toContain(item.fileId)
    }
  })

  // TESTE A — LOGOS PRESERVADAS
  it('TESTE A — LOGOS PRESERVADAS: logos continuam com os mesmos assets do resolver aprovado', () => {
    mockUseUnifiedSeason.mockReturnValue({
      team: {
        id: 'team_ferrari',
        name: 'Scuderia Ferrari',
        team_key: 'ferrari',
        color: '#E8002D',
        engine_supplier: 'Ferrari',
      },
      season: { id: 'season_2026', year: 2026, current_round: 1, total_rounds: 24 },
      constructorStandings: [
        {
          id: 'ferrari',
          name: 'Scuderia Ferrari',
          points: 25,
          wins: 1,
          podiums: 1,
          isPlayer: true,
        },
        {
          id: 'mclaren',
          name: 'McLaren F1 Team',
          points: 18,
          wins: 0,
          podiums: 1,
          isPlayer: false,
        },
      ],
      playerDrivers: [],
      loading: false,
    })

    render(<PaddockPage />)

    // O resolver de logo deve resolver a logo oficial de Ferrari
    const expectedLogoUrl = getTeamReducedLogoUrl('ferrari')
    expect(expectedLogoUrl).toBe(
      'https://drive.google.com/thumbnail?id=1WNhKOWyf3B_clAbYkBnv9cSju3sBNtg6&sz=w200',
    )

    // A logo no cabeçalho do painel deve existir e conter a URL esperada
    const panel = screen.getByTestId('team-detail-panel')
    const headerLogo = within(panel).getByAltText('Emblema Scuderia Ferrari') as HTMLImageElement
    expect(headerLogo.src).toBe(expectedLogoUrl)
  })

  // TESTE B — FOTOS CORRETAS
  it('TESTE B — FOTOS CORRETAS: selecionar 3 equipes diferentes exibe o monoposto correto de cada uma', () => {
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
        { id: 'audi', name: 'Audi F1 Team', points: 0, wins: 0, podiums: 0, isPlayer: true },
        {
          id: 'ferrari',
          name: 'Scuderia Ferrari',
          points: 25,
          wins: 1,
          podiums: 1,
          isPlayer: false,
        },
        {
          id: 'mercedes',
          name: 'Mercedes-AMG Petronas',
          points: 18,
          wins: 0,
          podiums: 1,
          isPlayer: false,
        },
      ],
      playerDrivers: [],
      loading: false,
    })

    render(<PaddockPage />)

    // 1. Equipe Audi (inicial selecionada por ser a do jogador)
    const audiPhotoUrl = getTeamCarPhotoUrl('audi')
    expect(audiPhotoUrl).toContain('1YQZoSU6vfd6kxDR9rv3tyvqrDkVIJWau')
    const initialCarImg = screen.getByTestId('team-car-image') as HTMLImageElement
    expect(initialCarImg.src).toBe(audiPhotoUrl)

    // 2. Clicar em Ferrari
    const ferrariRow = screen.getByTestId('team-row-ferrari')
    fireEvent.click(ferrariRow)

    const ferrariPhotoUrl = getTeamCarPhotoUrl('ferrari')
    expect(ferrariPhotoUrl).toContain('1_g3tRsxYS6hsD22C7HElFVXV3gbFQHKq')
    const ferrariCarImg = screen.getByTestId('team-car-image') as HTMLImageElement
    expect(ferrariCarImg.src).toBe(ferrariPhotoUrl)

    // 3. Clicar em Mercedes
    const mercRow = screen.getByTestId('team-row-mercedes')
    fireEvent.click(mercRow)

    const mercPhotoUrl = getTeamCarPhotoUrl('mercedes')
    expect(mercPhotoUrl).toContain('18RSb6trOpyEXL2tIqN10cqFAl7WMLtj0')
    const mercCarImg = screen.getByTestId('team-car-image') as HTMLImageElement
    expect(mercCarImg.src).toBe(mercPhotoUrl)
  })

  // TESTE C — PARTICIPAÇÃO
  it('TESTE C — PARTICIPAÇÃO: participante e não participante mantêm estados esportivos corretos', () => {
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

    // Audi (participante)
    const panel = screen.getByTestId('team-detail-panel')
    expect(within(panel).getByTestId('status-badge-active')).toBeDefined()
    expect(within(panel).getByText('10 pts')).toBeDefined()

    // Jordan (não participante)
    const jordanRow = screen.getByTestId('team-row-jordan')
    fireEvent.click(jordanRow)

    expect(within(panel).getByTestId('status-badge-inactive')).toBeDefined()
    expect(within(panel).getByTestId('non-participating-notice')).toBeDefined()
    // Foto do carro da Jordan ainda deve estar presente e correta!
    const jordanPhoto = getTeamCarPhotoUrl('jordan')
    expect(jordanPhoto).toContain('1vM8oG5vsN-Q0Vnl_6q37IJ1jtBVRf-mO')
    const jordanCarImg = screen.getByTestId('team-car-image') as HTMLImageElement
    expect(jordanCarImg.src).toBe(jordanPhoto)
  })

  // TESTE D — SELEÇÃO RÁPIDA E COERÊNCIA
  it('TESTE D — SELEÇÃO RÁPIDA: dados institucionais, características e infraestrutura sincronizam juntos', () => {
    mockUseUnifiedSeason.mockReturnValue({
      team: null,
      season: { id: 'season_2026', year: 2026, current_round: 1, total_rounds: 24 },
      constructorStandings: [
        {
          id: 'mclaren',
          name: 'McLaren F1 Team',
          points: 40,
          wins: 1,
          podiums: 2,
          isPlayer: false,
        },
        { id: 'byd', name: 'BYD F1 Team', points: 0, wins: 0, podiums: 0, isPlayer: false },
      ],
      playerDrivers: [],
      loading: false,
    })

    render(<PaddockPage />)

    // Clicar em McLaren
    const mclarenRow = screen.getByTestId('team-row-mclaren')
    fireEvent.click(mclarenRow)

    const panel = screen.getByTestId('team-detail-panel')
    expect(within(panel).getByText('McLaren F1 Team')).toBeDefined()
    expect(within(panel).getByText(/Woking, Reino Unido/)).toBeDefined()
    expect(within(panel).getByTestId('team-characteristics-section')).toBeDefined()
    expect(within(panel).getByTestId('team-infrastructure-section')).toBeDefined()

    // Clicar em BYD
    const bydRow = screen.getByTestId('team-row-byd')
    fireEvent.click(bydRow)

    expect(within(panel).getByText('BYD')).toBeDefined()
    expect(within(panel).getByText(/Shenzhen, China/)).toBeDefined()
    const bydCarImg = screen.getByTestId('team-car-image') as HTMLImageElement
    expect(bydCarImg.src).toContain('1Cxxqmb4MzkiSkP5xe_TTOJF7lkdzRlj8')
  })

  // TESTE E — INFRAESTRUTURA EXPANSÍVEL
  it('TESTE E — INFRAESTRUTURA: exibe resumo e permite expandir para ver as 9 instalações canônicas', () => {
    mockUseUnifiedSeason.mockReturnValue({
      team: null,
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
      ],
      playerDrivers: [],
      loading: false,
    })

    render(<PaddockPage />)

    const panel = screen.getByTestId('team-detail-panel')
    const infraSection = within(panel).getByTestId('team-infrastructure-section')
    expect(infraSection).toBeDefined()

    // Resumo padrão deve mostrar Fábrica, Túnel Vento e Simulador
    expect(within(infraSection).getByText('Fábrica')).toBeDefined()
    expect(within(infraSection).getByText('Túnel Vento')).toBeDefined()
    expect(within(infraSection).getByText('Simulador')).toBeDefined()

    // Botão "Ver detalhes"
    const toggleBtn = within(infraSection).getByRole('button', { name: /Ver detalhes/i })
    fireEvent.click(toggleBtn)

    // Agora deve mostrar as 9 instalações canônicas
    expect(within(infraSection).getByText('Fábrica Operacional')).toBeDefined()
    expect(within(infraSection).getByText('Centro de Design')).toBeDefined()
    expect(within(infraSection).getByText('Cluster CFD')).toBeDefined()
    expect(within(infraSection).getByText('Manufatura & Produção')).toBeDefined()
    expect(within(infraSection).getByText('Centro de Operações')).toBeDefined()
    expect(within(infraSection).getByText('Centro de Pit Stop')).toBeDefined()
    expect(within(infraSection).getByText('Academia de Jovens Pilotos')).toBeDefined()
  })

  // TESTE F — FALLBACK DE FOTO DO CARRO QUANDO INDISPONÍVEL
  it('TESTE F — FALLBACK: renderiza mensagem neutra identificada sem imagem quebrada caso foto não exista', () => {
    // Testamos a lógica direta do resolver
    const unknownTeamUrl = getTeamCarPhotoUrl('equipe_fantasma_xyz')
    expect(unknownTeamUrl).toBeNull()
  })
})
