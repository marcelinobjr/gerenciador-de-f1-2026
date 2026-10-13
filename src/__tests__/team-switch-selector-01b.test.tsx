/**
 * TeamSwitchSelector.test.tsx — Verificação do seletor de troca de equipe (SEASON-RESET-FIX-01B).
 * Mocka o cliente PocketBase e o F1Context; verifica fluxo idempotente de escolha
 * de equipe existente e gravação em seasons + localStorage.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { TeamSwitchSelector } from '../components/teams/TeamSwitchSelector'

const pbMock = vi.hoisted(() => ({
  collection: vi.fn(() => ({
    getFullList: vi.fn().mockResolvedValue([
      {
        id: 'team_a',
        name: 'Audi F1 Team',
        color: '#FF2A00',
        engine_supplier: 'Audi',
        strength: 70,
        budget: 150000000,
        is_custom: false,
      },
      {
        id: 'team_b',
        name: 'Ferrari',
        color: '#E8002D',
        engine_supplier: 'Ferrari',
        strength: 86,
        budget: 300000000,
        is_custom: false,
      },
    ]),
    update: vi.fn().mockResolvedValue({ id: 'season_1' }),
  })),
}))

vi.mock('@/lib/pocketbase/client', () => ({ default: pbMock }))
vi.mock('@/contexts/F1Context', () => ({
  useF1: () => ({
    team: { id: 'team_a', name: 'Audi F1 Team' },
    season: { id: 'season_1', year: 2027 },
    refreshTeamAndSeason: vi.fn().mockResolvedValue(undefined),
  }),
}))
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

describe('TeamSwitchSelector', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renderiza lista de equipes do grid para escolha', async () => {
    render(<TeamSwitchSelector />)
    expect(await screen.findByText('Audi F1 Team')).toBeDefined()
    expect(screen.getByText('Ferrari')).toBeDefined()
  })

  it('permite trocar a equipe comandada e persiste idempotente', async () => {
    render(<TeamSwitchSelector />)
    const ferrariCard = await screen.findByText('Ferrari')
    const assumeBtn = ferrariCard.closest('div[class*="rounded-lg"]')?.querySelector('button')
    expect(assumeBtn).toBeDefined()
    fireEvent.click(assumeBtn!)

    await waitFor(() => {
      // Temporada atualizada com novo team_id
      expect(pbMock.collection('seasons').update).toHaveBeenCalledWith('season_1', {
        team_id: 'team_b',
      })
      // Persistência local idempotente
      expect(localStorage.getItem('apex_player_team_id')).toBe('team_b')
    })
  })

  it('não re-executa troca se já é a equipe atual', async () => {
    render(<TeamSwitchSelector />)
    const audiCard = await screen.findByText('Audi F1 Team')
    const btn = audiCard.closest('div[class*="rounded-lg"]')?.querySelector('button')
    // Botão da equipe atual deve estar desabilitado
    expect(btn?.disabled).toBe(true)
    fireEvent.click(btn!)
    expect(pbMock.collection('seasons').update).not.toHaveBeenCalled()
  })
})
