import { describe, it, expect } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { findDuplicateDrivers, normalizeDriverIdentityKey } from '@/lib/canonical-driver-database'

describe('BUG-RETRATOS-03C — PARTE 1 & 2: Hülkenberg Duplicado e Anti-Duplicidade', () => {
  it('BRT03C-01: existe exatamente UM Nico Hülkenberg canônico na base ativa', async () => {
    const drivers = await pb.collection('drivers').getFullList({
      filter: "name ~ 'Hülkenberg' || name ~ 'Hulkenberg'",
    })

    // Deve existir exatamente 1 registro de Nico Hülkenberg
    expect(drivers).toHaveLength(1)
    const hulkenberg = drivers[0]
    expect(hulkenberg.name).toBe('Nico Hülkenberg')
    expect(hulkenberg.age).toBe(38)
    expect(hulkenberg.nationality).toBe('Alemanha')
  })

  it('BRT03C-02: Hülkenberg canônico preserva o ID usado pela Audi/contratos/histórico', async () => {
    const canonicalDriver = await pb.collection('drivers').getOne('0mow8vmzk0y4z9s')
    expect(canonicalDriver).toBeDefined()
    expect(canonicalDriver.id).toBe('0mow8vmzk0y4z9s')
    expect(canonicalDriver.name).toBe('Nico Hülkenberg')
    expect(canonicalDriver.age).toBe(38)
    expect(canonicalDriver.nationality).toBe('Alemanha')
    // Equipe da Audi vinculada
    expect(canonicalDriver.team_id).toBe('dpvviz06tkzwbih')
  })

  it('BRT03C-03: registro órfão 25 anos / INT (578o7m22pttuk4r) não existe mais no universo ativo', async () => {
    let orphanExists = false
    try {
      await pb.collection('drivers').getOne('578o7m22pttuk4r')
      orphanExists = true
    } catch {
      orphanExists = false
    }
    expect(orphanExists).toBe(false)
  })

  it('BRT03C-04: zero duplicatas por nome normalizado + nascimento no universo', async () => {
    // Busca todos os motoristas
    const drivers = await pb.collection('drivers').getFullList()
    const duplicates = findDuplicateDrivers(drivers as any[])
    expect(duplicates).toEqual([])
  })
})
