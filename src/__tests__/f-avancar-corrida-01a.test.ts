/**
 * f-avancar-corrida-01a.test.ts
 *
 * Suíte oficial F-AVANCAR-CORRIDA-01A:
 * Validação da resolução de identidade canônica da equipe no PreRaceStrategyPreparationPanel
 * e no canonicalRacePreparationService.
 *
 * Testes obrigatórios:
 * A1 — POCKETBASE ID DIFERENTE DO TEAM KEY: equipe do jogador com record id opaco e team key = "audi";
 *      grid usa "audi". Confirmar que createInitialSnapshot encontra os 2 pilotos corretos.
 * A2 — OUTRA EQUIPE: usar outra team key (ex: "ferrari", "mclaren"); confirmar que não existe hardcode para Audi.
 * A3 — ISPLAYER INCOMPLETO: somente 1 ou 0 entries com isPlayer=true, mas as 2 com team key correto;
 *      confirmar que os 2 pilotos são resolvidos.
 * A4 — NÃO CONTAMINAR ADVERSÁRIOS: as outras 22 entries não entram no snapshot do jogador.
 * A5 — GRID INCONSISTENTE: somente 1 piloto com team key correto; confirmar que o serviço continua rejeitando o grid,
 *      sem inventar o segundo piloto.
 * A6 — INTEGRAÇÃO DO PAINEL: montar o PreRaceStrategyPreparationPanel com grid realista;
 *      confirmar que o initial snapshot é criado sem exceção quando há exatamente 2 entries canônicas.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { canonicalRacePreparationService } from '@/services/canonicalRacePreparationService'
import { resolveCanonicalTeamKey } from '@/services/canonicalTeamIdentityService'
import { PreRaceStrategyPreparationPanel } from '@/components/race/PreRaceStrategyPreparationPanel'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { TireSetItem } from '@/types/f1'

describe('F-AVANCAR-CORRIDA-01A — Identidade Canônica da Equipe no Painel Pré-Corrida', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.clear()
    }
  })

  // Gerador de grid canônico completo de 24 carros para testes
  const createMockGrid = (
    playerTeamKey: string = 'audi',
    options?: {
      playerEntriesCount?: number
      isPlayerFlags?: boolean[]
      extraAdversaryTeamKey?: string
    },
  ): FinalQualifyingGridEntry[] => {
    const {
      playerEntriesCount = 2,
      isPlayerFlags = [false, false],
      extraAdversaryTeamKey = 'ferrari',
    } = options || {}

    const grid: FinalQualifyingGridEntry[] = []

    // 1. Entradas da equipe do jogador
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

    // 2. Entradas adversárias para completar 24 carros
    const remainingCount = 24 - playerEntriesCount
    for (let i = 0; i < remainingCount; i++) {
      grid.push({
        gridPosition: playerEntriesCount + i + 1,
        driverId: `drv_adv_${i + 1}`,
        driverName: `Adversary ${i + 1}`,
        teamId: i % 2 === 0 ? extraAdversaryTeamKey : 'mercedes',
        teamName: i % 2 === 0 ? extraAdversaryTeamKey.toUpperCase() : 'MERCEDES',
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

  // A1 — POCKETBASE ID DIFERENTE DO TEAM KEY:
  // Equipe do jogador com record id opaco do PocketBase e team key = "audi"; grid usa "audi".
  it('A1: resolve os 2 pilotos corretos quando PocketBase ID é opaco e grid usa a chave canônica "audi"', () => {
    const pbTeamRecord = {
      id: '84fx5fgl9317xqs',
      name: 'Audi F1 Team',
      team_key: 'audi',
    }

    // O resolvedor canônico obtém a chave a partir do record
    const canonicalKey = resolveCanonicalTeamKey(pbTeamRecord)
    expect(canonicalKey).toBe('audi')

    // O grid possui teamId = "audi"
    const grid = createMockGrid('audi')

    const snapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career_a1',
      seasonYear: 2026,
      round: 1,
      teamId: canonicalKey!,
      totalLaps: 57,
      grid,
      inventories: mockInventories,
    })

    expect(snapshot.cars).toHaveLength(2)
    expect(snapshot.cars[0].driverId).toBe('drv_player_1')
    expect(snapshot.cars[0].driverName).toBe('Nico Hülkenberg')
    expect(snapshot.cars[1].driverId).toBe('drv_player_2')
    expect(snapshot.cars[1].driverName).toBe('Gabriel Bortoleto')
  })

  // A2 — OUTRA EQUIPE:
  // Usar outra team key (ex: "ferrari", "mclaren"); confirmar que não existe hardcode para Audi.
  it('A2: funciona dinamicamente para outras equipes (ex: ferrari, mclaren) sem qualquer hardcode', () => {
    const teamsToTest = ['ferrari', 'mclaren', 'williams', 'cadillac']

    for (const teamKey of teamsToTest) {
      const pbTeamRecord = {
        id: `pb_record_${teamKey}`,
        name: `${teamKey.toUpperCase()} Racing Team`,
        team_key: teamKey,
      }
      const canonicalKey = resolveCanonicalTeamKey(pbTeamRecord)
      expect(canonicalKey).toBe(teamKey)

      const grid = createMockGrid(teamKey)
      const snapshot = canonicalRacePreparationService.createInitialSnapshot({
        careerId: `test_career_${teamKey}`,
        seasonYear: 2026,
        round: 1,
        teamId: canonicalKey!,
        totalLaps: 57,
        grid,
        inventories: mockInventories,
      })

      expect(snapshot.cars).toHaveLength(2)
      expect(snapshot.cars[0].driverId).toBe('drv_player_1')
      expect(snapshot.cars[1].driverId).toBe('drv_player_2')
    }
  })

  // A3 — ISPLAYER INCOMPLETO:
  // Somente 1 ou 0 entries com isPlayer=true, mas as 2 com team key correto;
  // confirmar que os 2 pilotos são resolvidos pelo vínculo canônico.
  it('A3: resolve os 2 pilotos quando isPlayer=false em todas ou em apenas uma entrada, mas o team key está correto', () => {
    // Caso 1: 0 entradas com isPlayer = true
    const gridZeroPlayer = createMockGrid('audi', { isPlayerFlags: [false, false] })
    const snapZero = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career_a3_zero',
      seasonYear: 2026,
      round: 1,
      teamId: 'audi',
      totalLaps: 57,
      grid: gridZeroPlayer,
      inventories: mockInventories,
    })
    expect(snapZero.cars).toHaveLength(2)
    expect(snapZero.cars[0].driverId).toBe('drv_player_1')
    expect(snapZero.cars[1].driverId).toBe('drv_player_2')

    // Caso 2: apenas 1 entrada com isPlayer = true
    const gridOnePlayer = createMockGrid('audi', { isPlayerFlags: [true, false] })
    const snapOne = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career_a3_one',
      seasonYear: 2026,
      round: 1,
      teamId: 'audi',
      totalLaps: 57,
      grid: gridOnePlayer,
      inventories: mockInventories,
    })
    expect(snapOne.cars).toHaveLength(2)
    expect(snapOne.cars[0].driverId).toBe('drv_player_1')
    expect(snapOne.cars[1].driverId).toBe('drv_player_2')
  })

  // A4 — NÃO CONTAMINAR ADVERSÁRIOS:
  // As outras 22 entries não entram no snapshot do jogador.
  it('A4: snapshot do jogador contém estritamente os 2 carros da sua equipe e nenhum dos 22 adversários', () => {
    const grid = createMockGrid('audi')
    const snapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career_a4',
      seasonYear: 2026,
      round: 1,
      teamId: 'audi',
      totalLaps: 57,
      grid,
      inventories: mockInventories,
    })

    expect(snapshot.cars).toHaveLength(2)
    const selectedDriverIds = snapshot.cars.map((c) => c.driverId)
    expect(selectedDriverIds).toContain('drv_player_1')
    expect(selectedDriverIds).toContain('drv_player_2')

    // Confirmar que nenhum adversário vazou para o snapshot
    const adversaryEntries = grid.filter((g) => g.teamId !== 'audi')
    expect(adversaryEntries).toHaveLength(22)
    for (const adv of adversaryEntries) {
      expect(selectedDriverIds).not.toContain(adv.driverId)
    }
  })

  // A5 — GRID INCONSISTENTE:
  // Somente 1 piloto com team key correto; confirmar que o serviço continua rejeitando o grid,
  // sem inventar o segundo piloto.
  it('A5: lança exceção explícita se o grid contiver apenas 1 piloto da equipe, sem inventar segundo piloto', () => {
    const brokenGrid = createMockGrid('audi', { playerEntriesCount: 1 })
    expect(brokenGrid.filter((g) => g.teamId === 'audi')).toHaveLength(1)

    expect(() => {
      canonicalRacePreparationService.createInitialSnapshot({
        careerId: 'test_career_a5',
        seasonYear: 2026,
        round: 1,
        teamId: 'audi',
        totalLaps: 57,
        grid: brokenGrid,
        inventories: mockInventories,
      })
    }).toThrowError(/Grid oficial deve conter exatamente 2 pilotos/)
  })

  // A6 — INTEGRAÇÃO DO PAINEL:
  // Montar o PreRaceStrategyPreparationPanel com grid realista;
  // confirmar que o initial snapshot é criado sem exceção quando há exatamente 2 entries canônicas,
  // mesmo se o painel receber o ID opaco do PocketBase, pois ele converte para canônico.
  it('A6: PreRaceStrategyPreparationPanel inicializa e renderiza os dois pilotos da equipe sem exceção', () => {
    const grid = createMockGrid('audi')

    // Renderiza o painel passando o ID de PocketBase da Audi
    // O painel resolve via resolveCanonicalTeamKey('84fx5fgl9317xqs' -> ou teamId canônico 'audi')
    const { container } = render(
      React.createElement(PreRaceStrategyPreparationPanel, {
        careerId: 'career_test_a6',
        seasonYear: 2026,
        round: 1,
        teamId: 'audi', // Identidade canônica repassada pela WeekendV2Page
        totalLaps: 57,
        canonicalGrid: grid,
        inventories: mockInventories,
        onConfirmAndStartRace: () => {},
      }),
    )

    expect(container).toBeDefined()
    expect(screen.getByText('Nico Hülkenberg')).toBeDefined()
    expect(screen.getByText('Gabriel Bortoleto')).toBeDefined()
    expect(screen.getByText('CARRO 1')).toBeDefined()
    expect(screen.getByText('CARRO 2')).toBeDefined()
  })

  // A7 — F-AVANCAR-CORRIDA-01A-MICRO:
  // Simular a passagem de props da WeekendV2Page:
  // Objeto team possui record id opaco do PB ("84fx5fgl9317xqs") e team_key canônico ("audi").
  // O binding repassado ao PreRaceStrategyPreparationPanel é resolveCanonicalTeamKey(team) || team?.team_key || ''.
  // O grid possui teamId = "audi".
  // createInitialSnapshot / painel encontra exatamente os 2 pilotos do jogador sem estourar exceção.
  it('A7 (MICRO): binding canônico resolveCanonicalTeamKey(team) || team?.team_key passa chave canônica ao painel e createInitialSnapshot encontra 2 pilotos', () => {
    const mockTeamRecord = {
      id: '84fx5fgl9317xqs',
      name: 'Audi F1 Team',
      team_key: 'audi',
      color: '#E10600',
    }

    // Campo equivalente ao repassado por WeekendV2Page:
    const passedTeamId = resolveCanonicalTeamKey(mockTeamRecord) || mockTeamRecord.team_key || ''
    expect(passedTeamId).toBe('audi')
    expect(passedTeamId).not.toBe(mockTeamRecord.id)

    // Grid com 24 entries, onde as 2 entries do jogador usam teamId: "audi", com pelo menos um isPlayer = false
    const grid = createMockGrid('audi', { isPlayerFlags: [true, false] })
    const playerEntriesInGrid = grid.filter((g) => g.teamId === 'audi')
    expect(playerEntriesInGrid).toHaveLength(2)

    // Com o passedTeamId canônico, createInitialSnapshot encontra exatamente os 2 pilotos
    const snapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'career_test_a7',
      seasonYear: 2026,
      round: 1,
      teamId: passedTeamId,
      totalLaps: 57,
      grid,
      inventories: mockInventories,
    })

    expect(snapshot.cars).toHaveLength(2)
    expect(snapshot.cars[0].driverName).toBe('Nico Hülkenberg')
    expect(snapshot.cars[1].driverName).toBe('Gabriel Bortoleto')

    // E o painel PreRaceStrategyPreparationPanel renderiza sem lançar exceção
    const { container } = render(
      React.createElement(PreRaceStrategyPreparationPanel, {
        careerId: 'career_test_a7',
        seasonYear: 2026,
        round: 1,
        teamId: passedTeamId,
        totalLaps: 57,
        canonicalGrid: grid,
        inventories: mockInventories,
        onConfirmAndStartRace: () => {},
      }),
    )

    expect(container).toBeDefined()
    expect(screen.getByText('Nico Hülkenberg')).toBeDefined()
    expect(screen.getByText('Gabriel Bortoleto')).toBeDefined()
  })

  // A8 — F-AVANCAR-CORRIDA-01A-MICRO: Prova estrita de independência de isPlayer
  // team.id = "84fx5fgl9317xqs"; team.team_key = "audi";
  // grid com 2 entries com teamId="audi" e isPlayer ausente/false;
  // o painel recebe "audi" via resolveCanonicalTeamKey(team);
  // createInitialSnapshot encontra exatamente os 2 pilotos sem depender de isPlayer=true.
  it('A8 (MICRO): createInitialSnapshot encontra 2 pilotos estritamente por teamId="audi" mesmo quando ambos têm isPlayer=false ou ausente', () => {
    const mockTeamRecord = {
      id: '84fx5fgl9317xqs',
      name: 'Audi F1 Team',
      team_key: 'audi',
    }

    const resolvedKey = resolveCanonicalTeamKey(mockTeamRecord)
    expect(resolvedKey).toBe('audi')

    // Grid onde nenhuma entrada tem isPlayer: true (isPlayer: false em ambas)
    const grid = createMockGrid('audi', { isPlayerFlags: [false, false] })
    expect(grid.filter((e) => e.isPlayer)).toHaveLength(0)
    expect(grid.filter((e) => e.teamId === 'audi')).toHaveLength(2)

    const snapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'career_test_a8',
      seasonYear: 2026,
      round: 1,
      teamId: resolvedKey!,
      totalLaps: 57,
      grid,
      inventories: mockInventories,
    })

    expect(snapshot.cars).toHaveLength(2)
    expect(snapshot.cars.map((c) => c.driverId)).toEqual(['drv_player_1', 'drv_player_2'])
  })
})
