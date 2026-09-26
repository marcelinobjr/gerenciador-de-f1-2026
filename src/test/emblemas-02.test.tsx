import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { TEAM_LOGOS, resolveTeamLogo, normalizeTeamKey } from '@/data/teamLogos'
import { TeamCrest } from '@/components/ui/TeamCrest'
import { TeamHeroBanner } from '@/components/team/TeamHeroBanner'
import { TeamBrandingCard } from '@/components/team/TeamBrandingCard'

describe('EMBLEMAS-02 — Resolução de Emblemas Reais, Crests e Renderização de /team', () => {
  // --------------------------------------------------------------------------
  // A. Toda equipe canônica do grid resolve visual (29/29 sem fallback textual acionado no grid oficial)
  // --------------------------------------------------------------------------
  describe('A. Toda equipe canônica do grid resolve visual (29/29 sem fallback textual)', () => {
    it('o catálogo canônico possui exatamente 29 equipes cadastradas', () => {
      const teamKeys = Object.keys(TEAM_LOGOS)
      expect(teamKeys).toHaveLength(29)
    })

    it('todas as 29 equipes canônicas resolvem para tipo "logo" ou "crest", NUNCA "fallback"', () => {
      const teamKeys = Object.keys(TEAM_LOGOS)

      teamKeys.forEach((key) => {
        const visual = resolveTeamLogo(key)
        expect(
          ['logo', 'crest'].includes(visual.type),
          `Equipe ${key} retornou tipo inválido: ${visual.type}`,
        ).toBe(true)
        expect(visual.type).not.toBe('fallback')
        expect(visual.displayName).toBeTruthy()
        expect(visual.fallbackText).toBeTruthy()
        expect(visual.fallbackText).not.toBe('—')
        expect(visual.crest).toBeDefined()
        expect(visual.crest?.acronym).toBeTruthy()
        expect(visual.crest?.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
        expect(visual.crest?.secondaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
      })
    })

    it('as 12 equipes do grid oficial 2026 possuem tipo "logo" com logoUrl local definido', () => {
      const officialGrid2026 = [
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

      officialGrid2026.forEach((key) => {
        const visual = resolveTeamLogo(key)
        expect(visual.type).toBe('logo')
        expect(visual.logoUrl).toBeTruthy()
        expect(typeof visual.logoUrl).toBe('string')
        expect(visual.teamKey).toBe(key)
      })
    })
  })

  // --------------------------------------------------------------------------
  // B. Amostra de logos reais resolvidos e crests procedurais para fictícias/históricas
  // --------------------------------------------------------------------------
  describe('B. Amostra de logos reais e crests procedurais', () => {
    it('resolve corretamente logos reais das principais escuderias (Ferrari, Mercedes, McLaren, Red Bull, Aston, Alpine, Williams, Haas, Audi, Racing Bulls, Cadillac)', () => {
      const realTeams = [
        { id: 'ferrari', name: 'Scuderia Ferrari', acronym: 'FER' },
        { id: 'mercedes', name: 'Mercedes-AMG Petronas', acronym: 'MER' },
        { id: 'mclaren', name: 'McLaren Formula 1 Team', acronym: 'MCL' },
        { id: 'redbull', name: 'Oracle Red Bull Racing', acronym: 'RBR' },
        { id: 'astonmartin', name: 'Aston Martin Aramco Formula One Team', acronym: 'AMR' },
        { id: 'alpine', name: 'BWT Alpine F1 Team', acronym: 'ALP' },
        { id: 'williams', name: 'Williams Racing', acronym: 'WIL' },
        { id: 'haas', name: 'MoneyGram Haas F1 Team', acronym: 'HAA' },
        { id: 'audi', name: 'Audi Revolut F1 Team', acronym: 'AUD' },
        { id: 'racingbulls', name: 'Visa Cash App RB', acronym: 'RB' },
        { id: 'cadillac', name: 'Cadillac Formula 1 Team', acronym: 'CAD' },
      ]

      realTeams.forEach((t) => {
        const resolved = resolveTeamLogo(t.id)
        expect(resolved.type).toBe('logo')
        expect(resolved.displayName).toBe(t.name)
        expect(resolved.crest?.acronym).toBe(t.acronym)
        expect(resolved.logoUrl).toBeDefined()
      })
    })

    it('resolve crests procedurais com cores e siglas oficiais para equipes fictícias ou sem logo vetorial', () => {
      const proceduralTeams = [
        { id: 'byd', name: 'BYD Formula Racing', acronym: 'BYD', primary: '#00529B' },
        { id: 'penske', name: 'Team Penske F1', acronym: 'PEN', primary: '#DD0000' },
        { id: 'benetton', name: 'Benetton Formula', acronym: 'BEN', primary: '#00965E' },
        { id: 'copersucar', name: 'Copersucar-Fittipaldi', acronym: 'COP', primary: '#009B3A' },
        { id: 'alphatauri', name: 'Scuderia AlphaTauri', acronym: 'AT', primary: '#021B35' },
        { id: 'fittipaldi', name: 'Fittipaldi Automotive', acronym: 'FIT', primary: '#FFD700' },
        { id: 'jordan', name: 'Jordan Grand Prix', acronym: 'JOR', primary: '#FFE500' },
        { id: 'toleman', name: 'Toleman Motorsport', acronym: 'TOL', primary: '#002B7F' },
        { id: 'custom', name: 'Escuderia Apex Brasil', acronym: 'APX', primary: '#E10600' },
      ]

      proceduralTeams.forEach((t) => {
        const resolved = resolveTeamLogo(t.id)
        expect(resolved.type).toBe('crest')
        expect(resolved.displayName).toBe(t.name)
        expect(resolved.crest?.acronym).toBe(t.acronym)
        expect(resolved.crest?.primaryColor).toBe(t.primary)
      })
    })

    it('resolve aliases e variações de nomes para a equipe canônica correspondente', () => {
      expect(resolveTeamLogo('Scuderia Ferrari HP').teamKey).toBe('ferrari')
      expect(resolveTeamLogo('Mercedes AMG').teamKey).toBe('mercedes')
      expect(resolveTeamLogo('McLaren Racing').teamKey).toBe('mclaren')
      expect(resolveTeamLogo('Oracle Red Bull Racing').teamKey).toBe('redbull')
      expect(resolveTeamLogo('Aston Martin Aramco').teamKey).toBe('astonmartin')
      expect(resolveTeamLogo('BWT Alpine').teamKey).toBe('alpine')
      expect(resolveTeamLogo('Williams F1').teamKey).toBe('williams')
      expect(resolveTeamLogo('MoneyGram Haas').teamKey).toBe('haas')
      expect(resolveTeamLogo('Audi Revolut').teamKey).toBe('audi')
      expect(resolveTeamLogo('VCARB').teamKey).toBe('racingbulls')
      expect(resolveTeamLogo('GM Cadillac').teamKey).toBe('cadillac')
      expect(resolveTeamLogo('Team Lotus').teamKey).toBe('lotus')
    })
  })

  // --------------------------------------------------------------------------
  // C. Fallback honesto: equipe inexistente → tipo 'fallback'/sigla textual, sem crash
  // --------------------------------------------------------------------------
  describe('C. Fallback honesto: termos desconhecidos ou vazios', () => {
    it('equipe desconhecida gera visual tipo "fallback" com sigla textual sem crash', () => {
      const resolved = resolveTeamLogo('Xpto Racing Team')
      expect(resolved.type).toBe('fallback')
      expect(resolved.displayName).toBe('Xpto Racing Team')
      expect(resolved.fallbackText).toBe('XRT')
      expect(resolved.logoUrl).toBeUndefined()
    })

    it('strings vazias ou nulas geram fallback padrão sem crash', () => {
      const resNull = resolveTeamLogo(null)
      expect(resNull.type).toBe('fallback')
      expect(resNull.fallbackText).toBe('—')

      const resEmpty = resolveTeamLogo('')
      expect(resEmpty.type).toBe('fallback')
      expect(resEmpty.fallbackText).toBe('—')

      const resUndefined = resolveTeamLogo(undefined)
      expect(resUndefined.type).toBe('fallback')
      expect(resUndefined.fallbackText).toBe('—')
    })

    it('normalizeTeamKey trata com segurança entradas malformadas', () => {
      expect(normalizeTeamKey(null)).toBe('')
      expect(normalizeTeamKey(undefined)).toBe('')
      expect(normalizeTeamKey('')).toBe('')
      expect(normalizeTeamKey('   ')).toBe('')
    })
  })

  // --------------------------------------------------------------------------
  // D. Renderização dos Componentes de UI sem ReferenceError (TeamHeroBanner / TeamBrandingCard)
  // --------------------------------------------------------------------------
  describe('D. Renderização de UI — TeamHeroBanner e TeamBrandingCard sem ReferenceError', () => {
    it('TeamHeroBanner renderiza sem erro quando teamKey é fornecido ou omitido', () => {
      const bannerProps = {
        teamName: 'Audi Revolut F1 Team',
        teamKey: 'audi',
        subheading: 'Tecnologia. Pessoas. Performance.',
        bgImage: '/test-garage.png',
        constructorPosition: 3,
        constructorPoints: 85,
        reputation: 90,
        seasonTarget: 'Pódio no campeonato',
        pointsProgress: { current: 85, target: 120 },
        isAudi: true,
      }

      // 1. Com teamKey fornecido
      const { unmount: unmount1 } = render(<TeamHeroBanner {...bannerProps} />)
      unmount1()

      // 2. Sem teamKey (usa teamName como fallback para o crest)
      const { teamKey: _, ...propsWithoutKey } = bannerProps
      const { unmount: unmount2 } = render(<TeamHeroBanner {...propsWithoutKey} />)
      unmount2()
    })

    it('TeamBrandingCard renderiza sem erro para equipe com logo ou crest', () => {
      const { unmount: unmount1 } = render(
        <TeamBrandingCard
          teamKey="audi"
          teamName="Audi Revolut F1 Team"
          tagline="DRIVEN BY PROGRESS"
        />,
      )
      unmount1()

      const { unmount: unmount2 } = render(
        <TeamBrandingCard
          teamKey="custom"
          teamName="Escuderia Apex Brasil"
          tagline="RACING HERITAGE"
        />,
      )
      unmount2()
    })

    it('TeamCrest renderiza perfeitamente para os três modos (logo, crest, fallback)', () => {
      // 1. Logo real
      const { container: cLogo } = render(<TeamCrest team="ferrari" size="lg" />)
      expect(cLogo.querySelector('img')).not.toBeNull()

      // 2. Crest procedural
      const { container: cCrest } = render(<TeamCrest team="benetton" size="md" />)
      expect(cCrest.querySelector('svg')).not.toBeNull()
      expect(cCrest.querySelector('text')?.textContent).toBe('BEN')

      // 3. Fallback textual
      const { container: cFallback } = render(<TeamCrest team="Inexistente Team" size="sm" />)
      expect(cFallback.textContent).toBe('IT')
    })
  })
})
