/**
 * SUÍTE FC02A — Driver Profile, Superlicença Canônica e Reconciliação de Histórico
 * Testes FC02A-01 a FC02A-12
 */

import { describe, it, expect } from 'vitest'
import { canonicalHomologationAdapter } from '@/lib/canonical-adapters'
import { MBJ_2026_PILOTS, getDriverCareerStats } from '@/lib/mbj-drivers-data'
import type { DriverModel } from '@/types/f1'

describe('SUÍTE FC02A — Driver Profile & Superlicença Canônica', () => {
  // FC02A-01: Gabriel Bortoleto recebe License A (Superlicença)
  it('FC02A-01: Bortoleto titular oficial recebe nivel_a / Licença A', () => {
    const bortoleto = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-020')
    expect(bortoleto).toBeDefined()
    const view = canonicalHomologationAdapter.toCanonicalView(bortoleto as unknown as DriverModel)
    expect(view.licenseStatus).toBe('nivel_a')
  })

  // FC02A-02: Super License válida e elegível para assento de F1
  it('FC02A-02: Bortoleto tem isEligibleForF1Seat = true', () => {
    const bortoleto = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-020')
    const view = canonicalHomologationAdapter.toCanonicalView(bortoleto as unknown as DriverModel)
    expect(view.isEligibleForF1Seat).toBe(true)
    expect(view.isEligibleForFP1).toBe(true)
  })

  // FC02A-03: Sem exigência de TL1 / homologação pendente para titular oficial F1
  it('FC02A-03: Titular oficial F1 não fica com status de homologação pendente', () => {
    const bortoleto = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-020')
    const view = canonicalHomologationAdapter.toCanonicalView(bortoleto as unknown as DriverModel)
    expect(view.legacyHomologationStatus).toBe('elegivel')
  })

  // FC02A-04: Nico Hülkenberg recebe License A
  it('FC02A-04: Hülkenberg titular Audi F1 recebe nivel_a / Licença A', () => {
    const hulkenberg = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-019')
    expect(hulkenberg).toBeDefined()
    const view = canonicalHomologationAdapter.toCanonicalView(hulkenberg as unknown as DriverModel)
    expect(view.licenseStatus).toBe('nivel_a')
    expect(view.isEligibleForF1Seat).toBe(true)
  })

  // FC02A-05: Todos os 22 pilotos titulares do grid 2026 recebem License A
  it('FC02A-05: Todos os titulares do grid 2026 têm nivel_a', () => {
    const titulares = MBJ_2026_PILOTS.filter(
      (p) => (p.role ?? '').toLowerCase() === 'titular' && p.category === 'f1',
    )
    expect(titulares.length).toBe(22)
    for (const tit of titulares) {
      const view = canonicalHomologationAdapter.toCanonicalView(tit as unknown as DriverModel)
      expect(view.licenseStatus).toBe('nivel_a')
      expect(view.isEligibleForF1Seat).toBe(true)
    }
  })

  // FC02A-06: Piloto não-elegível (academy/teste sem SL) não recebe License A indevidamente
  it('FC02A-06: Pilotos de academia ou sem critérios reais não recebem nivel_a indevidamente', () => {
    const academyCandidate = {
      id: 'acad-001',
      name: 'Rookie Prospect',
      role: 'reserva',
      category: 'f2',
      superlicense_points: 15,
      homologation_status: 'formacao' as const,
      is_academy: true,
    }
    const view = canonicalHomologationAdapter.toCanonicalView(
      academyCandidate as unknown as DriverModel,
    )
    expect(view.licenseStatus).not.toBe('nivel_a')
    expect(view.isEligibleForF1Seat).toBe(false)
  })

  // FC02A-07: Baseline histórico respeitado: Bortoleto = 0 GPs (novato 2026)
  it('FC02A-07: Histórico de Bortoleto no baseline oficial = 0 GPs na F1', () => {
    const bortoleto = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-020')
    const stats = getDriverCareerStats({
      pilot: bortoleto as any,
      raceResults: null,
      seasonHistories: null,
    })
    expect(stats.races).toBe(0)
    expect(stats.wins).toBe(0)
  })

  // FC02A-08: Hülkenberg preserva seus 228 GPs de histórico oficial
  it('FC02A-08: Hülkenberg preserva 228 GPs de baseline histórico', () => {
    const hulkenberg = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-019')
    const stats = getDriverCareerStats({
      pilot: hulkenberg as any,
      raceResults: null,
      seasonHistories: null,
    })
    expect(stats.races).toBe(228)
  })

  // FC02A-09: Baseline + resultados do game somam uma única vez de forma aditiva
  it('FC02A-09: Baseline histórico e resultados do save somam exatamente uma vez', () => {
    const hulkenberg = MBJ_2026_PILOTS.find((p) => p.id === 'mbj-019')
    const mockSaveResults = [
      { id: 'res-1', driver_id: 'mbj-019', position: 1 },
      { id: 'res-2', driver_id: 'mbj-019', position: 4 },
    ]
    const stats = getDriverCareerStats({
      pilot: hulkenberg as any,
      raceResults: mockSaveResults,
      seasonHistories: null,
    })
    expect(stats.races).toBe(230) // 228 + 2
    expect(stats.wins).toBe(1)
  })

  // FC02A-10: Tolerância a caixa de role ('Titular' vs 'titular') e vínculo contratual
  it('FC02A-10: isCanonicalF1Titular é tolerante a caixa ("Titular", "titular")', () => {
    const driverUpper = {
      id: 'test-1',
      name: 'Piloto Teste',
      role: 'Titular',
      category: 'f1',
    }
    const driverLower = {
      id: 'test-2',
      name: 'Piloto Teste 2',
      role: 'titular',
      category: 'F1',
    }
    const viewUpper = canonicalHomologationAdapter.toCanonicalView(
      driverUpper as unknown as DriverModel,
    )
    const viewLower = canonicalHomologationAdapter.toCanonicalView(
      driverLower as unknown as DriverModel,
    )
    expect(viewUpper.licenseStatus).toBe('nivel_a')
    expect(viewLower.licenseStatus).toBe('nivel_a')
  })

  // FC02A-11: Adapter canônico elimina fallback legado baseado puramente em pilot.speed
  it('FC02A-11: Piloto titular com speed baixo (ex: 70) continua com Licença A pelo status canônico', () => {
    const slowTitular = {
      id: 'test-slow',
      name: 'Piloto Titular Lento',
      role: 'titular',
      category: 'f1',
      speed: 70,
    }
    const view = canonicalHomologationAdapter.toCanonicalView(slowTitular as unknown as DriverModel)
    expect(view.licenseStatus).toBe('nivel_a')
    expect(view.isEligibleForF1Seat).toBe(true)
  })

  // FC02A-12: ID canônico mbj-020 para Bortoleto encontra o piloto em MBJ_2026_PILOTS
  it('FC02A-12: ID mbj-020 resolve com sucesso para Gabriel Bortoleto', () => {
    const p = MBJ_2026_PILOTS.find((pilot) => pilot.id === 'mbj-020')
    expect(p).toBeDefined()
    expect(p?.name).toBe('Gabriel Bortoleto')
    expect(p?.role).toBe('titular')
  })
})
