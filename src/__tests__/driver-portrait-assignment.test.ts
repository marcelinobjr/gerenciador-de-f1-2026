/**
 * driver-portrait-assignment.test.ts
 *
 * Teste canônico para a MUDANÇA 1:
 * Atribuição automática de fotos para pilotos sem foto a partir de public/pilotos-gerados,
 * respeitando o gênero de identidade e determinismo por hash FNV-1a.
 *
 * Catálogo do usuário:
 * - Homens: Pilotos_01, 2, 6, 8, 10, 12, 14, 17, 19, 20, 21, 23, 28, 30, 31, 33, 35, 37, 39, 42, 46, 49, 52, 58 (24 índices)
 * - Mulheres: TODOS os demais índices existentes no diretório (42 arquivos, ex: 03, 04, 05, 07, 09, 11, 13, 15, 16, 18, 22, 24..67 exceto os masculinos)
 * - Total de arquivos no pool = 66 arquivos físicos existentes em public/pilotos-gerados/
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  MALE_PORTRAIT_INDICES,
  MALE_PORTRAITS_POOL,
  FEMALE_PORTRAITS_POOL,
  TOTAL_ASSIGNABLE_PORTRAITS,
  hashDriverIdentifier,
  assignGeneratedPortrait,
  resolveDriverIdentityGender,
} from '@/services/driverPortraitAssignmentService'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'

describe('driverPortraitAssignmentService (MUDANÇA 1)', () => {
  it('DPA-01: Os pools masculino e feminino cobrem exatamente os arquivos de public/pilotos-gerados/', () => {
    // 24 índices masculinos homologados
    expect(MALE_PORTRAIT_INDICES).toEqual([
      1, 2, 6, 8, 10, 12, 14, 17, 19, 20, 21, 23, 28, 30, 31, 33, 35, 37, 39, 42, 46, 49, 52, 58,
    ])
    expect(MALE_PORTRAITS_POOL.length).toBe(24)
    // Total de 66 arquivos físicos (Piloto_01..Piloto_67 exceto Piloto_52 inexistente / usando Piloto52.jpg)
    expect(MALE_PORTRAITS_POOL.length + FEMALE_PORTRAITS_POOL.length).toBe(TOTAL_ASSIGNABLE_PORTRAITS)
    expect(TOTAL_ASSIGNABLE_PORTRAITS).toBe(66)
    expect(FEMALE_PORTRAITS_POOL.length).toBe(42)

    // Todos os arquivos dos pools existem fisicamente em public/pilotos-gerados/
    const publicDir = path.resolve(process.cwd(), 'public')
    for (const p of [...MALE_PORTRAITS_POOL, ...FEMALE_PORTRAITS_POOL]) {
      const fullPath = path.join(publicDir, p)
      expect(fs.existsSync(fullPath), `Arquivo deve existir fisicamente: ${fullPath}`).toBe(true)
    }
  })

  it('DPA-02: hashDriverIdentifier é determinístico (FNV-1a estável)', () => {
    const h1 = hashDriverIdentifier('lukas-colombo')
    const h2 = hashDriverIdentifier('lukas-colombo')
    const h3 = hashDriverIdentifier('mia-simon')

    expect(h1).toBe(h2)
    expect(typeof h1).toBe('number')
    expect(h1).toBeGreaterThanOrEqual(0)
    expect(h1).not.toBe(h3)
  })

  it('DPA-03: Piloto masculino sem foto recebe foto do pool masculino determinística', () => {
    const assigned = assignGeneratedPortrait({
      driverId: 'drv_lukas_colombo',
      name: 'Lukas Colombo',
      gender: 'male',
    })

    expect(assigned).not.toBeNull()
    expect(MALE_PORTRAITS_POOL).toContain(assigned)
    expect(FEMALE_PORTRAITS_POOL).not.toContain(assigned)

    // Re-chamadas retornam exatamente a mesma foto
    const assignedAgain = assignGeneratedPortrait({
      driverId: 'drv_lukas_colombo',
      name: 'Lukas Colombo',
      gender: 'male',
    })
    expect(assignedAgain).toBe(assigned)
  })

  it('DPA-04: Piloto feminino sem foto recebe foto do pool feminino determinística', () => {
    const assignedMia = assignGeneratedPortrait({
      driverId: 'drv_mia_simon',
      name: 'Mia Simon',
      gender: 'female',
    })

    expect(assignedMia).not.toBeNull()
    expect(FEMALE_PORTRAITS_POOL).toContain(assignedMia)
    expect(MALE_PORTRAITS_POOL).not.toContain(assignedMia)

    const assignedSakura = assignGeneratedPortrait({
      driverId: 'drv_sakura_tanaka',
      name: 'Sakura Tanaka',
      gender: 'female',
    })
    expect(assignedSakura).not.toBeNull()
    expect(FEMALE_PORTRAITS_POOL).toContain(assignedSakura)
    expect(MALE_PORTRAITS_POOL).not.toContain(assignedSakura)
  })

  it('DPA-05: resolveDriverIdentityGender detecta gênero de múltiplas fontes ou usa fallback masculino documentado', () => {
    expect(resolveDriverIdentityGender({ gender: 'female' })).toBe('female')
    expect(resolveDriverIdentityGender({ gender: 'male' })).toBe('male')
    expect(resolveDriverIdentityGender({ visualIdentity: { gender: 'female' } })).toBe('female')
    expect(resolveDriverIdentityGender({ visualIdentity: { gender: 'male' } })).toBe('male')
    expect(resolveDriverIdentityGender({ prospect: { gender: 'female' } })).toBe('female')
    // Ausente/desconhecido -> fallback male documentado
    expect(resolveDriverIdentityGender({})).toBe('male')
    expect(resolveDriverIdentityGender({ gender: undefined })).toBe('male')
  })

  it('DPA-06: resolveDriverPhoto integra atribuição automática e gera url do gênero correto para pilotos sem foto', () => {
    // Lukas Colombo (masculino)
    const lukasPhoto = resolveDriverPhoto({
      driverId: 'prospect_lukas_colombo',
      name: 'Lukas Colombo',
      gender: 'male',
    })
    expect(lukasPhoto.url).not.toBeNull()
    expect(lukasPhoto.sourceType).toBe('generated_procedural')
    expect(MALE_PORTRAITS_POOL).toContain(lukasPhoto.url!)

    // Mia Simon (feminino)
    const miaPhoto = resolveDriverPhoto({
      driverId: 'prospect_mia_simon',
      name: 'Mia Simon',
      gender: 'female',
    })
    expect(miaPhoto.url).not.toBeNull()
    expect(miaPhoto.sourceType).toBe('generated_procedural')
    expect(FEMALE_PORTRAITS_POOL).toContain(miaPhoto.url!)

    // Sakura Tanaka (feminino via visualIdentity)
    const sakuraPhoto = resolveDriverPhoto({
      driverId: 'prospect_sakura_tanaka',
      name: 'Sakura Tanaka',
      visualIdentity: { gender: 'female' } as any,
    })
    expect(sakuraPhoto.url).not.toBeNull()
    expect(sakuraPhoto.sourceType).toBe('generated_procedural')
    expect(FEMALE_PORTRAITS_POOL).toContain(sakuraPhoto.url!)
  })

  it('DPA-07: Pilotos reais com foto mapeada NÃO são tocados (DRV_0001..DRV_0188)', () => {
    // Max Verstappen
    const maxPhoto = resolveDriverPhoto({
      driverId: 'mbj-001',
      name: 'Max Verstappen',
    })
    expect(maxPhoto.url).toBe('/pilotos/DRV_0001.jpg')
    expect(maxPhoto.sourceType).toBe('canonical_real')

    // Sébastien Bourdais (DRV_0075)
    const bourdaisPhoto = resolveDriverPhoto({
      driverId: 'mbj-128',
      name: 'Sébastien Bourdais',
    })
    expect(bourdaisPhoto.url).toBe('/pilotos/DRV_0075.jpg')
    expect(bourdaisPhoto.sourceType).toBe('canonical_real')

    // Gabriel Bortoleto
    const bortoletoPhoto = resolveDriverPhoto({
      driverId: 'mbj-020',
      name: 'Gabriel Bortoleto',
    })
    expect(bortoletoPhoto.url).toBe('/pilotos/DRV_0020.jpg')
    expect(bortoletoPhoto.sourceType).toBe('canonical_real')
  })

  it('DPA-08: Piloto com customImageUrl direta mantém sourceType custom', () => {
    const customPhoto = resolveDriverPhoto({
      driverId: 'custom-driver-999',
      name: 'Piloto Custom',
      customImageUrl: 'https://img.usecurling.com/p/200/200?q=racer',
    })
    expect(customPhoto.url).toBe('https://img.usecurling.com/p/200/200?q=racer')
    expect(customPhoto.sourceType).toBe('custom')
  })
})
