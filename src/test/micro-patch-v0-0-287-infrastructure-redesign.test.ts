import { describe, it, expect } from 'vitest'
import { CAREER_NAV_SECTIONS } from '@/components/Sidebar'
import { ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { CANONICAL_FACILITIES_DEFINITIONS } from '@/types/canonical-facilities-data'
import { DRIVE_STORAGE_PHOTOS } from '@/lib/drive-storage-photos'

describe('REDESIGN INFRAESTRUTURA v0.0.287 — Suíte de Testes Canônica', () => {
  it('Sidebar: deve ter removido o item "Desenvolvimento" (/development) e manter seções GESTÃO e COMPETIÇÃO', () => {
    const allItems = CAREER_NAV_SECTIONS.flatMap((sec) => sec.items)
    const devItem = allItems.find(
      (item) => item.path === '/development' || item.name === 'Desenvolvimento',
    )
    expect(devItem).toBeUndefined()

    // Validação das seções esperadas
    const gestao = CAREER_NAV_SECTIONS.find((s) => s.title === 'GESTÃO')
    expect(gestao).toBeDefined()
    const gestaoNames = gestao!.items.map((i) => i.name)
    expect(gestaoNames).toContain('Central')
    expect(gestaoNames).toContain('Equipe')
    expect(gestaoNames).toContain('Pilotos')
    expect(gestaoNames).toContain('Carro')
    expect(gestaoNames).toContain('Infraestrutura')
    expect(gestaoNames).toContain('Comercial & Finanças')

    const competicao = CAREER_NAV_SECTIONS.find((s) => s.title === 'COMPETIÇÃO')
    expect(competicao).toBeDefined()
    const compNames = competicao!.items.map((i) => i.name)
    expect(compNames).toContain('Fim de Semana')
    expect(compNames).toContain('Campeonato')
    expect(compNames).toContain('Paddock')
    expect(compNames).toContain('Histórico')
  })

  it('Power Unit: Fornecedores de Power Unit contém Audi, Ferrari, Mercedes, Honda e Ford com dados completos', () => {
    expect(ENGINE_SUPPLIERS.length).toBeGreaterThanOrEqual(5)
    const audi = ENGINE_SUPPLIERS.find((s) => s.name === 'Audi')
    expect(audi).toBeDefined()
    expect(audi?.power).toBeGreaterThan(0)
    expect(audi?.reliability).toBeGreaterThan(0)
    expect(audi?.costAnnual).toBeGreaterThan(0)

    const ferrari = ENGINE_SUPPLIERS.find((s) => s.name === 'Ferrari')
    const mercedes = ENGINE_SUPPLIERS.find((s) => s.name === 'Mercedes')
    const honda = ENGINE_SUPPLIERS.find((s) => s.name === 'Honda')
    const ford = ENGINE_SUPPLIERS.find((s) => s.name === 'Ford')
    expect(ferrari).toBeDefined()
    expect(mercedes).toBeDefined()
    expect(honda).toBeDefined()
    expect(ford).toBeDefined()
  })

  it('Infraestrutura: exatamente 9 instalações canônicas com nomes e imagens canônicas mapeadas', () => {
    expect(CANONICAL_FACILITIES_DEFINITIONS.length).toBe(9)

    const expectedKeys = [
      'Fabrica.jpg',
      'Centro_de_Design.jpg',
      'Cluster_CFD.jpg',
      'Túnel_de_vento.jpg',
      'Estrutura_industrial.jpg',
      'Simulador.jpg',
      'Centro_de_operações.jpg',
      'Centro_de_Pit_stop.jpg',
      'Academia_de_pilotos.jpg',
    ]

    for (const key of expectedKeys) {
      expect(DRIVE_STORAGE_PHOTOS[key]).toBeDefined()
      expect(typeof DRIVE_STORAGE_PHOTOS[key]).toBe('string')
      expect(DRIVE_STORAGE_PHOTOS[key].length).toBeGreaterThan(10)
    }
  })
})
