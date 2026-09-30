/**
 * generated-driver-portraits-01.test.ts
 *
 * Suíte de testes canônica para a tarefa GENERATED-DRIVER-PORTRAITS-01 (GDP01):
 * Incorporação dos retratos femininos gerados Piloto_65, Piloto_66 e Piloto_67.
 *
 * Itens obrigatórios:
 * - GDP01-01: Piloto_65 existe no registry e gender=female.
 * - GDP01-02: Piloto_66 existe no registry e gender=female.
 * - GDP01-03: Piloto_67 existe no registry e gender=female.
 * - GDP01-04: novo piloto female pode selecionar Piloto_65.
 * - GDP01-05: novo piloto female pode selecionar Piloto_66.
 * - GDP01-06: novo piloto female pode selecionar Piloto_67.
 * - GDP01-07: piloto male nunca recebe 65/66/67.
 * - GDP01-08: filtro usa campo canônico de gênero.
 * - GDP01-09: mesmo piloto/seed → mesmo retrato.
 * - GDP01-10: save/reload → mesmo retrato.
 * - GDP01-11: re-render → mesmo retrato.
 * - GDP01-12: piloto existente com retrato não é resorteado.
 * - GDP01-13: procedural_data=[] é sanitizado sem destruir visualIdentity.
 * - GDP01-14: generatedPortraitProfileId é preservado.
 * - GDP01-15: fallback não cruza gênero.
 * - GDP01-16: os três arquivos registrados existem fisicamente no path usado.
 * - GDP01-17: pool feminino antigo permanece íntegro.
 * - GDP01-18: múltiplas seeds/IDs demonstram que 65, 66 e 67 são alcançáveis.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
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
import {
  sanitizeDriverProceduralData,
  normalizeProceduralDataObject,
} from '@/lib/sanitizeDriverProceduralData'
import { preservePortraitFields } from '@/lib/preservePortraitFields'

describe('Suíte GDP01: GENERATED-DRIVER-PORTRAITS-01 (Retratos Femininos Piloto_65/66/67)', () => {
  // GDP01-01: Piloto_65 existe no registry e gender=female.
  it('GDP01-01: Piloto_65 existe no registry e gender=female', () => {
    const profile = getGeneratedDriverPortraitProfile('GEN_65')
    expect(profile).not.toBeNull()
    expect(profile?.profileId).toBe('GEN_65')
    expect(profile?.fileName).toBe('Piloto_65.jpg')
    expect(profile?.gender).toBe('female')
    expect(profile?.path).toBe('/pilotos-gerados/Piloto_65.jpg')
    expect(profile?.index).toBe(65)
    expect(profile?.sourceType).toBe('generated_seed_profile')
  })

  // GDP01-02: Piloto_66 existe no registry e gender=female.
  it('GDP01-02: Piloto_66 existe no registry e gender=female', () => {
    const profile = getGeneratedDriverPortraitProfile('GEN_66')
    expect(profile).not.toBeNull()
    expect(profile?.profileId).toBe('GEN_66')
    expect(profile?.fileName).toBe('Piloto_66.jpg')
    expect(profile?.gender).toBe('female')
    expect(profile?.path).toBe('/pilotos-gerados/Piloto_66.jpg')
    expect(profile?.index).toBe(66)
    expect(profile?.sourceType).toBe('generated_seed_profile')
  })

  // GDP01-03: Piloto_67 existe no registry e gender=female.
  it('GDP01-03: Piloto_67 existe no registry e gender=female', () => {
    const profile = getGeneratedDriverPortraitProfile('GEN_67')
    expect(profile).not.toBeNull()
    expect(profile?.profileId).toBe('GEN_67')
    expect(profile?.fileName).toBe('Piloto_67.jpg')
    expect(profile?.gender).toBe('female')
    expect(profile?.path).toBe('/pilotos-gerados/Piloto_67.jpg')
    expect(profile?.index).toBe(67)
    expect(profile?.sourceType).toBe('generated_seed_profile')
  })

  // GDP01-04: novo piloto female pode selecionar Piloto_65.
  it('GDP01-04: novo piloto female pode selecionar Piloto_65', () => {
    let reached = false
    for (let seed = 0; seed < 100; seed++) {
      const selected = allocateGeneratedPortraitProfile('female', seed)
      if (selected.fileName === 'Piloto_65.jpg' && selected.profileId === 'GEN_65') {
        reached = true
        expect(selected.gender).toBe('female')
        break
      }
    }
    expect(reached).toBe(true)
  })

  // GDP01-05: novo piloto female pode selecionar Piloto_66.
  it('GDP01-05: novo piloto female pode selecionar Piloto_66', () => {
    let reached = false
    for (let seed = 0; seed < 100; seed++) {
      const selected = allocateGeneratedPortraitProfile('female', seed)
      if (selected.fileName === 'Piloto_66.jpg' && selected.profileId === 'GEN_66') {
        reached = true
        expect(selected.gender).toBe('female')
        break
      }
    }
    expect(reached).toBe(true)
  })

  // GDP01-06: novo piloto female pode selecionar Piloto_67.
  it('GDP01-06: novo piloto female pode selecionar Piloto_67', () => {
    let reached = false
    for (let seed = 0; seed < 100; seed++) {
      const selected = allocateGeneratedPortraitProfile('female', seed)
      if (selected.fileName === 'Piloto_67.jpg' && selected.profileId === 'GEN_67') {
        reached = true
        expect(selected.gender).toBe('female')
        break
      }
    }
    expect(reached).toBe(true)
  })

  // GDP01-07: piloto male nunca recebe 65/66/67.
  it('GDP01-07: piloto male nunca recebe 65/66/67', () => {
    expect(GENERATED_DRIVER_MALE_INDICES.has(65)).toBe(false)
    expect(GENERATED_DRIVER_MALE_INDICES.has(66)).toBe(false)
    expect(GENERATED_DRIVER_MALE_INDICES.has(67)).toBe(false)

    const maleIndices = ALL_MALE_GENERATED_PORTRAITS.map((p) => p.index)
    expect(maleIndices).not.toContain(65)
    expect(maleIndices).not.toContain(66)
    expect(maleIndices).not.toContain(67)

    for (let seed = 0; seed < 600; seed++) {
      const selected = allocateGeneratedPortraitProfile('male', seed)
      expect(selected.gender).toBe('male')
      expect(selected.index).not.toBe(65)
      expect(selected.index).not.toBe(66)
      expect(selected.index).not.toBe(67)
      expect(selected.fileName).not.toBe('Piloto_65.jpg')
      expect(selected.fileName).not.toBe('Piloto_66.jpg')
      expect(selected.fileName).not.toBe('Piloto_67.jpg')
    }
  })

  // GDP01-08: filtro usa campo canônico de gênero.
  it('GDP01-08: filtro usa campo canônico de gênero', () => {
    // Alocação aceita estritamente o parâmetro de gênero tipado ('female' | 'male')
    const femaleSelection = allocateGeneratedPortraitProfile('female', 123)
    const maleSelection = allocateGeneratedPortraitProfile('male', 123)

    expect(femaleSelection.gender).toBe('female')
    expect(maleSelection.gender).toBe('male')
    expect(femaleSelection.profileId).not.toBe(maleSelection.profileId)
  })

  // GDP01-09: mesmo piloto/seed → mesmo retrato.
  it('GDP01-09: mesmo piloto/seed → mesmo retrato', () => {
    const testSeeds = [0, 1, 10, 30, 31, 32, 65, 66, 67, 9999]
    for (const seed of testSeeds) {
      const first = allocateGeneratedPortraitProfile('female', seed)
      const second = allocateGeneratedPortraitProfile('female', seed)
      const third = allocateGeneratedPortraitProfile('female', seed)

      expect(first.profileId).toBe(second.profileId)
      expect(second.profileId).toBe(third.profileId)
      expect(first.fileName).toBe(third.fileName)
      expect(first.path).toBe(third.path)
    }
  })

  // GDP01-10: save/reload → mesmo retrato.
  it('GDP01-10: save/reload → mesmo retrato', () => {
    const originalPilot = {
      driverId: 'drv_female_test_01',
      name: 'Sofia Alencar',
      gender: 'female' as const,
      generatedPortraitProfileId: 'GEN_65',
      procedural_data: {
        driverId: 'drv_female_test_01',
        generatedPortraitProfileId: 'GEN_65',
        visualIdentity: {
          portraitAssetId: 'GEN_65',
          generatedPortraitProfileId: 'GEN_65',
          gender: 'female',
        },
      },
    }

    // Simula ciclo completo de save/reload via JSON serialization (wire transfer do backend)
    const serialized = JSON.stringify(originalPilot)
    const reloaded = JSON.parse(serialized)

    const photoBefore = resolveDriverPhoto({
      driverId: originalPilot.driverId,
      name: originalPilot.name,
      generatedPortraitProfileId: originalPilot.generatedPortraitProfileId,
      visualIdentity: originalPilot.procedural_data.visualIdentity as any,
    })

    const photoAfter = resolveDriverPhoto({
      driverId: reloaded.driverId,
      name: reloaded.name,
      generatedPortraitProfileId: reloaded.generatedPortraitProfileId,
      visualIdentity: reloaded.procedural_data.visualIdentity,
    })

    expect(photoBefore.url).toBe('/pilotos-gerados/Piloto_65.jpg')
    expect(photoAfter.url).toBe('/pilotos-gerados/Piloto_65.jpg')
    expect(photoBefore.url).toBe(photoAfter.url)
    expect(photoBefore.sourceType).toBe('generated_procedural')
    expect(photoAfter.sourceType).toBe('generated_procedural')
  })

  // GDP01-11: re-render → mesmo retrato.
  it('GDP01-11: re-render → mesmo retrato', () => {
    const pilotState = {
      driverId: 'drv_female_66',
      name: 'Camila Duarte',
      generatedPortraitProfileId: 'GEN_66',
      visualIdentity: {
        portraitAssetId: 'GEN_66',
        generatedPortraitProfileId: 'GEN_66',
        gender: 'female' as const,
      },
    }

    // Múltiplas invocações do resolvedor (como ocorre em sucessivos renders do React)
    const render1 = resolveDriverPhoto({
      driverId: pilotState.driverId,
      name: pilotState.name,
      generatedPortraitProfileId: pilotState.generatedPortraitProfileId,
      visualIdentity: pilotState.visualIdentity as any,
    })

    const render2 = resolveDriverPhoto({
      driverId: pilotState.driverId,
      name: pilotState.name,
      generatedPortraitProfileId: pilotState.generatedPortraitProfileId,
      visualIdentity: pilotState.visualIdentity as any,
    })

    const render3 = resolveDriverPhoto({
      driverId: pilotState.driverId,
      name: pilotState.name,
      generatedPortraitProfileId: pilotState.generatedPortraitProfileId,
      visualIdentity: pilotState.visualIdentity as any,
    })

    expect(render1.url).toBe('/pilotos-gerados/Piloto_66.jpg')
    expect(render2.url).toBe('/pilotos-gerados/Piloto_66.jpg')
    expect(render3.url).toBe('/pilotos-gerados/Piloto_66.jpg')
    expect(render1.assetId).toBe('GEN_66')
    expect(render2.assetId).toBe('GEN_66')
    expect(render3.assetId).toBe('GEN_66')
  })

  // GDP01-12: piloto existente com retrato não é resorteado.
  it('GDP01-12: piloto existente com retrato não é resorteado', () => {
    const existingDriver = {
      driverId: 'drv_mariana_fagundes',
      name: 'Mariana Fagundes',
      gender: 'female' as const,
      generatedPortraitProfileId: 'Piloto_13',
      procedural_data: {
        driverId: 'drv_mariana_fagundes',
        generatedPortraitProfileId: 'Piloto_13',
        visualIdentity: {
          portraitAssetId: 'GEN_13',
          generatedPortraitProfileId: 'Piloto_13',
          gender: 'female',
        },
      },
    }

    // Se o piloto já possui retrato persistido, o sanitizador e resolvedor preservam o retrato original
    const sanitized = sanitizeDriverProceduralData(existingDriver.procedural_data, {
      speed: 70,
      seasonWins: 2,
    })

    expect(sanitized.generatedPortraitProfileId).toBe('Piloto_13')
    expect(sanitized.visualIdentity?.portraitAssetId).toBe('GEN_13')

    const photo = resolveDriverPhoto({
      driverId: existingDriver.driverId,
      name: existingDriver.name,
      generatedPortraitProfileId: sanitized.generatedPortraitProfileId,
      visualIdentity: sanitized.visualIdentity,
    })

    expect(photo.url).toBe('/pilotos-gerados/Piloto_13.jpg')
    expect(photo.url).not.toBe('/pilotos-gerados/Piloto_65.jpg')
  })

  // GDP01-13: procedural_data=[] é sanitizado sem destruir visualIdentity.
  it('GDP01-13: procedural_data=[] é sanitizado sem destruir visualIdentity', () => {
    const base = {
      driverId: 'drv_test_67',
      generatedPortraitProfileId: 'GEN_67',
      visualIdentity: {
        portraitAssetId: 'GEN_67',
        generatedPortraitProfileId: 'GEN_67',
        gender: 'female',
      },
    }

    // Patch malformado com Array [] não destrói os dados existentes
    const result = sanitizeDriverProceduralData(base, [])
    expect(Array.isArray(result)).toBe(false)
    expect(result.generatedPortraitProfileId).toBe('GEN_67')
    expect(result.visualIdentity).toBeDefined()
    expect(result.visualIdentity.portraitAssetId).toBe('GEN_67')
    expect(result.visualIdentity.gender).toBe('female')

    // Entrada nula ou array isolada retorna objeto plano seguro
    const emptyFromArray = sanitizeDriverProceduralData([])
    expect(Array.isArray(emptyFromArray)).toBe(false)
    expect(emptyFromArray).toEqual({})
  })

  // GDP01-14: generatedPortraitProfileId é preservado.
  it('GDP01-14: generatedPortraitProfileId é preservado', () => {
    const persisted = {
      generatedPortraitProfileId: 'GEN_65',
      visualIdentity: {
        portraitAssetId: 'GEN_65',
        generatedPortraitProfileId: 'GEN_65',
      },
    }

    const nextWithoutFields = {
      driverId: 'drv_test_65',
      notes: 'Avaliação da temporada',
    }

    const preserved = preservePortraitFields(persisted, nextWithoutFields)
    expect(preserved?.generatedPortraitProfileId).toBe('GEN_65')
    expect(preserved?.visualIdentity?.portraitAssetId).toBe('GEN_65')
    expect(preserved?.visualIdentity?.generatedPortraitProfileId).toBe('GEN_65')
  })

  // GDP01-15: fallback não cruza gênero.
  it('GDP01-15: fallback não cruza gênero', () => {
    // Alocação masculina nunca cruza para o pool feminino nem sob esgotamento
    const maleAllocation = allocateGeneratedPortraitProfile('male', 99999)
    expect(maleAllocation.gender).toBe('male')
    expect(ADDITIONAL_FEMALE_GENERATED_INDICES).not.toContain(maleAllocation.index as any)

    // Alocação feminina nunca cruza para o pool masculino
    const femaleAllocation = allocateGeneratedPortraitProfile('female', 99999)
    expect(femaleAllocation.gender).toBe('female')
    expect(GENERATED_DRIVER_MALE_INDICES.has(femaleAllocation.index)).toBe(false)

    // Se o driver não tiver foto e cair em fallback de iniciais, não atribui foto de outro gênero
    const fallbackResolved = resolveDriverPhoto({
      name: 'Piloto Sem Foto',
      driverId: 'drv_unknown_fallback',
    })
    expect(fallbackResolved.url).toBeNull()
    expect(fallbackResolved.sourceType).toBe('fallback_initials')
  })

  // GDP01-16: os três arquivos registrados existem fisicamente no path usado.
  it('GDP01-16: os três arquivos registrados existem fisicamente no path usado', () => {
    const projectRoot = process.cwd()
    const files = ['Piloto_65.jpg', 'Piloto_66.jpg', 'Piloto_67.jpg']

    for (const file of files) {
      const fullPath = path.join(projectRoot, 'public', 'pilotos-gerados', file)
      expect(fs.existsSync(fullPath)).toBe(true)
      const stats = fs.statSync(fullPath)
      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBeGreaterThan(0)
    }
  })

  // GDP01-17: pool feminino antigo permanece íntegro.
  it('GDP01-17: pool feminino antigo permanece íntegro', () => {
    expect(TOTAL_GENERATED_DRIVER_PROFILES).toBe(53)
    expect(GENERATED_DRIVER_PORTRAIT_PROFILES.length).toBe(53)

    const baseFemales = GENERATED_DRIVER_PORTRAIT_PROFILES.filter((p) => p.gender === 'female')
    expect(baseFemales.length).toBe(30)

    // Os 30 perfis base originais continuam presentes
    for (const p of baseFemales) {
      expect(ALL_FEMALE_GENERATED_PORTRAITS).toContainEqual(p)
    }

    // Pool feminino ampliado tem exatamente 33 perfis (30 base + 3 novos)
    expect(ALL_FEMALE_GENERATED_PORTRAITS.length).toBe(33)
  })

  // GDP01-18: múltiplas seeds/IDs demonstram que 65, 66 e 67 são alcançáveis.
  it('GDP01-18: múltiplas seeds/IDs demonstram que 65, 66 e 67 são alcançáveis', () => {
    let reached65 = false
    let reached66 = false
    let reached67 = false

    const seedsTested = 300
    for (let seed = 0; seed < seedsTested; seed++) {
      const selected = allocateGeneratedPortraitProfile('female', seed)
      if (selected.index === 65) reached65 = true
      if (selected.index === 66) reached66 = true
      if (selected.index === 67) reached67 = true
      if (reached65 && reached66 && reached67) break
    }

    expect(reached65).toBe(true)
    expect(reached66).toBe(true)
    expect(reached67).toBe(true)
  })
})
