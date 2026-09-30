/**
 * GDP-01: Suíte de QA focada para retratos de pilotos femininos gerados (GENERATED-DRIVER-PORTRAITS-01).
 *
 * Provas requeridas:
 * (a) As 3 novas imagens (Piloto_65.jpg, Piloto_66.jpg, Piloto_67.jpg) estão no pool feminino de retratos gerados.
 * (b) SÓ perfis femininos as recebem — NUNCA atribuídas a pilotos masculinos.
 * (c) Mapeamento determinístico e estável (nenhum piloto muda de foto após reload/save/mesma semente).
 */

import { describe, it, expect } from 'vitest'
import {
  GENERATED_DRIVER_MALE_INDICES,
  GENERATED_DRIVER_PORTRAIT_PROFILES,
  TOTAL_GENERATED_DRIVER_PROFILES,
  ADDITIONAL_FEMALE_GENERATED_INDICES,
  ADDITIONAL_FEMALE_GENERATED_PORTRAITS,
  ALL_FEMALE_GENERATED_PORTRAITS,
  ALL_MALE_GENERATED_PORTRAITS,
  ALL_KNOWN_GENERATED_PORTRAITS,
  getGeneratedDriverPortraitProfile,
  allocateGeneratedPortraitProfile,
} from '@/lib/generated-driver-profiles'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'

describe('GDP-01: Retratos Gerados de Pilotos Femininos (Piloto_65, Piloto_66, Piloto_67)', () => {
  // 1. Prova (a): As 3 novas imagens estão no pool feminino
  it('GDP-01.1: As 3 novas imagens (Piloto_65, 66, 67) estão catalogadas como femininas e acessíveis por lookup', () => {
    expect(ADDITIONAL_FEMALE_GENERATED_INDICES).toEqual([65, 66, 67])
    expect(ADDITIONAL_FEMALE_GENERATED_PORTRAITS.length).toBe(3)

    const expectedNewProfiles = [
      { id: 'GEN_65', file: 'Piloto_65.jpg', path: '/pilotos-gerados/Piloto_65.jpg', index: 65 },
      { id: 'GEN_66', file: 'Piloto_66.jpg', path: '/pilotos-gerados/Piloto_66.jpg', index: 66 },
      { id: 'GEN_67', file: 'Piloto_67.jpg', path: '/pilotos-gerados/Piloto_67.jpg', index: 67 },
    ]

    for (const item of expectedNewProfiles) {
      // Lookup por GEN_XX
      const byId = getGeneratedDriverPortraitProfile(item.id)
      expect(byId).not.toBeNull()
      expect(byId?.gender).toBe('female')
      expect(byId?.fileName).toBe(item.file)
      expect(byId?.path).toBe(item.path)
      expect(byId?.index).toBe(item.index)

      // Lookup por Piloto_XX.jpg
      const byFile = getGeneratedDriverPortraitProfile(item.file)
      expect(byFile).toEqual(byId)

      // Lookup sem extensão 'Piloto_XX'
      const byStem = getGeneratedDriverPortraitProfile(item.file.replace('.jpg', ''))
      expect(byStem).toEqual(byId)

      // Pertence a ALL_FEMALE_GENERATED_PORTRAITS
      const foundInFemalePool = ALL_FEMALE_GENERATED_PORTRAITS.find((p) => p.index === item.index)
      expect(foundInFemalePool).toBeDefined()
      expect(foundInFemalePool?.gender).toBe('female')
    }
  })

  it('GDP-01.2: Pool feminino totaliza 33 retratos (30 da base + 3 novos), e o catálogo base de 53 perfis permanece travado', () => {
    expect(TOTAL_GENERATED_DRIVER_PROFILES).toBe(53)
    expect(GENERATED_DRIVER_PORTRAIT_PROFILES.length).toBe(53)

    // Contagem da base: 30 femininos e 23 masculinos
    const baseFemales = GENERATED_DRIVER_PORTRAIT_PROFILES.filter((p) => p.gender === 'female')
    const baseMales = GENERATED_DRIVER_PORTRAIT_PROFILES.filter((p) => p.gender === 'male')
    expect(baseFemales.length).toBe(30)
    expect(baseMales.length).toBe(23)

    // Pool feminino ampliado
    expect(ALL_FEMALE_GENERATED_PORTRAITS.length).toBe(33)
    // Pool masculino intacto
    expect(ALL_MALE_GENERATED_PORTRAITS.length).toBe(23)
  })

  // 2. Prova (b): SÓ perfis femininos as recebem — NUNCA atribuídas a masculinos
  it('GDP-01.3: Piloto_65, 66 e 67 NUNCA estão no pool masculino nem são alocados para male', () => {
    // 1. Não estão em GENERATED_DRIVER_MALE_INDICES
    expect(GENERATED_DRIVER_MALE_INDICES.has(65)).toBe(false)
    expect(GENERATED_DRIVER_MALE_INDICES.has(66)).toBe(false)
    expect(GENERATED_DRIVER_MALE_INDICES.has(67)).toBe(false)

    // 2. Não estão em ALL_MALE_GENERATED_PORTRAITS
    const maleIndices = ALL_MALE_GENERATED_PORTRAITS.map((p) => p.index)
    expect(maleIndices).not.toContain(65)
    expect(maleIndices).not.toContain(66)
    expect(maleIndices).not.toContain(67)

    // 3. Nenhuma chamada de allocateGeneratedPortraitProfile('male', seed) retorna 65, 66 ou 67
    for (let seed = 0; seed < 500; seed++) {
      const allocated = allocateGeneratedPortraitProfile('male', seed)
      expect(allocated.gender).toBe('male')
      expect(allocated.index).not.toBe(65)
      expect(allocated.index).not.toBe(66)
      expect(allocated.index).not.toBe(67)
      expect(allocated.fileName).not.toBe('Piloto_65.jpg')
      expect(allocated.fileName).not.toBe('Piloto_66.jpg')
      expect(allocated.fileName).not.toBe('Piloto_67.jpg')
    }
  })

  it('GDP-01.4: Perfis femininos conseguem receber Piloto_65, 66 e 67 via alocação determinística', () => {
    const allocatedIndices = new Set<number>()

    // Testa sementes no pool feminino
    for (let seed = 0; seed < 33; seed++) {
      const profile = allocateGeneratedPortraitProfile('female', seed)
      expect(profile.gender).toBe('female')
      allocatedIndices.add(profile.index)
    }

    // Deve cobrir os 33 retratos únicos quando seed varia de 0 a 32 (sem alocados prévios)
    expect(allocatedIndices.size).toBe(33)
    expect(allocatedIndices.has(65)).toBe(true)
    expect(allocatedIndices.has(66)).toBe(true)
    expect(allocatedIndices.has(67)).toBe(true)
  })

  // 3. Prova (c): Mapeamento determinístico estável
  it('GDP-01.5: Mapeamento de alocação é 100% determinístico e estável para a mesma semente', () => {
    for (const seed of [0, 1, 15, 30, 31, 32, 42, 100, 9999]) {
      const run1 = allocateGeneratedPortraitProfile('female', seed)
      const run2 = allocateGeneratedPortraitProfile('female', seed)
      const run3 = allocateGeneratedPortraitProfile('female', seed)

      expect(run1.profileId).toBe(run2.profileId)
      expect(run2.profileId).toBe(run3.profileId)
      expect(run1.fileName).toBe(run3.fileName)
      expect(run1.gender).toBe('female')
    }
  })

  it('GDP-01.6: resolveDriverPhoto resolve corretamente GEN_65, GEN_66 e GEN_67 para /pilotos-gerados/Piloto_XX.jpg', () => {
    const res65 = resolveDriverPhoto({ generatedPortraitProfileId: 'GEN_65' })
    expect(res65.url).toBe('/pilotos-gerados/Piloto_65.jpg')
    expect(res65.sourceType).toBe('generated_procedural')

    const res66 = resolveDriverPhoto({ generatedPortraitProfileId: 'Piloto_66' })
    expect(res66.url).toBe('/pilotos-gerados/Piloto_66.jpg')
    expect(res66.sourceType).toBe('generated_procedural')

    const res67 = resolveDriverPhoto({ generatedPortraitProfileId: 'Piloto_67.jpg' })
    expect(res67.url).toBe('/pilotos-gerados/Piloto_67.jpg')
    expect(res67.sourceType).toBe('generated_procedural')
  })
})
