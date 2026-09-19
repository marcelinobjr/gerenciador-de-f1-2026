import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LiveStandingsTable } from '@/components/race/LiveStandingsTable'
import { DriverLiveOperationsPanel } from '@/components/race/DriverLiveOperationsPanel'
import {
  getTeamReducedLogoUrl,
  getTeamReducedLogoDef,
  normalizeTeamIdentifier,
} from '@/lib/team-reduced-logo-resolver'
import { selectCarTireDisplayState } from '@/lib/f1-tire-system'
import type { SimDriverEntry } from '@/pages/race/types'
import type { DriverModel } from '@/types/f1'
import type { PreparationInformedPackage } from '@/services/canonicalPreparationInformedService'
import type { RacePendingDecision } from '@/types/race-session'

describe('REDESIGN DA CORRIDA AO VIVO — TESTES FOCADOS A–I', () => {
  const mockCar1Entry: SimDriverEntry = {
    driverId: 'drv_bortoleto',
    driverName: 'Gabriel Bortoleto',
    teamId: 'team_audi_sport',
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    position: 4,
    gridPosition: 6,
    score: 85,
    points: 12,
    fastestLap: false,
    usedOvertake: false,
    accumulatedTimeSec: 1240.5,
    tireCompound: 'medio',
    tireWear: 28,
    lapsOnCurrentTire: 14,
    fuelRemaining: 45.5,
    gapToLeader: '+12.4s',
    gapToFront: '+1.8s',
    lastLapTime: '1:21.450',
    lastLapTimeSec: 81.45,
    isPlayer: true,
  }

  const mockCar2Entry: SimDriverEntry = {
    driverId: 'drv_hulkenberg',
    driverName: 'Nico Hulkenberg',
    teamId: 'team_audi_sport',
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    position: 7,
    gridPosition: 7,
    score: 80,
    points: 6,
    fastestLap: false,
    usedOvertake: false,
    accumulatedTimeSec: 1248.2,
    tireCompound: 'duro',
    tireWear: 0,
    lapsOnCurrentTire: 0,
    fuelRemaining: 48.0,
    gapToLeader: '+20.1s',
    gapToFront: '+3.2s',
    lastLapTime: '1:22.100',
    lastLapTimeSec: 82.1,
    isPlayer: true,
  }

  const mockRivalFerrari: SimDriverEntry = {
    driverId: 'drv_leclerc',
    driverName: 'Charles Leclerc',
    teamId: 'team_ferrari',
    teamName: 'Ferrari',
    teamColor: '#EF1A2D',
    position: 1,
    gridPosition: 1,
    score: 95,
    points: 25,
    fastestLap: true,
    usedOvertake: false,
    accumulatedTimeSec: 1228.1,
    tireCompound: 'medio',
    tireWear: 34,
    lapsOnCurrentTire: 14,
    gapToLeader: 'LÍDER',
    gapToFront: '—',
    lastLapTime: '1:20.900',
    isPlayer: false,
  }

  const mockDriver1Model: DriverModel = {
    id: 'drv_bortoleto',
    name: 'Gabriel Bortoleto',
    role: 'titular',
    speed: 84,
    consistency: 82,
    morale: 85,
    physical_condition: 90,
    team_id: 'team_audi_sport',
    nationality: 'Brasil',
    age: 21,
    rain: 80,
    defense: 80,
    salary: 5000000,
    contract_end: 2028,
  }

  // =========================================================================
  // TESTE A: Logo correto por teamId (não por posição)
  // =========================================================================
  it('TESTE A: resolve logo correto por teamId / slug / alias e não pela posição de chegada', () => {
    // teamId do construtor
    const audiDef = getTeamReducedLogoDef('team_audi_sport')
    expect(audiDef).not.toBeNull()
    expect(audiDef?.fileName).toBe('Audi.jpg')

    const ferrariDef = getTeamReducedLogoDef('team_ferrari')
    expect(ferrariDef).not.toBeNull()
    expect(ferrariDef?.fileName).toBe('Ferrari.jpg')

    const williamsDef = getTeamReducedLogoDef('williams')
    expect(williamsDef).not.toBeNull()
    expect(williamsDef?.fileName).toBe('Williams.jpg')

    // Posição diferente não interfere na resolução
    const gridMixed = [mockRivalFerrari, mockCar1Entry]
    const logoFerrari = getTeamReducedLogoUrl(gridMixed[0].teamId)
    const logoAudi = getTeamReducedLogoUrl(gridMixed[1].teamId)

    expect(logoFerrari).toContain('1WNhKOWyf3B_clAbYkBnv9cSju3sBNtg6')
    expect(logoAudi).toContain('1E_hOCkC1UZ1vxJ_BmhMLrjVz4hjduRw-')
  })

  // =========================================================================
  // TESTE B: Tooltip mostra nome correto
  // =========================================================================
  it('TESTE B: Tooltip de equipe na tabela de classificação exibe o nome oficial do construtor', () => {
    const audiDef = getTeamReducedLogoDef('audi')
    expect(audiDef?.displayName).toBe('Audi')

    const mclarenDef = getTeamReducedLogoDef('mclaren')
    expect(mclarenDef?.displayName).toBe('McLaren')

    const rbDef = getTeamReducedLogoDef('racingbulls')
    expect(rbDef?.displayName).toBe('Racing Bulls (VCARB)')
  })

  // =========================================================================
  // TESTE C: Pilotos do jogador recebem destaque
  // =========================================================================
  it('TESTE C: Pilotos do jogador recebem destaque visual com badge APEX e borda característica', () => {
    const grid = [mockRivalFerrari, mockCar1Entry, mockCar2Entry]
    render(
      <LiveStandingsTable
        grid={grid}
        currentLap={14}
        totalLaps={50}
        playerDriverIds={['drv_bortoleto', 'drv_hulkenberg']}
        lapHistory={{}}
        selectedCompareDriverId={null}
        onSelectCompareDriverId={() => {}}
      />,
    )

    // Ambos os carros do jogador devem apresentar a badge APEX
    const apexBadges = screen.getAllByText('APEX')
    expect(apexBadges.length).toBe(2)

    // Nome dos dois pilotos renderizado
    expect(screen.getByText('Gabriel Bortoleto')).toBeInTheDocument()
    expect(screen.getByText('Nico Hulkenberg')).toBeInTheDocument()
  })

  // =========================================================================
  // TESTE D: Telemetria dos cards corresponde ao estado canônico
  // =========================================================================
  it('TESTE D: Telemetria do card operacional reflete estritamente os dados do carro', () => {
    render(
      <DriverLiveOperationsPanel
        slotNumber={1}
        driver={mockDriver1Model}
        car={mockCar1Entry}
        totalLaps={50}
        tacticalMode="normal"
        paceOrder="normal"
        onChangeTacticalMode={() => {}}
        onChangePaceOrder={() => {}}
        onCallBox={() => {}}
        onOpenRadio={() => {}}
      />,
    )

    // Posição P4
    expect(screen.getByText('P4')).toBeInTheDocument()
    // Gaps
    expect(screen.getByText('+1.8s')).toBeInTheDocument()
    expect(screen.getByText('+12.4s')).toBeInTheDocument()
    // Última volta
    expect(screen.getByText('1:21.450')).toBeInTheDocument()
    // Pneu 28% desgaste e 72% condição restante
    expect(screen.getByText('28%')).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.getByText('14 voltas de uso')).toBeInTheDocument()
    // Combustível ~47.8 kg (45.5% de 105kg = 47.8)
    expect(screen.getByText(/47\.8 kg/)).toBeInTheDocument()
  })

  // =========================================================================
  // TESTE E: Pneu 0%/4%/78% continua correto, ausente = "—" (sem fallback 50%)
  // =========================================================================
  it('TESTE E: selectCarTireDisplayState respeita 0% como valor válido e ausente como "—"', () => {
    // Caso 1: 0% de desgaste (pneu novo no início ou após troca limpa)
    const state0 = selectCarTireDisplayState({
      tireCompound: 'duro',
      tireWear: 0,
      lapsOnCurrentTire: 0,
    })
    expect(state0.tireWearPct).toBe(0)
    expect(state0.tireWearText).toBe('0%')
    expect(state0.tireConditionPct).toBe(100)
    expect(state0.tireConditionText).toBe('100%')
    expect(state0.lapsOnTire).toBe(0)
    expect(state0.lapsOnTireText).toBe('0v')

    // Caso 2: 4% de desgaste
    const state4 = selectCarTireDisplayState({
      tireCompound: 'medio',
      tireWear: 4,
      lapsOnCurrentTire: 2,
    })
    expect(state4.tireWearPct).toBe(4)
    expect(state4.tireWearText).toBe('4%')
    expect(state4.tireConditionPct).toBe(96)
    expect(state4.tireConditionText).toBe('96%')

    // Caso 3: 78% de desgaste
    const state78 = selectCarTireDisplayState({
      tireCompound: 'macio',
      tireWear: 78,
      lapsOnCurrentTire: 18,
    })
    expect(state78.tireWearPct).toBe(78)
    expect(state78.tireWearText).toBe('78%')
    expect(state78.tireConditionPct).toBe(22)
    expect(state78.tireConditionText).toBe('22%')

    // Caso 4: Ausente (sem dados) — nunca deve retornar 50%!
    const stateMissing = selectCarTireDisplayState(null)
    expect(stateMissing.tireWearPct).toBeNull()
    expect(stateMissing.tireWearText).toBe('—')
    expect(stateMissing.tireConditionPct).toBeNull()
    expect(stateMissing.tireConditionText).toBe('—')
    expect(stateMissing.lapsOnTire).toBeNull()
    expect(stateMissing.lapsOnTireText).toBe('—')
  })

  // =========================================================================
  // TESTE F: Card sem recomendação não mostra dado inventado
  // =========================================================================
  it('TESTE F: Card sem recomendação ativa não inventa card de recomendação nem bônus fantasmas', () => {
    const { container } = render(
      <DriverLiveOperationsPanel
        slotNumber={2}
        driver={mockDriver1Model}
        car={mockCar2Entry}
        totalLaps={50}
        tacticalMode="normal"
        paceOrder="normal"
        onChangeTacticalMode={() => {}}
        onChangePaceOrder={() => {}}
        onCallBox={() => {}}
        onOpenRadio={() => {}}
        informedPackage={null}
        pendingRecommendation={null}
      />,
    )

    // Não deve conter recomendação da engenharia inventada
    expect(screen.queryByText(/Recomendação da Engenharia/i)).not.toBeInTheDocument()
    // Condição normal exibe "Sem problemas detectados."
    expect(screen.getByText('Sem problemas detectados.')).toBeInTheDocument()
  })

  // =========================================================================
  // TESTE G: Botão Rádio usa handler existente
  // =========================================================================
  it('TESTE G: Botão Rádio Pit Wall chama o handler existente onOpenRadio com o driverId correto', () => {
    const handleRadio = vi.fn()
    render(
      <DriverLiveOperationsPanel
        slotNumber={1}
        driver={mockDriver1Model}
        car={mockCar1Entry}
        totalLaps={50}
        tacticalMode="normal"
        paceOrder="normal"
        onChangeTacticalMode={() => {}}
        onChangePaceOrder={() => {}}
        onCallBox={() => {}}
        onOpenRadio={handleRadio}
      />,
    )

    const radioBtn = screen.getByRole('button', { name: /Rádio Pit Wall/i })
    fireEvent.click(radioBtn)

    expect(handleRadio).toHaveBeenCalledTimes(1)
    expect(handleRadio).toHaveBeenCalledWith('drv_bortoleto')
  })

  // =========================================================================
  // TESTE H: Box este giro usa handler existente
  // =========================================================================
  it('TESTE H: Botão Box este giro chama o handler existente onCallBox com o driverId correto', () => {
    const handleBox = vi.fn()
    render(
      <DriverLiveOperationsPanel
        slotNumber={1}
        driver={mockDriver1Model}
        car={mockCar1Entry}
        totalLaps={50}
        tacticalMode="normal"
        paceOrder="normal"
        onChangeTacticalMode={() => {}}
        onChangePaceOrder={() => {}}
        onCallBox={handleBox}
        onOpenRadio={() => {}}
      />,
    )

    const boxBtn = screen.getByRole('button', { name: /Box este giro/i })
    fireEvent.click(boxBtn)

    expect(handleBox).toHaveBeenCalledTimes(1)
    expect(handleBox).toHaveBeenCalledWith('drv_bortoleto')
  })

  // =========================================================================
  // TESTE I: Layout responsivo não quebra colunas críticas
  // =========================================================================
  it('TESTE I: Tabela de classificação e cockpit respeitam classes responsivas sem quebrar colunas essenciais', () => {
    const grid = [mockRivalFerrari, mockCar1Entry]
    const { container } = render(
      <LiveStandingsTable
        grid={grid}
        currentLap={14}
        totalLaps={50}
        playerDriverIds={['drv_bortoleto']}
        lapHistory={{}}
        selectedCompareDriverId={null}
        onSelectCompareDriverId={() => {}}
      />,
    )

    // Colunas críticas POS, Piloto, Equipe, Pneu, Intervalo permanecem no DOM
    expect(screen.getByText('Pos')).toBeInTheDocument()
    expect(screen.getByText('Piloto')).toBeInTheDocument()
    expect(screen.getByText('Equipe')).toBeInTheDocument()
    expect(screen.getByText('Pneu')).toBeInTheDocument()
    expect(screen.getByText('Intervalo')).toBeInTheDocument()

    // Overflow horizontal tratado com container scrollbar-thin e overflow-x-auto
    const scrollContainer = container.querySelector('.overflow-x-auto')
    expect(scrollContainer).not.toBeNull()
  })
})
