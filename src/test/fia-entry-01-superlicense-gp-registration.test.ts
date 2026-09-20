import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalHomologationAdapter } from '@/lib/canonical-adapters'
import { canonicalEventRegistrationService } from '@/services/canonicalEventRegistrationService'
import { ALL_GRID_TEAMS_DATABASE } from '@/lib/grid-teams-database'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import type { DriverModel, TeamModel } from '@/types/f1'

describe('MICRO-PATCH FIA-ENTRY-01: Suíte S1–S12 Superlicença FIA e Inscrição de GP', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // Mock Audi Team
  const mockAudiTeam: TeamModel = {
    id: 'team_audi_2026',
    name: 'Audi Revolut F1 Team',
    short_name: 'Audi',
    color: '#E10600',
    engine_supplier: 'Audi',
    strength: 78,
  } as any

  // S1: Todos os titulares oficiais 2026 com license_status 'nivel_a'
  it('S1: todos os pilotos titulares canônicos de F1 2026 recebem license_status nivel_a e elegibilidade plena', () => {
    // Pegar pilotos titulares do grid oficial
    const officialDrivers: Partial<DriverModel>[] = [
      {
        id: 'mbj-001',
        name: 'Max Verstappen',
        role: 'titular',
        category: 'f1',
        license_status: 'nivel_a',
      },
      { id: 'mbj-002', name: 'Liam Lawson', role: 'titular', category: 'f1' }, // sem status prévio
      {
        id: 'mbj-019',
        name: 'Nico Hülkenberg',
        role: 'titular',
        category: 'f1',
        license_status: 'nivel_c',
      }, // cenário de correção do bug
      { id: 'mbj-020', name: 'Gabriel Bortoleto', role: 'titular', category: 'f1' },
      { id: 'mbj-007', name: 'Lewis Hamilton', role: 'titular', category: 'f1' },
      { id: 'mbj-008', name: 'Charles Leclerc', role: 'titular', category: 'f1' },
    ]

    officialDrivers.forEach((driver) => {
      const canonicalView = canonicalHomologationAdapter.toCanonicalView(driver as DriverModel)
      expect(canonicalView.licenseStatus).toBe('nivel_a')
      expect(canonicalView.isEligibleForF1Seat).toBe(true)
    })
  })

  // S2: Normalização idempotente (2 execuções = mesmo estado)
  it('S2: normalização idempotente (2 execuções geram exatamente o mesmo estado canônico)', () => {
    const rawDriver: Partial<DriverModel> = {
      id: '0mow8vmzk0y4z9s',
      name: 'Nico Hülkenberg',
      role: 'titular',
      category: 'f1',
      license_status: 'nivel_c',
      superlicense_points: 30,
    }

    const run1 = canonicalHomologationAdapter.toCanonicalView(rawDriver as DriverModel)
    const run2 = canonicalHomologationAdapter.toCanonicalView(rawDriver as DriverModel)

    expect(run1).toEqual(run2)
    expect(run1.licenseStatus).toBe('nivel_a')
    expect(run1.isEligibleForF1Seat).toBe(true)
    expect(run1.legacyHomologationStatus).toBe('elegivel')
  })

  // S3: Academia sem Licença A continua inelegível
  it('S3: piloto de academia sem Licença A permanece inelegível para assento de GP', () => {
    const academyDriver: Partial<DriverModel> = {
      id: 'acad_01',
      name: 'Jovem Piloto Academia',
      role: 'reserva',
      category: 'f2',
      is_academy: true,
      license_status: 'nivel_c',
      superlicense_points: 15,
      team_id: 'team_audi_2026',
    }

    const view = canonicalHomologationAdapter.toCanonicalView(academyDriver as DriverModel)
    expect(view.licenseStatus).toBe('nivel_c')
    expect(view.isEligibleForF1Seat).toBe(false)
  })

  // S4: Reserva sem Licença A bloqueado para o GP
  it('S4: piloto reserva sem Licença A (apenas nível B ou C) é bloqueado para inscrição no GP', () => {
    const reserveDriverWithoutA: Partial<DriverModel> = {
      id: 'res_01',
      name: 'Piloto Reserva Nível B',
      role: 'reserva',
      category: 'f1',
      license_status: 'nivel_b',
      superlicense_points: 28,
      reserve_team_id: 'team_audi_2026',
    }

    const view = canonicalHomologationAdapter.toCanonicalView(reserveDriverWithoutA as DriverModel)
    expect(view.licenseStatus).toBe('nivel_b')
    expect(view.isEligibleForF1Seat).toBe(false)

    // Tentativa de validar inscrição com esse reserva
    const validation = canonicalEventRegistrationService.validateRegistrationEntries({
      car1Driver: {
        id: 'mbj-019',
        name: 'Nico Hülkenberg',
        role: 'titular',
        category: 'f1',
      } as DriverModel,
      car2Driver: reserveDriverWithoutA as DriverModel,
      playerTeam: mockAudiTeam,
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors.some((e) => e.includes('Licença A / Superlicença FIA'))).toBe(true)
  })

  // S5: Reserva com Licença A pode ser escalado
  it('S5: piloto reserva portador de Licença A pode ser validado e inscrito no GP', () => {
    const reserveWithLicenseA: Partial<DriverModel> = {
      id: 'res_super',
      name: 'Reserva Experiente',
      role: 'reserva',
      category: 'f1',
      license_status: 'nivel_a',
      superlicense_points: 40,
      reserve_team_id: 'team_audi_2026',
    }

    const titular1: Partial<DriverModel> = {
      id: 'mbj-019',
      name: 'Nico Hülkenberg',
      role: 'titular',
      category: 'f1',
      license_status: 'nivel_a',
      team_id: 'team_audi_2026',
    }

    const validation = canonicalEventRegistrationService.validateRegistrationEntries({
      car1Driver: titular1 as DriverModel,
      car2Driver: reserveWithLicenseA as DriverModel,
      playerTeam: mockAudiTeam,
    })

    expect(validation.valid).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })

  // S6: Dois titulares elegíveis pré-selecionados
  it('S6: dois titulares oficiais elegíveis formam uma inscrição perfeitamente válida', () => {
    const hulkenberg: Partial<DriverModel> = {
      id: 'mbj-019',
      name: 'Nico Hülkenberg',
      role: 'titular',
      category: 'f1',
      team_id: 'team_audi_2026',
    }
    const bortoleto: Partial<DriverModel> = {
      id: 'mbj-020',
      name: 'Gabriel Bortoleto',
      role: 'titular',
      category: 'f1',
      team_id: 'team_audi_2026',
    }

    const validation = canonicalEventRegistrationService.validateRegistrationEntries({
      car1Driver: hulkenberg as DriverModel,
      car2Driver: bortoleto as DriverModel,
      playerTeam: mockAudiTeam,
    })

    expect(validation.valid).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })

  // S7: Snapshot só nasce após confirmação
  it('S7: snapshot de inscrição não existe antes da confirmação explícita', () => {
    const seasonId = 'season_2026_test'
    const round = 1

    expect(canonicalEventRegistrationService.readRegistrationSnapshot(seasonId, round)).toBeNull()

    // Resolução sem persistência / com snapshot inexistente
    const teamDrivers: DriverModel[] = [
      {
        id: 'mbj-019',
        name: 'Nico Hülkenberg',
        role: 'titular',
        category: 'f1',
        team_id: mockAudiTeam.id,
      } as any,
      {
        id: 'mbj-020',
        name: 'Gabriel Bortoleto',
        role: 'titular',
        category: 'f1',
        team_id: mockAudiTeam.id,
      } as any,
    ]

    // Confirmar inscrição explicitamente via playerSeatOverrides
    const result = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId,
      round,
      gpName: 'GP do Bahrein',
      playerTeam: mockAudiTeam,
      allDrivers: teamDrivers,
      playerSeatOverrides: {
        car1DriverId: 'mbj-019',
        car2DriverId: 'mbj-020',
      },
    })

    expect(result.valid).toBe(true)
    expect(result.snapshot).not.toBeNull()

    // Agora o snapshot deve existir no storage
    const storedSnapshot = canonicalEventRegistrationService.readRegistrationSnapshot(
      seasonId,
      round,
    )
    expect(storedSnapshot).not.toBeNull()
    expect(storedSnapshot?.entriesByCar.playerCar1.driverId).toBe('mbj-019')
    expect(storedSnapshot?.entriesByCar.playerCar2.driverId).toBe('mbj-020')
  })

  // S8: Mesmo piloto nos dois carros é bloqueado
  it('S8: escalar o mesmo piloto em ambos os carros da equipe é terminantemente bloqueado', () => {
    const hulkenberg: Partial<DriverModel> = {
      id: 'mbj-019',
      name: 'Nico Hülkenberg',
      role: 'titular',
      category: 'f1',
    }

    const validation = canonicalEventRegistrationService.validateRegistrationEntries({
      car1Driver: hulkenberg as DriverModel,
      car2Driver: hulkenberg as DriverModel,
      playerTeam: mockAudiTeam,
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors.some((e) => e.includes('mesmo piloto'))).toBe(true)
  })

  // S9: Titular indisponível -> substituto com Licença A ocupa o assento
  it('S9: quando titular está incapacitado/lesionado, substituto com Licença A é aceito', () => {
    const injuredTitular: Partial<DriverModel> = {
      id: 'mbj-019',
      name: 'Nico Hülkenberg',
      role: 'titular',
      category: 'f1',
      is_incapacitated: true,
      incapacitated_rounds_left: 1,
      incapacitated_reason: 'Fratura de punho',
    }
    const healthyTitular: Partial<DriverModel> = {
      id: 'mbj-020',
      name: 'Gabriel Bortoleto',
      role: 'titular',
      category: 'f1',
    }
    const eligibleReserve: Partial<DriverModel> = {
      id: 'res_paul',
      name: 'Paul Aron',
      role: 'reserva',
      category: 'f1',
      license_status: 'nivel_a',
    }

    // 1. Tentar inscrever o titular machucado falha
    const valWithInjured = canonicalEventRegistrationService.validateRegistrationEntries({
      car1Driver: injuredTitular as DriverModel,
      car2Driver: healthyTitular as DriverModel,
      playerTeam: mockAudiTeam,
    })
    expect(valWithInjured.valid).toBe(false)
    expect(valWithInjured.errors.some((e) => e.includes('indisponível'))).toBe(true)

    // 2. Substituir pelo reserva com Licença A é aprovado
    const valWithSubstitute = canonicalEventRegistrationService.validateRegistrationEntries({
      car1Driver: eligibleReserve as DriverModel,
      car2Driver: healthyTitular as DriverModel,
      playerTeam: mockAudiTeam,
    })
    expect(valWithSubstitute.valid).toBe(true)
    expect(valWithSubstitute.errors).toHaveLength(0)
  })

  // S10: Piloto sem Licença A não pode ser confirmado
  it('S10: piloto sem Licença A é impedido de confirmação', () => {
    const unlicencedDriver: Partial<DriverModel> = {
      id: 'novato_01',
      name: 'Novato sem Licença',
      role: 'reserva',
      category: 'f2',
      license_status: 'nivel_c',
    }
    const healthyTitular: Partial<DriverModel> = {
      id: 'mbj-020',
      name: 'Gabriel Bortoleto',
      role: 'titular',
      category: 'f1',
    }

    const val = canonicalEventRegistrationService.validateRegistrationEntries({
      car1Driver: unlicencedDriver as DriverModel,
      car2Driver: healthyTitular as DriverModel,
      playerTeam: mockAudiTeam,
    })
    expect(val.valid).toBe(false)
    expect(val.errors.some((e) => e.includes('Licença A / Superlicença FIA'))).toBe(true)
  })

  // S11: Snapshot final com 12 equipes / 24 driverIds únicos
  it('S11: snapshot do evento contém grid de 12 equipes com 24 pilotos inscritos', () => {
    const seasonId = 'season_2026_grid'
    const round = 1

    const teamDrivers: DriverModel[] = [
      {
        id: 'mbj-019',
        name: 'Nico Hülkenberg',
        role: 'titular',
        category: 'f1',
        team_id: mockAudiTeam.id,
      } as any,
      {
        id: 'mbj-020',
        name: 'Gabriel Bortoleto',
        role: 'titular',
        category: 'f1',
        team_id: mockAudiTeam.id,
      } as any,
    ]

    const reg = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId,
      round,
      gpName: 'GP da Austrália',
      playerTeam: mockAudiTeam,
      allDrivers: teamDrivers,
    })

    expect(reg.valid).toBe(true)
    expect(reg.snapshot).not.toBeNull()
    expect(reg.snapshot?.entries).toHaveLength(24)

    // Checar se não há driverIds nulos ou duplicados
    const driverIds = reg.snapshot?.entries.map((e) => e.driverId) || []
    const uniqueIds = new Set(driverIds)
    expect(uniqueIds.size).toBe(24)

    // Todos com licença A
    reg.snapshot?.entries.forEach((e) => {
      expect(e.licenseStatus).toBe('nivel_a')
    })
  })

  // S12: Reload consome snapshot persistido sem alteração de pilotos
  it('S12: recarregar consome o snapshot gravado e preserva os pilotos originais inscritos', () => {
    const seasonId = 'season_reload_test'
    const round = 2

    const teamDrivers: DriverModel[] = [
      {
        id: 'mbj-019',
        name: 'Nico Hülkenberg',
        role: 'titular',
        category: 'f1',
        team_id: mockAudiTeam.id,
      } as any,
      {
        id: 'mbj-020',
        name: 'Gabriel Bortoleto',
        role: 'titular',
        category: 'f1',
        team_id: mockAudiTeam.id,
      } as any,
    ]

    // 1. Criar e persistir o snapshot inicial
    const initialReg = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId,
      round,
      gpName: 'GP da Arábia Saudita',
      playerTeam: mockAudiTeam,
      allDrivers: teamDrivers,
    })
    expect(initialReg.valid).toBe(true)

    // 2. Simular nova chamada (como num reload de página) com allDrivers alterado/diferente
    const alteredDrivers: DriverModel[] = [
      {
        id: 'fake_01',
        name: 'Piloto Fake',
        role: 'titular',
        category: 'f1',
        team_id: mockAudiTeam.id,
      } as any,
    ]

    const reloadedReg = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId,
      round,
      gpName: 'GP da Arábia Saudita',
      playerTeam: mockAudiTeam,
      allDrivers: alteredDrivers, // Lista diferente
      forceRecalculate: false,
    })

    expect(reloadedReg.valid).toBe(true)
    // Pilotos devem continuar sendo os do snapshot gravado, não os de alteredDrivers!
    expect(reloadedReg.snapshot?.entriesByCar.playerCar1.driverId).toBe('mbj-019')
    expect(reloadedReg.snapshot?.entriesByCar.playerCar2.driverId).toBe('mbj-020')
  })

  // FIXTURE DO CASO AUDI (Hülkenberg + Bortoleto)
  it('Fixture do caso Audi: Hülkenberg e Bortoleto ambos elegíveis com Licença A e evento desbloqueado', () => {
    // Registro idêntico ao que estava no banco com license_status 'nivel_c'
    const hulkenbergDbRecord: Partial<DriverModel> = {
      id: '0mow8vmzk0y4z9s',
      name: 'Nico Hülkenberg',
      role: 'titular',
      category: 'f1',
      license_status: 'nivel_c',
      superlicense_points: 30,
      team_id: '2xi9j3xb4epwec9',
    }
    const bortoletoDbRecord: Partial<DriverModel> = {
      id: 'mbj-020',
      name: 'Gabriel Bortoleto',
      role: 'titular',
      category: 'f1',
      license_status: 'nivel_a',
      superlicense_points: 40,
      team_id: '2xi9j3xb4epwec9',
    }

    const viewHulk = canonicalHomologationAdapter.toCanonicalView(hulkenbergDbRecord as DriverModel)
    const viewBort = canonicalHomologationAdapter.toCanonicalView(bortoletoDbRecord as DriverModel)

    expect(viewHulk.licenseStatus).toBe('nivel_a')
    expect(viewHulk.isEligibleForF1Seat).toBe(true)

    expect(viewBort.licenseStatus).toBe('nivel_a')
    expect(viewBort.isEligibleForF1Seat).toBe(true)

    const registration = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId: 'season_audi_test',
      round: 1,
      gpName: 'GP do Bahrein',
      playerTeam: { id: '2xi9j3xb4epwec9', name: 'Audi Revolut F1 Team' } as TeamModel,
      allDrivers: [hulkenbergDbRecord as DriverModel, bortoletoDbRecord as DriverModel],
    })

    expect(registration.valid).toBe(true)
    expect(registration.errors).toHaveLength(0)
    expect(registration.snapshot?.entriesByCar.playerCar1.driverName).toBe('Nico Hülkenberg')
    expect(registration.snapshot?.entriesByCar.playerCar2.driverName).toBe('Gabriel Bortoleto')
  })
})
