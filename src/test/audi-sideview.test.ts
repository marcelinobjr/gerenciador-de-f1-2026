import { describe, it, expect } from 'vitest'
import { getTeamAsset, getTeamSideView, TEAM_ASSET_MANIFEST } from '@/data/assets/teamAssets'

describe('Validação Canônica da Vista Lateral da Audi (v0.0.276)', () => {
  it('garante que a Audi resolve o asset empacotado válido via bundle do Vite', () => {
    const sideView = getTeamSideView('audi')
    expect(sideView).toBeDefined()
    expect(typeof sideView).toBe('string')
    // Não pode apontar para o diretório virtual inexistente em public/
    expect(sideView).not.toBe('/assets/teams/sideviews/Audi_VL.jpg')
    // Deve resolver o asset do bundle (ex.: /src/assets/audivl-cfef2.jpg ou hash no build)
    expect(sideView).toMatch(/\.(jpg|jpeg|png|webp)($|\?)/i)

    const asset = getTeamAsset('audi')
    expect(asset).not.toBeNull()
    expect(asset?.sideViewFileName).toBe('Audi_VL.jpg')
    expect(asset?.sideViewPath).toBe(sideView)

    // Aliases resolvem consistentemente o mesmo asset empacotado
    expect(getTeamSideView('audi_f1')).toBe(sideView)
    expect(getTeamSideView('audi-revolut')).toBe(sideView)
    expect(getTeamSideView('audi-sport')).toBe(sideView)
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
