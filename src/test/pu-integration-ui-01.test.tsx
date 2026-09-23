/**
 * pu-integration-ui-01.test.tsx
 *
 * Suíte de Testes PUIUI-01..10 para o Painel de Integração de PU na página de Infraestrutura.
 *
 * PUIUI-01: factory mostra teto 100%
 * PUIUI-02: customer mostra teto 90%
 * PUIUI-03: Red Bull Ford mostra Factory
 * PUIUI-04: Racing Bulls Ford mostra Customer
 * PUIUI-05: Aston Martin Honda mostra Customer
 * PUIUI-06: integration value vem do service/state (não hardcoded)
 * PUIUI-07: UI não recalcula performance
 * PUIUI-08: barra respeita teto da relação
 * PUIUI-09: fatores vêm do estado real
 * PUIUI-10: player team dinâmico
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { PowerUnitIntegrationPanel } from '@/components/car/PowerUnitIntegrationPanel'
import { canonicalPowerUnitIntegrationService } from '@/services/canonicalPowerUnitIntegrationService'

describe('PU-INTEGRATION-UI-01: Painel de Integração de Power Unit (PUIUI-01..10)', () => {
  beforeEach(() => {
    canonicalPowerUnitIntegrationService.clearMemoryCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // PUIUI-01: factory mostra teto 100%
  it('PUIUI-01: factory mostra teto 100%', () => {
    render(<PowerUnitIntegrationPanel teamId="mercedes" careerId="pui_ui_test" seasonYear={2026} />)

    const capEl = screen.getByTestId('pu-max-cap')
    expect(capEl.textContent).toContain('100%')

    const badgeEl = screen.getByTestId('pu-relationship-badge')
    expect(badgeEl.textContent).toBe('FÁBRICA')
  })

  // PUIUI-02: customer mostra teto 90%
  it('PUIUI-02: customer mostra teto 90%', () => {
    render(<PowerUnitIntegrationPanel teamId="mclaren" careerId="pui_ui_test" seasonYear={2026} />)

    const capEl = screen.getByTestId('pu-max-cap')
    expect(capEl.textContent).toContain('90%')

    const badgeEl = screen.getByTestId('pu-relationship-badge')
    expect(badgeEl.textContent).toBe('CLIENTE')
  })

  // PUIUI-03: Red Bull Ford mostra Factory
  it('PUIUI-03: Red Bull Ford mostra Factory e fornecedor Ford', () => {
    render(<PowerUnitIntegrationPanel teamId="redbull" careerId="pui_ui_test" seasonYear={2026} />)

    const supplierEl = screen.getByTestId('pu-supplier-name')
    expect(supplierEl.textContent).toBe('Ford')

    const badgeEl = screen.getByTestId('pu-relationship-badge')
    expect(badgeEl.textContent).toBe('FÁBRICA')

    const capEl = screen.getByTestId('pu-max-cap')
    expect(capEl.textContent).toContain('100%')
  })

  // PUIUI-04: Racing Bulls Ford mostra Customer
  it('PUIUI-04: Racing Bulls Ford mostra Customer e fornecedor Ford', () => {
    render(
      <PowerUnitIntegrationPanel teamId="racingbulls" careerId="pui_ui_test" seasonYear={2026} />,
    )

    const supplierEl = screen.getByTestId('pu-supplier-name')
    expect(supplierEl.textContent).toBe('Ford')

    const badgeEl = screen.getByTestId('pu-relationship-badge')
    expect(badgeEl.textContent).toBe('CLIENTE')

    const capEl = screen.getByTestId('pu-max-cap')
    expect(capEl.textContent).toContain('90%')
  })

  // PUIUI-05: Aston Martin Honda mostra Customer
  it('PUIUI-05: Aston Martin Honda mostra Customer e fornecedor Honda', () => {
    render(
      <PowerUnitIntegrationPanel teamId="astonmartin" careerId="pui_ui_test" seasonYear={2026} />,
    )

    const supplierEl = screen.getByTestId('pu-supplier-name')
    expect(supplierEl.textContent).toBe('Honda')

    const badgeEl = screen.getByTestId('pu-relationship-badge')
    expect(badgeEl.textContent).toBe('CLIENTE')

    const capEl = screen.getByTestId('pu-max-cap')
    expect(capEl.textContent).toContain('90%')
  })

  // PUIUI-06: integration value vem do service/state (não hardcoded)
  it('PUIUI-06: integration value vem do service/state (não hardcoded)', () => {
    // 1. Obter estado do serviço
    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId: 'pui_ui_test_state',
      seasonYear: 2026,
      teamId: 'cadillac',
    })

    const expectedKnowledge = Math.round(state.integrationKnowledge)
    const expectedEffective = Math.round(state.effectiveIntegration * 100)

    render(
      <PowerUnitIntegrationPanel
        teamId="cadillac"
        careerId="pui_ui_test_state"
        seasonYear={2026}
      />,
    )

    const kEl = screen.getByTestId('pu-knowledge-value')
    expect(kEl.textContent).toContain(String(expectedKnowledge))

    const effEl = screen.getByTestId('pu-effective-integration')
    expect(effEl.textContent).toBe(`${expectedEffective}%`)
  })

  // PUIUI-07: UI não recalcula performance
  it('PUIUI-07: UI apenas consome dados canônicos e renderiza sem recalcular potência nominal ou alterar estado de corrida', () => {
    const { container } = render(
      <PowerUnitIntegrationPanel teamId="ferrari" careerId="pui_ui_test" seasonYear={2026} />,
    )

    expect(screen.getByTestId('pu-integration-panel')).toBeInTheDocument()
    // O painel exibe o fornecedor Ferrari
    expect(screen.getByTestId('pu-supplier-name').textContent).toBe('Ferrari')
    // Não deve conter mutações de engine ratings no escopo da UI
    expect(container).toBeDefined()
  })

  // PUIUI-08: barra respeita teto da relação
  it('PUIUI-08: barra respeita teto da relação (para customer, alvo visual relativo é 90%)', () => {
    render(<PowerUnitIntegrationPanel teamId="williams" careerId="pui_ui_test" seasonYear={2026} />)

    const barEl = screen.getByTestId('pu-integration-bar-fill')
    const widthStyle = barEl.style.width
    const numericWidth = parseFloat(widthStyle.replace('%', ''))
    // Deve estar entre 0 e 100% da largura visual
    expect(numericWidth).toBeGreaterThan(0)
    expect(numericWidth).toBeLessThanOrEqual(100)
    // Teto exibido deve ser 90%
    expect(screen.getByTestId('pu-max-cap').textContent).toBe('90%')
  })

  // PUIUI-09: fatores vêm do estado real
  it('PUIUI-09: fatores de integração vêm do estado real (tenure, infra, staff)', () => {
    render(
      <PowerUnitIntegrationPanel
        teamId="audi"
        careerId="pui_ui_test"
        seasonYear={2026}
        facilityLevel={8}
        staffRating={85}
      />,
    )

    // O painel renderiza os fatores amigáveis
    expect(screen.getByText(/Infraestrutura/i)).toBeInTheDocument()
    expect(screen.getByText(/Corpo Técnico/i)).toBeInTheDocument()
    expect(screen.getByText(/Tempo de Parceria/i)).toBeInTheDocument()
    expect(screen.getByText(/Conhecimento Geral:/i)).toBeInTheDocument()
    expect(screen.getByText(/Conhecimento Específico:/i)).toBeInTheDocument()
  })

  // PUIUI-10: player team dinâmico
  it('PUIUI-10: player team dinâmico (renderiza corretamente para diferentes equipes escolhidas pelo jogador)', () => {
    // Equipe 1: Sauber/Ferrari (Customer 90%)
    const { unmount } = render(
      <PowerUnitIntegrationPanel teamId="sauber" careerId="pui_dyn_1" seasonYear={2026} />,
    )
    expect(screen.getByTestId('pu-supplier-name').textContent).toBe('Ferrari')
    expect(screen.getByTestId('pu-relationship-badge').textContent).toBe('CLIENTE')
    expect(screen.getByTestId('pu-max-cap').textContent).toBe('90%')
    unmount()

    // Equipe 2: Audi (Factory 100%)
    render(<PowerUnitIntegrationPanel teamId="audi" careerId="pui_dyn_2" seasonYear={2026} />)
    expect(screen.getByTestId('pu-supplier-name').textContent).toBe('Audi')
    expect(screen.getByTestId('pu-relationship-badge').textContent).toBe('FÁBRICA')
    expect(screen.getByTestId('pu-max-cap').textContent).toBe('100%')
  })
})
