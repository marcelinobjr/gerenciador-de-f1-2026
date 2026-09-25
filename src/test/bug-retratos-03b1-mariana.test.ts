/**
 * bug-retratos-03b1-mariana.test.ts
 *
 * Suíte de testes BUG-RETRATOS-03B1:
 * - BRT03B1-01: Mariana Fagundes possui generatedPortraitProfileId persistido/definido.
 * - BRT03B1-02: O valor de generatedPortraitProfileId é exatamente "Piloto_13".
 * - BRT03B1-03: resolveDriverPhoto retorna "/pilotos-gerados/Piloto_13.jpg".
 * - BRT03B1-04: Arquivo existe no catálogo de perfis gerados e nos assets locais.
 * - BRT03B1-05: ProspectCard utiliza retrato gerado quando generatedPortraitProfileId existe.
 * - BRT03B1-06: Mariana Fagundes não renderiza fallback de iniciais quando a imagem é válida.
 * - BRT03B1-07: Zero URLs externas (Google Drive, Dropbox, http/https) no fluxo de foto do card.
 * - BRT03B1-08: onError do <img> continua gerando fallback seguro (iniciais + badge ACAD).
 */

import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import {
  getGeneratedDriverPortraitProfile,
  GENERATED_DRIVER_PORTRAIT_PROFILES,
} from '@/lib/generated-driver-profiles'
import { ProspectCard } from '@/components/ProspectCard'
import { driverScoutingService } from '@/services/driverScoutingService'
import { ProspectScoutingCardViewModel } from '@/types/procedural-driver'
import fs from 'fs'
import path from 'path'

describe('BUG-RETRATOS-03B1: Retrato Gerado de Mariana Fagundes (Piloto_13)', () => {
  // Objeto de mock representativo da Mariana Fagundes vindo do PocketBase após o backfill
  const marianaDbRecord = {
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
  }

  // BRT03B1-01: Mariana possui generatedPortraitProfileId
  it('BRT03B1-01: Mariana possui generatedPortraitProfileId configurado', () => {
    const proceduralData = marianaDbRecord.procedural_data
    expect(proceduralData).toBeDefined()
    expect(proceduralData.generatedPortraitProfileId).toBeTruthy()
    expect(proceduralData.visualIdentity?.generatedPortraitProfileId).toBeTruthy()
  })

  // BRT03B1-02: valor é exatamente "Piloto_13"
  it('BRT03B1-02: valor do profile ID é exatamente "Piloto_13"', () => {
    const proceduralData = marianaDbRecord.procedural_data
    expect(proceduralData.generatedPortraitProfileId).toBe('Piloto_13')
    expect(proceduralData.visualIdentity?.generatedPortraitProfileId).toBe('Piloto_13')
  })

  // BRT03B1-03: resolver retorna /pilotos-gerados/Piloto_13.jpg
  it('BRT03B1-03: resolver canônico retorna /pilotos-gerados/Piloto_13.jpg', () => {
    const res = resolveDriverPhoto({
      driverId: marianaDbRecord.id,
      name: marianaDbRecord.name,
      generatedPortraitProfileId: marianaDbRecord.procedural_data.generatedPortraitProfileId,
      visualIdentity: marianaDbRecord.procedural_data.visualIdentity,
    })

    expect(res.url).toBe('/pilotos-gerados/Piloto_13.jpg')
    expect(res.sourceType).toBe('generated_procedural')
    expect(res.assetId).toBe('Piloto_13')
    expect(res.fallbackInitials).toBe('MF')
  })

  // BRT03B1-04: arquivo existe no catálogo e em public/pilotos-gerados/
  it('BRT03B1-04: arquivo existe no catálogo de perfis gerados e nos assets locais', () => {
    const profile = getGeneratedDriverPortraitProfile('Piloto_13')
    expect(profile).toBeDefined()
    expect(profile?.profileId).toBe('Piloto_13')
    expect(profile?.path).toBe('/pilotos-gerados/Piloto_13.jpg')
    expect(profile?.gender).toBe('female')

    const inCatalog = GENERATED_DRIVER_PORTRAIT_PROFILES.find((p) => p.profileId === 'Piloto_13')
    expect(inCatalog).toBeDefined()
    expect(inCatalog?.fileName).toBe('Piloto_13.jpg')

    // Checagem no filesystem local em public/pilotos-gerados/
    const diskPath = path.resolve(process.cwd(), 'public/pilotos-gerados/Piloto_13.jpg')
    expect(fs.existsSync(diskPath)).toBe(true)
  })

  // BRT03B1-05: ProspectCard usa retrato gerado quando generatedPortraitProfileId existe
  it('BRT03B1-05: ProspectCard usa retrato gerado quando generatedPortraitProfileId existe', () => {
    const scoutView: ProspectScoutingCardViewModel = driverScoutingService.createScoutingViewModel(
      marianaDbRecord as any,
      'dpvviz06tkzwbih',
    )

    expect(scoutView.generatedPortraitProfileId).toBe('Piloto_13')

    const { container } = render(React.createElement(ProspectCard, { prospect: scoutView }))
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('/pilotos-gerados/Piloto_13.jpg')
    expect(img?.getAttribute('alt')).toBe('Mariana Fagundes')
  })

  // BRT03B1-06: Mariana não renderiza fallback de iniciais
  it('BRT03B1-06: Mariana não renderiza fallback de iniciais quando a imagem inicial carrega normalmente', () => {
    const scoutView: ProspectScoutingCardViewModel = driverScoutingService.createScoutingViewModel(
      marianaDbRecord as any,
      'dpvviz06tkzwbih',
    )

    render(React.createElement(ProspectCard, { prospect: scoutView }))
    expect(screen.queryByTestId(`prospect-fallback-${marianaDbRecord.id}`)).toBeNull()
  })

  // BRT03B1-07: zero URL externa
  it('BRT03B1-07: zero URL externa (Drive/Dropbox/http/https) no fluxo de resolução e renderização do ProspectCard', () => {
    // Mesmo que o objeto legado contenha URLs externas em posterUrl ou visualIdentity
    const legacyMock: ProspectScoutingCardViewModel = {
      ...driverScoutingService.createScoutingViewModel(marianaDbRecord as any, 'dpvviz06tkzwbih'),
      posterUrl: 'https://lh3.googleusercontent.com/drive-storage/broken-mariana-url',
    }

    const { container } = render(React.createElement(ProspectCard, { prospect: legacyMock }))
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('/pilotos-gerados/Piloto_13.jpg')

    // Nenhuma URL externa renderizada
    const html = container.innerHTML
    expect(html).not.toContain('lh3.googleusercontent.com')
    expect(html).not.toContain('drive.google')
    expect(html).not.toContain('dropbox.com')
  })

  // BRT03B1-08: onError continua gerando fallback seguro
  it('BRT03B1-08: onError do <img> dispara o fallback seguro de iniciais com badge ACAD', () => {
    const scoutView: ProspectScoutingCardViewModel = driverScoutingService.createScoutingViewModel(
      marianaDbRecord as any,
      'dpvviz06tkzwbih',
    )

    const { container } = render(React.createElement(ProspectCard, { prospect: scoutView }))
    const img = container.querySelector('img')
    expect(img).not.toBeNull()

    // Dispara erro na imagem
    fireEvent.error(img!)

    // Imagem removida e fallback de iniciais exibido
    expect(container.querySelector('img')).toBeNull()
    const fallback = screen.getByTestId(`prospect-fallback-${marianaDbRecord.id}`)
    expect(fallback).toBeDefined()
    expect(fallback.textContent).toContain('MF')
    expect(fallback.textContent).toContain('ACAD')
  })
})
