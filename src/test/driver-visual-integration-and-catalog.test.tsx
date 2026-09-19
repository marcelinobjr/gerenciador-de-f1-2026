import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { matchEntity, MatchCandidate } from '@/lib/entity-matcher'
import {
  FICTIONAL_PORTRAITS_CATALOG,
  getAvailableFictionalPortraits,
  getFictionalPortraitById,
} from '@/lib/fictional-driver-catalog'
import { proceduralDriverGenerator } from '@/services/proceduralDriverGenerator'
import { driverVisualAssetService } from '@/services/driverVisualAssetService'
import { DriverVisualAssetIdentity } from '@/types/procedural-driver'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { DriverPoster } from '@/components/DriverPoster'
import { getLocalDriverPosterCandidates } from '@/lib/pilot-posters'

describe('Integração de Imagens Canônicas, Catálogo Fictício & Entity Matcher', () => {
  // ==========================================
  // 1. MATCHER CANÔNICO & TOLERÂNCIA A GRAFIA
  // ==========================================
  describe('Entity Matcher', () => {
    const candidates: MatchCandidate[] = [
      { id: 'norris', name: 'Lando Norris', type: 'driver', aliases: ['Norris', 'Lando'] },
      {
        id: 'bottas',
        name: 'Valtteri Bottas',
        type: 'driver',
        aliases: ['Bottas', 'Valteri Botas'],
      },
      { id: 'russell', name: 'George Russell', type: 'driver', aliases: ['Russell', 'Russel'] },
      { id: 'lawson', name: 'Liam Lawson', type: 'driver', aliases: ['Lawson'] },
      {
        id: 'mick_schumacher',
        name: 'Mick Schumacher',
        type: 'driver',
        aliases: ['Schumacher Jr', 'Shumacher'],
      },
      {
        id: 'sainz',
        name: 'Carlos Sainz Jr.',
        type: 'driver',
        aliases: ['Sainz Jr.', 'Carlos Sainz'],
      },
      { id: 'ferrari', name: 'Scuderia Ferrari', type: 'team', aliases: ['Ferrari'] },
    ]

    it('normaliza e resolve erros de grafia comuns em nomes de pilotos', () => {
      // Noris -> Norris
      const norrisMatch = matchEntity('Lando Noris', candidates, { entityTypeFilter: 'driver' })
      expect(norrisMatch.matched).toBe(true)
      expect(norrisMatch.entityId).toBe('norris')

      // Botas -> Bottas
      const bottasMatch = matchEntity('Valteri Botas', candidates, { entityTypeFilter: 'driver' })
      expect(bottasMatch.matched).toBe(true)
      expect(bottasMatch.entityId).toBe('bottas')

      // Russel -> Russell
      const russellMatch = matchEntity('George Russel', candidates, { entityTypeFilter: 'driver' })
      expect(russellMatch.matched).toBe(true)
      expect(russellMatch.entityId).toBe('russell')

      // Lawson -> Lawson
      const lawsonMatch = matchEntity('Liam Lawson', candidates, { entityTypeFilter: 'driver' })
      expect(lawsonMatch.matched).toBe(true)
      expect(lawsonMatch.entityId).toBe('lawson')

      // Shumacher -> Schumacher
      const schumacherMatch = matchEntity('Mick Shumacher', candidates, {
        entityTypeFilter: 'driver',
      })
      expect(schumacherMatch.matched).toBe(true)
      expect(schumacherMatch.entityId).toBe('mick_schumacher')
    })

    it('preserva sufixos de distinção como "Jr."', () => {
      const matchJr = matchEntity('Carlos Sainz Jr.', candidates, { entityTypeFilter: 'driver' })
      expect(matchJr.matched).toBe(true)
      expect(matchJr.entityId).toBe('sainz')
    })

    it('separa rigorosamente escopo de equipe vs piloto', () => {
      // Busca por equipe filtra tipo team
      const teamMatch = matchEntity('Scuderia Ferrari', candidates, { entityTypeFilter: 'team' })
      expect(teamMatch.matched).toBe(true)
      expect(teamMatch.entityId).toBe('ferrari')

      // Busca por piloto filtrando tipo driver não deve casar Ferrari
      const driverMatch = matchEntity('Scuderia Ferrari', candidates, {
        entityTypeFilter: 'driver',
      })
      expect(driverMatch.matched).toBe(false)
    })
  })

  // ==========================================
  // 2. CATÁLOGO DE RETRATOS FICTÍCIOS
  // ==========================================
  describe('Catálogo Fictício (Google Drive)', () => {
    it('possui IDs únicos para todos os 13 retratos', () => {
      expect(FICTIONAL_PORTRAITS_CATALOG.length).toBe(13)
      const ids = FICTIONAL_PORTRAITS_CATALOG.map((p) => p.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(13)
    })

    it('possui exatamente 12 retratos elegíveis (7 masculinos, 5 femininos) e 1 pendente de revisão (Piloto_02)', () => {
      const malePortraits = getAvailableFictionalPortraits('male')
      const femalePortraits = getAvailableFictionalPortraits('female')
      const allAvailable = getAvailableFictionalPortraits()

      expect(malePortraits.length).toBe(7)
      expect(femalePortraits.length).toBe(5)
      expect(allAvailable.length).toBe(12)

      const pilot02 = getFictionalPortraitById('fictional_pilot_02')
      expect(pilot02).not.toBeNull()
      expect(pilot02?.status).toBe('pending_review')
      expect(pilot02?.gender).toBe('pending_review')
    })

    it('todos os retratos contêm URLs válidas lh3 / drive', () => {
      FICTIONAL_PORTRAITS_CATALOG.forEach((item) => {
        expect(item.displayUrl).toMatch(
          /^https:\/\/(lh3\.googleusercontent\.com|drive\.google\.com)/,
        )
        expect(item.thumbnailUrl).toMatch(
          /^https:\/\/(lh3\.googleusercontent\.com|drive\.google\.com)/,
        )
      })
    })
  })

  // ==========================================
  // 3. GERADOR PROCEDURAL & GÊNERO / RETRATO
  // ==========================================
  describe('Gerador Procedural (proceduralDriverGenerator)', () => {
    it('respeita proporção feminina configurável e tem default em 50% (estatístico com lote grande)', () => {
      const sampleSize = 600
      let femaleCount = 0

      for (let i = 0; i < sampleSize; i++) {
        const generated = proceduralDriverGenerator.generateDriver({
          seed: 50000 + i * 13,
        })
        const gender = generated.metadata.visualIdentity.gender
        if (gender === 'female') {
          femaleCount++
        }
      }

      const ratio = femaleCount / sampleSize
      // Em lote de 600 com seed pseudo-aleatória, deve ficar perto de 50% (entre 42% e 58%)
      expect(ratio).toBeGreaterThan(0.42)
      expect(ratio).toBeLessThan(0.58)
    })

    it('aceita femaleRatio customizado (ex.: 0% ou 100%)', () => {
      const allMale = proceduralDriverGenerator.generateDriver({
        femaleRatio: 0.0,
        seed: 777,
      })
      expect(allMale.metadata.visualIdentity.gender).toBe('male')

      const allFemale = proceduralDriverGenerator.generateDriver({
        femaleRatio: 1.0,
        seed: 888,
      })
      expect(allFemale.metadata.visualIdentity.gender).toBe('female')
    })

    it('o gênero sorteado determina estritamente o pool de retratos do catálogo fictício', () => {
      const malePortraits = getAvailableFictionalPortraits('male').map((p) => p.id)
      const femalePortraits = getAvailableFictionalPortraits('female').map((p) => p.id)

      for (let i = 0; i < 40; i++) {
        const gen = proceduralDriverGenerator.generateDriver({ seed: 1000 + i * 9 })
        const visual = gen.metadata.visualIdentity

        if (visual.gender === 'female') {
          expect(femalePortraits).toContain(visual.portraitAssetId)
        } else {
          expect(malePortraits).toContain(visual.portraitAssetId)
        }
      }
    })

    it('desacopla totalmente os atributos esportivos do sorteio visual', () => {
      // Duas sementes esportivas com identidades visuais distintas
      const d1 = proceduralDriverGenerator.generateDriver({ seed: 12345 })
      const d2 = proceduralDriverGenerator.generateDriver({ seed: 67890 })

      expect(d1.driver.id).not.toBe(d2.driver.id)
      expect(d1.metadata.visualIdentity.visualIdentityId).not.toBe(
        d2.metadata.visualIdentity.visualIdentityId,
      )
    })

    it('esgotamento de retratos da equipe reutiliza sem loop infinito', () => {
      const malePortraits = getAvailableFictionalPortraits('male').map((p) => p.id)

      // Equipe já possui todos os retratos masculinos
      const visual = driverVisualAssetService.createVisualIdentity(
        'pilot_overflow',
        42,
        'male',
        malePortraits, // todos já usados
      )

      expect(visual.portraitAssetId).toBeDefined()
      expect(malePortraits).toContain(visual.portraitAssetId)
    })
  })

  // ==========================================
  // 4. PERSISTÊNCIA & RESOLUÇÃO DE IDENTIDADE
  // ==========================================
  describe('Persistência e Resolução de Imagens', () => {
    it('preserva portraitAssetId e visualIdentity no ciclo criar -> persistir -> recarregar', () => {
      const gen = proceduralDriverGenerator.generateDriver({ seed: 4444 })
      const originalDriver = gen.driver
      const originalAssetId = gen.metadata.visualIdentity.portraitAssetId

      // Simula serialização JSON (salvar no banco/localstorage)
      const serialized = JSON.stringify(originalDriver)
      const deserialized = JSON.parse(serialized)

      expect(deserialized.procedural_data.visualIdentity.portraitAssetId).toBe(originalAssetId)
      expect(deserialized.procedural_data.visualIdentity.visualIdentityId).toBe(
        gen.metadata.visualIdentity.visualIdentityId,
      )

      // Resolução de URL deve ser estável e idêntica
      const candidatesBefore = getLocalDriverPosterCandidates(
        originalDriver.name,
        originalDriver.id,
        (originalDriver as any).procedural_data.visualIdentity,
      )
      const candidatesAfter = getLocalDriverPosterCandidates(
        deserialized.name,
        deserialized.id,
        deserialized.procedural_data.visualIdentity,
      )

      expect(candidatesBefore.length).toBeGreaterThan(0)
      expect(candidatesBefore[0]).toBe(candidatesAfter[0])
    })

    it('respeita a hierarquia: (i) Custom -> (ii) portraitAssetId -> (iii) Matcher por nome', () => {
      const customIdentity: DriverVisualAssetIdentity = {
        isCustom: true,
        customImageUrl: 'https://cdn.example.com/custom_avatar.png',
        portraitAssetId: 'fictional_pilot_01',
      }
      const candidatesCustom = getLocalDriverPosterCandidates(
        'Lando Norris',
        'norris',
        customIdentity,
      )
      expect(candidatesCustom[0]).toBe('https://cdn.example.com/custom_avatar.png')

      const fictionalIdentity: DriverVisualAssetIdentity = {
        isCustom: false,
        portraitAssetId: 'fictional_pilot_03',
      }
      const candidatesFictional = getLocalDriverPosterCandidates(
        'Piloto Desconhecido',
        'unknown_id',
        fictionalIdentity,
      )
      const p3 = getFictionalPortraitById('fictional_pilot_03')
      expect(candidatesFictional[0]).toBe(p3?.displayUrl)

      // Sem visualIdentity cai no matcher canônico (ex.: Lando Norris)
      const candidatesCanon = getLocalDriverPosterCandidates('Lando Norris', 'norris', null)
      expect(candidatesCanon.length).toBeGreaterThan(0)
      expect(candidatesCanon[0]).not.toBe(p3?.displayUrl)
    })
  })

  // ==========================================
  // 5. TESTES DE COMPONENTES REAIS (UI)
  // ==========================================
  describe('Renderização em Componentes Reais (DriverPhotoAvatar & DriverPoster)', () => {
    it('DriverPoster renderiza imagem do catálogo quando visualIdentity é fornecido', () => {
      const visualIdentity: DriverVisualAssetIdentity = {
        visualIdentityId: 'vis_test_1',
        portraitAssetId: 'fictional_pilot_05',
        gender: 'female',
      }
      const expectedPortrait = getFictionalPortraitById('fictional_pilot_05')

      render(
        <DriverPoster
          name="Elena Rossi"
          driverId="drv_elena"
          visualIdentity={visualIdentity}
          aspectRatio="tall"
        />,
      )

      const img = screen.getByRole('img') as HTMLImageElement
      expect(img).toBeDefined()
      expect(img.src).toBe(expectedPortrait?.displayUrl)
    })

    it('DriverPhotoAvatar renderiza imagem do catálogo quando visualIdentity é fornecido', () => {
      const visualIdentity: DriverVisualAssetIdentity = {
        visualIdentityId: 'vis_test_2',
        portraitAssetId: 'fictional_pilot_08',
        gender: 'male',
      }
      const expectedPortrait = getFictionalPortraitById('fictional_pilot_08')

      render(
        <DriverPhotoAvatar
          name="Mateo Silva"
          driverId="drv_mateo"
          visualIdentity={visualIdentity}
          size="md"
        />,
      )

      const img = screen.getByRole('img') as HTMLImageElement
      expect(img).toBeDefined()
      expect(img.src).toBe(expectedPortrait?.displayUrl)
    })

    it('DriverPhotoAvatar e DriverPoster aceitam portraitAssetId string direto como retrocompatibilidade', () => {
      const expectedPortrait = getFictionalPortraitById('fictional_pilot_11')

      render(
        <DriverPhotoAvatar name="Clara Dupont" portraitAssetId="fictional_pilot_11" size="sm" />,
      )

      const img = screen.getByRole('img') as HTMLImageElement
      expect(img).toBeDefined()
      expect(img.src).toBe(expectedPortrait?.displayUrl)
    })
  })
})
