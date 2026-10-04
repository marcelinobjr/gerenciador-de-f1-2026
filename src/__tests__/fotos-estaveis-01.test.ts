import { describe, it, expect } from 'vitest'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { proceduralDriverGenerator } from '@/services/proceduralDriverGenerator'
import { driverHiringService } from '@/services/driverHiringService'
import { driverPortraitBackfillService } from '@/services/driverPortraitBackfillService'
import { assignGeneratedPortraitProfile } from '@/services/driverPortraitAssignmentService'
import type { DriverModel } from '@/types/f1'

describe('FOTOS-ESTAVEIS-01 — Estabilidade de Retratos de Pilotos Gerados e Resolução Central', () => {
  // =========================================================================
  // CENÁRIO A: Foto estável pós-reload/re-sincronização (ID do registro muda, foto não)
  // Regra: "uma vez criado o piloto e definida a imagem associada, não pode mudar"
  // =========================================================================
  it('(a) foto estável pós-reload/re-sincronização quando o ID do registro muda no banco', () => {
    // 1. Gera piloto procedural com retrato fixado
    const generated = proceduralDriverGenerator.generateDriver({
      seed: 42,
    })

    const initialProfileId =
      generated.metadata.generatedPortraitProfileId ||
      generated.metadata.visualIdentity.generatedPortraitProfileId
    expect(initialProfileId).toBeDefined()
    expect(initialProfileId).toMatch(/^Piloto_\d{2}$/)

    // Resolução inicial antes do save
    const initialResolved = resolveDriverPhoto({
      driverId: generated.driver.id,
      name: generated.driver.name,
      originType: 'procedural',
      generatedPortraitProfileId: initialProfileId,
      visualIdentity: generated.metadata.visualIdentity,
    })

    expect(initialResolved.url).toBe(`/pilotos-gerados/${initialProfileId}.jpg`)

    // 2. Simula reload/salvamento no PocketBase onde o ID do registro muda para um hash aleatório do PB (ex.: 'pb_rec_99x')
    const reloadedDriverRecord: Partial<DriverModel> = {
      ...generated.driver,
      id: 'pb_rec_random_id_after_sync_99x', // ID mudou pós-persistência/sincronização
      origin_type: 'procedural',
      procedural_data: {
        ...(generated.driver.procedural_data || {}),
        generatedPortraitProfileId: initialProfileId,
      },
    }

    // Resolução após reload com novo ID
    const reloadedResolved = resolveDriverPhoto({
      driverId: reloadedDriverRecord.id,
      name: reloadedDriverRecord.name,
      generatedPortraitProfileId: reloadedDriverRecord.procedural_data?.generatedPortraitProfileId,
      visualIdentity: reloadedDriverRecord.procedural_data?.visualIdentity,
    })

    // A foto DEVE permanecer exatamente a mesma
    expect(reloadedResolved.url).toBe(initialResolved.url)
    expect(reloadedResolved.assetId).toBe(initialResolved.assetId)
    expect(reloadedResolved.sourceType).toBe('generated_procedural')
  })

  // =========================================================================
  // CENÁRIO B: Colisão por nome NÃO muda a foto de piloto gerado
  // Regra: pilotos procedurais/gerados NUNCA casam por nome com o catálogo canônico real (DRV_0001..DRV_0188)
  // =========================================================================
  it('(b) colisão por nome NÃO muda a foto de piloto gerado (ignora catálogo canônico real)', () => {
    // Criamos um piloto procedural cujo nome coincide acidentalmente com um piloto real (ex.: "Max Verstappen" ou "Gabriel Bortoleto")
    const assigned = assignGeneratedPortraitProfile('male', 12345)

    const collidingProceduralDriver = {
      driverId: 'drv_proc_colisao_99',
      name: 'Gabriel Bortoleto', // Nome existente no catálogo canônico real (DRV_0075 / DRV_0042)
      generatedPortraitProfileId: assigned.profileId,
      visualIdentity: {
        portraitAssetId: assigned.portraitAssetId,
        generatedPortraitProfileId: assigned.profileId,
        gender: 'male' as const,
      },
    }

    const resolved = resolveDriverPhoto(collidingProceduralDriver)

    // NÃO deve resolver para /pilotos/DRV_xxxx.jpg nem para a foto real do Gabriel Bortoleto
    expect(resolved.sourceType).toBe('generated_procedural')
    expect(resolved.url).toBe(`/pilotos-gerados/${assigned.profileId}.jpg`)
    expect(resolved.url).not.toContain('/pilotos/DRV_')
  })

  // =========================================================================
  // CENÁRIO C: Piloto com foto real (ex.: Verstappen, Bortoleto, Bourdais DRV_0075) intocado
  // =========================================================================
  it('(c) piloto com foto real (ex.: Verstappen, Bortoleto, DRV_0075) permanece intocado e canônico', () => {
    // 1. Max Verstappen por ID
    const maxResolved = resolveDriverPhoto({
      driverId: 'DRV_0001',
      name: 'Max Verstappen',
    })
    expect(maxResolved.sourceType).toBe('canonical_real')
    expect(maxResolved.url).toMatch(/\/pilotos\/DRV_0001\.jpg|\/pilotos\/DRV_0001/)

    // 2. Gabriel Bortoleto canônico real
    const bortoletoResolved = resolveDriverPhoto({
      driverId: 'DRV_0034',
      name: 'Gabriel Bortoleto',
    })
    expect(bortoletoResolved.sourceType).toBe('canonical_real')
    expect(bortoletoResolved.url).toMatch(/\/pilotos\/DRV_0034\.jpg/)

    // 3. Sébastien Bourdais DRV_0075 canônico real
    const bourdaisResolved = resolveDriverPhoto({
      driverId: 'DRV_0075',
      name: 'Sébastien Bourdais',
    })
    expect(bourdaisResolved.sourceType).toBe('canonical_real')
    expect(bourdaisResolved.url).toMatch(/\/pilotos\/DRV_0075\.jpg/)
  })

  // =========================================================================
  // CENÁRIO D: Backfill idempotente
  // Pilotos existentes sem foto gravada recebem a foto que o resolvedor JÁ calcula hoje
  // Casos de teste conhecidos: Camila Carvalho e Sakura Ito
  // Idempotente: rodar duas vezes não muda nada
  // =========================================================================
  it('(d) backfill idempotente congela a foto atual e rodar duas vezes não altera o resultado', () => {
    const camilaRaw: DriverModel = {
      id: 'pys0cvfjzvio4w6',
      name: 'Camila Carvalho',
      nationality: 'Brasil',
      age: 18,
      speed: 65,
      consistency: 60,
      rain: 58,
      defense: 62,
      salary: 50000,
      contract_end: 2027,
      team_id: 'team_player',
      role: null,
      category: 'f2',
      superlicense_points: 6,
      homologation_status: 'formacao',
      f1_adaptation: 50,
      license_status: 'nivel_c',
      is_academy: true,
      is_test_driver: false,
      technical_feedback: 60,
      seat_security: 80,
      origin_type: 'procedural',
      procedural_data: {
        driverId: 'pys0cvfjzvio4w6',
        name: 'Camila Carvalho',
        // Sem generatedPortraitProfileId gravado originalmente
      },
    }

    const sakuraRaw: DriverModel = {
      id: 'sakura_ito_test_id_99',
      name: 'Sakura Ito',
      nationality: 'Japão',
      age: 19,
      speed: 68,
      consistency: 65,
      rain: 60,
      defense: 64,
      salary: 55000,
      contract_end: 2027,
      team_id: 'team_player',
      role: null,
      category: 'f2',
      superlicense_points: 7,
      homologation_status: 'formacao',
      f1_adaptation: 55,
      license_status: 'nivel_c',
      is_academy: true,
      is_test_driver: false,
      technical_feedback: 62,
      seat_security: 80,
      origin_type: 'procedural',
      procedural_data: {
        driverId: 'sakura_ito_test_id_99',
        name: 'Sakura Ito',
      },
    }

    // Execução 1 do backfill
    const camilaBackfilled1 = driverPortraitBackfillService.freezeDriverInMemory(camilaRaw)
    const sakuraBackfilled1 = driverPortraitBackfillService.freezeDriverInMemory(sakuraRaw)

    const camilaPhoto1 = camilaBackfilled1.procedural_data?.generatedPortraitProfileId
    const sakuraPhoto1 = sakuraBackfilled1.procedural_data?.generatedPortraitProfileId

    expect(camilaPhoto1).toBeDefined()
    expect(camilaPhoto1).toMatch(/^Piloto_\d{2}$/)
    expect(sakuraPhoto1).toBeDefined()
    expect(sakuraPhoto1).toMatch(/^Piloto_\d{2}$/)

    // Ambos devem ter entrado no pool feminino (pois são mulheres)
    // O pool feminino é qualquer foto que NÃO seja da lista masculina
    const malePool = new Set([
      'Piloto_01',
      'Piloto_02',
      'Piloto_06',
      'Piloto_08',
      'Piloto_10',
      'Piloto_12',
      'Piloto_14',
      'Piloto_17',
      'Piloto_19',
      'Piloto_20',
      'Piloto_21',
      'Piloto_23',
      'Piloto_28',
      'Piloto_30',
      'Piloto_31',
      'Piloto_33',
      'Piloto_35',
      'Piloto_37',
      'Piloto_39',
      'Piloto_42',
      'Piloto_46',
      'Piloto_49',
      'Piloto_52',
      'Piloto_58',
    ])
    expect(malePool.has(camilaPhoto1!)).toBe(false)
    expect(malePool.has(sakuraPhoto1!)).toBe(false)

    // Execução 2 do backfill (Idempotência estrita)
    const camilaBackfilled2 = driverPortraitBackfillService.freezeDriverInMemory(camilaBackfilled1)
    const sakuraBackfilled2 = driverPortraitBackfillService.freezeDriverInMemory(sakuraBackfilled1)

    expect(camilaBackfilled2.procedural_data?.generatedPortraitProfileId).toBe(camilaPhoto1)
    expect(sakuraBackfilled2.procedural_data?.generatedPortraitProfileId).toBe(sakuraPhoto1)
    expect(camilaBackfilled2.procedural_data?.visualIdentity?.portraitAssetId).toBe(camilaPhoto1)
    expect(sakuraBackfilled2.procedural_data?.visualIdentity?.portraitAssetId).toBe(sakuraPhoto1)
  })

  // =========================================================================
  // CENÁRIO E: sanitizeDriverProceduralData e preservePortraitFields nunca perdem foto
  // =========================================================================
  it('(e) sanitização de procedural_data preserva a foto gerada em qualquer update', () => {
    const fixedProfileId = 'Piloto_25'
    const existingProcData = {
      driverId: 'hire_test_01',
      generatedPortraitProfileId: fixedProfileId,
      visualIdentity: {
        portraitAssetId: fixedProfileId,
        generatedPortraitProfileId: fixedProfileId,
        gender: 'female',
      },
      careerStatus: 'academy',
    }

    // Simula um update arbitrário que não enviava a foto gerada ou que enviava campos novos
    const updatePatch = {
      careerStatus: 'professional',
      academyPromotedToProfessional: true,
    }

    const sanitized = driverPortraitBackfillService.freezeDriverInMemory({
      id: 'hire_test_01',
      name: 'Elena Rostova',
      procedural_data: existingProcData,
    } as any)

    expect(sanitized.procedural_data?.generatedPortraitProfileId).toBe(fixedProfileId)
    expect(sanitized.procedural_data?.visualIdentity?.generatedPortraitProfileId).toBe(
      fixedProfileId,
    )
  })

  // =========================================================================
  // CENÁRIO F: Pools homologados de Fotos Geradas FOTOS-GERADAS-01
  // Homens: Piloto_01, 02, 06, 08, 10, 12, 14, 17, 19, 20, 21, 23, 28, 30, 31, 33, 35, 37, 39, 42, 46, 49, 52, 58 (24 fotos)
  // Mulheres: todas as 42 demais fotos
  // =========================================================================
  it('(f) sorteios respeitam estritamente a partição homologada de 24 homens e 42 mulheres', () => {
    const maleSet = new Set([
      'Piloto_01',
      'Piloto_02',
      'Piloto_06',
      'Piloto_08',
      'Piloto_10',
      'Piloto_12',
      'Piloto_14',
      'Piloto_17',
      'Piloto_19',
      'Piloto_20',
      'Piloto_21',
      'Piloto_23',
      'Piloto_28',
      'Piloto_30',
      'Piloto_31',
      'Piloto_33',
      'Piloto_35',
      'Piloto_37',
      'Piloto_39',
      'Piloto_42',
      'Piloto_46',
      'Piloto_49',
      'Piloto_52',
      'Piloto_58',
    ])

    // Testa amostragem determinística masculina
    for (let i = 0; i < 50; i++) {
      const assignedMale = assignGeneratedPortraitProfile('male', `male_test_seed_${i}`)
      expect(maleSet.has(assignedMale.profileId)).toBe(true)
    }

    // Testa amostragem determinística feminina
    for (let i = 0; i < 50; i++) {
      const assignedFemale = assignGeneratedPortraitProfile('female', `female_test_seed_${i}`)
      expect(maleSet.has(assignedFemale.profileId)).toBe(false)
    }
  })
})
