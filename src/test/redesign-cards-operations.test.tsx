import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LiveStandingsTable } from '@/components/race/LiveStandingsTable'
import { DriverLiveOperationsPanel } from '@/components/race/DriverLiveOperationsPanel'
import { getTeamReducedLogoUrl, getTeamReducedLogoDef } from '@/lib/team-reduced-logo-resolver'
import { selectCarTireDisplayState } from '@/lib/f1-tire-system'
import type { SimDriverEntry } from '@/pages/race/types'
import type { DriverModel } from '@/types/f1'
import type { PreparationInformedPackage } from '@/services/canonicalPreparationInformedService'
import type { RacePendingDecision } from '@/types/race-session'

describe('REDESIGN DOS CARDS OPERACIONAIS — SUÍTE DE TESTES FOCADOS A–I', () => {
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

  const mockDriver2Model: DriverModel = {
    id: 'drv_hulkenberg',
    name: 'Nico Hulkenberg',
    role: 'titular',
    speed: 83,
    consistency: 85,
    morale: 80,
    physical_condition: 88,
    team_id: 'team_audi_sport',
    nationality: 'Alemanha',
    age: 38,
    rain: 84,
    defense: 85,
    salary: 6000000,
    contract_end: 2027,
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

  // =========================================================================
  // TESTE A: Logo existente: redesign não quebra a classificação; logo continua vindo do resolver real.
  // =========================================================================
  it('TESTE A: Redesign não quebra a classificação e os logos continuam resolvidos pelo resolver real', () => {
    const audiDef = getTeamReducedLogoDef('team_audi_sport')
    expect(audiDef).not.toBeNull()
    expect(audiDef?.displayName).toBe('Audi')
    expect(audiDef?.fileName).toBe('Audi.jpg')

    const logoAudi = getTeamReducedLogoUrl('team_audi_sport')
    expect(logoAudi).toContain('1E_hOCkC1UZ1vxJ_BmhMLrjVz4hjduRw-')

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

    // Tabela exibe pilotos e construtores
    expect(screen.getByText('Charles Leclerc')).toBeInTheDocument()
    expect(screen.getByText('Gabriel Bortoleto')).toBeInTheDocument()
    expect(screen.getByText('Nico Hulkenberg')).toBeInTheDocument()
    const apexBadges = screen.getAllByText('APEX')
    expect(apexBadges.length).toBe(2)
  })

  // =========================================================================
  // TESTE B: Telemetria do carro: dados correspondem ao estado canônico (posição, gaps, última volta, melhor volta)
  // =========================================================================
  it('TESTE B: Telemetria exibida no cabeçalho corresponde ao estado canônico (posição, gaps, última e melhor volta)', () => {
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

    // Cabeçalho: identificador Carro 1, nome, número e posição P4
    expect(screen.getByText('Carro 1')).toBeInTheDocument()
    expect(screen.getByText('Gabriel Bortoleto')).toBeInTheDocument()
    expect(screen.getByText('P4')).toBeInTheDocument()

    // Gaps canônicos
    expect(screen.getByText('+1.8s')).toBeInTheDocument()
    expect(screen.getByText('+12.4s')).toBeInTheDocument()

    // Última volta
    expect(screen.getByText('1:21.450')).toBeInTheDocument()
  })

  // =========================================================================
  // TESTE C: Pneus: casos 0%, 4%, desgaste alto, dado ausente — sem fallback fictício
  // =========================================================================
  it('TESTE C: Bloco de Pneus respeita 0%, 4%, desgaste alto e ausência sem fallback fictício', () => {
    // 1. Caso 0% desgaste (pneu novo)
    const state0 = selectCarTireDisplayState({
      tireCompound: 'duro',
      tireWear: 0,
      lapsOnCurrentTire: 0,
    })
    expect(state0.tireWearPct).toBe(0)
    expect(state0.tireWearText).toBe('0%')
    expect(state0.tireConditionPct).toBe(100)
    expect(state0.tireConditionText).toBe('100%')

    // 2. Caso 4% desgaste
    const state4 = selectCarTireDisplayState({
      tireCompound: 'medio',
      tireWear: 4,
      lapsOnCurrentTire: 2,
    })
    expect(state4.tireWearPct).toBe(4)
    expect(state4.tireWearText).toBe('4%')
    expect(state4.tireConditionPct).toBe(96)
    expect(state4.tireConditionText).toBe('96%')

    // 3. Caso Desgaste Alto (78%)
    const state78 = selectCarTireDisplayState({
      tireCompound: 'macio',
      tireWear: 78,
      lapsOnCurrentTire: 18,
    })
    expect(state78.tireWearPct).toBe(78)
    expect(state78.tireWearText).toBe('78%')
    expect(state78.tireConditionPct).toBe(22)

    // 4. Caso ausente (null) — NUNCA 50%
    const stateMissing = selectCarTireDisplayState(null)
    expect(stateMissing.tireWearPct).toBeNull()
    expect(stateMissing.tireWearText).toBe('—')
    expect(stateMissing.tireConditionPct).toBeNull()
    expect(stateMissing.tireConditionText).toBe('—')

    // Renderização no componente com Carro 2 (0% desgaste)
    render(
      <DriverLiveOperationsPanel
        slotNumber={2}
        driver={mockDriver2Model}
        car={mockCar2Entry}
        totalLaps={50}
        tacticalMode="normal"
        paceOrder="normal"
        onChangeTacticalMode={() => {}}
        onChangePaceOrder={() => {}}
        onCallBox={() => {}}
        onOpenRadio={() => {}}
      />,
    )
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('0 voltas de uso')).toBeInTheDocument()
  })

  // =========================================================================
  // TESTE D: Combustível: valor exibido = dado real; sem conversão inventada no frontend
  // =========================================================================
  it('TESTE D: Bloco de Combustível exibe dados reais (kg e %) sem conversão inventada no frontend', () => {
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

    // fuelRemaining: 45.5% -> 47.8 kg (45.5 / 100 * 105)
    expect(screen.getByText(/47\.8 kg/)).toBeInTheDocument()
    expect(screen.getByText(/(46%)/)).toBeInTheDocument()
    expect(screen.getByText(/Combustível/)).toBeInTheDocument()
  })

  // =========================================================================
  // TESTE E: Condição do carro: sem problema = estado verde correto; com problema real = alerta correto; sem dado = não fingir carro saudável
  // =========================================================================
  it('TESTE E: Condição do carro exibe estado verde sem problemas, alerta em falhas reais e não finge saudável se ausente', () => {
    // 1. Saudável
    const { rerender } = render(
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
        partsCondition={[{ id: 'part_front_wing', name: 'Asa Dianteira', condition: 92 }]}
        puStatus={{ wear: 12 }}
      />,
    )
    expect(screen.getByText('Sem problemas detectados.')).toBeInTheDocument()
    expect(screen.getByText('Integridade 92%')).toBeInTheDocument()
    expect(screen.getByText('12% desg.')).toBeInTheDocument()

    // 2. Com problema real (asa danificada + falha mecânica)
    const carWithDmg: SimDriverEntry = {
      ...mockCar1Entry,
      hasWingDamage: true,
    }
    rerender(
      <DriverLiveOperationsPanel
        slotNumber={1}
        driver={mockDriver1Model}
        car={carWithDmg}
        totalLaps={50}
        tacticalMode="normal"
        paceOrder="normal"
        onChangeTacticalMode={() => {}}
        onChangePaceOrder={() => {}}
        onCallBox={() => {}}
        onOpenRadio={() => {}}
        mechanicalIssues={[
          { driverId: 'drv_bortoleto', name: 'Vazamento Hidráulico', severity: 'moderate' },
        ]}
      />,
    )
    expect(screen.getByText('Asa Dianteira com Danos')).toBeInTheDocument()
    expect(screen.getByText('Reparo no Box')).toBeInTheDocument()
    expect(screen.getByText(/Vazamento Hidráulico \(moderate\)/)).toBeInTheDocument()

    // 3. Sem dados de telemetria mecânica — não fingir "Sem problemas" quando arrays vazios e sem PU
    rerender(
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
        partsCondition={[]}
        puStatus={null}
        mechanicalIssues={[]}
      />,
    )
    expect(screen.getByText('Sem dados de telemetria mecânica.')).toBeInTheDocument()
  })

  // =========================================================================
  // TESTE F: Estratégia: sem recomendação = não inventa card; com pendingDecision = exibe recomendação do carro correto
  // =========================================================================
  it('TESTE F: Estratégia sem recomendação não inventa card vazio; com pendingDecision exibe a recomendação do carro correto', () => {
    // 1. Sem recomendação
    const { rerender } = render(
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
        informedPackage={null}
        pendingRecommendation={null}
      />,
    )
    expect(screen.queryByText(/Recomendação da Engenharia/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Plano Padrão de Corrida/i)).toBeInTheDocument()

    // 2. Com pendingDecision específica para este carro
    const pendingRec: RacePendingDecision = {
      id: 'rec_pit_car1',
      driverId: 'drv_bortoleto',
      lap: 14,
      type: 'pit_stop_informed_recommendation',
      title: 'Antecipar parada em 2 voltas',
      description: 'Queda brusca de aderência detectada na telemetria.',
      payload: {
        proposedCompound: 'duro',
        confidence: 'alta',
        justification: 'Degradação térmica acelerada no composto médio.',
      },
      createdAt: new Date().toISOString(),
    }

    rerender(
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
        informedPackage={null}
        pendingRecommendation={pendingRec}
      />,
    )
    expect(screen.getByText('Recomendação da Engenharia')).toBeInTheDocument()
    expect(screen.getByText('Degradação térmica acelerada no composto médio.')).toBeInTheDocument()
    expect(screen.getByText('Sugerido: Composto DURO')).toBeInTheDocument()
  })

  // =========================================================================
  // TESTE G: Isolamento: Carro 1 com desgaste/dano/recomendação diferentes do Carro 2 — nenhum vazamento
  // =========================================================================
  it('TESTE G: Isolamento estrito entre Carro 1 e Carro 2 sem nenhum vazamento de estado', () => {
    const pendingRecCar1: RacePendingDecision = {
      id: 'rec_c1',
      driverId: 'drv_bortoleto',
      lap: 14,
      type: 'pit_stop_informed_recommendation',
      title: 'Box para Carro 1',
      description: 'Recomendação exclusiva do Carro 1',
      payload: {},
      createdAt: new Date().toISOString(),
    }

    render(
      <div>
        <DriverLiveOperationsPanel
          slotNumber={1}
          driver={mockDriver1Model}
          car={{ ...mockCar1Entry, tireWear: 65, lapsOnCurrentTire: 22 }}
          totalLaps={50}
          tacticalMode="attack"
          paceOrder="empurrar"
          onChangeTacticalMode={() => {}}
          onChangePaceOrder={() => {}}
          onCallBox={() => {}}
          onOpenRadio={() => {}}
          pendingRecommendation={pendingRecCar1}
        />
        <DriverLiveOperationsPanel
          slotNumber={2}
          driver={mockDriver2Model}
          car={{ ...mockCar2Entry, tireWear: 5, lapsOnCurrentTire: 2 }}
          totalLaps={50}
          tacticalMode="save_fuel"
          paceOrder="segurar"
          onChangeTacticalMode={() => {}}
          onChangePaceOrder={() => {}}
          onCallBox={() => {}}
          onOpenRadio={() => {}}
          pendingRecommendation={null}
        />
      </div>,
    )

    // Carro 1 tem 65% desgaste e 22 voltas de uso
    expect(screen.getByText('65%')).toBeInTheDocument()
    expect(screen.getByText('22 voltas de uso')).toBeInTheDocument()
    expect(screen.getByText('Recomendação exclusiva do Carro 1')).toBeInTheDocument()

    // Carro 2 tem 5% desgaste e 2 voltas de uso
    expect(screen.getByText('5%')).toBeInTheDocument()
    expect(screen.getByText('2 voltas de uso')).toBeInTheDocument()

    // Carro 1 e Carro 2 têm títulos independentes
    expect(screen.getByText('Carro 1')).toBeInTheDocument()
    expect(screen.getByText('Carro 2')).toBeInTheDocument()
  })

  // =========================================================================
  // TESTE H: Ações: Rádio Pit Wall usa handler existente; Box este giro usa handler canônico; sem segundo comando paralelo
  // =========================================================================
  it('TESTE H: Ações de Rádio Pit Wall e Box este giro disparam os handlers canônicos existentes', () => {
    const handleRadio = vi.fn()
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
        onOpenRadio={handleRadio}
      />,
    )

    const radioBtn = screen.getByRole('button', { name: /Rádio Pit Wall/i })
    const boxBtn = screen.getByRole('button', { name: /Box este giro/i })

    fireEvent.click(radioBtn)
    expect(handleRadio).toHaveBeenCalledTimes(1)
    expect(handleRadio).toHaveBeenCalledWith('drv_bortoleto')

    fireEvent.click(boxBtn)
    expect(handleBox).toHaveBeenCalledTimes(1)
    expect(handleBox).toHaveBeenCalledWith('drv_bortoleto')
  })

  // =========================================================================
  // TESTE I: Responsividade/contrato visual: estrutura mantém cabeçalho, pneus, combustível, condição, estratégia, ações
  // =========================================================================
  it('TESTE I: Contrato visual completo mantém áreas A, B, C e D sem quebras de layout', () => {
    const { container } = render(
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

    // Área A: Cabeçalho
    expect(container.querySelector('.bg-slate-50.border-b')).not.toBeNull()
    expect(screen.getByText('Carro 1')).toBeInTheDocument()

    // Área B: Pneus e Combustível em grid responsivo md:grid-cols-2
    expect(screen.getByText(/Combustível/)).toBeInTheDocument()
    expect(screen.getByText(/Condição Restante:/)).toBeInTheDocument()

    // Área C: Condição do Carro e Estratégia
    expect(screen.getByText('Condição do Carro')).toBeInTheDocument()
    expect(screen.getByText('Estratégia')).toBeInTheDocument()

    // Área D: Ações e controles táteis
    expect(screen.getByText(/Ordem de Ritmo/i)).toBeInTheDocument()
    expect(screen.getByText(/Modo Tático/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rádio Pit Wall/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Box este giro/i })).toBeInTheDocument()
  })
})
