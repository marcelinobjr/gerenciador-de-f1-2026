import { describe, it, expect } from 'vitest'
import {
  CAR_PART_ASSETS,
  getCarPartPhoto,
  getCarPartFallbackSvg,
  getSponsorSlotPhoto,
} from '@/data/assets/carPartAssets'
import { OFFICIAL_SPONSOR_SLOTS } from '@/data/assets/teamSponsorHotspots'
import { CAREER_NAV_SECTIONS, ROUTE_TITLE_MAP } from '@/components/Sidebar'

describe('MICRO-PATCH v0.0.282 — Resolução Canônica de Miniaturas de Peças & Hotspots', () => {
  it('(1) Todas as 5 posições de patrocínio resolvem via getSponsorSlotPhoto sem erro', () => {
    for (const slot of OFFICIAL_SPONSOR_SLOTS) {
      const photoOrSvg = getSponsorSlotPhoto(slot.key)
      expect(photoOrSvg).toBeDefined()
      expect(typeof photoOrSvg).toBe('string')
      expect(photoOrSvg.length).toBeGreaterThan(0)
      // Garante que não aponta para pastas inexistentes
      expect(photoOrSvg).not.toContain('/assets/car-parts/')
    }
  })

  it('(2) Manifest CAR_PART_ASSETS possui 6 componentes com assets ou fallback SVG limpo', () => {
    const parts = ['frontWing', 'rearWing', 'floor', 'sidepods', 'engine', 'suspension'] as const
    for (const p of parts) {
      const asset = CAR_PART_ASSETS[p]
      expect(asset).toBeDefined()
      expect(asset.fallbackSvg).toContain('<svg')
      expect(asset.photoUrl).toBeDefined()
      expect(asset.photoUrl).not.toContain('/assets/car-parts/')
    }
  })

  it('(3) Fallback SVG gera data URL válida para qualquer chave desconhecida', () => {
    const svg = getCarPartFallbackSvg('desconhecido')
    expect(svg).toContain('data:image/svg+xml')
    expect(svg).toContain('%3Csvg')
  })

  it('(4) Sidebar possui as seções requeridas e rotas intactas', () => {
    const sectionTitles = CAREER_NAV_SECTIONS.map((s) => s.title)
    expect(sectionTitles).toEqual(['GESTÃO', 'COMPETIÇÃO'])

    const allItems = CAREER_NAV_SECTIONS.flatMap((s) => s.items)
    const sponsorsItem = allItems.find((i) => i.name === 'Comercial & Finanças')
    expect(sponsorsItem).toBeDefined()
    expect(sponsorsItem?.path).toBe('/sponsors')

    const regulamentoItem = allItems.find((i) => i.path === '/regulamento')
    expect(regulamentoItem).toBeDefined()
    expect(regulamentoItem?.path).toBe('/regulamento')
  })
})
