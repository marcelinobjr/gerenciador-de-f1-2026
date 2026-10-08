import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { getTeamLogoUrl, TEAM_LOGOS_MAP } from '@/lib/lobby-assets'
import { Topbar } from '@/components/Topbar'

// Mock de NotificationBell para isolamento da Topbar
vi.mock('@/components/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="mock-notification-bell" />,
}))

describe('Correção de URLs de Logo de Equipe e Topbar (Anti-CORS / Anti-Dropbox)', () => {
  describe('1. getTeamLogoUrl e TEAM_LOGOS_MAP', () => {
    it('não deve conter nenhuma URL do Dropbox no TEAM_LOGOS_MAP', () => {
      for (const [key, url] of Object.entries(TEAM_LOGOS_MAP)) {
        expect(
          url.includes('dropbox.com'),
          `TEAM_LOGOS_MAP para a equipe "${key}" ainda aponta para o Dropbox: ${url}`,
        ).toBe(false)
      }
    })

    it('deve retornar asset local para Audi (sem Dropbox, sem CORS)', () => {
      const audiLogo = getTeamLogoUrl('audi')
      expect(audiLogo).toBeDefined()
      expect(typeof audiLogo).toBe('string')
      expect(audiLogo?.includes('dropbox.com')).toBe(false)
      expect(audiLogo).toMatch(/\.svg|data:image\/svg\+xml/)
    })

    it('deve retornar assets locais para as 12 equipes do grid oficial 2026', () => {
      const grid2026 = [
        'ferrari',
        'mercedes',
        'mclaren',
        'redbull',
        'astonmartin',
        'alpine',
        'williams',
        'haas',
        'audi',
        'racingbulls',
        'andretti',
        'cadillac',
      ]

      for (const key of grid2026) {
        const logo = getTeamLogoUrl(key)
        expect(logo, `Logo da equipe "${key}" não foi resolvido`).toBeDefined()
        expect(logo?.includes('dropbox.com')).toBe(false)
        expect(logo).toMatch(/\.svg|data:image\/svg\+xml/)
      }
    })

    it('deve retornar crest SVG procedural em data URI para equipes históricas sem SVG estático', () => {
      const proceduralTeams = ['benetton', 'copersucar', 'jordan', 'toleman', 'penske', 'byd']
      for (const key of proceduralTeams) {
        const logo = getTeamLogoUrl(key)
        expect(logo, `Logo procedural da equipe "${key}" não foi retornado`).toBeDefined()
        expect(logo?.startsWith('data:image/svg+xml')).toBe(true)
        expect(logo?.includes('dropbox.com')).toBe(false)
      }
    })

    it('deve tratar com segurança IDs com prefixos como team_ e ai_', () => {
      const logoTeamAudi = getTeamLogoUrl('team_audi')
      const logoAiAudi = getTeamLogoUrl('ai_audi')
      expect(logoTeamAudi).toBeDefined()
      expect(logoTeamAudi?.includes('dropbox.com')).toBe(false)
      expect(logoAiAudi).toBeDefined()
      expect(logoAiAudi?.includes('dropbox.com')).toBe(false)
    })

    it('deve retornar undefined para valores vazios ou nulos sem estourar exceção', () => {
      expect(getTeamLogoUrl(null)).toBeUndefined()
      expect(getTeamLogoUrl(undefined)).toBeUndefined()
      expect(getTeamLogoUrl('')).toBeUndefined()
    })
  })

  describe('2. Topbar e Renderização Segura', () => {
    it('deve renderizar o logo da equipe com data-html2canvas-ignore="true" e sem URL do Dropbox', () => {
      const mockTeam = {
        id: 'team_audi',
        team_key: 'audi',
        name: 'Audi Revolut F1 Team',
        color: '#00E701',
      }
      const mockSeason = { current_round: 1, total_rounds: 24, year: 2026 }
      const mockUser = { id: 'usr-1', name: 'Player Manager' }

      const { container } = render(
        <BrowserRouter>
          <Topbar
            onOpenMobileMenu={() => {}}
            user={mockUser}
            team={mockTeam}
            season={mockSeason}
            onLogout={() => {}}
          />
        </BrowserRouter>,
      )

      const teamLogoImg = container.querySelector('img[alt="Audi Revolut F1 Team"]')
      expect(teamLogoImg).not.toBeNull()
      expect(teamLogoImg?.getAttribute('data-html2canvas-ignore')).toBe('true')
      expect(teamLogoImg?.getAttribute('src')?.includes('dropbox.com')).toBe(false)
    })
  })
})
