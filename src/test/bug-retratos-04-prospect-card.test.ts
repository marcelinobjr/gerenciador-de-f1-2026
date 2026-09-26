/**
 * bug-retratos-04-prospect-card.test.ts
 *
 * Suíte de homologação BUG-RETRATOS-04:
 * Migração e conformidade integral de src/components/ProspectCard.tsx
 * com o resolvedor canônico resolveDriverPhoto.
 *
 * Cobertura de 12 itens obrigatórios (BRT04-01..12):
 * (1) ProspectCard usa o resolver canônico resolveDriverPhoto.
 * (2) Não existe lookup/manual map de retratos dentro do componente ProspectCard.
 * (3) Piloto com imagem conhecida resolve corretamente (canônico real ou procedural).
 * (4) Piloto sem imagem usa fallback canônico (iniciais + teamColor).
 * (5) ID desconhecido não quebra o card (sem crash, fallback de iniciais limpo).
 * (6) Nome desconhecido não quebra o card.
 * (7) Dados do prospect permanecem 100% intactos após resolução visual.
 * (8) Nacionalidade não é alterada (ISO3 / texto intactos).
 * (9) Save/reload de dados de scouting não é afetado pela resolução de retrato.
 * (10) Nenhuma lógica paralela de foto criada no componente (sem maps, sem regex, sem caminhos hardcodados).
 * (11) Retrato não vaza entre pilotos (isolamento estrito entre instâncias de ProspectCard).
 * (12) Renderização da lista de prospects continua íntegra (múltiplos cards simultâneos).
 */

import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import * as driverPhotoResolverModule from '@/lib/driver-photo-resolver'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { ProspectCard } from '@/components/ProspectCard'
import { ProspectScoutingCardViewModel } from '@/types/procedural-driver'
import fs from 'fs'
import path from 'path'

describe('BUG-RETRATOS-04: Migração Canônica do ProspectCard (BRT04-01..12)', () => {
  // Mock base de prospect procedural
  const baseMockProspect: ProspectScoutingCardViewModel = {
    driverId: 'drv_proc_mariana_fagundes',
    name: 'Mariana Fagundes',
    age: 16,
    nationality: 'BRA',
    countryFlag: '🇧🇷',
    juniorCategory: 'f4',
    categoryLabel: 'FIA Fórmula 4',
    currentTeamOrAcademyName: 'Audi Junior Academy',
    isLinkedToPlayerAcademy: true,
    isLinkedToRivalAcademy: false,
    visualIdentityId: 'fictional_pilot_13',
    visualIdentity: {
      visualIdentityId: 'fictional_pilot_13',
      portraitAssetId: 'GEN_13',
      generatedPortraitProfileId: 'Piloto_13',
      gender: 'female',
      visualSeed: 13,
    },
    generatedPortraitProfileId: 'Piloto_13',
    gender: 'female',
    perceivedPotentialLabel: 'Promissor',
    perceivedPotentialValue: 72,
    evaluationConfidence: 65,
    confidenceGrade: 'Média',
    perceivedSpeed: { label: 'Ritmo', value: 68 },
    perceivedConsistency: { label: 'Consistência', value: 70 },
    perceivedRain: { label: 'Chuva', value: 62 },
    perceivedDefense: { label: 'Defesa', value: 64 },
    perceivedFeedback: { label: 'Feedback Técnico', value: 60 },
    drivingStyle: 'Técnico',
    strengths: ['Excelente em voltas de qualificação'],
    weaknesses: ['Adaptação a pista molhada'],
    personalitySummary: 'Focada e disciplinada',
    lastSeasonSummary: '2025: 3º lugar F4 Brasil',
    evaluationsDone: 2,
    careerStatus: 'academy',
    licenseStatus: 'nivel_c',
  }

  // (1) ProspectCard usa o resolver canônico
  it('BRT04-01: ProspectCard invoca resolveDriverPhoto com as opções canônicas', () => {
    const spy = vi.spyOn(driverPhotoResolverModule, 'resolveDriverPhoto')

    render(React.createElement(ProspectCard, { prospect: baseMockProspect }))

    expect(spy).toHaveBeenCalled()
    const lastCallArg = spy.mock.calls[spy.mock.calls.length - 1][0]
    expect(lastCallArg.driverId).toBe('drv_proc_mariana_fagundes')
    expect(lastCallArg.name).toBe('Mariana Fagundes')
    expect(lastCallArg.generatedPortraitProfileId).toBe('Piloto_13')

    spy.mockRestore()
  })

  // (2) Não existe lookup/manual map de retratos dentro do componente
  it('BRT04-02: ProspectCard.tsx não contém nenhum lookup manual, mapa de retratos ou hardcoded paths', () => {
    const componentSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ProspectCard.tsx'),
      'utf-8',
    )

    // Não deve conter caminhos literais como /pilotos/, /pilotos-gerados/, .jpg, .png, etc.
    expect(componentSource).not.toMatch(/\/pilotos\//)
    expect(componentSource).not.toMatch(/\/pilotos-gerados\//)
    expect(componentSource).not.toMatch(/DRV_\d{4}/)
    expect(componentSource).not.toMatch(/Piloto_\d{2}/)

    // Não deve conter imports legados de mapas de foto
    expect(componentSource).not.toContain('driver-portrait-map')
    expect(componentSource).not.toContain('driver-photos')
    expect(componentSource).not.toContain('drive-storage-photos')
    expect(componentSource).not.toContain('driver-portrait-manifest')

    // Deve importar estritamente resolveDriverPhoto
    expect(componentSource).toContain(
      "import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'",
    )
  })

  // (3) Piloto com imagem conhecida resolve corretamente
  it('BRT04-03: Piloto com retrato conhecido (procedural ou real) resolve e renderiza <img> com caminho correto', () => {
    // 3a: Piloto procedural (Mariana Fagundes -> Piloto_13)
    const { container: containerProc } = render(
      React.createElement(ProspectCard, { prospect: baseMockProspect }),
    )
    const imgProc = containerProc.querySelector('img')
    expect(imgProc).not.toBeNull()
    expect(imgProc?.getAttribute('src')).toBe('/pilotos-gerados/Piloto_13.jpg')
    expect(imgProc?.getAttribute('alt')).toBe('Mariana Fagundes')

    // 3b: Piloto canônico real (ex: mbj-001 -> Max Verstappen DRV_0001)
    const realProspect: ProspectScoutingCardViewModel = {
      ...baseMockProspect,
      driverId: 'mbj-001',
      name: 'Max Verstappen',
      generatedPortraitProfileId: undefined,
      visualIdentity: undefined,
    }

    const { container: containerReal } = render(
      React.createElement(ProspectCard, { prospect: realProspect }),
    )
    const imgReal = containerReal.querySelector('img')
    expect(imgReal).not.toBeNull()
    expect(imgReal?.getAttribute('src')).toBe('/pilotos/DRV_0001.jpg')
    expect(imgReal?.getAttribute('alt')).toBe('Max Verstappen')
  })

  // (4) Piloto sem imagem usa fallback canônico
  it('BRT04-04: Piloto válido sem imagem (Tony Kanaan mbj-135) usa fallback canônico sem crash', () => {
    const kanaanProspect: ProspectScoutingCardViewModel = {
      ...baseMockProspect,
      driverId: 'mbj-135',
      name: 'Tony Kanaan',
      generatedPortraitProfileId: undefined,
      visualIdentity: undefined,
    }

    const { container } = render(React.createElement(ProspectCard, { prospect: kanaanProspect }))
    expect(container.querySelector('img')).toBeNull()

    const fallback = screen.getByTestId('prospect-fallback-mbj-135')
    expect(fallback).toBeDefined()
    expect(fallback.textContent).toContain('TK')
    expect(fallback.textContent).toContain('ACAD')
  })

  // (5) ID desconhecido não quebra o card
  it('BRT04-05: ID desconhecido ou aleatório não quebra o card nem dispara exceção', () => {
    const unknownIdProspect: ProspectScoutingCardViewModel = {
      ...baseMockProspect,
      driverId: 'random_unknown_id_99999',
      name: 'Piloto Fantasma',
      generatedPortraitProfileId: undefined,
      visualIdentity: undefined,
    }

    expect(() => {
      render(React.createElement(ProspectCard, { prospect: unknownIdProspect }))
    }).not.toThrow()

    const fallback = screen.getByTestId('prospect-fallback-random_unknown_id_99999')
    expect(fallback).toBeDefined()
    expect(fallback.textContent).toContain('PF')
  })

  // (6) Nome desconhecido não quebra o card
  it('BRT04-06: Nome vazio, nulo ou exótico não causa crash nem renderiza "undefined"', () => {
    const exoticNameProspect: ProspectScoutingCardViewModel = {
      ...baseMockProspect,
      driverId: 'exotic_01',
      name: '   ',
      generatedPortraitProfileId: undefined,
      visualIdentity: undefined,
    }

    const { container } = render(
      React.createElement(ProspectCard, { prospect: exoticNameProspect }),
    )
    expect(container.innerHTML).not.toContain('undefined')
    expect(container.innerHTML).not.toContain('NaN')

    const fallback = screen.getByTestId('prospect-fallback-exotic_01')
    expect(fallback).toBeDefined()
    expect(fallback.textContent).toContain('F1')
  })

  // (7) Dados do prospect permanecem intactos
  it('BRT04-07: Dados técnicos, de scouting e identificadores do prospect permanecem 100% inalterados', () => {
    const originalCopy = JSON.parse(JSON.stringify(baseMockProspect))

    render(React.createElement(ProspectCard, { prospect: baseMockProspect }))

    expect(baseMockProspect).toEqual(originalCopy)
    expect(baseMockProspect.driverId).toBe('drv_proc_mariana_fagundes')
    expect(baseMockProspect.age).toBe(16)
    expect(baseMockProspect.perceivedPotentialValue).toBe(72)
    expect(baseMockProspect.evaluationConfidence).toBe(65)
  })

  // (8) Nacionalidade não é alterada
  it('BRT04-08: Nacionalidade (ISO3 / texto) permanece inalterada nos dados e renderizada com CountryFlag', () => {
    const { container } = render(React.createElement(ProspectCard, { prospect: baseMockProspect }))

    expect(baseMockProspect.nationality).toBe('BRA')
    expect(baseMockProspect.countryFlag).toBe('🇧🇷')

    // Deve exibir o badge / texto da nacionalidade
    expect(container.textContent).toContain('BRA')
    expect(container.textContent).toContain('16 anos')
  })

  // (9) Save/reload de dados de scouting não é afetado
  it('BRT04-09: Serialização e deserialização do prospect (save/reload) preserva compatibilidade com o card', () => {
    const serialized = JSON.stringify(baseMockProspect)
    const reloaded: ProspectScoutingCardViewModel = JSON.parse(serialized)

    const { container } = render(React.createElement(ProspectCard, { prospect: reloaded }))
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('/pilotos-gerados/Piloto_13.jpg')
  })

  // (10) Nenhuma lógica paralela de foto criada no componente
  it('BRT04-10: Nenhuma lógica paralela de resolução existe no ProspectCard (inspeção de AST/Source)', () => {
    const componentSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ProspectCard.tsx'),
      'utf-8',
    )

    // Não existem funções paralelas do tipo getPhoto, resolveImage, getAvatarPath
    expect(componentSource).not.toMatch(/function\s+get(?:Driver)?Photo/)
    expect(componentSource).not.toMatch(/const\s+get(?:Driver)?Photo\s*=/)
    expect(componentSource).not.toMatch(/function\s+resolveImage/)
    expect(componentSource).not.toMatch(/const\s+resolveImage\s*=/)

    // Deve haver exatamente UMA chamada a resolveDriverPhoto no componente
    const matches = componentSource.match(/resolveDriverPhoto\s*\(/g)
    expect(matches).not.toBeNull()
    expect(matches?.length).toBe(1)
  })

  // (11) Retrato não vaza entre pilotos
  it('BRT04-11: Retratos são estritamente isolados e não vazam entre diferentes instâncias de pilotos', () => {
    const driverA: ProspectScoutingCardViewModel = {
      ...baseMockProspect,
      driverId: 'pilot_gen_01',
      name: 'Piloto Alfa',
      generatedPortraitProfileId: 'Piloto_01',
      visualIdentity: {
        visualIdentityId: 'fictional_pilot_01',
        portraitAssetId: 'GEN_01',
        generatedPortraitProfileId: 'Piloto_01',
        gender: 'male',
      },
    }

    const driverB: ProspectScoutingCardViewModel = {
      ...baseMockProspect,
      driverId: 'pilot_gen_02',
      name: 'Piloto Beta',
      generatedPortraitProfileId: 'Piloto_02',
      visualIdentity: {
        visualIdentityId: 'fictional_pilot_02',
        portraitAssetId: 'GEN_02',
        generatedPortraitProfileId: 'Piloto_02',
        gender: 'male',
      },
    }

    const { container: contA } = render(React.createElement(ProspectCard, { prospect: driverA }))
    const { container: contB } = render(React.createElement(ProspectCard, { prospect: driverB }))

    const imgA = contA.querySelector('img')
    const imgB = contB.querySelector('img')

    expect(imgA?.getAttribute('src')).toBe('/pilotos-gerados/Piloto_01.jpg')
    expect(imgB?.getAttribute('src')).toBe('/pilotos-gerados/Piloto_02.jpg')
    expect(imgA?.getAttribute('src')).not.toEqual(imgB?.getAttribute('src'))
  })

  // (12) Renderização da lista de prospects continua íntegra
  it('BRT04-12: Renderização de múltiplos cards simultâneos na lista de scouting permanece íntegra', () => {
    const driversList: ProspectScoutingCardViewModel[] = [
      {
        ...baseMockProspect,
        driverId: 'drv_1',
        name: 'Mariana Fagundes',
        generatedPortraitProfileId: 'Piloto_13',
      },
      {
        ...baseMockProspect,
        driverId: 'mbj-005',
        name: 'Lando Norris',
        generatedPortraitProfileId: undefined,
        visualIdentity: undefined,
      },
      {
        ...baseMockProspect,
        driverId: 'mbj-135',
        name: 'Tony Kanaan',
        generatedPortraitProfileId: undefined,
        visualIdentity: undefined,
      },
    ]

    const { container } = render(
      React.createElement(
        'div',
        { className: 'grid grid-cols-3' },
        driversList.map((d) => React.createElement(ProspectCard, { key: d.driverId, prospect: d })),
      ),
    )

    // Devem haver 2 imagens (Mariana e Norris) e 1 fallback (Kanaan)
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(2)

    const srcs = Array.from(images).map((img) => img.getAttribute('src'))
    expect(srcs).toContain('/pilotos-gerados/Piloto_13.jpg')
    expect(srcs).toContain('/pilotos/DRV_0005.jpg')

    // Fallback de Tony Kanaan presente
    expect(screen.getByTestId('prospect-fallback-mbj-135')).toBeDefined()
  })

  // Bônus: onError do <img> em tempo de execução dispara fallback seguro sem estourar exceção
  it('BRT04-BONUS: Erro no carregamento da tag <img> ativa imediatamente o fallback visual seguro', () => {
    const { container } = render(React.createElement(ProspectCard, { prospect: baseMockProspect }))
    const img = container.querySelector('img')
    expect(img).not.toBeNull()

    // Dispara onError simulando falha de rede/arquivo
    fireEvent.error(img!)

    expect(container.querySelector('img')).toBeNull()
    const fallback = screen.getByTestId('prospect-fallback-drv_proc_mariana_fagundes')
    expect(fallback).toBeDefined()
    expect(fallback.textContent).toContain('MF')
  })
})
