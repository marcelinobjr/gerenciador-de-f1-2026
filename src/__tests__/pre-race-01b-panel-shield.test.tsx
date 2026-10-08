/**
 * pre-race-01b-panel-shield.test.tsx
 *
 * Suíte oficial PR-B1..PR-B9:
 * Validação da blindagem visual do PreRaceStrategyPreparationPanel e diagnóstico do player match.
 *
 * PR-B1: grid válido com 2 pilotos da equipe -> painel monta normalmente.
 * PR-B2: grid com 0 pilotos compatíveis -> não lança erro para fora do render; mostra card de erro.
 * PR-B3: grid com 1 piloto compatível -> mostra erro; diagnóstico playerEntriesCount=1.
 * PR-B4: grid com 3 pilotos compatíveis -> mostra erro; diagnóstico count=3.
 * PR-B5: erro mostra canonicalTeamKey esperado.
 * PR-B6: erro registra teamId/isPlayer dos candidatos sem dump do payload inteiro.
 * PR-B7: "Tentar novamente" com dados corrigidos -> painel normal aparece.
 * PR-B8: retry com dados ainda inválidos -> erro permanece, sem crash.
 * PR-B9: snapshot válido não altera estratégia/pit/fuel defaults atuais.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreRaceStrategyPreparationPanel } from '@/components/race/PreRaceStrategyPreparationPanel'
import { canonicalRacePreparationService } from '@/services/canonicalRacePreparationService'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { TireSetItem } from '@/types/f1'

describe('PRE-RACE-01B — Blindagem Visual do Painel e Diagnóstico do Player Match', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.clear()
    }
    vi.restoreAllMocks()
  })

  const createGrid = (
    playerTeamKey: string = 'audi',
    options?: {
      playerEntriesCount?: number
      isPlayerFlags?: boolean[]
      customAdversaryTeam?: string
    },
  ): FinalQualifyingGridEntry[] => {
    const {
      playerEntriesCount = 2,
      isPlayerFlags = [false, false],
      customAdversaryTeam = 'ferrari',
    } = options || {}

    const grid: FinalQualifyingGridEntry[] = []

    for (let i = 0; i < playerEntriesCount; i++) {
      grid.push({
        gridPosition: i + 1,
        driverId: `drv_player_${i + 1}`,
        driverName: i === 0 ? 'Nico Hülkenberg' : 'Gabriel Bortoleto',
        teamId: playerTeamKey,
        teamName: playerTeamKey.toUpperCase(),
        teamColor: '#FF0000',
        isPlayer: isPlayerFlags[i] ?? false,
        eliminationStage: 'Q3',
        bestLapSec: 85.0 + i,
        bestLapTime: `1:25.${i}00`,
        bestLapCompound: 'macio',
      })
    }

    const remaining = 24 - playerEntriesCount
    for (let i = 0; i < remaining; i++) {
      grid.push({
        gridPosition: playerEntriesCount + i + 1,
        driverId: `drv_adv_${i + 1}`,
        driverName: `Adversary ${i + 1}`,
        teamId: customAdversaryTeam,
        teamName: customAdversaryTeam.toUpperCase(),
        teamColor: '#000000',
        isPlayer: false,
        eliminationStage: 'Q1',
        bestLapSec: 87.0 + i * 0.1,
        bestLapTime: `1:27.${i}00`,
        bestLapCompound: 'duro',
      })
    }

    return grid
  }

  const mockInventories: Record<string, TireSetItem[]> = {
    drv_player_1: [
      { id: 't1', compound: 'medio', wear: 0, lapsUsed: 0, isFitted: true, status: 'disponivel' },
    ],
    drv_player_2: [
      { id: 't2', compound: 'medio', wear: 0, lapsUsed: 0, isFitted: true, status: 'disponivel' },
    ],
  }

  // PR-B1: grid válido com 2 pilotos da equipe -> painel monta normalmente
  it('PR-B1: grid válido com 2 pilotos da equipe monta o painel normalmente sem erros', () => {
    const grid = createGrid('audi', { playerEntriesCount: 2 })

    const { container } = render(
      React.createElement(PreRaceStrategyPreparationPanel, {
        careerId: 'c_b1',
        seasonYear: 2026,
        round: 1,
        teamId: 'audi',
        totalLaps: 57,
        canonicalGrid: grid,
        inventories: mockInventories,
        onConfirmAndStartRace: () => {},
      }),
    )

    expect(container).toBeDefined()
    expect(screen.getByText('Estratégia de Corrida — Pré-Largada')).toBeDefined()
    expect(screen.getByText('Nico Hülkenberg')).toBeDefined()
    expect(screen.getByText('Gabriel Bortoleto')).toBeDefined()
    expect(screen.queryByText('Não foi possível preparar a corrida')).toBeNull()
  })

  // PR-B2: grid com 0 pilotos compatíveis -> não lança erro para fora do render; mostra card de erro
  it('PR-B2: grid com 0 pilotos compatíveis não derruba o componente e exibe o card de erro visual', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const brokenGrid = createGrid('audi', { playerEntriesCount: 0 })

    expect(() => {
      render(
        React.createElement(PreRaceStrategyPreparationPanel, {
          careerId: 'c_b2',
          seasonYear: 2026,
          round: 1,
          teamId: 'audi',
          totalLaps: 57,
          canonicalGrid: brokenGrid,
          inventories: mockInventories,
          onConfirmAndStartRace: () => {},
        }),
      )
    }).not.toThrow()

    expect(screen.getByText('Não foi possível preparar a corrida')).toBeDefined()
    expect(
      screen.getByText(
        'Não foi possível identificar corretamente os dois carros da sua equipe no grid oficial.',
      ),
    ).toBeDefined()
    expect(screen.getByText('0 (esperado: 2)')).toBeDefined()
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  // PR-B3: grid com 1 piloto compatível -> mostra erro; diagnóstico playerEntriesCount=1
  it('PR-B3: grid com 1 piloto compatível exibe card de erro com diagnóstico playerEntriesCount=1', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const brokenGrid = createGrid('audi', { playerEntriesCount: 1 })

    render(
      React.createElement(PreRaceStrategyPreparationPanel, {
        careerId: 'c_b3',
        seasonYear: 2026,
        round: 1,
        teamId: 'audi',
        totalLaps: 57,
        canonicalGrid: brokenGrid,
        inventories: mockInventories,
        onConfirmAndStartRace: () => {},
      }),
    )

    expect(screen.getByText('Não foi possível preparar a corrida')).toBeDefined()
    expect(screen.getByText('1 (esperado: 2)')).toBeDefined()
  })

  // PR-B4: grid com 3 pilotos compatíveis -> mostra erro; diagnóstico count=3
  it('PR-B4: grid com 3 pilotos compatíveis exibe card de erro com diagnóstico count=3', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const brokenGrid = createGrid('audi', { playerEntriesCount: 3 })

    render(
      React.createElement(PreRaceStrategyPreparationPanel, {
        careerId: 'c_b4',
        seasonYear: 2026,
        round: 1,
        teamId: 'audi',
        totalLaps: 57,
        canonicalGrid: brokenGrid,
        inventories: mockInventories,
        onConfirmAndStartRace: () => {},
      }),
    )

    expect(screen.getByText('Não foi possível preparar a corrida')).toBeDefined()
    expect(screen.getByText('3 (esperado: 2)')).toBeDefined()
  })

  // PR-B5: erro mostra canonicalTeamKey esperado
  it('PR-B5: card de erro mostra o canonicalTeamKey esperado na interface', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const brokenGrid = createGrid('ferrari', { playerEntriesCount: 0 })

    render(
      React.createElement(PreRaceStrategyPreparationPanel, {
        careerId: 'c_b5',
        seasonYear: 2026,
        round: 1,
        teamId: 'ferrari',
        totalLaps: 57,
        canonicalGrid: brokenGrid,
        inventories: mockInventories,
        onConfirmAndStartRace: () => {},
      }),
    )

    expect(screen.getByText('ferrari')).toBeDefined()
  })

  // PR-B6: erro registra teamId/isPlayer dos candidatos sem dump do payload inteiro
  it('PR-B6: log estruturado console.error é disparado com campos compactos sem dump de payload inteiro', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const brokenGrid = createGrid('audi', {
      playerEntriesCount: 1,
      isPlayerFlags: [true],
    })

    render(
      React.createElement(PreRaceStrategyPreparationPanel, {
        careerId: 'c_b6',
        seasonYear: 2026,
        round: 1,
        teamId: 'audi',
        totalLaps: 57,
        canonicalGrid: brokenGrid,
        inventories: mockInventories,
        onConfirmAndStartRace: () => {},
      }),
    )

    expect(errorSpy).toHaveBeenCalled()
    const matchingCall = errorSpy.mock.calls.find(
      (args) =>
        typeof args[0] === 'string' &&
        args[0].includes('[PreRacePreparation] Failed to initialize snapshot'),
    )
    expect(matchingCall).toBeDefined()

    const logPayload = matchingCall?.[1]
    expect(logPayload).toBeDefined()
    expect(logPayload.canonicalTeamKey).toBe('audi')
    expect(logPayload.playerEntriesCount).toBe(1)
    expect(logPayload.entriesMatchedByTeamId).toBe(1)
    expect(logPayload.entriesMatchedByIsPlayer).toBe(1)
    expect(Array.isArray(logPayload.candidates)).toBe(true)
    expect(logPayload.candidates).toHaveLength(1)
    expect(logPayload.candidates[0]).toEqual({
      driverId: 'drv_player_1',
      teamId: 'audi',
      isPlayer: true,
    })
    // Garante que não foi feito dump de todo o objeto do grid com 24 elementos brutos
    expect(logPayload.canonicalGrid).toBeUndefined()
  })

  // PR-B7: "Tentar novamente" com dados corrigidos -> painel normal aparece
  it('PR-B7: botão "Tentar novamente" após correção de dados reexecuta inicialização e monta o painel normal', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mockar createInitialSnapshot para simular falha na primeira tentativa e sucesso no retry
    let attempt = 0
    const originalCreateInitial = canonicalRacePreparationService.createInitialSnapshot.bind(
      canonicalRacePreparationService,
    )
    const spyCreate = vi
      .spyOn(canonicalRacePreparationService, 'createInitialSnapshot')
      .mockImplementation((params) => {
        attempt++
        if (attempt === 1) {
          throw new Error('Inconsistência temporária no grid')
        }
        return originalCreateInitial(params)
      })

    const validGrid = createGrid('audi', { playerEntriesCount: 2 })

    render(
      React.createElement(PreRaceStrategyPreparationPanel, {
        careerId: 'c_b7',
        seasonYear: 2026,
        round: 1,
        teamId: 'audi',
        totalLaps: 57,
        canonicalGrid: validGrid,
        inventories: mockInventories,
        onConfirmAndStartRace: () => {},
      }),
    )

    // Primeira renderização: erro visível
    expect(screen.getByText('Não foi possível preparar a corrida')).toBeDefined()
    expect(screen.queryByText('Nico Hülkenberg')).toBeNull()

    // Clicar em "Tentar novamente"
    const retryBtn = screen.getByText('Tentar novamente')
    fireEvent.click(retryBtn)

    // Segunda tentativa: sucesso, painel normal montado
    expect(screen.queryByText('Não foi possível preparar a corrida')).toBeNull()
    expect(screen.getByText('Nico Hülkenberg')).toBeDefined()
    expect(screen.getByText('Gabriel Bortoleto')).toBeDefined()
    expect(spyCreate).toHaveBeenCalledTimes(2)
  })

  // PR-B8: retry com dados ainda inválidos -> erro permanece, sem crash
  it('PR-B8: retry com dados ainda inválidos mantém o card de erro sem crash ou loops', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const brokenGrid = createGrid('audi', { playerEntriesCount: 1 })

    render(
      React.createElement(PreRaceStrategyPreparationPanel, {
        careerId: 'c_b8',
        seasonYear: 2026,
        round: 1,
        teamId: 'audi',
        totalLaps: 57,
        canonicalGrid: brokenGrid,
        inventories: mockInventories,
        onConfirmAndStartRace: () => {},
      }),
    )

    expect(screen.getByText('Não foi possível preparar a corrida')).toBeDefined()

    // Clicar em tentar novamente
    const retryBtn = screen.getByText('Tentar novamente')
    fireEvent.click(retryBtn)

    // Erro permanece e nada explode
    expect(screen.getByText('Não foi possível preparar a corrida')).toBeDefined()
    expect(screen.getByText('1 (esperado: 2)')).toBeDefined()
  })

  // PR-B9: snapshot válido não altera estratégia/pit/fuel defaults atuais
  it('PR-B9: snapshot válido preserva defaults de combustível, pneus e plano de paradas', () => {
    const validGrid = createGrid('audi', { playerEntriesCount: 2 })

    render(
      React.createElement(PreRaceStrategyPreparationPanel, {
        careerId: 'c_b9',
        seasonYear: 2026,
        round: 1,
        teamId: 'audi',
        totalLaps: 57,
        canonicalGrid: validGrid,
        inventories: mockInventories,
        onConfirmAndStartRace: () => {},
      }),
    )

    // Verificar se elementos de combustível, pit e pneus estão montados
    expect(screen.getAllByText(/Combustível de Largada/i).length).toBe(2)
    expect(screen.getAllByText(/Plano de Pit Stop/i).length).toBe(2)
    expect(screen.getAllByText(/Pneu de Largada/i).length).toBe(2)
    expect(screen.getByText('Iniciar Corrida')).toBeDefined()
  })
})
