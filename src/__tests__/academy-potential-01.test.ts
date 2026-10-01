import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ProspectCard } from '@/components/ProspectCard'
import { driverScoutingService } from '@/services/driverScoutingService'
import { DriverModel } from '@/types/f1'
import { ProspectScoutingCardViewModel } from '@/types/procedural-driver'

describe('ACADEMY-POTENTIAL-01: Sincronização Canônica do Potencial da Academia', () => {
  // Mariana Fagundes mock canônico no banco (Piloto_13, perceived_potential = 72, evaluation_confidence = 63)
  const marianaRecord: DriverModel = {
    id: 'qm6xcgc5mstulg3',
    name: 'Mariana Fagundes',
    nationality: 'Brasil',
    age: 16,
    speed: 59,
    consistency: 60,
    rain: 56,
    defense: 61,
    technical_feedback: 52,
    salary: 180000,
    contract_end: 2027,
    team_id: 'dpvviz06tkzwbih',
    is_academy: true,
    is_test_driver: false,
    license_status: 'nivel_c' as const,
    origin_type: 'procedural' as const,
    true_potential: 71,
    perceived_potential: 72,
    evaluation_confidence: 63,
    career_status: 'academy' as const,
    procedural_data: {
      driverId: 'drv_proc_mariana_fagundes',
      displayName: 'M. Fagundes',
      countryFlag: '🇧🇷',
      careerStatus: 'academy',
      currentAcademyTeamId: 'dpvviz06tkzwbih',
      academyOriginTeamId: 'dpvviz06tkzwbih',
      dateOfBirth: '2010-03-16',
      generatedPortraitProfileId: 'Piloto_13',
      visualIdentity: {
        visualIdentityId: 'fictional_pilot_13',
        portraitAssetId: 'GEN_13',
        generatedPortraitProfileId: 'Piloto_13',
        gender: 'female' as const,
        stylePromptSeed: 13,
      },
    },
  } as any

  it('AP01-01: Fonte única - driverScoutingService cria viewModel com perceivedPotentialValue = 72', () => {
    const scoutView = driverScoutingService.createScoutingViewModel(
      marianaRecord,
      'dpvviz06tkzwbih',
    )
    expect(scoutView.perceivedPotentialValue).toBe(72)
    expect(scoutView.evaluationConfidence).toBe(63)
    expect(scoutView.perceivedPotentialLabel).toBe('Médio')
  })

  it('AP01-02: ProspectCard exibe o valor numérico canônico "Potencial Atual: 72 pts" junto ao badge "Médio"', () => {
    const scoutView = driverScoutingService.createScoutingViewModel(
      marianaRecord,
      'dpvviz06tkzwbih',
    )
    const { container } = render(React.createElement(ProspectCard, { prospect: scoutView }))

    // Detalhe deve conter Potencial Atual: 72 pts
    expect(container.textContent).toContain('Potencial Atual: 72 pts')
    // Badge qualitativo deve ser mantido
    expect(container.textContent).toContain('Médio')
    // Confiança deve permanecer independente em 63%
    expect(container.textContent).toContain('Confiança da Avaliação: 63% (Média)')
  })

  it('AP01-03: Confiança é mantida independente e NÃO é confundida com o potencial', () => {
    const customProspect: ProspectScoutingCardViewModel = {
      ...driverScoutingService.createScoutingViewModel(marianaRecord, 'dpvviz06tkzwbih'),
      perceivedPotentialValue: 85,
      perceivedPotentialLabel: 'Muito Alto',
      evaluationConfidence: 45,
      confidenceGrade: 'Média',
    }
    const { container } = render(React.createElement(ProspectCard, { prospect: customProspect }))

    expect(container.textContent).toContain('Potencial Atual: 85 pts')
    expect(container.textContent).toContain('Muito Alto')
    expect(container.textContent).toContain('Confiança da Avaliação: 45% (Média)')
  })

  it('AP01-04: Save/reload (serialização/desserialização) preserva potencial numérico de 72', () => {
    const scoutView = driverScoutingService.createScoutingViewModel(
      marianaRecord,
      'dpvviz06tkzwbih',
    )
    const serialized = JSON.stringify(scoutView)
    const reloaded: ProspectScoutingCardViewModel = JSON.parse(serialized)

    expect(reloaded.perceivedPotentialValue).toBe(72)
    expect(reloaded.evaluationConfidence).toBe(63)

    const { container } = render(React.createElement(ProspectCard, { prospect: reloaded }))
    expect(container.textContent).toContain('Potencial Atual: 72 pts')
    expect(container.textContent).toContain('Confiança da Avaliação: 63% (Média)')
  })
})
