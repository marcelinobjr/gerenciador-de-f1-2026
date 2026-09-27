import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { generateCareerNumbersCurrentStateInventory } from '@/artifacts/audits/generateCareerNumbersInventory'
import { MBJ_2026_PILOTS, getDriverCareerStats } from '@/lib/mbj-drivers-data'

describe('CN-RECOVERY-01A — Geração e Integridade do Inventário Estrutural', () => {
  it('gera o artefato career-numbers-01-current-state.json e persiste em docs/', () => {
    const inventory = generateCareerNumbersCurrentStateInventory('ae5df12')
    const outPath = path.resolve(process.cwd(), 'docs/career-numbers-01-current-state.json')
    fs.writeFileSync(outPath, JSON.stringify(inventory, null, 2), 'utf-8')

    expect(fs.existsSync(outPath)).toBe(true)
    const content = JSON.parse(fs.readFileSync(outPath, 'utf-8'))

    expect(content.schemaVersion).toBe('1.0.0')
    expect(content.targetHistoricalCutoff).toBe('2025-12-31')
    expect(content.nature).toBe('INVENTARIO_ESTRUTURAL')
    expect(content.externalFactualValidation).toBe('NAO_EXECUTADA')
    expect(content.totalEffectiveDrivers).toBe(MBJ_2026_PILOTS.length)
    expect(content.totalEffectiveDrivers).toBe(137)
    expect(content.entries).toHaveLength(137)
  })

  it('Bloco 5 - A: Os três pilotos resolvem pelo mesmo caminho da ficha', () => {
    const mazepin = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-136')!
    const kvyat = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-137')!
    const bourdais = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-128')!

    expect(mazepin).toBeDefined()
    expect(kvyat).toBeDefined()
    expect(bourdais).toBeDefined()

    const mazepinStats = getDriverCareerStats({ pilot: mazepin })
    const kvyatStats = getDriverCareerStats({ pilot: kvyat })
    const bourdaisStats = getDriverCareerStats({ pilot: bourdais })

    expect(mazepinStats).toEqual({ races: 21, wins: 0, poles: 0, championships: 0 })
    expect(kvyatStats).toEqual({ races: 110, wins: 0, poles: 0, championships: 0 })
    expect(bourdaisStats).toEqual({ races: 27, wins: 0, poles: 0, championships: 0 })
  })

  it('Bloco 5 - B: Mazepin 21/0/0/0, Kvyat 110/0/0/0, Bourdais 27/0/0/0 sem eventos simulados', () => {
    const mazepinStats = getDriverCareerStats({
      pilot: { id: 'mbj-136' } as any,
      raceResults: [],
      seasonHistories: [],
    })
    const kvyatStats = getDriverCareerStats({
      pilot: { id: 'mbj-137' } as any,
      raceResults: [],
      seasonHistories: [],
    })
    const bourdaisStats = getDriverCareerStats({
      pilot: { id: 'mbj-128' } as any,
      raceResults: [],
      seasonHistories: [],
    })

    expect(mazepinStats.races).toBe(21)
    expect(mazepinStats.wins).toBe(0)
    expect(mazepinStats.poles).toBe(0)
    expect(mazepinStats.championships).toBe(0)

    expect(kvyatStats.races).toBe(110)
    expect(kvyatStats.wins).toBe(0)
    expect(kvyatStats.poles).toBe(0)
    expect(kvyatStats.championships).toBe(0)

    expect(bourdaisStats.races).toBe(27)
    expect(bourdaisStats.wins).toBe(0)
    expect(bourdaisStats.poles).toBe(0)
    expect(bourdaisStats.championships).toBe(0)
  })

  it('Bloco 5 - C: IDs e aliases convergem para a mesma identidade, sem troca entre os três', () => {
    // Mazepin
    const mById = getDriverCareerStats({ pilot: { id: 'mbj-136' } as any })
    const mByAlias = getDriverCareerStats({ pilot: { id: 'mazepin' } as any })
    const mByFull = getDriverCareerStats({ pilot: { id: 'nikita_mazepin' } as any })
    expect(mById).toEqual(mByAlias)
    expect(mById).toEqual(mByFull)
    expect(mById.races).toBe(21)

    // Kvyat
    const kById = getDriverCareerStats({ pilot: { id: 'mbj-137' } as any })
    const kByAlias = getDriverCareerStats({ pilot: { id: 'kvyat' } as any })
    const kByFull = getDriverCareerStats({ pilot: { id: 'daniil_kvyat' } as any })
    expect(kById).toEqual(kByAlias)
    expect(kById).toEqual(kByFull)
    expect(kById.races).toBe(110)

    // Bourdais
    const bById = getDriverCareerStats({ pilot: { id: 'mbj-128' } as any })
    const bByAlias = getDriverCareerStats({ pilot: { id: 'bourdais' } as any })
    const bByFull = getDriverCareerStats({ pilot: { id: 'sebastien_bourdais' } as any })
    expect(bById).toEqual(bByAlias)
    expect(bById).toEqual(bByFull)
    expect(bById.races).toBe(27)

    // Sem troca entre os três
    expect(mById.races).not.toBe(kById.races)
    expect(kById.races).not.toBe(bById.races)
    expect(bById.races).not.toBe(mById.races)
  })

  it('Bloco 5 - D: Sem duplicados; contagem canônica estável em 137', () => {
    expect(MBJ_2026_PILOTS.length).toBe(137)
    const seen = new Set<string>()
    for (const p of MBJ_2026_PILOTS) {
      expect(seen.has(p.id)).toBe(false)
      seen.add(p.id)
    }
    expect(seen.size).toBe(137)
  })

  it('Bloco 5 - E: Regressões dos outros três conhecidos continuam: Schumacher 43, Sargeant 36, de Vries 11', () => {
    const schumacher = getDriverCareerStats({ pilot: { id: 'mbj-037' } as any })
    const sargeant = getDriverCareerStats({ pilot: { id: 'mbj-038' } as any })
    const deVries = getDriverCareerStats({ pilot: { id: 'mbj-039' } as any })

    expect(schumacher.races).toBe(43)
    expect(schumacher.wins).toBe(0)
    expect(schumacher.poles).toBe(0)
    expect(schumacher.championships).toBe(0)

    expect(sargeant.races).toBe(36)
    expect(sargeant.wins).toBe(0)
    expect(sargeant.poles).toBe(0)
    expect(sargeant.championships).toBe(0)

    expect(deVries.races).toBe(11)
    expect(deVries.wins).toBe(0)
    expect(deVries.poles).toBe(0)
    expect(deVries.championships).toBe(0)
  })

  it('Bloco 5 - F: Inventário com exatamente UMA entrada por ID; falha de resolução gera entrada com erro, não omissão', () => {
    const inventory = generateCareerNumbersCurrentStateInventory('ae5df12')
    expect(inventory.entries).toHaveLength(137)

    const ids = inventory.entries.map((e) => e.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(137)
    expect(inventory.summary.errorCount).toBe(0)
  })

  it('Bloco 5 - G: Contagens-resumo do inventário batem com as entradas', () => {
    const inventory = generateCareerNumbersCurrentStateInventory('ae5df12')
    const { summary, entries } = inventory

    const resolved = entries.filter((e) => e.resolutionStatus === 'RESOLVIDO').length
    const notFound = entries.filter((e) => e.resolutionStatus === 'NAO_ENCONTRADO').length
    const ambiguous = entries.filter((e) => e.resolutionStatus === 'AMBIGUO').length
    const error = entries.filter((e) => e.resolutionStatus === 'ERRO').length
    const withDoc = entries.filter((e) => e.hasDocumentedReference).length
    const withInc = entries.filter((e) => e.structuralInconsistencies.length > 0).length

    expect(summary.resolvedCount).toBe(resolved)
    expect(summary.notFoundCount).toBe(notFound)
    expect(summary.ambiguousCount).toBe(ambiguous)
    expect(summary.errorCount).toBe(error)
    expect(summary.withDocumentaryReferenceCount).toBe(withDoc)
    expect(summary.inconsistenciesCount).toBe(withInc)

    expect(resolved + notFound + ambiguous + error).toBe(entries.length)
  })

  it('Bloco 5 - H: Com a infraestrutura existente de testes de carreira, verifica que um resultado simulado válido continua agregado uma única vez, sem perda nem duplicação da baseline após reload', () => {
    // Mazepin disputa 2 corridas e vence 1 no save
    const mazepin = { id: 'mbj-136' }
    const raceResults = [
      { driver_id: 'mbj-136', position: 1, grid_position: 1 },
      { driver_id: 'mbj-136', position: 6, grid_position: 8 },
    ]
    const seasonHistories = [{ drivers_champion: 'mbj-136' }]

    // Primeira consulta (render inicial)
    const run1 = getDriverCareerStats({
      pilot: mazepin as any,
      raceResults,
      seasonHistories,
    })

    // Baseline: 21 GPs, 0 vitórias, 0 poles, 0 títulos
    // Save: +2 GPs, +1 vitória, +1 pole, +1 título
    expect(run1.races).toBe(21 + 2)
    expect(run1.wins).toBe(0 + 1)
    expect(run1.poles).toBe(0 + 1)
    expect(run1.championships).toBe(0 + 1)

    // Simula reload (segunda consulta com mesmos inputs restaurados do save)
    const run2 = getDriverCareerStats({
      pilot: JSON.parse(JSON.stringify(mazepin)) as any,
      raceResults: JSON.parse(JSON.stringify(raceResults)),
      seasonHistories: JSON.parse(JSON.stringify(seasonHistories)),
    })

    // Sem duplicação nem perda da baseline
    expect(run2).toEqual(run1)
    expect(run2.races).toBe(23)
    expect(run2.wins).toBe(1)
    expect(run2.poles).toBe(1)
    expect(run2.championships).toBe(1)
  })
})
