import { describe, it, expect } from 'vitest'
import {
  getCanonicalDisplayName,
  getDriverCanonicalKey,
  resolveCanonicalDriverImagePath,
  normalizeDriverNameToken,
} from '@/lib/driver-canonical-service'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import fs from 'node:fs'
import path from 'node:path'

describe('PIL-GH: Acceptance Tests — Deduplicação e Identidade Canônica', () => {
  // PIL-GH-01: Alex Palou aparece uma vez
  it('PIL-GH-01: Alex Palou tem a mesma chave canônica para variantes com e sem acento', () => {
    const k1 = getDriverCanonicalKey('Alex Palou')
    const k2 = getDriverCanonicalKey('Álex Palou')
    expect(k1).toBe(k2)
    expect(getCanonicalDisplayName('Álex Palou')).toBe('Alex Palou')
  })

  // PIL-GH-02: Alex/Alexander Albon → uma identidade
  it('PIL-GH-02: Alex/Alexander Albon compartilham chave canônica e identidade', () => {
    const k1 = getDriverCanonicalKey('Alex Albon')
    const k2 = getDriverCanonicalKey('Alexander Albon')
    expect(k1).toBe(k2)
  })

  // PIL-GH-03: Alex/Alexander Dunne → uma identidade
  it('PIL-GH-03: Alex/Alexander Dunne compartilham chave canônica e identidade', () => {
    const k1 = getDriverCanonicalKey('Alex Dunne')
    const k2 = getDriverCanonicalKey('Alexander Dunne')
    expect(k1).toBe(k2)
  })

  // PIL-GH-04: Andre/André Lotterer → uma identidade
  it('PIL-GH-04: Andre/André Lotterer compartilham chave canônica', () => {
    const k1 = getDriverCanonicalKey('Andre Lotterer')
    const k2 = getDriverCanonicalKey('André Lotterer')
    expect(k1).toBe(k2)
  })

  // PIL-GH-05: Antonio/António Félix da Costa → uma identidade
  it('PIL-GH-05: Antonio/António Félix da Costa compartilham chave canônica', () => {
    const k1 = getDriverCanonicalKey('Antonio Felix da Costa')
    const k2 = getDriverCanonicalKey('António Félix da Costa')
    expect(k1).toBe(k2)
  })

  // PIL-GH-06: Gabriele Mini/Minì → uma identidade
  it('PIL-GH-06: Gabriele Mini/Minì compartilham chave canônica', () => {
    const k1 = getDriverCanonicalKey('Gabriele Mini')
    const k2 = getDriverCanonicalKey('Gabriele Minì')
    expect(k1).toBe(k2)
  })

  // PIL-GH-07: Robin Frijns WEC não aparece no catálogo MBJ
  it('PIL-GH-07: Robin Frijns WEC não deve existir em MBJ_2026_PILOTS', () => {
    const wecDriver = MBJ_2026_PILOTS.find(
      (p) => p.name.toLowerCase().trim() === 'robin frijns wec',
    )
    expect(wecDriver).toBeUndefined()
  })

  // PIL-GH-08: Robin Frijns aparece uma vez
  it('PIL-GH-08: Robin Frijns tem registro único no catálogo', () => {
    const frijnsEntries = MBJ_2026_PILOTS.filter(
      (p) => getDriverCanonicalKey(p.name) === getDriverCanonicalKey('Robin Frijns'),
    )
    expect(frijnsEntries.length).toBe(1)
    expect(frijnsEntries[0].name).toBe('Robin Frijns')
  })
})
