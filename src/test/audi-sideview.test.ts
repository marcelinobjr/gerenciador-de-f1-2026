import { describe, it, expect } from 'vitest'
import { getTeamAsset, getTeamSideView, TEAM_ASSET_MANIFEST } from '@/data/assets/teamAssets'

describe('Validação Canônica da Vista Lateral da Audi (v0.0.275)', () => {
  it('garante que a Audi resolve exatamente o arquivo local Audi_VL.jpg', () => {
    const sideView = getTeamSideView('audi')
    expect(sideView).toBe('/assets/teams/sideviews/Audi_VL.jpg')

    const asset = getTeamAsset('audi')
    expect(asset).not.toBeNull()
    expect(asset?.sideViewFileName).toBe('Audi_VL.jpg')
    expect(asset?.sideViewPath).toBe('/assets/teams/sideviews/Audi_VL.jpg')

    // Aliases resolvem consistentemente
    expect(getTeamSideView('audi_f1')).toBe('/assets/teams/sideviews/Audi_VL.jpg')
    expect(getTeamSideView('audi-revolut')).toBe('/assets/teams/sideviews/Audi_VL.jpg')
    expect(getTeamSideView('audi-sport')).toBe('/assets/teams/sideviews/Audi_VL.jpg')
  })

  it('apenas a Audi possui mapeamento físico ativo no manifest nesta passada', () => {
    const keys = Object.keys(TEAM_ASSET_MANIFEST)
    expect(keys).toEqual(['audi'])
  })

  it('equipes sem arquivo físico caem em fallback limpo sem caminhos inexistentes', () => {
    expect(getTeamSideView('ferrari')).toBeNull()
    expect(getTeamSideView('mclaren')).toBeNull()
    expect(getTeamSideView('red_bull')).toBeNull()
    expect(getTeamSideView('mercedes')).toBeNull()
    expect(getTeamSideView('equipe_aleatoria_xyz')).toBeNull()
  })
})
