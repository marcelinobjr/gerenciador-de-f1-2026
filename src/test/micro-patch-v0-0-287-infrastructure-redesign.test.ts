import { describe, it, expect } from 'vitest'
import { CAREER_NAV_SECTIONS } from '@/components/Sidebar'
import { ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { CANONICAL_FACILITIES_DEFINITIONS } from '@/types/canonical-facilities-data'
import {
  DRIVE_STORAGE_PHOTOS,
  ENGINE_SUPPLIER_LOGOS,
  getEngineSupplierLogo,
} from '@/lib/drive-storage-photos'

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
    expect(compNames).toContain('Corrida')
    expect(compNames).not.toContain('Fim de Semana')
    expect(compNames).toContain('Campeonato')
    expect(compNames.some((n) => n === 'Paddock' || n === 'Equipes')).toBe(true)
    expect(compNames).toContain('Histórico')
  })

  it('Power Unit: Fornecedores de Power Unit contém Audi, Ferrari, Mercedes, Honda e Ford com dados completos', () => {
    const suppliers = ['Audi', 'Ferrari', 'Mercedes', 'Honda', 'Ford']
    suppliers.forEach((s) => {
      const logo = getEngineSupplierLogo(s)
      expect(logo).toBeTruthy()
      expect(logo).toContain('drive.google.com/thumbnail?id=')
      expect(ENGINE_SUPPLIER_LOGOS[s]).toBeTruthy()
    })
  })

  it('Power Unit: Fornecedores de Power Unit contém dados técnicos válidos', () => {
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
      // Validação de formato Google Drive Thumbnail resiliente
      expect(DRIVE_STORAGE_PHOTOS[key]).toContain('drive.google.com/thumbnail?id=')
    }
  })

  it('Assets Visuais Oficiais da Pasta do Google Drive (9 Instalações + Campus + Power Unit)', () => {
    // 9 instalações com seus IDs únicos na pasta oficial do Drive (1qMFGQkKXlH1Zb3u7GVnRYKFUny1Jzqnk)
    const officialDriveMap: Record<string, string> = {
      'Fabrica.jpg': '1phyP1H8xzTbit9rblTUMzLrKg2jhy-f-',
      'Centro_de_Design.jpg': '1qyYkUNjw46Za-cWqFgIkRIOkYBARjzNF',
      'Cluster_CFD.jpg': '1dmYw9CxdM_73zqX10qmoVaWCNpJ1i7qt',
      'Túnel_de_vento.jpg': '1lENvyCJa0fKVpttHVYl8N4Z11svoPy4y',
      'Estrutura_industrial.jpg': '1iXyVw_enWLYp4G2FbAg5EsoMr5A7mKwS',
      'Simulador.jpg': '16YZFSmFgLGdVhjAZbB5PhG9U5R0qHK1V',
      'Centro_de_operações.jpg': '1VZwvNs4ENeCOwjZXap1Wkstc4NEp6WeG',
      'Centro_de_Pit_stop.jpg': '1cnzcYOvlipue238eftPktQf5AKAI-YHu',
      'Academia_de_pilotos.jpg': '1bZajSpyxHJW5ZVr9QHGx-L4MuDNYbFva',
    }

    // Cada uma das 9 instalações possui seu arquivo mapeado com o ID correto e único
    const seenIds = new Set<string>()
    for (const [filename, fileId] of Object.entries(officialDriveMap)) {
      const url = DRIVE_STORAGE_PHOTOS[filename]
      expect(url).toBeDefined()
      expect(url).toContain(fileId)
      expect(seenIds.has(fileId)).toBe(false)
      seenIds.add(fileId)
    }

    // Exatamente 9 arquivos distintos para as 9 instalações (não reutiliza imagem entre cards)
    expect(seenIds.size).toBe(9)
  })
})
