import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import RegulationPage from '@/pages/RegulationPage'
import Sidebar from '@/components/Sidebar'
import {
  regulationCenterService,
  getRegulationsForSeason,
  searchRegulations,
  auditRegulationCenter,
  REGULATION_CATEGORIES,
} from '@/services/regulationCenterService'
import {
  ROOKIE_REQUIRED_TOTAL_TEAM,
  ROOKIE_REQUIRED_PER_CAR,
  ROOKIE_MAX_CAREER_STARTS,
} from '@/types/rookie-practice'
import { RookiePracticeRequirementService } from '@/services/rookiePracticeRequirementService'
import { RookieTl1PlanningService } from '@/services/rookieTl1PlanningService'
import { CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'
import { FIA_POINTS_TABLE } from '@/lib/f1-standings-calculator'
import {
  STANDARD_GP_TYRE_ALLOCATION,
  SPRINT_GP_TYRE_ALLOCATION,
} from '@/services/canonicalTyreAllocationService'
import { canonicalHomologationAdapter } from '@/lib/canonical-adapters'

// Mock do hook useUnifiedSeason
vi.mock('@/hooks/use-unified-season', () => ({
  useUnifiedSeason: () => ({
    team: {
      id: 'audi',
      name: 'Audi Revolut F1 Team',
      color: '#E10600',
      engine_supplier: 'Audi',
      strength: 80,
    },
    season: { id: 'season_2026', year: 2026, career_id: 'career_test_01', current_round: 4 },
    playerDrivers: [
      {
        id: 'drv_hulk',
        name: 'Nico Hülkenberg',
        role: 'titular',
        career_gps: 220,
        superlicense_points: 40,
      },
      {
        id: 'drv_bortoleto',
        name: 'Gabriel Bortoleto',
        role: 'titular',
        career_gps: 0,
        superlicense_points: 40,
      },
      {
        id: 'drv_reserva',
        name: 'Paul Aron',
        role: 'reserva',
        career_gps: 0,
        superlicense_points: 25,
      },
    ],
    currentRound: 4,
    totalRounds: 24,
    loading: false,
  }),
}))

describe('ETAPA REG-01: SUÍTE DE TESTES DA CENTRAL DE REGULAMENTO FIA', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  // -----------------------------------------------------------------
  // 1. REG-01 a REG-07: ROTA, SIDEBAR, CATEGORIAS, BUSCA, SEASON & BADGES
  // -----------------------------------------------------------------

  it('REG-01: rota /regulamento funciona e renderiza a RegulationPage', () => {
    render(
      <MemoryRouter initialEntries={['/regulamento']}>
        <RegulationPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('REGULAMENTO FIA')).toBeDefined()
    expect(
      screen.getByText(/Temporada 2026 — regras esportivas, técnicas e operacionais/i),
    ).toBeDefined()
  })

  it('REG-02: sidebar mostra item Regulamento FIA na seção COMPETIÇÃO com link /regulamento', () => {
    render(
      <MemoryRouter initialEntries={['/regulamento']}>
        <Sidebar onOpenSettings={() => {}} />
      </MemoryRouter>,
    )
    const navItem = screen.getByText('Regulamento FIA')
    expect(navItem).toBeDefined()
    const anchor = navItem.closest('a')
    expect(anchor?.getAttribute('href')).toBe('/regulamento')
  })

  it('REG-03: categorias regulamentares renderizam no topo da página', () => {
    render(
      <MemoryRouter>
        <RegulationPage />
      </MemoryRouter>,
    )
    expect(REGULATION_CATEGORIES.length).toBeGreaterThanOrEqual(15)
    expect(screen.getByText('Novatos no TL1')).toBeDefined()
    expect(screen.getByText('Pneus')).toBeDefined()
    expect(screen.getByText('Qualificação')).toBeDefined()
    expect(screen.getByText('Pontuação')).toBeDefined()
    expect(screen.getByText('Power Unit')).toBeDefined()
  })

  it('REG-04: busca funciona por título, termo e categoria ignorando acentos e case', () => {
    const rules = getRegulationsForSeason(2026)

    // Busca por "rookie" -> deve trazer a regra de novatos
    const rookieSearch = searchRegulations(rules, 'rookie')
    expect(rookieSearch.some((r) => r.category === 'novatos_tl1')).toBe(true)

    // Busca por "pneu" -> deve trazer regra de pneus
    const pneuSearch = searchRegulations(rules, 'pneu')
    expect(pneuSearch.some((r) => r.category === 'pneus')).toBe(true)

    // Busca por "SC" -> deve trazer Safety Car
    const scSearch = searchRegulations(rules, 'SC')
    expect(scSearch.some((r) => r.category === 'safety_car_vsc')).toBe(true)

    // Busca por "pontos" ou "pontuacao" sem acento
    const ptsSearch = searchRegulations(rules, 'pontuacao')
    expect(ptsSearch.some((r) => r.category === 'pontuacao')).toBe(true)
  })

  it('REG-05: seleção de categoria altera o conteúdo do catálogo', () => {
    render(
      <MemoryRouter>
        <RegulationPage />
      </MemoryRouter>,
    )
    // Clica no botão de categoria "Pneus"
    const pneuBtn = screen.getByRole('button', { name: /Pneus/i })
    fireEvent.click(pneuBtn)

    // Deve exibir o título da regra de pneus
    expect(
      screen.getByText(/Alocação Pirelli de Pneus e Persistência de Inventário/i),
    ).toBeDefined()
  })

  it('REG-06: temporada atual do hook/configuração aparece no cabeçalho sem hardcode', () => {
    render(
      <MemoryRouter>
        <RegulationPage />
      </MemoryRouter>,
    )
    // Hook mockado com season 2026
    expect(screen.getByText(/Temporada 2026/i)).toBeDefined()
    expect(screen.getByText(/FIA F1 2026/i)).toBeDefined()
  })

  it('REG-07: sourceType FIA / APEX renderiza corretamente com badges correspondentes', () => {
    render(
      <MemoryRouter>
        <RegulationPage />
      </MemoryRouter>,
    )
    const fiaBadges = screen.getAllByTestId('badge-source-fia')
    expect(fiaBadges.length).toBeGreaterThan(0)
    expect(fiaBadges[0].textContent).toContain('FIA 2026')
  })

  // -----------------------------------------------------------------
  // 2. REG-C01 a REG-C06: INTEGRAÇÃO EXCLUSIVA COM FONTES CANÔNICAS
  // -----------------------------------------------------------------

  it('REG-C01: rookie required vem do serviço existente (ROOKIE_REQUIRED_TOTAL_TEAM)', () => {
    const rules = getRegulationsForSeason(2026)
    const rookieRule = rules.find((r) => r.id === 'reg_rookie_fp1_obligation')
    expect(rookieRule).toBeDefined()
    expect(rookieRule?.whatItDetermines).toContain(`${ROOKIE_REQUIRED_TOTAL_TEAM} sessões`)
    expect(rookieRule?.whatItDetermines).toContain(`${ROOKIE_REQUIRED_PER_CAR} sessões no Carro 1`)
    expect(ROOKIE_REQUIRED_TOTAL_TEAM).toBe(4)
    expect(ROOKIE_REQUIRED_PER_CAR).toBe(2)
  })

  it('REG-C02: rookie completed vem do serviço existente (RookieTl1PlanningService & RequirementService)', () => {
    const summary = RookieTl1PlanningService.getPlanningSummary(
      'career_test_01',
      'season_2026',
      'audi',
    )
    expect(summary.requiredTotal).toBe(4)
    expect(summary.completedTotal).toBe(0)
    expect(summary.plannedTotal).toBe(0)
  })

  it('REG-C03: qualifying config vem do motor canônico CANONICAL_QUALIFYING_RULES', () => {
    const rules = getRegulationsForSeason(2026)
    const qualiRule = rules.find((r) => r.id === 'reg_qualifying_format')
    expect(qualiRule).toBeDefined()
    // Grid canônico do APEX possui 24 carros
    expect(CANONICAL_QUALIFYING_RULES.q1.participantsCount).toBe(24)
    expect(qualiRule?.whatItDetermines).toContain('24 carros')
    expect(qualiRule?.whatItDetermines).toContain(
      `${CANONICAL_QUALIFYING_RULES.q1.eliminatedCount} carros mais lentos`,
    )
  })

  it('REG-C04: pontuação vem de FIA_POINTS_TABLE canônica', () => {
    const rules = getRegulationsForSeason(2026)
    const ptsRule = rules.find((r) => r.id === 'reg_fia_scoring_system')
    expect(ptsRule).toBeDefined()
    expect(FIA_POINTS_TABLE).toEqual([25, 18, 15, 12, 10, 8, 6, 4, 2, 1])
    expect(ptsRule?.whatItDetermines).toContain('1º: 25 pts')
    expect(ptsRule?.whatItDetermines).toContain('10º: 1 pt')
  })

  it('REG-C05: alocação de pneus vem do domínio canônico STANDARD_GP_TYRE_ALLOCATION', () => {
    const rules = getRegulationsForSeason(2026)
    const tyreRule = rules.find((r) => r.id === 'reg_tyre_allocation_pirelli')
    expect(tyreRule).toBeDefined()
    expect(STANDARD_GP_TYRE_ALLOCATION.totalSetsPerDriver).toBe(20)
    expect(STANDARD_GP_TYRE_ALLOCATION.totalTyresPerDriver).toBe(80)
    expect(tyreRule?.whatItDetermines).toContain(
      `${STANDARD_GP_TYRE_ALLOCATION.totalSetsPerDriver} jogos de pneus`,
    )
  })

  it('REG-C06: regra de licenças vem do serviço canônico canonicalHomologationAdapter', () => {
    const titularView = canonicalHomologationAdapter.toCanonicalView({
      id: 'drv_test_1',
      name: 'Piloto Teste',
      role: 'titular',
      superlicense_points: 40,
      career_gps: 50,
    } as any)
    expect(titularView.licenseStatus).toBe('nivel_a')
    expect(titularView.isEligibleForF1Seat).toBe(true)

    const baseView = canonicalHomologationAdapter.toCanonicalView({
      id: 'drv_test_2',
      name: 'Piloto Base',
      role: 'reserva',
      superlicense_points: 15,
      career_gps: 0,
    } as any)
    expect(baseView.licenseStatus).toBe('nivel_c')
    expect(baseView.isEligibleForF1Seat).toBe(false)
  })

  // -----------------------------------------------------------------
  // 3. REG-R01 a REG-R06: OBRIGAÇÃO DE ROOKIES NO TL1
  // -----------------------------------------------------------------

  it('REG-R01: mostra 4 sessões no total de obrigação de novatos', () => {
    render(
      <MemoryRouter>
        <RegulationPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Requisito: 4 sessões/i)).toBeDefined()
  })

  it('REG-R02: mostra 2 por carro (Carro 1 e Carro 2)', () => {
    render(
      <MemoryRouter>
        <RegulationPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Carro 1:/i)).toBeDefined()
    expect(screen.getByText(/Carro 2:/i)).toBeDefined()
  })

  it('REG-R03: situação da equipe corresponde ao ledger real', () => {
    // Configura 1 participação real cumprida no requisito usando a API canônica do serviço
    RookiePracticeRequirementService.grantRookieFP1Credit({
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 1,
      carId: 'car1',
      driverId: 'drv_bortoleto',
      driverName: 'Gabriel Bortoleto',
      lapsCompleted: 18,
      isRookieEligible: true,
    })

    const summary = RookieTl1PlanningService.getPlanningSummary(
      'career_test_01',
      'season_2026',
      'audi',
    )
    expect(summary.car1.completed).toBe(1)
    expect(summary.completedTotal).toBe(1)
    expect(summary.car2.completed).toBe(0)
  })

  it('REG-R04: planejado não aparece como cumprido no resumo', () => {
    RookieTl1PlanningService.setSeatPlan({
      careerId: 'career_test_01',
      seasonId: 'season_2026',
      teamId: 'audi',
      round: 8,
      carId: 'car2',
      driver: { id: 'rookie_x', name: 'Rookie X', career_gps: 0 } as any,
    })

    const summary = RookieTl1PlanningService.getPlanningSummary(
      'career_test_01',
      'season_2026',
      'audi',
    )
    expect(summary.car2.planned).toBe(1)
    // O completed do Carro 2 continua zero!
    expect(summary.car2.completed).toBe(0)
  })

  it('REG-R05: CTA de novatos aponta para /calendario', () => {
    render(
      <MemoryRouter>
        <RegulationPage />
      </MemoryRouter>,
    )
    const ctaBtns = screen.getAllByText('VER PLANEJAMENTO NO CALENDÁRIO')
    expect(ctaBtns.length).toBeGreaterThan(0)
    const link = ctaBtns[0].closest('a')
    expect(link?.getAttribute('href')).toBe('/calendario')
  })

  it('REG-R06: inelegibilidade <=2 GPs de carreira é estritamente informada', () => {
    const rules = getRegulationsForSeason(2026)
    const rookieRule = rules.find((r) => r.id === 'reg_rookie_fp1_obligation')
    expect(rookieRule?.whatItDetermines).toContain(
      `máximo ${ROOKIE_MAX_CAREER_STARTS} Grandes Prêmios`,
    )
    expect(ROOKIE_MAX_CAREER_STARTS).toBe(2)
  })

  // -----------------------------------------------------------------
  // 4. REG-S01 a REG-S05: TAXONOMIA E STATUS DE IMPLEMENTAÇÃO
  // -----------------------------------------------------------------

  it('REG-S01: regra FIA recebe badge OFFICIAL_FIA', () => {
    const rules = getRegulationsForSeason(2026)
    const qualifyingRule = rules.find((r) => r.id === 'reg_qualifying_format')
    expect(qualifyingRule?.sourceType).toBe('OFFICIAL_FIA')
    expect(qualifyingRule?.sourceMetadata.authority).toBe('FIA')
  })

  it('REG-S02: regra de desenvolvimento APEX recebe badge APEX', () => {
    const rules = getRegulationsForSeason(2026)
    const techRule = rules.find((r) => r.id === 'reg_technical_regulations_and_eras')
    expect(techRule?.sourceType).toBe('APEX_ADAPTATION')
    expect(techRule?.sourceMetadata.authority).toBe('APEX')
  })

  it('REG-S03: regra híbrida recebe badge FIA + APEX', () => {
    const rules = getRegulationsForSeason(2026)
    const licenseRule = rules.find((r) => r.id === 'reg_driver_licenses')
    expect(licenseRule?.sourceType).toBe('APEX_ADAPTATION')
    expect(licenseRule?.sourceMetadata.authority).toBe('FIA + APEX')
  })

  it('REG-S04: regra parcial (Sprint) é expressamente identificada como SUPORTE PARCIAL', () => {
    const rules = getRegulationsForSeason(2026)
    const sprintRule = rules.find((r) => r.id === 'reg_sprint_format')
    expect(sprintRule?.status).toBe('SUPORTE PARCIAL')
    expect(sprintRule?.apexExplanation).toContain('suporte parcial no APEX')
  })

  it('REG-S05: auditoria canônica valida integridade de 100% das regras sem erro', () => {
    const audit = auditRegulationCenter(2026)
    expect(audit.isValid).toBe(true)
    expect(audit.issues.filter((i) => i.severity === 'ERROR')).toHaveLength(0)
    expect(audit.totalRules).toBeGreaterThanOrEqual(15)
  })

  // -----------------------------------------------------------------
  // 5. TESTE CONTRA NÚMEROS ILUSTRATIVOS DO MOCKUP
  // -----------------------------------------------------------------

  it('REG-MOCKUP-01: números no catálogo são derivados dos serviços canônicos', () => {
    const rules = getRegulationsForSeason(2026)

    // Verifica que não há menções hardcodadas aos valores fictícios do mockup
    const qualiRule = rules.find((r) => r.id === 'reg_qualifying_format')
    expect(qualiRule?.whatItDetermines).not.toContain('20 carros') // Mockup típico tem 20, APEX tem 24
    expect(qualiRule?.whatItDetermines).toContain('24 carros')

    const tyreRule = rules.find((r) => r.id === 'reg_tyre_allocation_pirelli')
    expect(tyreRule?.whatItDetermines).toContain('20 jogos')
    expect(tyreRule?.whatItDetermines).toContain('80 pneus')
  })
})
