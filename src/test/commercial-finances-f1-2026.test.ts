import { describe, it, expect } from 'vitest'
import { CAREER_NAV_SECTIONS, ROUTE_TITLE_MAP } from '@/components/Sidebar'
import { OFFICIAL_SPONSOR_SLOTS, getTeamHotspots } from '@/data/assets/teamSponsorHotspots'
import { COMMERCIAL_MARKET_SPONSORS } from '@/data/commercialMarketData'
import { calculateCanonicalSponsorFit } from '@/lib/sponsorFitCalculator'
import { formatMoneyM, formatCurrency } from '@/lib/formatters'

describe('Frente 1 — Nova Navegação Global (Sidebar)', () => {
  it('Sidebar possui os grupos exigidos com a ordem correta', () => {
    const titles = CAREER_NAV_SECTIONS.map((s) => s.title)
    expect(titles).toEqual(['PRINCIPAL', 'PERFORMANCE', 'GESTÃO', 'COMPETIÇÃO & REGRAS'])

    // Grupo PRINCIPAL: 1. Dashboard 2. Minha Equipe 3. Meus Carros 4. Comercial & Finanças
    const principalItems = CAREER_NAV_SECTIONS[0].items.map((i) => i.name)
    expect(principalItems).toEqual([
      'Dashboard',
      'Minha Equipe',
      'Meus Carros',
      'Comercial & Finanças',
    ])

    // Grupo PERFORMANCE: 5. Desenvolvimento 6. Infraestrutura 7. Fim de Semana
    const perfItems = CAREER_NAV_SECTIONS[1].items.map((i) => i.name)
    expect(perfItems).toEqual(['Desenvolvimento', 'Infraestrutura', 'Fim de Semana'])

    // Grupo GESTÃO: 8. Pilotos 9. Pistas 10. Equipes
    const gestaoItems = CAREER_NAV_SECTIONS[2].items.map((i) => i.name)
    expect(gestaoItems).toEqual(['Pilotos', 'Pistas', 'Equipes'])

    // Campeonato, Histórico, Regulamento
    const compItems = CAREER_NAV_SECTIONS[3].items.map((i) => i.name)
    expect(compItems).toEqual(['Campeonato', 'Histórico', 'Regulamento'])
  })

  it('Rotas internas foram preservadas com renomeações visíveis', () => {
    const principal = CAREER_NAV_SECTIONS[0].items
    expect(principal.find((i) => i.name === 'Dashboard')?.path).toBe('/')
    expect(principal.find((i) => i.name === 'Minha Equipe')?.path).toBe('/team')
    expect(principal.find((i) => i.name === 'Meus Carros')?.path).toBe('/car')
    expect(principal.find((i) => i.name === 'Comercial & Finanças')?.path).toBe('/sponsors')

    const gestao = CAREER_NAV_SECTIONS[2].items
    expect(gestao.find((i) => i.name === 'Equipes')?.path).toBe('/paddock')

    const comp = CAREER_NAV_SECTIONS[3].items
    expect(comp.find((i) => i.name === 'Regulamento')?.path).toBe('/regulamento')
  })
})

describe('Frente 2 — Patrocinadores Atuais & Hotspots', () => {
  it('Define exatamente os 5 espaços canônicos de patrocínio', () => {
    expect(OFFICIAL_SPONSOR_SLOTS).toHaveLength(5)
    const slotKeys = OFFICIAL_SPONSOR_SLOTS.map((s) => s.key)
    expect(slotKeys).toContain('front_wing')
    expect(slotKeys).toContain('nose')
    expect(slotKeys).toContain('sidepod')
    expect(slotKeys).toContain('engine_cover')
    expect(slotKeys).toContain('rear_wing')
  })

  it('Coordenadas de hotspots para Audi e fallback existem e estão no range 0-100%', () => {
    const audiConfig = getTeamHotspots('audi')
    expect(audiConfig.hasCalibratedCoordinates).toBe(true)
    for (const slotKey of ['front_wing', 'nose', 'sidepod', 'engine_cover', 'rear_wing'] as const) {
      const coord = audiConfig.slots[slotKey]
      expect(coord.x).toBeGreaterThan(0)
      expect(coord.x).toBeLessThan(100)
      expect(coord.y).toBeGreaterThan(0)
      expect(coord.y).toBeLessThan(100)
    }

    const fallbackConfig = getTeamHotspots('equipe_desconhecida')
    expect(fallbackConfig.hasCalibratedCoordinates).toBe(true)
    expect(fallbackConfig.slots.sidepod.x).toBeGreaterThan(0)
  })
})

describe('Frente 2 — Mercado & Oportunidades & Sponsor Fit', () => {
  it('Catálogo de mercado possui marcas oficiais variadas em US$', () => {
    expect(COMMERCIAL_MARKET_SPONSORS.length).toBeGreaterThanOrEqual(10)
    for (const sp of COMMERCIAL_MARKET_SPONSORS) {
      expect(sp.estimatedBudgetMin).toBeGreaterThan(0)
      expect(sp.estimatedBudgetMax).toBeGreaterThanOrEqual(sp.estimatedBudgetMin)
      expect(sp.preferredSlots.length).toBeGreaterThan(0)
    }
  })

  it('Sponsor Fit canônico deriva fatores reais sem valores arbitrários', () => {
    const mockTeam = {
      id: 'audi_f1',
      name: 'Audi F1 Team',
      reputation: 85,
      country: 'Alemanha',
    } as any

    const rolex = COMMERCIAL_MARKET_SPONSORS.find((s) => s.id === 'sp_rolex')!
    const fitResult = calculateCanonicalSponsorFit(rolex, mockTeam, { championshipPosition: 3 })

    expect(fitResult.score).toBeGreaterThanOrEqual(50)
    expect(fitResult.score).toBeLessThanOrEqual(99)
    expect(fitResult.factors.length).toBeGreaterThanOrEqual(4)
    expect(fitResult.description).toBeTruthy()
  })
})

describe('Frente 2 — Formatação de Moeda Canônica', () => {
  it('Moeda canônica exibe formato US$ M consistente sem misturar R$', () => {
    const formatted1 = formatMoneyM(164.01)
    expect(formatted1).toBe('US$ 164,01 M')

    const formattedRaw = formatMoneyM(84_040_000, true)
    expect(formattedRaw).toBe('US$ 84,04 M')

    const formattedCurrency = formatCurrency(150_000_000)
    expect(formattedCurrency).toContain('US$')
    expect(formattedCurrency).not.toContain('R$')
  })
})
