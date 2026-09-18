import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { OFFICIAL_SPONSOR_SLOTS, getTeamHotspots } from '@/data/assets/teamSponsorHotspots'
import { CarSideViewHotspots } from '@/components/commercial/CarSideViewHotspots'

describe('PATCH VISUAL v0.0.286 — Mapa de Espaços Oficiais no Carro F1 2026', () => {
  it('Hotspots oficiais da Audi e padrão possuem coordenadas percentuais calibradas', () => {
    const audiConfig = getTeamHotspots('audi')
    expect(audiConfig.hasCalibratedCoordinates).toBe(true)

    // 5 slots canônicos
    const slots = ['nose', 'front_wing', 'sidepod', 'engine_cover', 'rear_wing'] as const
    slots.forEach((key) => {
      const coord = audiConfig.slots[key]
      expect(coord).toBeDefined()
      expect(coord.x).toBeGreaterThan(0)
      expect(coord.x).toBeLessThan(100)
      expect(coord.y).toBeGreaterThan(0)
      expect(coord.y).toBeLessThan(100)
      expect(coord.boxBand).toBeDefined()
    })

    // Checagem de zonas físicas relativas:
    // Bico (nariz dianteiro superior) deve ficar na extremidade frontal esquerda
    expect(audiConfig.slots.nose.x).toBeLessThan(15)
    // Asa dianteira fica abaixo do bico na região frontal
    expect(audiConfig.slots.front_wing.x).toBeLessThan(20)
    expect(audiConfig.slots.front_wing.y).toBeGreaterThan(audiConfig.slots.nose.y)
    // Sidepod / Lateral fica na região central da carenagem
    expect(audiConfig.slots.sidepod.x).toBeGreaterThan(45)
    expect(audiConfig.slots.sidepod.x).toBeLessThan(60)
    // Tampa do motor fica atrás do cockpit / antes da asa traseira
    expect(audiConfig.slots.engine_cover.x).toBeGreaterThan(60)
    expect(audiConfig.slots.engine_cover.x).toBeLessThan(75)
    // Asa traseira fica na extremidade traseira direita
    expect(audiConfig.slots.rear_wing.x).toBeGreaterThan(85)
  })

  it('Distribuição das caixas entre faixas pretas: 4 superiores e 1 inferior', () => {
    const audiConfig = getTeamHotspots('audi')
    const topBoxes = Object.values(audiConfig.slots).filter((s) => s.boxBand === 'top')
    const bottomBoxes = Object.values(audiConfig.slots).filter((s) => s.boxBand === 'bottom')

    expect(topBoxes).toHaveLength(4)
    expect(bottomBoxes).toHaveLength(1)

    // Top: Bico, Lateral, Tampa do Motor, Asa Traseira
    const topKeys = topBoxes.map((s) => s.slot)
    expect(topKeys).toContain('nose')
    expect(topKeys).toContain('sidepod')
    expect(topKeys).toContain('engine_cover')
    expect(topKeys).toContain('rear_wing')

    // Bottom: Asa Dianteira
    expect(bottomBoxes[0].slot).toBe('front_wing')
  })

  it('CarSideViewHotspots renderiza estrutura de faixas pretas e elementos sem erro', () => {
    const { container } = render(
      <CarSideViewHotspots
        teamId="audi_f1"
        teamKey="audi"
        teamName="Audi F1 Team"
        contracts={[
          {
            contractId: 'c1',
            sponsorId: 'sp1',
            sponsorName: 'Audi Global Partner',
            teamId: 'audi_f1',
            seasonStart: 2026,
            seasonEnd: 2027,
            slot: 'sidepod',
            fixedAnnualValue: 164_010_000,
            valuePerRound: 6_833_750,
            paymentSchedule: 'per_round',
            bonuses: [],
            objectives: [],
            partnershipType: 'title_sponsor',
            isTitleSponsor: true,
            satisfaction: 85,
            renewalInterest: 80,
            status: 'ativo',
            signingDate: '2026-01-01',
          },
        ]}
        selectedSlot="sidepod"
        onSelectSlot={() => {}}
      />,
    )

    // SVG de linhas de conexão deve estar presente
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()

    // Imagem do carro deve estar presente
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('alt')).toBe('Audi F1 Team')

    // Textos canônicos
    expect(container.textContent).toContain('ESPAÇOS OFICIAIS // MONOPOSTO F1 2026')
    expect(container.textContent).toContain('Audi Global Partner')
    expect(container.textContent).toContain('US$ 164,01 M/ano')
    expect(container.textContent).toContain('Bico')
    expect(container.textContent).toContain('Asa Dianteira')
    expect(container.textContent).toContain('Tampa do Motor')
    expect(container.textContent).toContain('Asa Traseira')
  })
})
