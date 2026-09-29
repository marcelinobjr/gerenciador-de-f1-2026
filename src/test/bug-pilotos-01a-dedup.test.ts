import { describe, it, expect } from 'vitest'
import {
  getCanonicalDisplayName,
  getDriverCanonicalKey,
  normalizeDriverNameToken,
  CANONICAL_NAME_MAP,
} from '@/lib/driver-canonical-service'
import {
  findCanonicalDriverMaster,
  getCanonicalDriverMaster,
} from '@/lib/canonical-driver-database'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'

describe('BUG-PILOTOS-01A: Testes Focados PIL-A01..A10', () => {
  // Mock dos registros reais do PocketBase observados em produção
  const mockPbDrivers = [
    {
      id: 'c8vv4ox4mevgfxs',
      name: 'Álex Palou',
      nationality: 'Espanha',
      age: 29,
      speed: 85,
      consistency: 86,
      rain: 82,
      defense: 83,
      salary: 12650000,
      contract_end: 2028,
      role: 'titular',
      category: 'f1',
      team_id: 'n2tqsicdy7z6n9w',
    },
    {
      id: '0qgkzay9my6ofdi',
      name: 'Alexander Albon',
      nationality: 'Tailândia',
      age: 29,
      speed: 84,
      consistency: 83,
      rain: 79,
      defense: 81,
      salary: 14000000,
      contract_end: 2029,
      role: 'titular',
      category: 'f1',
      team_id: 'ou3sblcubiv48o3',
    },
    {
      id: 'hl14dawcbv4jv79',
      name: 'Alex Dunne',
      nationality: 'Irlanda',
      age: 21,
      speed: 79,
      consistency: 77,
      rain: 76,
      defense: 76,
      salary: 3400000,
      contract_end: 2028,
      role: 'titular',
      category: 'f1',
      team_id: 'ze4v4eiylmqjd6m',
    },
    {
      id: 'zzvtfpp1fmlbr9s',
      name: 'André Lotterer',
      nationality: 'Alemanha',
      age: 45,
      speed: 81,
      consistency: 86,
      rain: 85,
      defense: 83,
      salary: 0,
      contract_end: 2026,
      role: '',
      category: 'mercado',
      team_id: '',
    },
    {
      id: 'ajrt6xt2tbdp8zm',
      name: 'António Félix da Costa',
      nationality: 'Portugal',
      age: 34,
      speed: 82,
      consistency: 82,
      rain: 83,
      defense: 83,
      salary: 7000000,
      contract_end: 2026,
      role: '',
      category: 'formula_e',
      team_id: '',
    },
    {
      id: 'rmwwye5lh3oyta6',
      name: 'Gabriele Minì',
      nationality: 'Itália',
      age: 21,
      speed: 79,
      consistency: 78,
      rain: 77,
      defense: 77,
      salary: 3700000,
      contract_end: 2028,
      role: 'titular',
      category: 'f1',
      team_id: 'tw1ekcu0ifm88nu',
    },
    // Outros pilotos reais para validar não-regressão (PIL-A10)
    {
      id: '9uazqw522oc9p4z',
      name: 'Gabriel Bortoleto',
      nationality: 'Brasil',
      age: 21,
      speed: 86,
      consistency: 85,
      rain: 86,
      defense: 87,
      salary: 3500000,
      contract_end: 2027,
      role: 'titular',
      category: 'f1',
      team_id: 'audi_team',
    },
    {
      id: 'de3isw3re1ji2wj',
      name: 'Max Verstappen',
      nationality: 'Holanda',
      age: 28,
      speed: 94,
      consistency: 93,
      rain: 95,
      defense: 94,
      salary: 45000000,
      contract_end: 2028,
      role: 'titular',
      category: 'f1',
      team_id: 'red_bull',
    },
  ]

  // Função simulando a unificação da lista de pilotos de DriversPage (fonte do catálogo)
  function buildUnifiedDriversList(pbList: typeof mockPbDrivers) {
    const result: Array<{ id: string; name: string; category: string }> = []
    const visitedCanonicalKeys = new Set<string>()

    // 1. Processa banco PocketBase
    for (const d of pbList) {
      const canKey = getDriverCanonicalKey(d.name)
      if (visitedCanonicalKeys.has(canKey)) continue
      visitedCanonicalKeys.add(canKey)
      result.push({
        id: d.id,
        name: getCanonicalDisplayName(d.name),
        category: d.category,
      })
    }

    // 2. Incorpora pilotos MBJ não cadastrados no banco
    for (const pilot of MBJ_2026_PILOTS) {
      const canKey = getDriverCanonicalKey(pilot.name)
      if (visitedCanonicalKeys.has(canKey)) continue
      visitedCanonicalKeys.add(canKey)
      result.push({
        id: pilot.id,
        name: getCanonicalDisplayName(pilot.name),
        category: pilot.category,
      })
    }

    return result
  }

  // PIL-A01: Alex Palou aparece exatamente 1 vez
  it('PIL-A01: Alex Palou aparece exatamente 1 vez na lista unificada', () => {
    const list = buildUnifiedDriversList(mockPbDrivers)
    const palouEntries = list.filter(
      (p) => getDriverCanonicalKey(p.name) === getDriverCanonicalKey('Alex Palou'),
    )
    expect(palouEntries).toHaveLength(1)
    expect(palouEntries[0].id).toBe('c8vv4ox4mevgfxs')
  })

  // PIL-A02: Gabriele Mini aparece exatamente 1 vez
  it('PIL-A02: Gabriele Mini aparece exatamente 1 vez na lista unificada', () => {
    const list = buildUnifiedDriversList(mockPbDrivers)
    const miniEntries = list.filter(
      (p) => getDriverCanonicalKey(p.name) === getDriverCanonicalKey('Gabriele Mini'),
    )
    expect(miniEntries).toHaveLength(1)
    expect(miniEntries[0].id).toBe('rmwwye5lh3oyta6')
  })

  // PIL-A03: Alex Albon e Alexander Albon resolvem para a mesma identidade
  it('PIL-A03: Alex Albon e Alexander Albon resolvem para a mesma identidade canônica', () => {
    const key1 = getDriverCanonicalKey('Alex Albon')
    const key2 = getDriverCanonicalKey('Alexander Albon')
    expect(key1).toBe(key2)

    const master1 = findCanonicalDriverMaster('0qgkzay9my6ofdi', 'Alex Albon')
    const master2 = findCanonicalDriverMaster('mbj-013', 'Alexander Albon')
    expect(master1).toBeDefined()
    expect(master2).toBeDefined()
    expect(master1?.driverId).toBe(master2?.driverId)
  })

  // PIL-A04: Alex Dunne e Alexander Dunne resolvem para a mesma identidade
  it('PIL-A04: Alex Dunne e Alexander Dunne resolvem para a mesma identidade canônica', () => {
    const key1 = getDriverCanonicalKey('Alex Dunne')
    const key2 = getDriverCanonicalKey('Alexander Dunne')
    expect(key1).toBe(key2)

    const master1 = findCanonicalDriverMaster('hl14dawcbv4jv79', 'Alex Dunne')
    const master2 = findCanonicalDriverMaster('mbj-071', 'Alexander Dunne')
    expect(master1).toBeDefined()
    expect(master2).toBeDefined()
    expect(master1?.driverId).toBe(master2?.driverId)
  })

  // PIL-A05: Andre Lotterer e André Lotterer resolvem para a mesma identidade
  it('PIL-A05: Andre Lotterer e André Lotterer resolvem para a mesma identidade canônica', () => {
    const key1 = getDriverCanonicalKey('Andre Lotterer')
    const key2 = getDriverCanonicalKey('André Lotterer')
    expect(key1).toBe(key2)

    const master1 = findCanonicalDriverMaster('zzvtfpp1fmlbr9s', 'André Lotterer')
    const master2 = findCanonicalDriverMaster('mbj-109', 'Andre Lotterer')
    expect(master1).toBeDefined()
    expect(master2).toBeDefined()
    expect(master1?.driverId).toBe(master2?.driverId)
  })

  // PIL-A06: Antonio Felix da Costa e António Félix da Costa resolvem para a mesma identidade
  it('PIL-A06: Antonio Felix da Costa e António Félix da Costa resolvem para a mesma identidade canônica', () => {
    const key1 = getDriverCanonicalKey('Antonio Felix da Costa')
    const key2 = getDriverCanonicalKey('António Félix da Costa')
    expect(key1).toBe(key2)

    const master1 = findCanonicalDriverMaster('ajrt6xt2tbdp8zm', 'António Félix da Costa')
    const master2 = findCanonicalDriverMaster('mbj-085', 'Antonio Felix da Costa')
    expect(master1).toBeDefined()
    expect(master2).toBeDefined()
    expect(master1?.driverId).toBe(master2?.driverId)
  })

  // PIL-A07: Busca por "Alex Albon" encontra o piloto canônico
  it('PIL-A07: Busca por "Alex Albon" encontra o piloto canônico', () => {
    const list = buildUnifiedDriversList(mockPbDrivers)
    const query = 'Alex Albon'
    const qLower = query.toLowerCase().trim()
    const normQuery = normalizeDriverNameToken(qLower)
    const aliasCan = getCanonicalDisplayName(qLower)

    const matched = list.filter((p) => {
      const normName = normalizeDriverNameToken(p.name)
      return (
        p.name.toLowerCase().includes(qLower) ||
        (normQuery.length >= 3 && normName.includes(normQuery)) ||
        (aliasCan && p.name.toLowerCase() === aliasCan.toLowerCase())
      )
    })

    expect(matched.length).toBe(1)
    expect(matched[0].name).toBe('Alexander Albon')
  })

  // PIL-A08: Busca por "Andre Lotterer" encontra o piloto canônico
  it('PIL-A08: Busca por "Andre Lotterer" encontra o piloto canônico', () => {
    const list = buildUnifiedDriversList(mockPbDrivers)
    const query = 'Andre Lotterer'
    const qLower = query.toLowerCase().trim()
    const normQuery = normalizeDriverNameToken(qLower)
    const aliasCan = getCanonicalDisplayName(qLower)

    const matched = list.filter((p) => {
      const normName = normalizeDriverNameToken(p.name)
      return (
        p.name.toLowerCase().includes(qLower) ||
        (normQuery.length >= 3 && normName.includes(normQuery)) ||
        (aliasCan && p.name.toLowerCase() === aliasCan.toLowerCase())
      )
    })

    expect(matched.length).toBe(1)
    expect(matched[0].name).toBe('André Lotterer')
  })

  // PIL-A09: Lista Pilotos não contém mais de um ID canônico para cada pessoa corrigida
  it('PIL-A09: Lista Pilotos não contém duplicidade para nenhum dos 6 casos corrigidos', () => {
    const list = buildUnifiedDriversList(mockPbDrivers)

    const testCases = [
      'Alex Palou',
      'Gabriele Mini',
      'Alexander Albon',
      'Alexander Dunne',
      'André Lotterer',
      'António Félix da Costa',
    ]

    for (const testName of testCases) {
      const targetKey = getDriverCanonicalKey(testName)
      const count = list.filter((p) => getDriverCanonicalKey(p.name) === targetKey).length
      expect(
        count,
        `Piloto ${testName} deve aparecer exatamente 1 vez, mas apareceu ${count} vezes`,
      ).toBe(1)
    }
  })

  // PIL-A10: Nenhum outro piloto da base é removido por efeito colateral
  it('PIL-A10: Nenhum outro piloto da base é removido por efeito colateral', () => {
    const list = buildUnifiedDriversList(mockPbDrivers)

    // Pilotos do mock de banco e do MBJ devem estar presentes
    expect(list.some((p) => p.name === 'Gabriel Bortoleto')).toBe(true)
    expect(list.some((p) => p.name === 'Max Verstappen')).toBe(true)
    expect(list.some((p) => p.name.includes('Carlos Sainz'))).toBe(true)
    expect(list.some((p) => p.name.includes('Fernando Alonso'))).toBe(true)

    // O total deve ser exatamente:
    // 135 MBJ + 2 do banco que não estão no MBJ (ou similar) - deduplicações exatas
    // A lista não pode estar vazia ou encolhida drasticamente
    expect(list.length).toBeGreaterThan(130)
  })
})
