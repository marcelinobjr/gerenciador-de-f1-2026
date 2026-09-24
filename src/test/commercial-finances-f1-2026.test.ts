import { describe, it, expect } from 'vitest'
import { CAREER_NAV_SECTIONS, ROUTE_TITLE_MAP } from '@/components/Sidebar'
import { OFFICIAL_SPONSOR_SLOTS, getTeamHotspots } from '@/data/assets/teamSponsorHotspots'
import { COMMERCIAL_MARKET_SPONSORS } from '@/data/commercialMarketData'
import { calculateCanonicalSponsorFit } from '@/lib/sponsorFitCalculator'
import { formatMoneyM, formatCurrency } from '@/lib/formatters'

describe('Frente 1 — Nova Navegação Global (Sidebar)', () => {
  it('Sidebar possui os grupos exigidos com a ordem correta', () => {
    const titles = CAREER_NAV_SECTIONS.map((s) => s.title)
    expect(titles).toEqual(['GESTÃO', 'COMPETIÇÃO'])

    const allItems = CAREER_NAV_SECTIONS.flatMap((s) => s.items)
    const allNames = allItems.map((i) => i.name)
    expect(allNames).toContain('Comercial & Finanças')
    expect(allNames).toContain('Infraestrutura')
    expect(allNames).toContain('Corrida')
    expect(allNames).not.toContain('Fim de Semana')
    expect(allNames).toContain('Campeonato')
    expect(allNames).toContain('Histórico')
  })

  it('Rotas internas foram preservadas com renomeações visíveis', () => {
    const allItems = CAREER_NAV_SECTIONS.flatMap((s) => s.items)
    expect(allItems.find((i) => i.path === '/')?.path).toBe('/')
    expect(allItems.find((i) => i.path === '/team')?.path).toBe('/team')
    expect(allItems.find((i) => i.path === '/car')?.path).toBe('/car')
    expect(allItems.find((i) => i.path === '/sponsors')?.path).toBe('/sponsors')
    expect(allItems.find((i) => i.path === '/corrida')?.path).toBe('/corrida')
    expect(allItems.find((i) => i.path === '/paddock')?.path).toBe('/paddock')
    expect(allItems.find((i) => i.path === '/regulamento')?.path).toBe('/regulamento')
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
