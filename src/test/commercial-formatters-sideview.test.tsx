import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { formatNumber, formatMoneyM, formatPercent } from '@/lib/formatters'
import { getTeamSideView, getTeamAsset } from '@/data/assets/teamAssets'
import { getCarroPorEquipeImage } from '@/assets/carroPorEquipe'
import { CarSideViewHotspots } from '@/components/commercial/CarSideViewHotspots'

describe('MICRO-PATCH v0.0.285 — Validação de Formatadores Canônicos (pt-BR)', () => {
  it('(1) floating-point cru 14.399999999999977 formata para "14,40"', () => {
    const formatted = formatNumber(14.399999999999977)
    expect(formatted).toBe('14,40')
  })

  it('(2) número 14.4 formata com 2 casas para "14,40"', () => {
    const formatted = formatNumber(14.4)
    expect(formatted).toBe('14,40')
  })

  it('(3) valor monetário 14.4 formata para "US$ 14,40 M"', () => {
    const formatted = formatMoneyM(14.4)
    expect(formatted).toBe('US$ 14,40 M')
  })

  it('(4) percentual 61.25 formata para "61,25%"', () => {
    const formatted = formatPercent(61.25)
    expect(formatted).toBe('61,25%')
  })

  it('(5) percentual inteiro 85 formata limpo para "85%"', () => {
    const formatted = formatPercent(85)
    expect(formatted).toBe('85%')
  })

  it('(6) null, undefined e NaN não quebram a UI e retornam fallbacks seguros', () => {
    // formatNumber
    expect(formatNumber(null)).toBe('0,00')
    expect(formatNumber(undefined)).toBe('0,00')
    expect(formatNumber(NaN)).toBe('0,00')

    // formatMoneyM
    expect(formatMoneyM(null)).toBe('US$ 0,00 M')
    expect(formatMoneyM(undefined)).toBe('US$ 0,00 M')
    expect(formatMoneyM(NaN)).toBe('US$ 0,00 M')

    // formatPercent
    expect(formatPercent(null)).toBe('0%')
    expect(formatPercent(undefined)).toBe('0%')
    expect(formatPercent(NaN)).toBe('0%')
  })
})

describe('MICRO-PATCH v0.0.285 — Resolução Canônica da Imagem Lateral & Hotspots', () => {
  it('(1) Audi resolve via team_key com sucesso', () => {
    const sideView = getTeamSideView('audi')
    expect(sideView).toBeDefined()
    expect(typeof sideView).toBe('string')
    expect(sideView).toMatch(/\.(jpg|jpeg|png|webp)($|\?)/i)
    expect(sideView).not.toBeNull()
  })

  it('(2) getTeamSideView retorna asset empacotado válido (Audi_VL.jpg)', () => {
    const asset = getTeamAsset('audi')
    expect(asset).not.toBeNull()
    expect(asset?.sideViewFileName).toBe('Audi_VL.jpg')
    expect(asset?.sideViewPath).toBeDefined()
    expect(asset?.sideViewPath).toContain('audivl')
  })

  it('(3) ID PocketBase aleatório não é usado como chave visual direta', () => {
    const randomPocketBaseId = 'pb_rec_9823kjsad89'
    // getTeamSideView não mapeia IDs aleatórios
    const resolved = getTeamSideView(randomPocketBaseId)
    expect(resolved).toBeNull()
  })

  it('(4) path virtual inválido (/equipes/xyz.png) não bloqueia o resolver do asset', () => {
    const legacy = getCarroPorEquipeImage('audi_custom')
    expect(legacy).toBe('/equipes/audicustom.png')
    // Na nossa lógica em CarSideViewHotspots, paths que começam com /equipes/ são tratados como virtuais
    const isVirtual = legacy.startsWith('/equipes/')
    expect(isVirtual).toBe(true)

    // Já para a Audi oficial, getTeamSideView('audi') tem autoridade e devolve o asset real
    const canonicalSideView = getTeamSideView('audi')
    expect(canonicalSideView).not.toBeNull()
    expect(canonicalSideView?.startsWith('/equipes/')).toBe(false)
  })

  it('(5) asset ausente ou equipe desconhecida usa fallback sem quebrar', () => {
    const unknownTeamSideView = getTeamSideView('equipe_fantasma_2026')
    expect(unknownTeamSideView).toBeNull()
  })

  it('(6) CarSideViewHotspots renderiza a imagem da Audi sem erro', () => {
    const { container } = render(
      <CarSideViewHotspots
        teamId="pb_rec_123"
        teamKey="audi"
        teamName="Audi Revolut F1 Team"
        contracts={[]}
        selectedSlot="sidepod"
        onSelectSlot={() => {}}
      />,
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBeDefined()
    expect(img?.getAttribute('src')).toMatch(/\.(jpg|jpeg|png|webp)($|\?)/i)
    expect(img?.getAttribute('alt')).toBe('Audi Revolut F1 Team')
  })
})
