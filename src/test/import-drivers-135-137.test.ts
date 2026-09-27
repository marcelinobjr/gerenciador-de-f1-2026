import { describe, it, expect } from 'vitest'
import { MBJ_2026_PILOTS, getDriverCareerStats } from '@/lib/mbj-drivers-data'
import {
  CANONICAL_DRIVERS_MASTER,
  CANONICAL_DRIVER_ID_TO_ASSET_ID,
  getCanonicalDriverMaster,
  getCanonicalAssetId,
  findCanonicalDriverMaster,
  findDuplicateDrivers,
} from '@/lib/canonical-driver-database'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { DRIVER_PORTRAIT_ASSET_MAP } from '@/lib/driver-portrait-map'
import { getDriverCareerBaseline2025 } from '@/data/driverCareerStats2025'

describe('IMPORT-DRIVERS-135-137: Homologação Mazepin, Kvyat e Bourdais', () => {
  // 1. Prova de unicidade 1/1/1 por nome e por alias
  it('garante unicidade estrita 1/1/1 por nome no catálogo MBJ_2026_PILOTS', () => {
    const mazepinList = MBJ_2026_PILOTS.filter((p) => p.name === 'Nikita Mazepin')
    const kvyatList = MBJ_2026_PILOTS.filter((p) => p.name === 'Daniil Kvyat')
    const bourdaisList = MBJ_2026_PILOTS.filter((p) => p.name === 'Sébastien Bourdais')

    expect(mazepinList).toHaveLength(1)
    expect(kvyatList).toHaveLength(1)
    expect(bourdaisList).toHaveLength(1)

    // Bourdais é mbj-128; mbj-137 é Kvyat e NUNCA Bourdais
    expect(bourdaisList[0].id).toBe('mbj-128')
    expect(mazepinList[0].id).toBe('mbj-136')
    expect(kvyatList[0].id).toBe('mbj-137')

    // findDuplicateDrivers retorna zero duplicatas para os 3
    const duplicates = findDuplicateDrivers(MBJ_2026_PILOTS)
    const dupsForTarget = duplicates.filter((d) =>
      ['nikitamazepin', 'daniilkvyat', 'sebastienbourdais'].includes(d.normalizedKey),
    )
    expect(dupsForTarget).toHaveLength(0)
  })

  // 2. Resolução por todos os 4 aliases de cada piloto
  it('garante resolução canônica via todos os 4 aliases de Mazepin, Kvyat e Bourdais', () => {
    const mazepinAliases = [
      'mazepin',
      'nikita_mazepin',
      'driver_nikita_mazepin',
      'drv_nikita_mazepin',
    ]
    for (const alias of mazepinAliases) {
      const found = findCanonicalDriverMaster(alias)
      expect(found).not.toBeNull()
      expect(found?.driverId).toBe('mbj-136')
      expect(found?.fullName).toBe('Nikita Mazepin')

      const baseline = getDriverCareerBaseline2025(alias)
      expect(baseline?.races).toBe(21)
    }

    const kvyatAliases = ['kvyat', 'daniil_kvyat', 'driver_daniil_kvyat', 'drv_daniil_kvyat']
    for (const alias of kvyatAliases) {
      const found = findCanonicalDriverMaster(alias)
      expect(found).not.toBeNull()
      expect(found?.driverId).toBe('mbj-137')
      expect(found?.fullName).toBe('Daniil Kvyat')

      const baseline = getDriverCareerBaseline2025(alias)
      expect(baseline?.races).toBe(110)
    }

    const bourdaisAliases = [
      'bourdais',
      'sebastien_bourdais',
      'driver_sebastien_bourdais',
      'drv_sebastien_bourdais',
    ]
    for (const alias of bourdaisAliases) {
      const found = findCanonicalDriverMaster(alias)
      expect(found).not.toBeNull()
      expect(found?.driverId).toBe('mbj-128')
      expect(found?.fullName).toBe('Sébastien Bourdais')

      const baseline = getDriverCareerBaseline2025(alias)
      expect(baseline?.races).toBe(27)
    }
  })

  // 3. Bourdais atualizado in place preservando id, vínculos e estatísticas
  it('Bourdais atualizado in place em mbj-128 preservando f1RacesCompleted: 27 e sem duplicata mbj-137', () => {
    const bourdais = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-128')
    expect(bourdais).toBeDefined()
    expect(bourdais?.name).toBe('Sébastien Bourdais')
    expect(bourdais?.f1RacesCompleted).toBe(27)
    expect(bourdais?.preferredNumber).toBeUndefined()
    expect(bourdais?.role).toBeUndefined()
    expect(bourdais?.teamKey).toBeUndefined()
    expect(bourdais?.salaryUsd).toBe(2000000)

    // Estatísticas canônicas de carreira
    const stats = getDriverCareerStats({ pilot: bourdais! })
    expect(stats.races).toBe(27)
    expect(stats.wins).toBe(0)
    expect(stats.poles).toBe(0)
    expect(stats.championships).toBe(0)

    // mbj-137 é Daniil Kvyat, nunca Bourdais
    const p137 = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-137')
    expect(p137?.name).toBe('Daniil Kvyat')
  })

  // 4. Competências e atributos literais das fichas materializados
  it('materializa atributos literais exatos das fichas para Mazepin, Kvyat e Bourdais', () => {
    const mazepin = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-136')!
    expect(mazepin.speed).toBe(70)
    expect(mazepin.consistency).toBe(63)
    expect(mazepin.feedback).toBe(69)
    expect(mazepin.qualifying).toBe(66)
    expect(mazepin.racePace).toBe(69)
    expect(mazepin.start).toBe(68)
    expect(mazepin.overtake).toBe(67)
    expect(mazepin.defense).toBe(65)
    expect(mazepin.rain).toBe(62)
    expect(mazepin.tireManagement).toBe(66)
    expect(mazepin.energyManagement).toBe(67)
    expect(mazepin.pressure).toBe(62)
    expect(mazepin.concentration).toBe(65)
    expect(mazepin.resilience).toBe(70)
    expect(mazepin.salaryUsd).toBe(500000)
    expect(mazepin.minSalaryUsd).toBe(350000)
    expect(mazepin.f1RacesCompleted).toBe(21)
    expect(mazepin.preferredNumber).toBe(9)

    const kvyat = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-137')!
    expect(kvyat.speed).toBe(81)
    expect(kvyat.consistency).toBe(77)
    expect(kvyat.feedback).toBe(85)
    expect(kvyat.qualifying).toBe(79)
    expect(kvyat.racePace).toBe(81)
    expect(kvyat.start).toBe(80)
    expect(kvyat.overtake).toBe(80)
    expect(kvyat.defense).toBe(78)
    expect(kvyat.rain).toBe(82)
    expect(kvyat.tireManagement).toBe(80)
    expect(kvyat.energyManagement).toBe(80)
    expect(kvyat.pressure).toBe(76)
    expect(kvyat.concentration).toBe(78)
    expect(kvyat.resilience).toBe(81)
    expect(kvyat.salaryUsd).toBe(2000000)
    expect(kvyat.minSalaryUsd).toBe(1400000)
    expect(kvyat.f1RacesCompleted).toBe(110)
    expect(kvyat.preferredNumber).toBe(26)

    const bourdais = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-128')!
    expect(bourdais.speed).toBe(78)
    expect(bourdais.consistency).toBe(89)
    expect(bourdais.feedback).toBe(96)
    expect(bourdais.qualifying).toBe(80)
    expect(bourdais.racePace).toBe(87)
    expect(bourdais.start).toBe(85)
    expect(bourdais.overtake).toBe(87)
    expect(bourdais.defense).toBe(88)
    expect(bourdais.rain).toBe(83)
    expect(bourdais.tireManagement).toBe(89)
    expect(bourdais.energyManagement).toBe(90)
    expect(bourdais.pressure).toBe(86)
    expect(bourdais.concentration).toBe(88)
    expect(bourdais.resilience).toBe(79)
    expect(bourdais.salaryUsd).toBe(2000000)
    expect(bourdais.minSalaryUsd).toBe(1400000)
    expect(bourdais.potentialMax).toBe(98)
    expect(bourdais.f1RacesCompleted).toBe(27)
  })

  // 5. Retratos resolvem via resolveDriverPhoto pelo caminho canônico
  it('retratos resolvem via resolveDriverPhoto para os 3 pilotos', () => {
    // Mazepin (DRV_0135)
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-136']).toBe('DRV_0135')
    expect(getCanonicalAssetId('mbj-136')).toBe('DRV_0135')
    expect(DRIVER_PORTRAIT_ASSET_MAP['drv_nikita_mazepin']).toBe('DRV_0135')
    const photoMazepin = resolveDriverPhoto({ driverId: 'mbj-136', name: 'Nikita Mazepin' })
    expect(photoMazepin.url).toBe('/pilotos/DRV_0135.jpg')
    expect(photoMazepin.assetId).toBe('DRV_0135')
    expect(photoMazepin.sourceType).toBe('canonical_real')

    // Kvyat (DRV_0136)
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-137']).toBe('DRV_0136')
    expect(getCanonicalAssetId('mbj-137')).toBe('DRV_0136')
    expect(DRIVER_PORTRAIT_ASSET_MAP['drv_daniil_kvyat']).toBe('DRV_0136')
    const photoKvyat = resolveDriverPhoto({ driverId: 'mbj-137', name: 'Daniil Kvyat' })
    expect(photoKvyat.url).toBe('/pilotos/DRV_0136.jpg')
    expect(photoKvyat.assetId).toBe('DRV_0136')
    expect(photoKvyat.sourceType).toBe('canonical_real')

    // Bourdais (mbj-128 -> DRV_0137)
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-128']).toBe('DRV_0137')
    expect(getCanonicalAssetId('mbj-128')).toBe('DRV_0137')
    expect(DRIVER_PORTRAIT_ASSET_MAP['drv_sebastien_bourdais']).toBe('DRV_0137')
    const photoBourdais = resolveDriverPhoto({ driverId: 'mbj-128', name: 'Sébastien Bourdais' })
    expect(photoBourdais.url).toBe('/pilotos/DRV_0137.jpg')
    expect(photoBourdais.assetId).toBe('DRV_0137')
    expect(photoBourdais.sourceType).toBe('canonical_real')
  })

  // 6. Sem equipe ou contrato inicial (LIVRE / RETORNO)
  it('nenhum dos 3 pilotos possui equipe ou contrato inicial', () => {
    const mazepin = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-136')!
    const kvyat = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-137')!
    const bourdais = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-128')!

    expect(mazepin.teamKey).toBeUndefined()
    expect(mazepin.contractYears).toBe(0)
    expect(kvyat.teamKey).toBeUndefined()
    expect(kvyat.contractYears).toBe(0)
    expect(bourdais.teamKey).toBeUndefined()
    expect(bourdais.contractYears).toBe(0)
  })
})
