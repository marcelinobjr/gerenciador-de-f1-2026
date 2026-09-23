import { describe, it, expect, beforeEach } from 'vitest'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import {
  CANONICAL_DRIVERS_MASTER,
  getCanonicalDriverMaster,
  CANONICAL_DRIVER_ID_TO_ASSET_ID,
  resolveCanonicalDriverId,
  auditDriverPerformanceSource,
} from '@/lib/canonical-driver-database'
import { driverBase2026Service } from '@/services/driverBase2026Service'

describe('BUG-06: Unificação Canônica dos Ratings de Performance dos Pilotos', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // BUG6-01: engine usa MBJ_2026_PILOTS com ratings corrigidos
  it('BUG6-01: engine usa MBJ_2026_PILOTS com ratings canônicos atualizados', () => {
    const sainz = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-014')
    const albon = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-013')
    const perez = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-021')
    const bottas = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-022')

    expect(sainz).toBeDefined()
    expect(albon).toBeDefined()
    expect(perez).toBeDefined()
    expect(bottas).toBeDefined()

    // Ratings não inflados
    expect(sainz?.speed).toBe(86)
    expect(sainz?.consistency).toBe(85)
    expect(sainz?.defense).toBe(83)

    expect(albon?.speed).toBe(83)
    expect(albon?.consistency).toBe(82)
    expect(albon?.defense).toBe(80)

    expect(perez?.speed).toBe(79)
    expect(perez?.consistency).toBe(80)
    expect(perez?.defense).toBe(80)

    expect(bottas?.speed).toBe(79)
    expect(bottas?.consistency).toBe(81)
    expect(bottas?.defense).toBe(78)
  })

  // BUG6-02: Sainz resolve para valores canônicos (86/85/83)
  it('BUG6-02: Sainz resolve para valores canônicos (86/85/83)', () => {
    const master = getCanonicalDriverMaster('mbj-014')
    expect(master).not.toBeNull()
    expect(master?.fullName).toBe('Carlos Sainz Jr')
    expect(master?.ratings.speed).toBe(86)
    expect(master?.ratings.consistency).toBe(85)
    expect(master?.ratings.defense).toBe(83)
    expect(master?.ratings.rain).toBe(82)
  })

  // BUG6-03: Albon resolve para canônico (83/82/80)
  it('BUG6-03: Albon resolve para canônico (83/82/80)', () => {
    const master = getCanonicalDriverMaster('mbj-013')
    expect(master).not.toBeNull()
    expect(master?.fullName).toBe('Alexander Albon')
    expect(master?.ratings.speed).toBe(83)
    expect(master?.ratings.consistency).toBe(82)
    expect(master?.ratings.defense).toBe(80)
    expect(master?.ratings.rain).toBe(79)
  })

  // BUG6-04: Pérez resolve para canônico (79/80/80)
  it('BUG6-04: Pérez resolve para canônico (79/80/80)', () => {
    const master = getCanonicalDriverMaster('mbj-021')
    expect(master).not.toBeNull()
    expect(master?.fullName).toBe('Sergio Pérez')
    expect(master?.ratings.speed).toBe(79)
    expect(master?.ratings.consistency).toBe(80)
    expect(master?.ratings.defense).toBe(80)
    expect(master?.ratings.rain).toBe(78)
  })

  // BUG6-05: Bottas resolve para canônico (79/81/78)
  it('BUG6-05: Bottas resolve para canônico (79/81/78)', () => {
    const master = getCanonicalDriverMaster('mbj-022')
    expect(master).not.toBeNull()
    expect(master?.fullName).toBe('Valtteri Bottas')
    expect(master?.ratings.speed).toBe(79)
    expect(master?.ratings.consistency).toBe(81)
    expect(master?.ratings.defense).toBe(78)
    expect(master?.ratings.rain).toBe(78)
  })

  // BUG6-06: alias de Sainz aponta para mbj-014
  it('BUG6-06: alias de Sainz aponta para mbj-014 e não para mbj-007', () => {
    const dummyGrid = [
      { driverId: 'mbj-007', driverName: 'George Russell', position: 3 },
      { driverId: 'mbj-014', driverName: 'Carlos Sainz', position: 7 },
    ]

    // Resolver por alias 'sainz' deve retornar mbj-014
    const resolved = resolveCanonicalDriverId('sainz', dummyGrid)
    expect(resolved).not.toBeNull()
    expect(resolved?.driverId).toBe('mbj-014')
    expect(resolved?.driverName).toBe('Carlos Sainz')

    // Resolver por driver_carlos_sainz
    const resolvedFull = resolveCanonicalDriverId('driver_carlos_sainz', dummyGrid)
    expect(resolvedFull?.driverId).toBe('mbj-014')
  })

  // BUG6-07: mbj-007 continua associado a George Russell
  it('BUG6-07: mbj-007 continua associado a George Russell', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-007']).toBe('DRV_0007')
    const masterRussell = getCanonicalDriverMaster('mbj-007')
    expect(masterRussell).not.toBeNull()
    expect(masterRussell?.fullName).toBe('George Russell')

    const dummyGrid = [
      { driverId: 'mbj-007', driverName: 'George Russell', position: 2 },
      { driverId: 'mbj-014', driverName: 'Carlos Sainz', position: 8 },
    ]
    const resolvedRussell = resolveCanonicalDriverId('mbj-007', dummyGrid)
    expect(resolvedRussell?.driverName).toBe('George Russell')
  })

  // BUG6-08: auditDriverPerformanceSource retorna estado limpo
  it('BUG6-08: auditDriverPerformanceSource retorna estado limpo (0 duplicates, 0 conflicts, 0 unresolved)', () => {
    const report = auditDriverPerformanceSource()
    expect(report.isValid).toBe(true)
    expect(report.effectiveSource).toBe('MBJ_2026_PILOTS')
    expect(report.duplicateDriverIds).toBe(0)
    expect(report.conflictingOverrides).toBe(0)
    expect(report.unresolvedIdentities).toBe(0)
    expect(report.engineResolvesToCanonical).toBe(true)
    expect(report.errors).toHaveLength(0)
  })

  // BUG6-09: initializeCareerDrivers persiste os ratings corrigidos (novas carreiras nascem canônicas)
  it('BUG6-09: initializeCareerDrivers persiste os ratings corrigidos em novas carreiras', () => {
    const careerId = 'career_test_bug06'
    const drivers = driverBase2026Service.initializeCareerDrivers({
      careerId,
      playerTeamId: 'williams',
    })

    const sainz = drivers['mbj-014']
    const albon = drivers['mbj-013']
    const perez = drivers['mbj-021']
    const bottas = drivers['mbj-022']

    expect(sainz.ratings.speed).toBe(86)
    expect(sainz.ratings.consistency).toBe(85)
    expect(sainz.ratings.defense).toBe(83)

    expect(albon.ratings.speed).toBe(83)
    expect(albon.ratings.consistency).toBe(82)
    expect(albon.ratings.defense).toBe(80)

    expect(perez.ratings.speed).toBe(79)
    expect(perez.ratings.consistency).toBe(80)
    expect(perez.ratings.defense).toBe(80)

    expect(bottas.ratings.speed).toBe(79)
    expect(bottas.ratings.consistency).toBe(81)
    expect(bottas.ratings.defense).toBe(78)

    // Confirma persistência lida do storage
    const reloaded = driverBase2026Service.getCareerDrivers(careerId)
    expect(reloaded).not.toBeNull()
    expect(reloaded?.['mbj-014'].ratings.speed).toBe(86)
    expect(reloaded?.['mbj-013'].ratings.speed).toBe(83)
  })

  // BUG6-10: moral/confiança/estado temporário não alteram o rating-base persistido
  it('BUG6-10: moral/confiança/estado temporário não alteram o rating-base persistido e reconciliação respeita evolução', () => {
    const careerId = 'career_test_progression'
    const drivers = driverBase2026Service.initializeCareerDrivers({
      careerId,
      playerTeamId: 'cadillac',
    })

    // Modifica apenas moral / condição física
    drivers['mbj-014'].morale = 60
    drivers['mbj-014'].physicalCondition = 80
    driverBase2026Service.saveCareerDrivers(careerId, drivers)

    const fetched = driverBase2026Service.getCareerDriver(careerId, 'mbj-014')
    expect(fetched?.morale).toBe(60)
    expect(fetched?.physicalCondition).toBe(80)
    // Ratings base permanecem os canônicos intocados
    expect(fetched?.ratings.speed).toBe(86)
    expect(fetched?.ratings.consistency).toBe(85)

    // Testar que reconciliação de save existente migra baseline legado mas NÃO sobrescreve se houver evolução legítima
    const legacyCareerId = 'career_legacy_save'
    const legacyDrivers = driverBase2026Service.initializeCareerDrivers({
      careerId: legacyCareerId,
      playerTeamId: 'williams',
    })
    // Forçar baseline legado inflado em Sainz (92/93/94)
    legacyDrivers['mbj-014'].ratings.speed = 92
    legacyDrivers['mbj-014'].ratings.consistency = 93
    legacyDrivers['mbj-014'].ratings.defense = 94

    // E piloto Pérez com evolução legítima após temporada (ex: 81 em vez do legado 88)
    legacyDrivers['mbj-021'].ratings.speed = 81
    legacyDrivers['mbj-021'].ratings.consistency = 82
    legacyDrivers['mbj-021'].ratings.defense = 82

    driverBase2026Service.saveCareerDrivers(legacyCareerId, legacyDrivers)

    // Reconcilia
    const recReport = driverBase2026Service.reconcileLegacyDriverRatings(legacyCareerId)
    expect(recReport.reconciled).toBe(true)
    expect(recReport.updatedDrivers).toContain('mbj-014')
    expect(recReport.updatedDrivers).not.toContain('mbj-021')

    const reloadedLegacy = driverBase2026Service.getCareerDrivers(legacyCareerId)
    // Sainz foi alinhado ao canônico
    expect(reloadedLegacy?.['mbj-014'].ratings.speed).toBe(86)
    expect(reloadedLegacy?.['mbj-014'].ratings.consistency).toBe(85)
    expect(reloadedLegacy?.['mbj-014'].ratings.defense).toBe(83)
    // Pérez manteve sua evolução de carreira (81/82/82)
    expect(reloadedLegacy?.['mbj-021'].ratings.speed).toBe(81)
    expect(reloadedLegacy?.['mbj-021'].ratings.consistency).toBe(82)
  })
})
