/**
 * preserve-portrait-fields.test.ts
 *
 * Suíte de testes para validar o helper preservePortraitFields e garantir
 * que saves de procedural_data preservem campos gerados de retrato
 * (generatedPortraitProfileId e visualIdentity.portraitAssetId)
 * sem inventar campos quando não existirem.
 */

import { describe, it, expect, vi } from 'vitest'
import { preservePortraitFields } from '@/lib/preservePortraitFields'
import { driverScoutingService } from '@/services/driverScoutingService'
import { newGenerationService } from '@/services/newGenerationService'
import pb from '@/lib/pocketbase/client'

describe('preservePortraitFields - Helper e Blindagem de Escritores', () => {
  describe('Helper preservePortraitFields', () => {
    it('PPF-01: Preserva generatedPortraitProfileId e visualIdentity.portraitAssetId do persistido se o next não os contiver', () => {
      const persisted = {
        generatedPortraitProfileId: 'Piloto_13',
        visualIdentity: {
          portraitAssetId: 'GEN_13',
          generatedPortraitProfileId: 'Piloto_13',
          gender: 'female',
        },
      }

      // Próximo estado sem esses campos (ex: reescrita desatenta em memória)
      const next = {
        driverId: 'drv_test_1',
        careerStatus: 'academy',
      }

      const merged = preservePortraitFields(persisted, next)

      expect(merged.generatedPortraitProfileId).toBe('Piloto_13')
      expect(merged.visualIdentity).toBeDefined()
      expect(merged.visualIdentity?.portraitAssetId).toBe('GEN_13')
      expect(merged.visualIdentity?.generatedPortraitProfileId).toBe('Piloto_13')
      expect(merged.driverId).toBe('drv_test_1')
    })

    it('PPF-02: Não inventa campos quando persisted for vazio ou não contiver campos de retrato', () => {
      const persisted = {
        driverId: 'drv_test_2',
        careerStatus: 'prospect',
      }

      const next = {
        driverId: 'drv_test_2',
        careerStatus: 'prospect',
        note: 'sem retrato',
      }

      const merged = preservePortraitFields(persisted, next)

      expect(merged.generatedPortraitProfileId).toBeUndefined()
      expect(merged.visualIdentity).toBeUndefined()
      expect(merged.note).toBe('sem retrato')
    })

    it('PPF-03: Trata com segurança inputs nulos ou indefinidos', () => {
      expect(preservePortraitFields(null, { a: 1 })).toEqual({ a: 1 })
      expect(preservePortraitFields(undefined, { b: 2 })).toEqual({ b: 2 })
      expect(preservePortraitFields({ generatedPortraitProfileId: 'Piloto_05' }, null)).toBeNull()
      expect(
        preservePortraitFields({ generatedPortraitProfileId: 'Piloto_05' }, undefined),
      ).toBeUndefined()
    })

    it('PPF-04: Respeita valores explícitos do next se já estiverem presentes sem sobrescrever com lixo', () => {
      const persisted = {
        generatedPortraitProfileId: 'Piloto_13',
        visualIdentity: {
          portraitAssetId: 'GEN_13',
        },
      }

      const next = {
        generatedPortraitProfileId: 'Piloto_99',
        visualIdentity: {
          portraitAssetId: 'GEN_99',
        },
      }

      const merged = preservePortraitFields(persisted, next)
      expect(merged.generatedPortraitProfileId).toBe('Piloto_99')
      expect(merged.visualIdentity?.portraitAssetId).toBe('GEN_99')
    })

    it('PPF-05: Faz merge em visualIdentity existente quando next tem visualIdentity mas sem portraitAssetId', () => {
      const persisted = {
        generatedPortraitProfileId: 'Piloto_13',
        visualIdentity: {
          portraitAssetId: 'GEN_13',
          generatedPortraitProfileId: 'Piloto_13',
        },
      }

      const next = {
        visualIdentity: {
          stylePromptSeed: 123,
          gender: 'female',
        },
      }

      const merged = preservePortraitFields(persisted, next)
      expect(merged.generatedPortraitProfileId).toBe('Piloto_13')
      expect(merged.visualIdentity?.portraitAssetId).toBe('GEN_13')
      expect(merged.visualIdentity?.generatedPortraitProfileId).toBe('Piloto_13')
      expect(merged.visualIdentity?.stylePromptSeed).toBe(123)
    })
  })

  describe('Escritor 1: driverScoutingService.evaluateProspectAgain', () => {
    it('PPF-06: evaluateProspectAgain preserva generatedPortraitProfileId e portraitAssetId de Mariana Fagundes', () => {
      const mockDriver: any = {
        id: 'qm6xcgc5mstulg3',
        name: 'Mariana Fagundes',
        speed: 59,
        consistency: 60,
        rain: 56,
        defense: 61,
        technical_feedback: 52,
        evaluation_confidence: 60,
        true_potential: 71,
        perceived_potential: 70,
        procedural_data: {
          driverId: 'drv_proc_mariana_fagundes',
          generatedPortraitProfileId: 'Piloto_13',
          visualIdentity: {
            portraitAssetId: 'GEN_13',
            generatedPortraitProfileId: 'Piloto_13',
            gender: 'female',
          },
          scoutingRecords: {},
        },
      }

      const mockTeam: any = {
        id: 'team_test',
        youth_academy_level: 5,
        simulator_level: 5,
      }

      const result = driverScoutingService.evaluateProspectAgain(mockDriver, mockTeam)
      const updatedMeta = (result.updatedDriver as any).procedural_data

      expect(updatedMeta).toBeDefined()
      expect(updatedMeta.generatedPortraitProfileId).toBe('Piloto_13')
      expect(updatedMeta.visualIdentity?.portraitAssetId).toBe('GEN_13')
      expect(updatedMeta.visualIdentity?.generatedPortraitProfileId).toBe('Piloto_13')
      expect(result.updatedDriver.evaluation_confidence).toBeGreaterThanOrEqual(60)
    })
  })

  describe('Escritor 2: newGenerationService.persistGeneratedClass', () => {
    it('PPF-07: persistGeneratedClass grava procedural_data através de preservePortraitFields', async () => {
      const createSpy = vi
        .spyOn(pb.collection('drivers'), 'create')
        .mockResolvedValue({ id: 'drv_new_1' } as any)

      const mockDriver: any = {
        id: 'drv_new_1',
        name: 'Newgen Piloto',
        nationality: 'Brasil',
        age: 16,
        speed: 60,
        consistency: 60,
        rain: 60,
        defense: 60,
        salary: 100000,
        contract_end: 2028,
        category: 'f4',
        superlicense_points: 0,
        homologation_status: 'formacao',
        f1_adaptation: 50,
        license_status: 'nivel_c',
        technical_feedback: 50,
        seat_security: 80,
        true_potential: 75,
        perceived_potential: 75,
        evaluation_confidence: 50,
        procedural_data: {
          driverId: 'drv_new_1',
          generatedPortraitProfileId: 'Piloto_13',
          visualIdentity: {
            portraitAssetId: 'GEN_13',
            gender: 'female',
          },
        },
      }

      await newGenerationService.persistGeneratedClass([mockDriver])

      expect(createSpy).toHaveBeenCalled()
      const payloadSent = createSpy.mock.calls[0][0] as any
      expect(payloadSent.procedural_data).toBeDefined()
      expect(payloadSent.procedural_data.generatedPortraitProfileId).toBe('Piloto_13')
      expect(payloadSent.procedural_data.visualIdentity?.portraitAssetId).toBe('GEN_13')

      createSpy.mockRestore()
    })
  })

  describe('Escritor 3: Team.tsx - preservação ao avançar temporada de academia', () => {
    it('PPF-08: simulação de save em /team com preservePortraitFields protege campos de Mariana', () => {
      // Simula o registro no banco antes do update de avanço de temporada
      const persistedDriver = {
        id: 'qm6xcgc5mstulg3',
        name: 'Mariana Fagundes',
        procedural_data: {
          driverId: 'drv_proc_mariana_fagundes',
          generatedPortraitProfileId: 'Piloto_13',
          visualIdentity: {
            portraitAssetId: 'GEN_13',
            generatedPortraitProfileId: 'Piloto_13',
            gender: 'female',
          },
        },
      }

      // Procedural progress service gera novo metadata sem portrait tags
      const updatedMetadataFromProgress: any = {
        driverId: 'drv_proc_mariana_fagundes',
        juniorCategory: 'f3',
        seasonsHistory: [{ year: 2026, category: 'karting', position: 1 }],
      }

      // Aplicando o helper que Team.tsx usa antes do pb.collection('drivers').update
      const safeProceduralData = preservePortraitFields(
        persistedDriver.procedural_data,
        updatedMetadataFromProgress,
      )

      expect(safeProceduralData.generatedPortraitProfileId).toBe('Piloto_13')
      expect(safeProceduralData.visualIdentity?.portraitAssetId).toBe('GEN_13')
      expect(safeProceduralData.visualIdentity?.generatedPortraitProfileId).toBe('Piloto_13')
      expect(safeProceduralData.juniorCategory).toBe('f3')
    })
  })
})
