import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { PilotProfileDialog } from '@/components/PilotProfileDialog'
import {
  OrganizationalCapacityCard,
  BottleneckSectorKey,
} from '@/components/team/OrganizationalCapacityCard'

// Mock de subcomponentes pesados para isolar renderização e layout
vi.mock('@/components/DriverPoster', () => ({
  DriverPoster: ({ name }: { name: string }) => <div data-testid="driver-poster">{name}</div>,
}))

vi.mock('@/components/CountryFlag', () => ({
  CountryFlag: ({ code }: { code: string }) => <span data-testid="country-flag">{code}</span>,
}))

describe('TASK 1 — Responsividade e Layout do PilotProfileDialog', () => {
  const dummyPilot = {
    id: 'mbj-020',
    name: 'Gabriel Bortoleto',
    age: 21,
    nationality: 'BRA',
    category: 'f1' as const,
    role: 'titular',
    overall: 82,
    salaryUsd: 8000000,
    team: 'Audi F1 Team',
    teamName: 'Audi F1 Team',
    isPlayerDriver: true,
    speed: 84,
    qualifying: 83,
    racePace: 83,
    consistency: 85,
    start: 81,
    overtake: 83,
    defense: 82,
    rain: 80,
    tireManagement: 82,
    energyManagement: 80,
    feedback: 85,
    pressure: 82,
    concentration: 85,
    resilience: 82,
    moraleState: 85,
  }

  it('(a) Renderiza DialogContent com max-h-[90vh], overflow-hidden e flex-col', () => {
    const { baseElement } = render(
      <PilotProfileDialog
        pilot={dummyPilot as any}
        open={true}
        onOpenChange={() => {}}
        onOpenContractModal={() => {}}
      />,
    )

    const dialogContent = baseElement.querySelector('[role="dialog"]')
    expect(dialogContent).not.toBeNull()
    expect(dialogContent?.className).toContain('max-h-[90vh]')
    expect(dialogContent?.className).toContain('overflow-hidden')
    expect(dialogContent?.className).toContain('flex')
    expect(dialogContent?.className).toContain('flex-col')
  })

  it('(b) Corpo rolável dedicado flex-1 overflow-y-auto contém foto, identificação e atributos esportivos', () => {
    const { baseElement } = render(
      <PilotProfileDialog
        pilot={dummyPilot as any}
        open={true}
        onOpenChange={() => {}}
        onOpenContractModal={() => {}}
      />,
    )

    const scrollBody = baseElement.querySelector('.flex-1.overflow-y-auto')
    expect(scrollBody).not.toBeNull()

    // O corpo rolável deve conter o pôster/foto e a identificação do piloto
    expect(scrollBody?.querySelector('[data-testid="driver-poster"]')).not.toBeNull()
    expect(scrollBody?.textContent).toContain('Gabriel Bortoleto')
    expect(scrollBody?.textContent).toContain('Audi F1 Team')
    expect(scrollBody?.textContent).toContain('US$ 8.000.000/ano')

    // Contém a seção de características esportivas
    expect(scrollBody?.textContent).toContain('ESPORTIVOS (VALORES EXATOS DA SUA EQUIPE)')
    expect(scrollBody?.textContent).toContain('Ritmo Classificação')
    expect(scrollBody?.textContent).toContain('Ritmo Corrida')
    expect(scrollBody?.textContent).toContain('Ultrapassagem')
    expect(scrollBody?.textContent).toContain('Defesa')
    expect(scrollBody?.textContent).toContain('Largada')
  })

  it('(c) Grid de atributos esportivos é responsivo (grid-cols-1 sm:grid-cols-2)', () => {
    const { baseElement } = render(
      <PilotProfileDialog
        pilot={dummyPilot as any}
        open={true}
        onOpenChange={() => {}}
        onOpenContractModal={() => {}}
      />,
    )

    const sportsGrid = baseElement.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2')
    expect(sportsGrid).not.toBeNull()
  })

  it('(d) Rodapé de ações é fixo (shrink-0 border-t bg-white/95 backdrop-blur) com botões acessíveis', () => {
    const onOpenChange = vi.fn()
    const onRelegate = vi.fn()
    const onPromote = vi.fn()
    const onDismiss = vi.fn()
    const onContract = vi.fn()

    const { baseElement } = render(
      <PilotProfileDialog
        pilot={dummyPilot as any}
        open={true}
        onOpenChange={onOpenChange}
        onOpenContractModal={onContract}
        onRelegateToReserve={onRelegate}
        onPromoteToStarter={onPromote}
        onDismissDriver={onDismiss}
        canRelegateToReserve={true}
        canPromoteToStarter={false}
      />,
    )

    const footer = baseElement.querySelector('.shrink-0.border-t')
    expect(footer).not.toBeNull()
    expect(footer?.className).toContain('bg-white/95')
    expect(footer?.className).toContain('backdrop-blur')

    // Botão Fechar funciona
    const closeBtn = screen.getByRole('button', { name: /Fechar/i })
    expect(closeBtn).toBeDefined()
    fireEvent.click(closeBtn)
    expect(onOpenChange).toHaveBeenCalledWith(false)

    // Botão Rebaixar funciona
    const relegateBtn = screen.getByRole('button', { name: /Rebaixar p\/ Reserva/i })
    expect(relegateBtn).toBeDefined()
    fireEvent.click(relegateBtn)
    expect(onRelegate).toHaveBeenCalled()

    // Botão Dispensar funciona
    const dismissBtn = screen.getByRole('button', { name: /Dispensar Piloto/i })
    expect(dismissBtn).toBeDefined()
    fireEvent.click(dismissBtn)
    expect(onDismiss).toHaveBeenCalled()

    // Botão Renegociar Contrato funciona
    const renegotiateBtn = screen.getByRole('button', { name: /Renegociar Contrato/i })
    expect(renegotiateBtn).toBeDefined()
    fireEvent.click(renegotiateBtn)
    expect(onContract).toHaveBeenCalled()
  })
})

describe('TASK 2 — Destino do Ponto de Atenção e Detalhes por Setor no OrganizationalCapacityCard', () => {
  const dummyCapacities = {
    aerodynamics: 50,
    engineering: 87,
    trackOperations: 88,
    commercial: 79,
  }

  it('Caso 1: Setor Aerodinâmica como gargalo aciona onResolveBottleneck("aerodynamics")', () => {
    const onResolve = vi.fn()
    render(
      <OrganizationalCapacityCard
        capacities={dummyCapacities}
        bottleneckSectorKey="aerodynamics"
        bottleneckText="Aerodinâmica"
        bottleneckImpact="Impacto: atraso no desenvolvimento aerodinâmico"
        onResolveBottleneck={onResolve}
      />,
    )

    // Clicar no box Ponto de Atenção
    const attentionBox = screen.getByText(/Ponto de Atenção/i).closest('div')
    expect(attentionBox).not.toBeNull()
    fireEvent.click(attentionBox!)
    expect(onResolve).toHaveBeenCalledWith('aerodynamics')

    // Clicar no botão Detalhes >
    const detailsBtn = screen.getByRole('button', { name: /Detalhes/i })
    fireEvent.click(detailsBtn)
    expect(onResolve).toHaveBeenCalledWith('aerodynamics')
  })

  it('Caso 2: Setor Engenharia como gargalo aciona onResolveBottleneck("engineering")', () => {
    const onResolve = vi.fn()
    const engCapacities = {
      aerodynamics: 90,
      engineering: 45,
      trackOperations: 85,
      commercial: 80,
    }

    render(
      <OrganizationalCapacityCard
        capacities={engCapacities}
        bottleneckSectorKey="engineering"
        bottleneckText="Engenharia"
        bottleneckImpact="Impacto: menor eficiência em peças e upgrades"
        onResolveBottleneck={onResolve}
      />,
    )

    const attentionBox = screen.getByText(/Ponto de Atenção/i).closest('div')
    fireEvent.click(attentionBox!)
    expect(onResolve).toHaveBeenCalledWith('engineering')
  })

  it('Caso 3: Setor Operações de Pista como gargalo aciona onResolveBottleneck("trackOperations")', () => {
    const onResolve = vi.fn()
    const trackCapacities = {
      aerodynamics: 85,
      engineering: 82,
      trackOperations: 40,
      commercial: 75,
    }

    render(
      <OrganizationalCapacityCard
        capacities={trackCapacities}
        bottleneckSectorKey="trackOperations"
        bottleneckText="Operações de pista"
        bottleneckImpact="Impacto: risco em paradas e acerto do carro"
        onResolveBottleneck={onResolve}
      />,
    )

    const attentionBox = screen.getByText(/Ponto de Atenção/i).closest('div')
    fireEvent.click(attentionBox!)
    expect(onResolve).toHaveBeenCalledWith('trackOperations')
  })

  it('Caso 4: Setor Comercial como gargalo aciona onResolveBottleneck("commercial")', () => {
    const onResolve = vi.fn()
    const commCapacities = {
      aerodynamics: 85,
      engineering: 82,
      trackOperations: 80,
      commercial: 35,
    }

    render(
      <OrganizationalCapacityCard
        capacities={commCapacities}
        bottleneckSectorKey="commercial"
        bottleneckText="Comercial"
        bottleneckImpact="Impacto: atratividade reduzida para patrocinadores"
        onResolveBottleneck={onResolve}
      />,
    )

    const attentionBox = screen.getByText(/Ponto de Atenção/i).closest('div')
    fireEvent.click(attentionBox!)
    expect(onResolve).toHaveBeenCalledWith('commercial')
  })

  it('Caso 5: Resolução dinâmica automática caso bottleneckSectorKey não seja explicitamente passado', () => {
    const onResolve = vi.fn()
    const autoCapacities = {
      aerodynamics: 95,
      engineering: 90,
      trackOperations: 92,
      commercial: 42, // menor score
    }

    render(
      <OrganizationalCapacityCard
        capacities={autoCapacities}
        bottleneckText="Setor com gargalo detectado"
        onResolveBottleneck={onResolve}
      />,
    )

    const attentionBox = screen.getByText(/Ponto de Atenção/i).closest('div')
    fireEvent.click(attentionBox!)
    expect(onResolve).toHaveBeenCalledWith('commercial')
  })
})
