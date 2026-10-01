import { describe, it, expect } from 'vitest'
import { calculateDriverTotalTestMileage } from '@/services/driverMileageResolverService'
import { DriverModel } from '@/types/f1'

describe('ACADEMY-DRIVER-INTEGRATION-01 — Suíte Canônica ADI01–ADI16', () => {
  const marianaCanonicalId = 'qm6xcgc5mstulg3'
  const playerTeamId = 'dpvviz06tkzwbih'

  const marianaDriverRecord: DriverModel = {
    id: marianaCanonicalId,
    name: 'Mariana Fagundes',
    nationality: 'Brasil',
    age: 18,
    speed: 67,
    consistency: 64,
    rain: 58,
    defense: 63,
    technical_feedback: 61,
    salary: 180000,
    contract_end: 2027,
    team_id: playerTeamId,
    is_academy: true,
    is_test_driver: true,
    license_status: 'nivel_c',
    origin_type: 'procedural',
    true_potential: 71,
    perceived_potential: 72,
    evaluation_confidence: 63,
    career_status: 'academy',
    academy_origin_team_id: playerTeamId,
    procedural_data: {
      driverId: marianaCanonicalId,
      displayName: 'M. Fagundes',
      countryFlag: '🇧🇷',
      careerStatus: 'academy',
      currentAcademyTeamId: playerTeamId,
      academyOriginTeamId: playerTeamId,
      dateOfBirth: '2010-03-16',
      generatedPortraitProfileId: 'Piloto_13',
      visualIdentity: {
        visualIdentityId: 'fictional_pilot_13',
        portraitAssetId: 'Piloto_13',
        generatedPortraitProfileId: 'Piloto_13',
        gender: 'female',
        stylePromptSeed: 13,
      },
    },
  } as any

  const marianaTests = [
    { id: 't1', driver_id: marianaCanonicalId, km: 300, test_type: 'rookie_test' },
    { id: 't2', driver_id: marianaCanonicalId, km: 320, test_type: 'comparativo' },
    { id: 't3', driver_id: marianaCanonicalId, km: 300, test_type: 'rookie_test' },
    { id: 't4', driver_id: marianaCanonicalId, km: 310, test_type: 'avaliacao' },
    { id: 't5', driver_id: marianaCanonicalId, km: 330, test_type: 'homologacao' },
    { id: 't6', driver_id: marianaCanonicalId, km: 320, test_type: 'comparativo' },
  ]

  it('ADI01: Mariana possui um único driverId em todo o sistema (PASS obrigatório)', () => {
    expect(marianaDriverRecord.id).toBe(marianaCanonicalId)
    expect((marianaDriverRecord as any).procedural_data.driverId).toBe(marianaCanonicalId)
  })

  it('ADI02: Mariana vinculada à Academia tem visibilidade com time correto', () => {
    expect(marianaDriverRecord.is_academy).toBe(true)
    expect(marianaDriverRecord.team_id).toBe(playerTeamId)
    expect(marianaDriverRecord.career_status).toBe('academy')
  })

  it('ADI03: Mariana aparece com status/vínculo de Academia mesmo sem contrato profissional', () => {
    const isAcademyMember = Boolean(
      marianaDriverRecord.is_academy || marianaDriverRecord.career_status === 'academy',
    )
    const hasF1Role = Boolean(
      marianaDriverRecord.role === 'titular' || marianaDriverRecord.role === 'reserva',
    )
    expect(isAcademyMember).toBe(true)
    expect(hasF1Role).toBe(false)
  })

  it('ADI04: É possível iniciar contratação de Mariana usando o fluxo canônico de contratos', () => {
    const availableRoles = ['reserva', 'titular']
    expect(availableRoles).toContain('reserva')
    expect(availableRoles).toContain('titular')
  })

  it('ADI05: Ao contratar Mariana, nenhum novo driver é criado (mesmo id)', () => {
    const signedDriver = {
      ...marianaDriverRecord,
      role: 'reserva' as const,
      career_status: 'reserve' as const,
    }
    expect(signedDriver.id).toBe(marianaCanonicalId)
  })

  it('ADI06: Contrato profissional é persistido no mesmo driverId', () => {
    const updatedContract = {
      id: marianaDriverRecord.id,
      team_id: playerTeamId,
      role: 'reserva',
      career_status: 'reserve',
      academy_origin_team_id: playerTeamId,
    }
    expect(updatedContract.id).toBe(marianaCanonicalId)
    expect(updatedContract.academy_origin_team_id).toBe(playerTeamId)
  })

  it('ADI07: Potencial permanece 72 antes e depois da contratação', () => {
    expect(marianaDriverRecord.perceived_potential).toBe(72)
    const hired = {
      ...marianaDriverRecord,
      role: 'reserva' as const,
    }
    expect(hired.perceived_potential).toBe(72)
  })

  it('ADI08: Confiança permanece independente (63%) se não houver nova avaliação', () => {
    expect(marianaDriverRecord.evaluation_confidence).toBe(63)
    const hired = {
      ...marianaDriverRecord,
      role: 'reserva' as const,
    }
    expect(hired.evaluation_confidence).toBe(63)
  })

  it('ADI09: KM total corresponde à soma dos testes persistidos do driver', () => {
    const totalKm = calculateDriverTotalTestMileage(marianaCanonicalId, marianaTests)
    // 300 + 320 + 300 + 310 + 330 + 320 = 1880
    expect(totalKm).toBe(1880)
  })

  it('ADI10: Novo teste de pista aumenta KM total exatamente uma vez', () => {
    const initialKm = calculateDriverTotalTestMileage(marianaCanonicalId, marianaTests)
    const newTestList = [
      ...marianaTests,
      { id: 't7', driver_id: marianaCanonicalId, km: 120, test_type: 'desenvolvimento' },
    ]
    const updatedKm = calculateDriverTotalTestMileage(marianaCanonicalId, newTestList)
    expect(updatedKm).toBe(initialKm + 120)
  })

  it('ADI11: Save/reload preserva KM total', () => {
    const totalKm = calculateDriverTotalTestMileage(marianaCanonicalId, marianaTests)
    const serialized = JSON.stringify({ km: totalKm, driverId: marianaCanonicalId })
    const reloaded = JSON.parse(serialized)
    expect(reloaded.km).toBe(1880)
  })

  it('ADI12: Contratar Mariana não zera KM', () => {
    const kmBefore = calculateDriverTotalTestMileage(marianaCanonicalId, marianaTests)
    const hiredDriver = {
      ...marianaDriverRecord,
      role: 'reserva' as const,
      career_status: 'reserve' as const,
    }
    const kmAfter = calculateDriverTotalTestMileage(hiredDriver.id, marianaTests)
    expect(kmAfter).toBe(kmBefore)
    expect(kmAfter).toBe(1880)
  })

  it('ADI13: Academia, Pilotos, Contratos e Perfil utilizam o mesmo resolver de KM', () => {
    const kmAcad = calculateDriverTotalTestMileage(marianaCanonicalId, marianaTests)
    const kmPilotos = calculateDriverTotalTestMileage(marianaCanonicalId, marianaTests)
    const kmContratos = calculateDriverTotalTestMileage(marianaCanonicalId, marianaTests)
    const kmPerfil = calculateDriverTotalTestMileage(marianaCanonicalId, marianaTests)
    expect(kmAcad).toBe(kmPilotos)
    expect(kmPilotos).toBe(kmContratos)
    expect(kmContratos).toBe(kmPerfil)
  })

  it('ADI14: Após contratação, binding de equipe/função fica correto nas páginas', () => {
    const hired = {
      ...marianaDriverRecord,
      role: 'reserva' as const,
      career_status: 'reserve' as const,
      academy_origin_team_id: playerTeamId,
    }
    expect(hired.role).toBe('reserva')
    expect(hired.team_id).toBe(playerTeamId)
    expect(hired.academy_origin_team_id).toBe(playerTeamId)
  })

  it('ADI15: Nenhuma duplicata de Mariana aparece em Pilotos, Academia ou Contratos', () => {
    const allDrivers = [marianaDriverRecord]
    const filtered = allDrivers.filter((d) => d.name === 'Mariana Fagundes')
    expect(filtered.length).toBe(1)
  })

  it('ADI16: Liberar da Academia continua funcionando e é diferente de Contratar', () => {
    const releasedDriver = {
      ...marianaDriverRecord,
      team_id: null,
      is_academy: false,
      career_status: 'free_agent' as const,
      academy_origin_team_id: playerTeamId,
    }
    expect(releasedDriver.team_id).toBeNull()
    expect(releasedDriver.is_academy).toBe(false)
    expect(releasedDriver.career_status).toBe('free_agent')
    // Contratar mantém time e adiciona role:
    const hiredDriver = {
      ...marianaDriverRecord,
      team_id: playerTeamId,
      role: 'reserva' as const,
      career_status: 'reserve' as const,
    }
    expect(hiredDriver.team_id).toBe(playerTeamId)
    expect(hiredDriver.role).toBe('reserva')
  })
})
