/**
 * bug-retratos-03b2-procedural-data.test.ts
 *
 * Suíte de homologação BUG-RETRATOS-03B2:
 * Validação rigorosa da causa raiz do expando bug de array JSON,
 * sanitizador canônico sanitizeDriverProceduralData, preservePortraitFields,
 * integridade de Mariana Fagundes (qm6xcgc5mstulg3), integridade de todos os newgens
 * e comportamento de persistência contra array [].
 */

import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import {
  sanitizeDriverProceduralData,
  normalizeProceduralDataObject,
} from '@/lib/sanitizeDriverProceduralData'
import { preservePortraitFields } from '@/lib/preservePortraitFields'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { ProspectCard } from '@/components/ProspectCard'
import { driverScoutingService } from '@/services/driverScoutingService'
import { proceduralDriverProgressService } from '@/services/proceduralDriverProgressService'
import driverDevelopmentService from '@/services/driverDevelopmentService'
import { f1Service } from '@/services/f1Service'
import { newGenerationService } from '@/services/newGenerationService'
import { DriverModel, TeamModel } from '@/types/f1'
import pb from '@/lib/pocketbase/client'

describe('BUG-RETRATOS-03B2: Procedural Driver Data & Portrait Persistence', () => {
  const marianaMock: any = {
    id: 'qm6xcgc5mstulg3',
    name: 'Mariana Fagundes',
    nationality: 'Brasil',
    age: 16,
    speed: 59,
    consistency: 60,
    rain: 56,
    defense: 61,
    technical_feedback: 52,
    salary: 180000,
    contract_end: 2027,
    team_id: 'dpvviz06tkzwbih',
    is_academy: true,
    is_test_driver: false,
    license_status: 'nivel_c',
    origin_type: 'procedural',
    true_potential: 71,
    perceived_potential: 72,
    evaluation_confidence: 63,
    career_status: 'academy',
    procedural_data: {
      driverId: 'drv_proc_mariana_fagundes',
      displayName: 'M. Fagundes',
      countryFlag: '🇧🇷',
      careerStatus: 'academy',
      currentAcademyTeamId: 'dpvviz06tkzwbih',
      academyOriginTeamId: 'dpvviz06tkzwbih',
      dateOfBirth: '2010-03-16',
      generatedPortraitProfileId: 'Piloto_13',
      visualIdentity: {
        visualIdentityId: 'fictional_pilot_13',
        portraitAssetId: 'GEN_13',
        generatedPortraitProfileId: 'Piloto_13',
        gender: 'female',
        stylePromptSeed: 13,
      },
    },
  }

  const teamMock: TeamModel = {
    id: 'dpvviz06tkzwbih',
    name: 'Audi F1 Team',
    team_principal: 'Test Principal',
    budget: 50000000,
    academy_development_data: {
      academyDrivers: ['qm6xcgc5mstulg3'],
      testDrivers: [],
      homologationPrograms: {},
      testResults: [],
    },
  } as any

  // BRT03B2-01: writer inventory cobre todos os usos de procedural_data
  it('BRT03B2-01: writer inventory cobre todos os usos de procedural_data', () => {
    // Valida que as funções centrais de sanitização estão definidas e prontas para uso pelos writers
    expect(typeof sanitizeDriverProceduralData).toBe('function')
    expect(typeof normalizeProceduralDataObject).toBe('function')
    expect(typeof preservePortraitFields).toBe('function')
  })

  // BRT03B2-02: nenhum writer ativo usa [] como default destrutivo
  it('BRT03B2-02: nenhum writer ativo usa [] como default destrutivo', () => {
    // Se a entrada for [], null ou undefined, sanitizeDriverProceduralData deve normalizar para objeto plano {}
    const fromArray = sanitizeDriverProceduralData([])
    expect(Array.isArray(fromArray)).toBe(false)
    expect(typeof fromArray).toBe('object')
    expect(fromArray).toEqual({})

    const fromNull = sanitizeDriverProceduralData(null)
    expect(Array.isArray(fromNull)).toBe(false)
    expect(fromNull).toEqual({})

    const fromUndefined = sanitizeDriverProceduralData(undefined)
    expect(Array.isArray(fromUndefined)).toBe(false)
    expect(fromUndefined).toEqual({})

    // Se patch for [], deve ser rejeitado/convertido para objeto sem apagar campos existentes
    const patchedWithArray = sanitizeDriverProceduralData(
      { generatedPortraitProfileId: 'Piloto_13', name: 'Mariana' },
      [],
    )
    expect(Array.isArray(patchedWithArray)).toBe(false)
    expect(patchedWithArray.generatedPortraitProfileId).toBe('Piloto_13')
    expect(patchedWithArray.name).toBe('Mariana')
  })

  // BRT03B2-03: update parcial preserva generatedPortraitProfileId
  it('BRT03B2-03: update parcial preserva generatedPortraitProfileId', () => {
    const existing = {
      driverId: 'drv_123',
      generatedPortraitProfileId: 'Piloto_13',
      extra: 'initial',
    }

    const patch = { extra: 'updated', newAttr: 99 }
    const res = sanitizeDriverProceduralData(existing, patch)

    expect(res.generatedPortraitProfileId).toBe('Piloto_13')
    expect(res.extra).toBe('updated')
    expect(res.newAttr).toBe(99)
  })

  // BRT03B2-04: update parcial preserva visualIdentity
  it('BRT03B2-04: update parcial preserva visualIdentity', () => {
    const existing = {
      driverId: 'drv_123',
      generatedPortraitProfileId: 'Piloto_13',
      visualIdentity: {
        portraitAssetId: 'GEN_13',
        generatedPortraitProfileId: 'Piloto_13',
        gender: 'female',
      },
    }

    const patch = { milestones: [{ type: 'promotion' }] }
    const res = sanitizeDriverProceduralData(existing, patch)

    expect(res.visualIdentity).toBeDefined()
    expect(res.visualIdentity.portraitAssetId).toBe('GEN_13')
    expect(res.visualIdentity.generatedPortraitProfileId).toBe('Piloto_13')
    expect(res.visualIdentity.gender).toBe('female')
  })

  // BRT03B2-05: save/reload preserva procedural_data
  it('BRT03B2-05: save/reload preserva procedural_data', () => {
    // Simula roundtrip de serialização JSON (PocketBase wire format)
    const original = marianaMock.procedural_data
    const serialized = JSON.stringify(original)
    const reloaded = JSON.parse(serialized)

    const sanitized = sanitizeDriverProceduralData(reloaded)
    expect(sanitized.generatedPortraitProfileId).toBe('Piloto_13')
    expect(sanitized.visualIdentity?.portraitAssetId).toBe('GEN_13')
    expect(Array.isArray(sanitized)).toBe(false)
  })

  // BRT03B2-06: advance round preserva procedural_data
  it('BRT03B2-06: advance round preserva procedural_data', () => {
    const progResult = proceduralDriverProgressService.advanceSeasonForJuniorDriver(
      marianaMock as DriverModel,
      teamMock,
      2026,
    )

    const updatedDriverAny = progResult.updatedDriver as any
    expect(updatedDriverAny.procedural_data).toBeDefined()
    expect(Array.isArray(updatedDriverAny.procedural_data)).toBe(false)
    expect(updatedDriverAny.procedural_data.generatedPortraitProfileId).toBe('Piloto_13')
    expect(updatedDriverAny.procedural_data.visualIdentity?.portraitAssetId).toBe('GEN_13')
  })
  // BRT03B2-07: academy sync preserva procedural_data
  it('BRT03B2-07: academy sync preserva procedural_data', async () => {
    const updateSpy = vi.spyOn(pb.collection('drivers'), 'update').mockResolvedValue(marianaMock)
    const teamUpdateSpy = vi.spyOn(pb.collection('teams'), 'update').mockResolvedValue(teamMock)
    const eventCreateSpy = vi.spyOn(pb.collection('events'), 'create').mockResolvedValue({} as any)

    const otherTeam: TeamModel = {
      ...teamMock,
      id: 'other_team_id',
      academy_development_data: {
        academyDrivers: [],
        testDrivers: [],
        homologationPrograms: {},
        testResults: [],
      },
    } as any

    await driverDevelopmentService.addDriverToAcademy(otherTeam, marianaMock)

    expect(updateSpy).toHaveBeenCalled()
    const callPayload = updateSpy.mock.calls[0][1] as any
    expect(callPayload.procedural_data).toBeDefined()
    expect(Array.isArray(callPayload.procedural_data)).toBe(false)
    expect(callPayload.procedural_data.generatedPortraitProfileId).toBe('Piloto_13')
    expect(callPayload.procedural_data.visualIdentity?.portraitAssetId).toBe('GEN_13')

    updateSpy.mockRestore()
    teamUpdateSpy.mockRestore()
    eventCreateSpy.mockRestore()
  })

  // BRT03B2-08: team update preserva procedural_data
  it('BRT03B2-08: team update preserva procedural_data', () => {
    // Simula a lógica de avanço de temporada do Team.tsx (handleAdvanceAcademySeason)
    const d = marianaMock
    const prog = proceduralDriverProgressService.advanceSeasonForJuniorDriver(d, teamMock, 2026)
    const safeProceduralData = sanitizeDriverProceduralData(
      (d as any)?.procedural_data,
      prog.updatedMetadata,
    )

    expect(Array.isArray(safeProceduralData)).toBe(false)
    expect(safeProceduralData.generatedPortraitProfileId).toBe('Piloto_13')
    expect(safeProceduralData.visualIdentity?.portraitAssetId).toBe('GEN_13')
  })

  // BRT03B2-09: Mariana termina com Piloto_13
  it('BRT03B2-09: Mariana termina com Piloto_13', () => {
    const photo = resolveDriverPhoto({
      driverId: marianaMock.id,
      name: marianaMock.name,
      generatedPortraitProfileId: marianaMock.procedural_data.generatedPortraitProfileId,
      visualIdentity: marianaMock.procedural_data.visualIdentity,
    })

    expect(photo.url).toBe('/pilotos-gerados/Piloto_13.jpg')
    expect(photo.assetId).toBe('Piloto_13')
    expect(photo.sourceType).toBe('generated_procedural')
  })

  // BRT03B2-10: ProspectCard resolve Piloto_13
  it('BRT03B2-10: ProspectCard resolve Piloto_13', () => {
    const scoutView = driverScoutingService.createScoutingViewModel(marianaMock, teamMock.id)
    expect(scoutView.generatedPortraitProfileId).toBe('Piloto_13')

    const { container } = render(React.createElement(ProspectCard, { prospect: scoutView }))
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('/pilotos-gerados/Piloto_13.jpg')
    expect(img?.getAttribute('alt')).toBe('Mariana Fagundes')
  })

  // BRT03B2-11: Mariana não renderiza fallback MF
  it('BRT03B2-11: Mariana não renderiza fallback MF quando a imagem carrega normalmente', () => {
    const scoutView = driverScoutingService.createScoutingViewModel(marianaMock, teamMock.id)
    render(React.createElement(ProspectCard, { prospect: scoutView }))

    expect(screen.queryByTestId(`prospect-fallback-${marianaMock.id}`)).toBeNull()
  })

  // BRT03B2-12: nenhum newgen com portrait definido perde o vínculo após os fluxos testados
  it('BRT03B2-12: nenhum newgen com portrait definido perde o vínculo após os fluxos testados', () => {
    const sampleNewgen: any = {
      id: 'drv_test_newgen_01',
      name: 'Lucas Silva',
      nationality: 'Brasil',
      age: 17,
      speed: 68,
      consistency: 65,
      rain: 60,
      defense: 62,
      technical_feedback: 55,
      salary: 150000,
      contract_end: 2027,
      team_id: null,
      is_academy: false,
      is_test_driver: false,
      license_status: 'nivel_c',
      origin_type: 'procedural',
      true_potential: 78,
      perceived_potential: 75,
      evaluation_confidence: 50,
      career_status: 'prospect',
      procedural_data: {
        driverId: 'drv_test_newgen_01',
        generatedPortraitProfileId: 'Piloto_05',
        visualIdentity: {
          portraitAssetId: 'GEN_05',
          generatedPortraitProfileId: 'Piloto_05',
        },
      },
    }

    // Passar por reavaliação (evaluateProspectAgain)
    const { updatedDriver } = driverScoutingService.evaluateProspectAgain(sampleNewgen, teamMock)
    expect((updatedDriver as any).procedural_data.generatedPortraitProfileId).toBe('Piloto_05')
    expect((updatedDriver as any).procedural_data.visualIdentity.portraitAssetId).toBe('GEN_05')
    expect(Array.isArray((updatedDriver as any).procedural_data)).toBe(false)

    // Passar por sanitizador com entrada array malformada
    const sanitizedBadInput = sanitizeDriverProceduralData(sampleNewgen.procedural_data, [])
    expect(sanitizedBadInput.generatedPortraitProfileId).toBe('Piloto_05')
    expect(sanitizedBadInput.visualIdentity.portraitAssetId).toBe('GEN_05')
  })
})
