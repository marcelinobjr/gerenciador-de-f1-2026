/**
 * generated-driver-profiles-gender.test.ts
 *
 * Teste de travamento estrito para os gêneros dos perfis de pilotos gerados Piloto_01..Piloto_53.
 *
 * Especificação do usuário:
 * - 53 entradas exatas (GEN_01..GEN_53 / Piloto_01..Piloto_53)
 * - 30 Femininos / 23 Masculinos
 *
 * Piloto_01..13 (intactos):
 * - Masculinos (6): 1, 2, 6, 8, 10, 12
 * - Femininos (7): 3, 4, 5, 7, 9, 11, 13
 *
 * Piloto_14..53 (homologados pelo usuário):
 * - Masculinos (16 IDs): 14, 17, 19, 20, 21, 23, 28, 30, 31, 33, 35, 37, 39, 42, 46, 49
 * - Femininos (23 IDs): todos os demais de 14 a 53:
 *   16, 18, 22, 24, 25, 26, 27, 29, 32, 34, 36, 38, 40, 41, 43, 44, 45, 47, 48, 50, 51, 52, 53
 *
 * Testa também:
 * - getGeneratedDriverPortraitProfile por profileId e fileName
 * - allocateGeneratedPortraitProfile('male' / 'female', seed) respeita o gênero solicitado
 */

import { describe, it, expect } from 'vitest'
import {
  GENERATED_DRIVER_PORTRAIT_PROFILES,
  GENERATED_DRIVER_MALE_INDICES,
  TOTAL_GENERATED_DRIVER_PROFILES,
  getGeneratedDriverPortraitProfile,
  allocateGeneratedPortraitProfile,
} from '@/lib/generated-driver-profiles'

describe('GÊNERO-PILOTOS-01: Catálogo de Perfis Gerados (Piloto_01..Piloto_53)', () => {
  const EXPECTED_MALE_14_TO_53 = [14, 17, 19, 20, 21, 23, 28, 30, 31, 33, 35, 37, 39, 42, 46, 49]

  const EXPECTED_FEMALE_14_TO_53 = [
    16, 18, 22, 24, 25, 26, 27, 29, 32, 34, 36, 38, 40, 41, 43, 44, 45, 47, 48, 50, 51, 52, 53,
  ]

  const EXPECTED_MALE_01_TO_13 = [1, 2, 6, 8, 10, 12]
  const EXPECTED_FEMALE_01_TO_13 = [3, 4, 5, 7, 9, 11, 13]

  it('possui exatamente 53 entradas no catálogo', () => {
    expect(TOTAL_GENERATED_DRIVER_PROFILES).toBe(53)
    expect(GENERATED_DRIVER_PORTRAIT_PROFILES.length).toBe(53)
  })

  it('possui exatamente 23 perfis masculinos e 30 femininos', () => {
    const males = GENERATED_DRIVER_PORTRAIT_PROFILES.filter((p) => p.gender === 'male')
    const females = GENERATED_DRIVER_PORTRAIT_PROFILES.filter((p) => p.gender === 'female')

    expect(males.length).toBe(23)
    expect(females.length).toBe(30)
    expect(males.length + females.length).toBe(53)
  })

  it('mantém intactos os gêneros do lote 01..13 (6M / 7F)', () => {
    for (const idx of EXPECTED_MALE_01_TO_13) {
      const pad = String(idx).padStart(2, '0')
      const profile = getGeneratedDriverPortraitProfile(`GEN_${pad}`)
      expect(profile).toBeDefined()
      expect(profile?.gender).toBe('male')
    }

    for (const idx of EXPECTED_FEMALE_01_TO_13) {
      const pad = String(idx).padStart(2, '0')
      const profile = getGeneratedDriverPortraitProfile(`GEN_${pad}`)
      expect(profile).toBeDefined()
      expect(profile?.gender).toBe('female')
    }
  })

  it('trava um a um os 16 IDs masculinos de 14 a 53', () => {
    expect(EXPECTED_MALE_14_TO_53.length).toBe(16)

    for (const idx of EXPECTED_MALE_14_TO_53) {
      const pad = String(idx).padStart(2, '0')
      const profileById = getGeneratedDriverPortraitProfile(`GEN_${pad}`)
      const profileByName = getGeneratedDriverPortraitProfile(`Piloto_${pad}.jpg`)

      expect(profileById).toBeDefined()
      expect(profileById?.gender).toBe('male')
      expect(profileById?.fileName).toBe(`Piloto_${pad}.jpg`)
      expect(profileById?.path).toBe(`/pilotos-gerados/Piloto_${pad}.jpg`)
      expect(profileById?.index).toBe(idx)
      expect(profileById?.sourceType).toBe('generated_seed_profile')

      expect(profileByName).toBe(profileById)
      expect(GENERATED_DRIVER_MALE_INDICES.has(idx)).toBe(true)
    }
  })

  it('trava um a um os 23 IDs femininos de 14 a 53', () => {
    expect(EXPECTED_FEMALE_14_TO_53.length).toBe(23)

    for (const idx of EXPECTED_FEMALE_14_TO_53) {
      const pad = String(idx).padStart(2, '0')
      const profileById = getGeneratedDriverPortraitProfile(`GEN_${pad}`)
      const profileByName = getGeneratedDriverPortraitProfile(`Piloto_${pad}.jpg`)

      expect(profileById).toBeDefined()
      expect(profileById?.gender).toBe('female')
      expect(profileById?.fileName).toBe(`Piloto_${pad}.jpg`)
      expect(profileById?.path).toBe(`/pilotos-gerados/Piloto_${pad}.jpg`)
      expect(profileById?.index).toBe(idx)
      expect(profileById?.sourceType).toBe('generated_seed_profile')

      expect(profileByName).toBe(profileById)
      expect(GENERATED_DRIVER_MALE_INDICES.has(idx)).toBe(false)
    }
  })

  it('cobre todos os inteiros de 14 a 53 sem duplicatas nem omissões', () => {
    const combined14To53 = [...EXPECTED_MALE_14_TO_53, ...EXPECTED_FEMALE_14_TO_53].sort(
      (a, b) => a - b,
    )
    expect(combined14To53.length).toBe(40) // 53 - 14 + 1 = 40
    for (let i = 14; i <= 53; i++) {
      expect(combined14To53[i - 14]).toBe(i)
    }
  })

  it('allocateGeneratedPortraitProfile retorna estritamente o gênero solicitado', () => {
    // Testa sementes variadas para masculino
    for (let seed = 0; seed < 100; seed += 7) {
      const maleAlloc = allocateGeneratedPortraitProfile('male', seed)
      expect(maleAlloc).toBeDefined()
      expect(maleAlloc.gender).toBe('male')
      expect(maleAlloc.path).toMatch(/^\/pilotos-gerados\/Piloto_\d{2}\.jpg$/)
    }

    // Testa sementes variadas para feminino
    for (let seed = 0; seed < 100; seed += 7) {
      const femaleAlloc = allocateGeneratedPortraitProfile('female', seed)
      expect(femaleAlloc).toBeDefined()
      expect(femaleAlloc.gender).toBe('female')
      expect(femaleAlloc.path).toMatch(/^\/pilotos-gerados\/Piloto_\d{2}\.jpg$/)
    }
  })

  it('allocateGeneratedPortraitProfile respeita a lista de perfis já alocados', () => {
    const allocated: string[] = ['GEN_01', 'GEN_02']
    const alloc = allocateGeneratedPortraitProfile('male', 0, allocated)
    expect(alloc.profileId).not.toBe('GEN_01')
    expect(alloc.profileId).not.toBe('GEN_02')
    expect(alloc.gender).toBe('male')
  })
})
