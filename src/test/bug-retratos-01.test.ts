import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import fs from 'fs'
import path from 'path'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { CANONICAL_DRIVERS_MASTER, getCanonicalAssetId } from '@/lib/canonical-driver-database'

// Mapeamento dos 24 Titulares 2026 fornecido na especificação
const GRID_2026_DRIVERS = [
  { driverId: 'mbj-001', expectedAsset: 'DRV_0022', name: 'Max Verstappen' },
  { driverId: 'mbj-002', expectedAsset: 'DRV_0002', name: 'Liam Lawson' },
  { driverId: 'mbj-003', expectedAsset: 'DRV_0003', name: 'Lewis Hamilton' },
  { driverId: 'mbj-004', expectedAsset: 'DRV_0047', name: 'Charles Leclerc' },
  { driverId: 'mbj-005', expectedAsset: 'DRV_0019', name: 'Lando Norris' },
  { driverId: 'mbj-006', expectedAsset: 'DRV_0108', name: 'Oscar Piastri' },
  { driverId: 'mbj-007', expectedAsset: 'DRV_0096', name: 'George Russell' },
  { driverId: 'mbj-008', expectedAsset: 'DRV_0008', name: 'Andrea Kimi Antonelli' },
  { driverId: 'mbj-009', expectedAsset: 'DRV_0009', name: 'Fernando Alonso' },
  { driverId: 'mbj-010', expectedAsset: 'DRV_0010', name: 'Lance Stroll' },
  { driverId: 'mbj-011', expectedAsset: 'DRV_0011', name: 'Pierre Gasly' },
  { driverId: 'mbj-012', expectedAsset: 'DRV_0015', name: 'Jack Doohan' },
  { driverId: 'mbj-013', expectedAsset: 'DRV_0014', name: 'Alexander Albon' },
  { driverId: 'mbj-014', expectedAsset: 'DRV_0089', name: 'Carlos Sainz' },
  { driverId: 'mbj-015', expectedAsset: 'DRV_0016', name: 'Yuki Tsunoda' },
  { driverId: 'mbj-016', expectedAsset: 'DRV_0017', name: 'Isack Hadjar' },
  { driverId: 'mbj-017', expectedAsset: 'DRV_0018', name: 'Esteban Ocon' },
  { driverId: 'mbj-018', expectedAsset: 'DRV_0019', name: 'Oliver Bearman' },
  { driverId: 'mbj-019', expectedAsset: 'DRV_0068', name: 'Nico Hülkenberg' },
  { driverId: 'mbj-020', expectedAsset: 'DRV_0012', name: 'Gabriel Bortoleto' },
  { driverId: 'mbj-021', expectedAsset: 'DRV_0020', name: 'Sergio Pérez' },
  { driverId: 'mbj-022', expectedAsset: 'DRV_0021', name: 'Valtteri Bottas' },
  { driverId: 'mbj-037', expectedAsset: 'DRV_0105', name: 'Mick Schumacher' },
  { driverId: 'mbj-029', expectedAsset: 'DRV_0028', name: 'Franco Colapinto' },
]

describe('BUG-RETRATOS-01: Resolução de Retratos Canônicos & Fallback de Pilotos', () => {
  const originalWarn = console.warn
  beforeEach(() => {
    console.warn = vi.fn()
  })
  afterEach(() => {
    console.warn = originalWarn
  })

  // BR01-01: os 24 titulares do grid 2026 resolvem para arquivos existentes em public/pilotos/
  it('BR01-01: os 24 titulares do grid 2026 resolvem para arquivos existentes em public/pilotos/', () => {
    expect(GRID_2026_DRIVERS).toHaveLength(24)

    const missingAssets: string[] = []

    for (const driver of GRID_2026_DRIVERS) {
      const resolved = resolveDriverPhoto({
        driverId: driver.driverId,
        name: driver.name,
      })

      expect(resolved.url).toBeTruthy()
      expect(resolved.url).toBe(`/pilotos/${driver.expectedAsset}.jpg`)

      // Verificar existência física no disco
      const relativePath = resolved.url!.replace(/^\//, '')
      const fullPath = path.resolve(process.cwd(), relativePath)
      if (!fs.existsSync(fullPath)) {
        missingAssets.push(`${driver.name} (${driver.driverId}) -> ${resolved.url}`)
      }
    }

    expect(missingAssets).toEqual([])
  })

  // BR01-02: Hülkenberg resolve para /pilotos/DRV_0068.jpg (via mbj-019, via nome e via ID do PocketBase)
  it('BR01-02: Hülkenberg resolve para /pilotos/DRV_0068.jpg (via mbj-019, via nome e via ID do PocketBase)', () => {
    // Via ID canônico mbj-019
    const viaCanonicalId = resolveDriverPhoto({
      driverId: 'mbj-019',
      name: 'Nico Hülkenberg',
    })
    expect(viaCanonicalId.url).toBe('/pilotos/DRV_0068.jpg')
    expect(viaCanonicalId.assetId).toBe('DRV_0068')

    // Via apenas nome
    const viaNameOnly = resolveDriverPhoto({
      name: 'Nico Hülkenberg',
    })
    expect(viaNameOnly.url).toBe('/pilotos/DRV_0068.jpg')
    expect(viaNameOnly.assetId).toBe('DRV_0068')

    // Via nome sem trema
    const viaNameNoDiacritics = resolveDriverPhoto({
      name: 'Nico Hulkenberg',
    })
    expect(viaNameNoDiacritics.url).toBe('/pilotos/DRV_0068.jpg')

    // Via ID de runtime dinâmico do PocketBase ('0mow8vmzk0y4z9s')
    const viaPocketBaseId = resolveDriverPhoto({
      driverId: '0mow8vmzk0y4z9s',
      name: 'Nico Hülkenberg',
    })
    expect(viaPocketBaseId.url).toBe('/pilotos/DRV_0068.jpg')
    expect(viaPocketBaseId.assetId).toBe('DRV_0068')

    // Via apenas ID do PocketBase sem o nome
    const viaPbIdOnly = resolveDriverPhoto({
      driverId: '0mow8vmzk0y4z9s',
    })
    expect(viaPbIdOnly.url).toBe('/pilotos/DRV_0068.jpg')
    expect(viaPbIdOnly.assetId).toBe('DRV_0068')
  })

  // BR01-03: Bortoleto resolve para /pilotos/DRV_0012.jpg
  it('BR01-03: Bortoleto resolve para /pilotos/DRV_0012.jpg (via mbj-020, via nome e via ID do PocketBase)', () => {
    // Via ID canônico mbj-020
    const viaCanonicalId = resolveDriverPhoto({
      driverId: 'mbj-020',
      name: 'Gabriel Bortoleto',
    })
    expect(viaCanonicalId.url).toBe('/pilotos/DRV_0012.jpg')
    expect(viaCanonicalId.assetId).toBe('DRV_0012')

    // Via apenas nome
    const viaNameOnly = resolveDriverPhoto({
      name: 'Gabriel Bortoleto',
    })
    expect(viaNameOnly.url).toBe('/pilotos/DRV_0012.jpg')

    // Via ID dinâmico do PocketBase ('9uazqw522oc9p4z')
    const viaPocketBaseId = resolveDriverPhoto({
      driverId: '9uazqw522oc9p4z',
      name: 'Gabriel Bortoleto',
    })
    expect(viaPocketBaseId.url).toBe('/pilotos/DRV_0012.jpg')
    expect(viaPocketBaseId.assetId).toBe('DRV_0012')

    // Via apenas ID do PocketBase sem o nome
    const viaPbIdOnly = resolveDriverPhoto({
      driverId: '9uazqw522oc9p4z',
    })
    expect(viaPbIdOnly.url).toBe('/pilotos/DRV_0012.jpg')
    expect(viaPbIdOnly.assetId).toBe('DRV_0012')
  })

  // BR01-04: card renderiza exatamente 1 <img> por piloto (sem camadas sobrepostas)
  it('BR01-04: card renderiza exatamente 1 <img> por piloto', () => {
    const { container } = render(
      React.createElement(DriverPhotoAvatar, {
        name: 'Gabriel Bortoleto',
        driverId: '9uazqw522oc9p4z',
        teamColor: '#F50537',
      }),
    )

    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(1)
    expect(images[0].getAttribute('src')).toBe('/pilotos/DRV_0012.jpg')
    expect(images[0].getAttribute('alt')).toBe('Gabriel Bortoleto')
  })

  // BR01-05: fallback mostra iniciais, não bloco escuro
  it('BR01-05: fallback mostra iniciais, não bloco escuro (#161D29)', () => {
    const { container } = render(
      React.createElement(DriverPhotoAvatar, {
        name: 'Piloto Desconhecido',
        driverId: 'sem_foto_totalmente_inexistente',
        teamColor: '#F50537',
      }),
    )

    // Simula erro de carregamento da imagem
    let img = container.querySelector('img')
    while (img) {
      fireEvent.error(img)
      img = container.querySelector('img')
    }

    // Deve exibir o container de fallback de iniciais
    const fallbackNode = screen.getByTestId('driver-fallback-initials')
    expect(fallbackNode).toBeTruthy()
    expect(fallbackNode.textContent).toContain('PD')
    expect(fallbackNode.className).not.toContain('bg-[#161D29]')

    // Checar que console.warn foi emitido
    expect(console.warn).toHaveBeenCalledWith(
      '[DriverPhotoAvatar] Falha ao carregar retrato:',
      expect.objectContaining({
        name: 'Piloto Desconhecido',
      }),
    )
  })

  // Validação complementar de todos os 134 pilotos canônicos mestres
  it('valida que todos os pilotos reais do banco mestre resolvem para caminhos locais', () => {
    for (const driver of CANONICAL_DRIVERS_MASTER) {
      if (driver.assetId) {
        const resolved = resolveDriverPhoto({
          driverId: driver.driverId,
          name: driver.fullName,
        })
        expect(resolved.url).toBe(`/pilotos/${driver.assetId}.jpg`)
      }
    }
  })
})
