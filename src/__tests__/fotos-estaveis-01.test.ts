/**
 * fotos-estaveis-01.test.ts
 *
 * Suíte de testes canônica para o Bloco FOTOS-ESTAVEIS-01:
 * Garante estabilidade estrita e imutabilidade dos retratos de pilotos gerados / newgens:
 *
 * 1. 10 renders/telas -> mesma URL e assetId.
 * 2. Ciclo serialize/save/reload -> retrato idêntico.
 * 3. Backfill idempotente (1x = 10x) -> congela os pilotos existentes (Camila Carvalho, Sakura Ito).
 * 4. Colisão por nome não muda retrato procedural (pilotos procedurais ignoram catálogo real).
 * 5. Pools por gênero preservados + pilotos reais DRV_0001..DRV_0188 intocados.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  assignGeneratedPortraitProfile,
  MALE_PORTRAITS_POOL,
  FEMALE_PORTRAITS_POOL,
} from '@/services/driverPortraitAssignmentService'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { proceduralDriverGenerator } from '@/services/proceduralDriverGenerator'
import { driverPortraitBackfillService } from '@/services/driverPortraitBackfillService'
import { sanitizeDriverProceduralData } from '@/lib/sanitizeDriverProceduralData'
import { preservePortraitFields } from '@/lib/preservePortraitFields'

describe('FOTOS-ESTAVEIS-01: Estabilidade e Imutabilidade de Retratos de Pilotos Gerados', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // (1) 10 renders/telas -> mesma URL e assetId
  it('FE01-01: 10 chamadas/renders em telas distintas retornam a mesma URL e assetId', () => {
    const driver = proceduralDriverGenerator.generateDriver({
      seed: 424242,
      femaleRatio: 1.0, // Força feminino
    })

    const initialProcData = driver.metadata
    expect(initialProcData.generatedPortraitProfileId).toBeDefined()
    expect(initialProcData.visualIdentity?.portraitAssetId).toBeDefined()

    const firstResolution = resolveDriverPhoto({
      driverId: driver.driver.id,
      name: driver.driver.name,
      generatedPortraitProfileId: initialProcData.generatedPortraitProfileId,
      visualIdentity: initialProcData.visualIdentity,
    })

    expect(firstResolution.url).not.toBeNull()
    expect(firstResolution.sourceType).toBe('generated_procedural')

    // Simula 10 renderizações / telas distintas
    for (let render = 1; render <= 10; render++) {
      const repeated = resolveDriverPhoto({
        driverId: driver.driver.id,
        name: driver.driver.name,
        generatedPortraitProfileId: initialProcData.generatedPortraitProfileId,
        visualIdentity: initialProcData.visualIdentity,
      })

      expect(repeated.url).toBe(firstResolution.url)
      expect(repeated.assetId).toBe(firstResolution.assetId)
      expect(repeated.sourceType).toBe('generated_procedural')
    }
  })

  // (2) Ciclo serialize/save/reload -> retrato idêntico
  it('FE01-02: Ciclo completo serialize -> save -> reload mantém retrato rigorosamente idêntico', () => {
    const original = proceduralDriverGenerator.generateDriver({
      seed: 888123,
    })

    const originalProcData = original.driver.procedural_data as any
    const profileIdBefore = originalProcData.generatedPortraitProfileId
    const portraitAssetIdBefore = originalProcData.visualIdentity?.portraitAssetId

    expect(profileIdBefore).toBeTruthy()
    expect(portraitAssetIdBefore).toBeTruthy()

    // 1. Simula envio/salvamento com sanitização
    const serializedJson = JSON.stringify(originalProcData)
    const deserialized = JSON.parse(serializedJson)

    // 2. Simula update parcial de corrida (ex: ganho de pontos ou contrato sem mexer no visual)
    const updatePatch = {
      careerStatus: 'professional',
      contract_end: 2028,
    }

    const savedProceduralData = sanitizeDriverProceduralData(deserialized, updatePatch)

    // 3. Verifica se os campos de retrato foram blindados
    expect(savedProceduralData.generatedPortraitProfileId).toBe(profileIdBefore)
    expect(savedProceduralData.visualIdentity.portraitAssetId).toBe(portraitAssetIdBefore)
    expect(savedProceduralData.visualIdentity.generatedPortraitProfileId).toBe(profileIdBefore)

    // 4. Resolve a foto no estado recarregado
    const reloadedResolution = resolveDriverPhoto({
      driverId: original.driver.id,
      name: original.driver.name,
      generatedPortraitProfileId: savedProceduralData.generatedPortraitProfileId,
      visualIdentity: savedProceduralData.visualIdentity,
    })

    const initialResolution = resolveDriverPhoto({
      driverId: original.driver.id,
      name: original.driver.name,
      generatedPortraitProfileId: profileIdBefore,
      visualIdentity: originalProcData.visualIdentity,
    })

    expect(reloadedResolution.url).toBe(initialResolution.url)
    expect(reloadedResolution.assetId).toBe(initialResolution.assetId)
  })

  // (3) Backfill idempotente (1x = 10x) e congelamento de pilotos existentes (Camila Carvalho, Sakura Ito)
  it('FE01-03: Backfill idempotente (1x = 10x) congela pilotos existentes sem alterar em execuções repetidas', () => {
    // Simula pilotos existentes do usuário no banco sem generatedPortraitProfileId gravado
    const camilaCarvalhoMock = {
      id: 'pys0cvfjzvio4w6',
      name: 'Camila Carvalho',
      origin_type: 'procedural',
      gender: 'female',
      procedural_data: {
        driverId: 'drv_proc_1728028980730_camila',
        countryFlag: '🇧🇷',
        visualIdentity: {
          gender: 'female',
          visualSeed: 12345,
        },
      },
    }

    const sakuraItoMock = {
      id: '6r5sqq2xhh3gtqh',
      name: 'Sakura Ito',
      origin_type: 'procedural',
      gender: 'female',
      procedural_data: {
        driverId: 'drv_proc_1728029010141_sakura',
        countryFlag: '🇳🇿',
        visualIdentity: {
          gender: 'female',
          visualSeed: 67890,
        },
      },
    }

    // 1ª execução de congelamento
    const frozenCamila1 = driverPortraitBackfillService.freezeDriverInMemory(camilaCarvalhoMock)
    const frozenSakura1 = driverPortraitBackfillService.freezeDriverInMemory(sakuraItoMock)

    const camilaProfile1 = frozenCamila1.procedural_data.generatedPortraitProfileId
    const sakuraProfile1 = frozenSakura1.procedural_data.generatedPortraitProfileId

    expect(camilaProfile1).toBeTruthy()
    expect(sakuraProfile1).toBeTruthy()
    expect(frozenCamila1.procedural_data.visualIdentity.portraitAssetId).toBe(camilaProfile1)
    expect(frozenSakura1.procedural_data.visualIdentity.portraitAssetId).toBe(sakuraProfile1)

    // Repete 10x para garantir idempotência estrita
    for (let i = 2; i <= 10; i++) {
      const repeatedCamila = driverPortraitBackfillService.freezeDriverInMemory(frozenCamila1)
      const repeatedSakura = driverPortraitBackfillService.freezeDriverInMemory(frozenSakura1)

      expect(repeatedCamila.procedural_data.generatedPortraitProfileId).toBe(camilaProfile1)
      expect(repeatedSakura.procedural_data.generatedPortraitProfileId).toBe(sakuraProfile1)
      expect(repeatedCamila.procedural_data.visualIdentity.portraitAssetId).toBe(camilaProfile1)
      expect(repeatedSakura.procedural_data.visualIdentity.portraitAssetId).toBe(sakuraProfile1)
    }

    // A foto resolvida de Camila e Sakura deve ser estável e do pool feminino
    const resolvedCamila = resolveDriverPhoto({
      driverId: frozenCamila1.id,
      name: frozenCamila1.name,
      generatedPortraitProfileId: camilaProfile1,
      visualIdentity: frozenCamila1.procedural_data.visualIdentity,
    })
    expect(FEMALE_PORTRAITS_POOL).toContain(resolvedCamila.url!)
    expect(MALE_PORTRAITS_POOL).not.toContain(resolvedCamila.url!)
  })

  // (4) Colisão por nome não muda retrato procedural
  it('FE01-04: Piloto procedural com nome idêntico a piloto real IGNORE o catálogo canônico real', () => {
    // Exemplo: Piloto gerado que por acaso se chama "Max Verstappen" ou "Lewis Hamilton"
    const fakeMaxProcedural = {
      driverId: 'drv_proc_999999_fake_max',
      name: 'Max Verstappen',
      generatedPortraitProfileId: 'Piloto_02',
      visualIdentity: {
        portraitAssetId: 'Piloto_02',
        generatedPortraitProfileId: 'Piloto_02',
        gender: 'male' as const,
      },
    }

    const resolved = resolveDriverPhoto({
      driverId: fakeMaxProcedural.driverId,
      name: fakeMaxProcedural.name,
      generatedPortraitProfileId: fakeMaxProcedural.generatedPortraitProfileId,
      visualIdentity: fakeMaxProcedural.visualIdentity,
    })

    // DEVE resolver para a foto procedural gravada (Piloto_02.jpg), NUNCA para DRV_0001.jpg
    expect(resolved.url).toBe('/pilotos-gerados/Piloto_02.jpg')
    expect(resolved.sourceType).toBe('generated_procedural')
    expect(resolved.assetId).toBe('Piloto_02')
    expect(resolved.url).not.toBe('/pilotos/DRV_0001.jpg')
  })

  // (5) Pools por gênero preservados + pilotos reais DRV_0001..DRV_0188 intocados
  it('FE01-05: Pools de gênero homologados são estritamente respeitados e pilotos reais intocados', () => {
    // Teste 1: Homem recebe foto do pool masculino (24 fotos)
    for (let seed = 100; seed < 120; seed++) {
      const assignedMale = assignGeneratedPortraitProfile('male', seed)
      expect(MALE_PORTRAITS_POOL).toContain(assignedMale.path)
      expect(FEMALE_PORTRAITS_POOL).not.toContain(assignedMale.path)
    }

    // Teste 2: Mulher recebe foto do pool feminino (42 fotos)
    for (let seed = 200; seed < 220; seed++) {
      const assignedFemale = assignGeneratedPortraitProfile('female', seed)
      expect(FEMALE_PORTRAITS_POOL).toContain(assignedFemale.path)
      expect(MALE_PORTRAITS_POOL).not.toContain(assignedFemale.path)
    }

    // Teste 3: Pilotos reais canônicos (DRV_0001..DRV_0188) permanecem intactos
    const realPilots = [
      { id: 'mbj-001', name: 'Max Verstappen', expectedAsset: 'DRV_0001' },
      { id: 'mbj-003', name: 'Lewis Hamilton', expectedAsset: 'DRV_0003' },
      { id: 'mbj-020', name: 'Gabriel Bortoleto', expectedAsset: 'DRV_0020' },
      { id: 'mbj-128', name: 'Sébastien Bourdais', expectedAsset: 'DRV_0075' },
    ]

    for (const real of realPilots) {
      const resolved = resolveDriverPhoto({
        driverId: real.id,
        name: real.name,
      })
      expect(resolved.sourceType).toBe('canonical_real')
      expect(resolved.assetId).toBe(real.expectedAsset)
      expect(resolved.url).toBe(`/pilotos/${real.expectedAsset}.jpg`)
    }
  })

  // (6) Helper preservePortraitFields nunca descarta campos de retrato
  it('FE01-06: preservePortraitFields protege generatedPortraitProfileId e visualIdentity contra sobrescrita vazia', () => {
    const persisted = {
      generatedPortraitProfileId: 'Piloto_35',
      visualIdentity: {
        portraitAssetId: 'Piloto_35',
        generatedPortraitProfileId: 'Piloto_35',
        gender: 'male',
      },
    }

    const incomingEmpty = {
      careerStatus: 'active',
      notes: 'Atualização de corrida',
    }

    const merged = preservePortraitFields(persisted, incomingEmpty)
    expect(merged?.generatedPortraitProfileId).toBe('Piloto_35')
    expect(merged?.visualIdentity?.portraitAssetId).toBe('Piloto_35')
    expect(merged?.visualIdentity?.generatedPortraitProfileId).toBe('Piloto_35')
  })
})
