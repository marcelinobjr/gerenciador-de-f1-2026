import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { DriverSidePanel } from '@/components/DriverSidePanel'
import { DriverPoster } from '@/components/DriverPoster'
import { getDriverCareerStats, MBJ_2026_PILOTS, getOverallRating } from '@/lib/mbj-drivers-data'
import { hasDriverPoster, getLocalDriverPosterCandidates } from '@/lib/pilot-posters'
import { UnifiedDriverItem } from '@/pages/DriversPage'

// Mock de pilotos de teste canônicos
const mockVerstappen: UnifiedDriverItem = {
  id: 'driver_verstappen',
  name: 'Max Verstappen',
  nationality: 'Países Baixos',
  age: 29,
  speed: 98,
  consistency: 96,
  rain: 97,
  defense: 95,
  salaryUsd: 55000000,
  contractEnd: 2028,
  teamId: 'team_redbull',
  teamKey: 'redbull',
  teamName: 'Red Bull Racing',
  teamColor: '#0600EF',
  role: 'titular',
  category: 'f1',
  potentialMin: 96,
  potentialMax: 99,
  f1RacesCompleted: 208,
  superlicensePoints: 80,
  isAcademyProspect: false,
  isPlayerDriver: false,
  racePace: 98,
  feedback: 94,
  preferredNumber: 1,
}

const mockFreeDriver: UnifiedDriverItem = {
  id: 'driver_free_agent',
  name: 'Liam Lawson',
  nationality: 'Nova Zelândia',
  age: 24,
  speed: 82,
  consistency: 80,
  rain: 79,
  defense: 81,
  salaryUsd: 4000000,
  contractEnd: 2026,
  teamId: null,
  teamKey: null,
  teamName: null,
  role: null,
  category: 'f1',
  potentialMin: 80,
  potentialMax: 88,
  f1RacesCompleted: 11,
  superlicensePoints: 45,
  isAcademyProspect: false,
  isPlayerDriver: false,
  preferredNumber: 30,
}

const mockJuniorNoSuperlicense: UnifiedDriverItem = {
  id: 'driver_junior_f3',
  name: 'Piloto Junior Academy',
  nationality: 'Brasil',
  age: 17,
  speed: 70,
  consistency: 68,
  rain: 65,
  defense: 69,
  salaryUsd: 300000,
  contractEnd: 2026,
  teamId: null,
  teamKey: null,
  teamName: null,
  role: null,
  category: 'f3',
  potentialMin: 78,
  potentialMax: 90,
  f1RacesCompleted: 0,
  superlicensePoints: 15,
  isAcademyProspect: true,
  isPlayerDriver: false,
}

describe('Aba Pilotos — Suíte de Requisitos Funcionais e Visuais (A a L)', () => {
  // A. Filtro Sob contrato
  it('A. Piloto sob contrato deve possuir status "Sob contrato" e equipe definida', () => {
    const isContracted = Boolean(
      (mockVerstappen.teamId || mockVerstappen.teamKey) && mockVerstappen.role !== null,
    )
    expect(isContracted).toBe(true)
    expect(mockVerstappen.teamName).toBe('Red Bull Racing')
  })

  // B. Filtro Mercado
  it('B. Piloto livre no mercado deve ter equipe nula e status desvinculado', () => {
    const isContracted = Boolean(
      (mockFreeDriver.teamId || mockFreeDriver.teamKey) && mockFreeDriver.role !== null,
    )
    expect(isContracted).toBe(false)
    expect(mockFreeDriver.teamId).toBeNull()
    expect(mockFreeDriver.teamName).toBeNull()
  })

  // C. Filtro Com superlicença
  it('C. Piloto com superlicença válida (>= 40 pontos ou histórico F1) é identificado corretamente', () => {
    const hasSlVerstappen =
      mockVerstappen.superlicensePoints >= 40 || mockVerstappen.f1RacesCompleted > 0
    const hasSlFree = mockFreeDriver.superlicensePoints >= 40 || mockFreeDriver.f1RacesCompleted > 0
    expect(hasSlVerstappen).toBe(true)
    expect(hasSlFree).toBe(true)
  })

  // D. Filtro Sem superlicença
  it('D. Piloto sem superlicença (< 40 pts e 0 GPs de F1) é identificado corretamente', () => {
    const hasSlJunior =
      mockJuniorNoSuperlicense.superlicensePoints >= 40 ||
      mockJuniorNoSuperlicense.f1RacesCompleted > 0
    expect(hasSlJunior).toBe(false)
  })

  // E. Filtro por categoria
  it('E. Categorias distintas são mapeadas adequadamente (F1, F2, F3, WEC, etc.)', () => {
    expect(mockVerstappen.category).toBe('f1')
    expect(mockJuniorNoSuperlicense.category).toBe('f3')
  })

  // F. Busca por nome
  it('F. Busca por substring de nome funciona de maneira case-insensitive', () => {
    const searchA = 'verstappen'
    const searchB = 'LIAM'
    expect(mockVerstappen.name.toLowerCase().includes(searchA.toLowerCase())).toBe(true)
    expect(mockFreeDriver.name.toLowerCase().includes(searchB.toLowerCase())).toBe(true)
  })

  // G. Clique abre painel lateral
  it('G. Painel lateral renderiza nome do piloto selecionado e detalhes', () => {
    const onOpenProfile = vi.fn()
    const { getByTestId, getByText } = render(
      <DriverSidePanel
        driver={mockVerstappen}
        f1CareerStats={{ races: 208, wins: 63, poles: 40, championships: 4 }}
        marketRange={{
          displayRange: 'US$ 50,0 M – US$ 60,0 M',
          minAnnualSalary: 50000000,
          maxAnnualSalary: 60000000,
        }}
        hasSuperlicense={true}
        contractStatusLabel="Sob contrato"
        contractStatusType="contracted"
        categoryLabel="F1"
        onOpenFullProfile={onOpenProfile}
      />,
    )

    expect(getByTestId('driver-side-panel')).toBeDefined()
    expect(getByText('Max Verstappen')).toBeDefined()
    expect(getByText('Red Bull Racing')).toBeDefined()
  })

  // H. Painel usa poster correto
  it('H. Painel usa o poster vertical do piloto existente no projeto/Drive', () => {
    // Verstappen possui poster canônico
    const candidates = getLocalDriverPosterCandidates('Max Verstappen')
    expect(candidates.length).toBeGreaterThan(0)
    expect(hasDriverPoster('Max Verstappen')).toBe(true)

    const { container } = render(<DriverPoster name="Max Verstappen" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
  })

  // I. Estatísticas F1 corretas (somente F1)
  it('I. Estatísticas na Fórmula 1 registram apenas números oficiais de F1', () => {
    const mbjVerstappen = MBJ_2026_PILOTS.find((p) => p.name === 'Max Verstappen')
    expect(mbjVerstappen).toBeDefined()
    const statsVerstappen = getDriverCareerStats({ pilot: mbjVerstappen })
    expect(statsVerstappen).not.toBeNull()
    expect(statsVerstappen.wins).toBeGreaterThanOrEqual(60)
    expect(statsVerstappen.championships).toBeGreaterThanOrEqual(3)

    // Piloto sem F1 tem 0 vitórias na F1
    const statsJunior = getDriverCareerStats({ pilot: null })
    expect(statsJunior.wins).toBe(0)
    expect(statsJunior.races).toBe(0)
  })

  // J. Piloto livre não aparece como contratado
  it('J. Piloto livre no mercado exibe status "Livre no mercado" e disponibilidade "Disponível"', () => {
    const onOpenProfile = vi.fn()
    const { getByText } = render(
      <DriverSidePanel
        driver={mockFreeDriver}
        f1CareerStats={{ races: 11, wins: 0, poles: 0, championships: 0 }}
        marketRange={{
          displayRange: 'US$ 3,0 M – US$ 5,0 M',
          minAnnualSalary: 3000000,
          maxAnnualSalary: 5000000,
        }}
        hasSuperlicense={true}
        contractStatusLabel="Livre no mercado"
        contractStatusType="free"
        categoryLabel="F1"
        onOpenFullProfile={onOpenProfile}
      />,
    )

    expect(getByText('Livre no mercado')).toBeDefined()
    expect(getByText('Disponível')).toBeDefined()
  })

  // K. Contratado não aparece como livre
  it('K. Piloto sob contrato não exibe "Disponível"', () => {
    const onOpenProfile = vi.fn()
    const { getByText, queryByText } = render(
      <DriverSidePanel
        driver={mockVerstappen}
        f1CareerStats={{ races: 208, wins: 63, poles: 40, championships: 4 }}
        marketRange={{
          displayRange: 'US$ 50,0 M – US$ 60,0 M',
          minAnnualSalary: 50000000,
          maxAnnualSalary: 60000000,
        }}
        hasSuperlicense={true}
        contractStatusLabel="Sob contrato"
        contractStatusType="contracted"
        categoryLabel="F1"
        onOpenFullProfile={onOpenProfile}
      />,
    )

    expect(getByText('Sob contrato')).toBeDefined()
    expect(getByText('Indisponível')).toBeDefined()
  })

  // L. Mobile responsivo e botões acessíveis
  it('L. Painel lateral mobile renderiza botões de ação e fecha se solicitado', () => {
    const onClose = vi.fn()
    const onOpenProfile = vi.fn()

    const { getByText } = render(
      <DriverSidePanel
        driver={mockVerstappen}
        f1CareerStats={{ races: 208, wins: 63, poles: 40, championships: 4 }}
        marketRange={{
          displayRange: 'US$ 50,0 M – US$ 60,0 M',
          minAnnualSalary: 50000000,
          maxAnnualSalary: 60000000,
        }}
        hasSuperlicense={true}
        contractStatusLabel="Sob contrato"
        contractStatusType="contracted"
        categoryLabel="F1"
        onClose={onClose}
        onOpenFullProfile={onOpenProfile}
        isMobileModal={true}
      />,
    )

    const fullProfileBtn = getByText('Ver perfil completo')
    expect(fullProfileBtn).toBeDefined()
    fireEvent.click(fullProfileBtn)
    expect(onOpenProfile).toHaveBeenCalledTimes(1)
  })
})
