import { describe, it, expect } from 'vitest'
import { MBJ_2026_PILOTS } from '../lib/mbj-drivers-data'
import {
  getCanonicalDriverMaster,
  findCanonicalDriverMaster,
} from '../lib/canonical-driver-database'
import { resolveDriverPhoto } from '../lib/driver-photo-resolver'
import { DRIVER_CAREER_STATS_2025 } from '../data/driverCareerStats2025'
import { DRIVER_PROVENANCE_135_137A } from '../data/driverProvenance135137a'

describe('IMPORT-DRIVERS-135-137 / 135-137A — Importação e Proveniência Canônica', () => {
  it('o catálogo canônico MBJ_2026_PILOTS deve conter exatamente 137 pilotos', () => {
    expect(MBJ_2026_PILOTS).toHaveLength(137)
    const uniqueIds = new Set(MBJ_2026_PILOTS.map((p) => p.id))
    expect(uniqueIds.size).toBe(137)
  })

  it('mbj-136 (Nikita Mazepin) deve estar cadastrado corretamente com preferredNumber 9', () => {
    const mazepin = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-136')
    expect(mazepin).toBeDefined()
    expect(mazepin?.name).toBe('Nikita Mazepin')
    expect(mazepin?.preferredNumber).toBe(9)
    expect(mazepin?.nationality).toBe('Rússia')
    expect(mazepin?.age).toBe(27)
    expect(mazepin?.teamKey).toBeUndefined()
  })

  it('mbj-137 (Daniil Kvyat) deve estar cadastrado corretamente com preferredNumber 26', () => {
    const kvyat = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-137')
    expect(kvyat).toBeDefined()
    expect(kvyat?.name).toBe('Daniil Kvyat')
    expect(kvyat?.preferredNumber).toBe(26)
    expect(kvyat?.nationality).toBe('Rússia')
    expect(kvyat?.age).toBe(31)
    expect(kvyat?.teamKey).toBeUndefined()
  })

  it('mbj-128 (Sébastien Bourdais) deve manter preferredNumber null / undefined', () => {
    const bourdais = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-128')
    expect(bourdais).toBeDefined()
    expect(bourdais?.name).toBe('Sébastien Bourdais')
    // Não deve herdar número "25" da arte gráfica
    expect(bourdais?.preferredNumber ?? null).toBeNull()
  })

  it('retratos devem resolver exatamente os DRVs correspondentes via resolveDriverPhoto', () => {
    const photoMazepin = resolveDriverPhoto({ driverId: 'mbj-136', name: 'Nikita Mazepin' })
    const photoKvyat = resolveDriverPhoto({ driverId: 'mbj-137', name: 'Daniil Kvyat' })
    const photoBourdais = resolveDriverPhoto({ driverId: 'mbj-128', name: 'Sébastien Bourdais' })

    expect(photoMazepin.url).toContain('DRV_0135.jpg')
    expect(photoKvyat.url).toContain('DRV_0136.jpg')
    expect(photoBourdais.url).toContain('DRV_0075.jpg')
  })

  it('identidades canônicas no CANONICAL_DRIVERS_MASTER devem estar íntegras via getCanonicalDriverMaster', () => {
    const mazepinCanonical = getCanonicalDriverMaster('mbj-136')
    const kvyatCanonical = getCanonicalDriverMaster('mbj-137')
    const bourdaisCanonical = getCanonicalDriverMaster('mbj-128')

    expect(mazepinCanonical).toBeDefined()
    expect(mazepinCanonical?.fullName).toBe('Nikita Mazepin')

    expect(kvyatCanonical).toBeDefined()
    expect(kvyatCanonical?.fullName).toBe('Daniil Kvyat')

    expect(bourdaisCanonical).toBeDefined()
    expect(bourdaisCanonical?.fullName).toBe('Sébastien Bourdais')
  })

  it('aliases no resolvedor canônico devem encontrar as entidades corretas', () => {
    expect(findCanonicalDriverMaster(undefined, 'Nikita Mazepin')?.driverId).toBe('mbj-136')
    expect(findCanonicalDriverMaster(undefined, 'Daniil Kvyat')?.driverId).toBe('mbj-137')
    expect(findCanonicalDriverMaster(undefined, 'Sébastien Bourdais')?.driverId).toBe('mbj-128')
  })

  it('as estatísticas históricas dos 3 pilotos devem estar registradas em driverCareerStats2025 sem modificação indevida', () => {
    // Mazepin: 21 largadas (canônico mbj-136 e aliases)
    expect(DRIVER_CAREER_STATS_2025['mbj-136']?.races).toBe(21)
    expect(DRIVER_CAREER_STATS_2025['mazepin']?.races).toBe(21)
    expect(DRIVER_CAREER_STATS_2025['nikita_mazepin']?.races).toBe(21)

    // Kvyat: 110 largadas (canônico mbj-137 e aliases)
    expect(DRIVER_CAREER_STATS_2025['mbj-137']?.races).toBe(110)
    expect(DRIVER_CAREER_STATS_2025['kvyat']?.races).toBe(110)
    expect(DRIVER_CAREER_STATS_2025['daniil_kvyat']?.races).toBe(110)

    // Bourdais: 27 largadas (registrado tanto com id canônico quanto aliases)
    expect(DRIVER_CAREER_STATS_2025['mbj-128']?.races).toBe(27)
    expect(DRIVER_CAREER_STATS_2025['bourdais']?.races).toBe(27)
    expect(DRIVER_CAREER_STATS_2025['sebastien_bourdais']?.races).toBe(27)
  })

  it('proveniência documental de preferredNumber deve apontar para fontes primárias válidas e não para a arte', () => {
    const provMazepin = DRIVER_PROVENANCE_135_137A['mbj-136']
    const provKvyat = DRIVER_PROVENANCE_135_137A['mbj-137']
    const provBourdais = DRIVER_PROVENANCE_135_137A['mbj-128']

    expect(provMazepin).toBeDefined()
    expect(provMazepin.preferredNumber).toBe(9)
    expect(provMazepin.sourceAuthor).toBe('Haas F1 Team')
    expect(provMazepin.sourceUrl).toContain('haasf1team.com')
    expect(provMazepin.provenanceType).toBe('PRIMARY_DOCUMENT')
    // Não aponta a arte como fonte de preferência
    expect(provMazepin.sourceUrl).not.toContain('.jpg')

    expect(provKvyat).toBeDefined()
    expect(provKvyat.preferredNumber).toBe(26)
    expect(provKvyat.sourceAuthor).toBe('Formula 1')
    expect(provKvyat.sourceUrl).toContain('formula1.com')
    expect(provKvyat.provenanceType).toBe('PRIMARY_DOCUMENT')
    expect(provKvyat.sourceUrl).not.toContain('.jpg')

    expect(provBourdais).toBeDefined()
    expect(provBourdais.preferredNumber).toBeNull()
    expect(provBourdais.provenanceType).toBe('NO_VALIDATED_PREFERENCE')
    // A arte DRV_0137 com 25 é citada na evidência como NÃO autorizadora
    expect(provBourdais.evidence).toContain('NÃO autoriza')
  })
})
