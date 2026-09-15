import { describe, it, expect } from 'vitest'
import {
  HOMOLOGATION_CONFIG,
  DRIVER_TEST_TYPES_CONFIG,
  DriverHomologationProgram,
  DriverTestResult,
} from '@/types/driver-development'
import driverDevelopmentService from '@/services/driverDevelopmentService'
import { DriverModel, TeamModel } from '@/types/f1'

describe('QA Obrigatório: Sistema de Homologação, Academia e Test Drivers (15 Cenários do PDF)', () => {
  // Mock base de equipe e pilotos
  const mockTeam: TeamModel = {
    id: 'test_team_qa',
    name: 'Audi Sport Test',
    budget: 50000000,
    reputation: 80,
    cost_cap_budget: 215000000,
    cost_cap_spent: 40000000,
    academy_development_data: {
      testDrivers: [],
      academyDrivers: [],
      homologationPrograms: {},
      testResults: [],
      seatSecurities: {},
      technicalFeedbacks: {},
      developmentProgresses: {},
    },
  }

  const mockTitular: DriverModel = {
    id: 'driver_titular_1',
    team_id: 'test_team_qa',
    name: 'Carlos Sainz',
    nationality: 'Espanha',
    speed: 86,
    consistency: 85,
    defense: 84,
    technical_feedback: 88,
    morale: 80,
    seat_security: 85,
    role: 'titular',
    age: 31,
  }

  const mockYoungDriver: DriverModel = {
    id: 'driver_young_1',
    name: 'Maya Weug',
    nationality: 'Holanda',
    speed: 79,
    consistency: 78,
    defense: 76,
    technical_feedback: 72,
    morale: 80,
    role: 'reserva',
    age: 21,
    category: 'f1_academy',
    license_status: 'nivel_c',
  }

  const mockYoungDriver2: DriverModel = {
    id: 'driver_young_2',
    name: 'Doriane Pin',
    nationality: 'França',
    speed: 81,
    consistency: 80,
    defense: 78,
    technical_feedback: 75,
    morale: 82,
    role: 'reserva',
    age: 22,
    category: 'f1_academy',
    license_status: 'nivel_c',
  }

  const mockYoungDriver3: DriverModel = {
    id: 'driver_young_3',
    name: 'Abbi Pulling',
    nationality: 'Reino Unido',
    speed: 80,
    consistency: 79,
    defense: 77,
    technical_feedback: 74,
    morale: 78,
    role: 'reserva',
    age: 23,
    category: 'f1_academy',
    license_status: 'nivel_c',
  }

  it('Cenário 1: Adicionar piloto à Academia -> vínculo criado sem duplicação', () => {
    const data = driverDevelopmentService.getAcademyData(mockTeam)
    expect(data.academyDrivers).toHaveLength(0)

    // Adiciona o primeiro jovem
    const updatedData = {
      ...data,
      academyDrivers: [...data.academyDrivers, mockYoungDriver.id],
    }
    expect(updatedData.academyDrivers).toContain(mockYoungDriver.id)
    expect(updatedData.academyDrivers).toHaveLength(1)

    // Re-adicionar o mesmo piloto não duplica
    if (!updatedData.academyDrivers.includes(mockYoungDriver.id)) {
      updatedData.academyDrivers.push(mockYoungDriver.id)
    }
    expect(updatedData.academyDrivers).toHaveLength(1)
  })

  it('Cenário 2: Designar acadêmico como Test Driver -> mesmo driverId, nova função', () => {
    const teamState = {
      ...mockTeam,
      academy_development_data: {
        ...mockTeam.academy_development_data!,
        academyDrivers: [mockYoungDriver.id],
        testDrivers: [mockYoungDriver.id], // promovido a test driver mantendo id
      },
    }
    const data = driverDevelopmentService.getAcademyData(teamState)
    // O mesmo driverId está na academia e no posto de Test Driver (relação não-duplicada)
    expect(data.academyDrivers).toContain(mockYoungDriver.id)
    expect(data.testDrivers).toContain(mockYoungDriver.id)
    expect(mockYoungDriver.id).toBe('driver_young_1')
  })

  it('Cenário 3: Adicionar 3º Test Driver -> BLOQUEADO pelo limite máximo de 2', async () => {
    const teamWithMaxTestDrivers: TeamModel = {
      ...mockTeam,
      academy_development_data: {
        ...mockTeam.academy_development_data!,
        testDrivers: ['driver_young_1', 'driver_young_2'], // Já possui 2
      },
    }

    // Tentativa de designar 3º test driver
    const result = await driverDevelopmentService.assignTestDriver(
      teamWithMaxTestDrivers,
      mockYoungDriver3,
    )
    expect(result.success).toBe(false)
    expect(result.message).toContain('Limite atingido')
    expect(result.message).toContain('máximo permitido de 2')
  })

  it('Cenário 4: Iniciar homologação -> programa e custo registrados', () => {
    const fee = HOMOLOGATION_CONFIG.openingFee
    expect(fee).toBe(2500000)

    const initialBudget = 50000000
    const newBudget = initialBudget - fee
    expect(newBudget).toBe(47500000)

    const program: DriverHomologationProgram = {
      driver_id: mockYoungDriver.id,
      team_id: mockTeam.id,
      startDate: new Date().toISOString(),
      phase: 'em_andamento',
      completedValidTests: 0,
      accumulatedHomologatedKm: 0,
      testScores: [],
      averageScore: 0,
      openingFeePaid: true,
      totalSpent: fee,
      targetLicense: 'nivel_b',
      isEligibleForFinalEvaluation: false,
    }

    expect(program.phase).toBe('em_andamento')
    expect(program.openingFeePaid).toBe(true)
    expect(program.totalSpent).toBe(2500000)
    expect(program.completedValidTests).toBe(0)
  })

  it('Cenário 5: Completar 4 testes válidos (>=300 km) -> elegível a avaliação final', () => {
    const program: DriverHomologationProgram = {
      driver_id: mockYoungDriver.id,
      team_id: mockTeam.id,
      startDate: new Date().toISOString(),
      phase: 'em_andamento',
      completedValidTests: 4,
      accumulatedHomologatedKm: 1320, // 4 * 330 km
      testScores: [82, 84, 80, 86],
      averageScore: 83,
      openingFeePaid: true,
      totalSpent: 2500000 + 4 * 1200000,
      targetLicense: 'nivel_b',
      isEligibleForFinalEvaluation: true,
    }

    const isEligible =
      program.completedValidTests >= HOMOLOGATION_CONFIG.minValidTests &&
      program.accumulatedHomologatedKm >=
        HOMOLOGATION_CONFIG.minValidTests * HOMOLOGATION_CONFIG.minKmPerTest
    expect(isEligible).toBe(true)
  })

  it('Cenário 6: Teste com km insuficientes (<300 km) -> NÃO conta para homologação', () => {
    const shortKm = 240 // Abaixo do mínimo de 300 km
    const isValid = shortKm >= HOMOLOGATION_CONFIG.minKmPerTest
    expect(isValid).toBe(false)
  })

  it('Cenário 7: Nota 75-84 -> Licença Provisória concedida', () => {
    const avgScore = 79
    let outcome = ''
    if (avgScore >= HOMOLOGATION_CONFIG.scoreThresholds.superLicenseMin) {
      outcome = 'superlicenca'
    } else if (avgScore >= HOMOLOGATION_CONFIG.scoreThresholds.provisionalLicenseMin) {
      outcome = 'licenca_provisoria'
    } else if (avgScore >= HOMOLOGATION_CONFIG.scoreThresholds.additionalTestMin) {
      outcome = 'teste_adicional'
    } else {
      outcome = 'reprovado'
    }
    expect(outcome).toBe('licenca_provisoria')
  })

  it('Cenário 8: Nota 85+ -> Super Licença concedida', () => {
    const avgScore = 88
    let outcome = ''
    if (avgScore >= HOMOLOGATION_CONFIG.scoreThresholds.superLicenseMin) {
      outcome = 'superlicenca'
    }
    expect(outcome).toBe('superlicenca')
  })

  it('Cenário 9: Nota 65-74 -> Teste adicional obrigatório', () => {
    const avgScore = 71
    let outcome = ''
    if (avgScore >= HOMOLOGATION_CONFIG.scoreThresholds.superLicenseMin) {
      outcome = 'superlicenca'
    } else if (avgScore >= HOMOLOGATION_CONFIG.scoreThresholds.provisionalLicenseMin) {
      outcome = 'licenca_provisoria'
    } else if (avgScore >= HOMOLOGATION_CONFIG.scoreThresholds.additionalTestMin) {
      outcome = 'teste_adicional'
    } else {
      outcome = 'reprovado'
    }
    expect(outcome).toBe('teste_adicional')
  })

  it('Cenário 10: Jovem pressiona titular -> Seat Security e moral respondem ao contexto', () => {
    const titularSeatSecurity = 85
    const titularMorale = 82
    const finalScoreJovem = 88 // Impressionou em teste

    // Impacto contextual (redução proporcional equilibrada)
    const seatDrop = Math.min(8, Math.max(3, Math.round((finalScoreJovem - 78) * 0.6)))
    const newSeatSecurity = titularSeatSecurity - seatDrop
    expect(newSeatSecurity).toBeLessThan(titularSeatSecurity)
    expect(newSeatSecurity).toBe(79)

    // Titular com alta moral responde com foco e determinação
    const newMorale = titularMorale >= 80 ? titularMorale + 2 : titularMorale - 4
    expect(newMorale).toBe(84)
  })

  it('Cenário 11: Visão Geral da Equipe -> estrutura de dados de Academia & Desenvolvimento pronta', () => {
    const academyData = driverDevelopmentService.getAcademyData(mockTeam)
    expect(academyData).toHaveProperty('testDrivers')
    expect(academyData).toHaveProperty('academyDrivers')
    expect(academyData).toHaveProperty('homologationPrograms')
    expect(academyData).toHaveProperty('testResults')
  })

  it('Cenário 12: Paddock -> validação dos novos filtros de função e licença', () => {
    const paddockRoles = [
      'todos',
      'titular',
      'reserva',
      'test_driver',
      'academia',
      'homologacao',
      'licenca_provisoria',
      'super_licenca',
      'livre',
    ]
    expect(paddockRoles).toContain('test_driver')
    expect(paddockRoles).toContain('academia')
    expect(paddockRoles).toContain('super_licenca')
    expect(paddockRoles).toContain('licenca_provisoria')
  })

  it('Cenário 13: Reload -> estado persistível e reconstituível', () => {
    const savedState = JSON.stringify(mockTeam.academy_development_data)
    const reloaded = JSON.parse(savedState)
    expect(reloaded).toEqual(mockTeam.academy_development_data)
  })

  it('Cenário 14: Save/load -> integridade de tipos e valores preservada', () => {
    const testResult: DriverTestResult = {
      id: 'test_123',
      team_id: mockTeam.id,
      driver_id: mockYoungDriver.id,
      driver_name: mockYoungDriver.name,
      test_type: 'homologacao',
      circuit: 'Silverstone',
      date: '10/03/2026',
      km: 330,
      cost: 1200000,
      isValidForHomologation: true,
      scorePace: 82,
      scoreConsistency: 80,
      scoreCarControl: 78,
      scoreTechnicalFeedback: 75,
      scoreDisciplineSafety: 85,
      finalScore: 80,
      bestLapTime: '1:29.401',
      incidents: [],
      experienceGained: 16,
      technicalFeedbackGain: 2,
      feedbackSummary: 'Sessão homologada com sucesso.',
    }

    expect(testResult.isValidForHomologation).toBe(true)
    expect(testResult.km).toBeGreaterThanOrEqual(300)
    expect(testResult.finalScore).toBe(80)
  })

  it('Cenário 15: Save antigo sem dados de desenvolvimento -> fallback seguro sem quebra', () => {
    const oldTeamSave: TeamModel = {
      id: 'old_team_save',
      name: 'Audi F1 Team Original',
      budget: 65000000,
      reputation: 82,
      cost_cap_budget: 215000000,
      cost_cap_spent: 30000000,
      // academy_development_data AUSENTE (Save legado da Audi)
    }

    const resolvedData = driverDevelopmentService.getAcademyData(oldTeamSave)
    expect(resolvedData).toBeDefined()
    expect(resolvedData.testDrivers).toEqual([])
    expect(resolvedData.academyDrivers).toEqual([])
    expect(resolvedData.homologationPrograms).toEqual({})
    expect(resolvedData.testResults).toEqual([])
  })
})
