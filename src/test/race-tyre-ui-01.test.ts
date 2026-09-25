import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getTyreImage, getTyreMeta, LOCAL_TYRE_ASSETS } from '@/lib/tyre-assets'
import type { TireCompound } from '@/types/f1'

describe('RACE-TYRE-UI-01B: Fechamento definitivo da UI de pneus e seletor canônico', () => {
  // RTUI01-01 /corrida renderiza somente uma interface ativa de seleção de compostos
  it('RTUI01-01: WeekendV2Page não possui duplicidade visual de seleção de pneus', () => {
    const weekendFilePath = path.resolve(process.cwd(), 'src/pages/WeekendV2Page.tsx')
    const fileContent = fs.readFileSync(weekendFilePath, 'utf-8')

    // Deve conter SessionCarPreparationPanel para a escolha/preparação
    expect(fileContent).toContain('<SessionCarPreparationPanel')

    // Não deve conter chamada visual ao TyreInventoryPanel
    expect(fileContent).not.toContain('<TyreInventoryPanel')
  })

  // RTUI01-02 TyreInventoryPanel duplicado não é renderizado na árvore ativa
  it('RTUI01-02: TyreInventoryPanel duplicado não é renderizado na árvore ativa de WeekendV2Page', () => {
    const weekendFilePath = path.resolve(process.cwd(), 'src/pages/WeekendV2Page.tsx')
    const fileContent = fs.readFileSync(weekendFilePath, 'utf-8')

    // Confirma que nenhuma tag <TyreInventoryPanel> existe no arquivo
    const matches = fileContent.match(/<TyreInventoryPanel/g)
    expect(matches).toBeNull()
  })

  // RTUI01-03 Soft usa Macios.jpg
  it('RTUI01-03: Soft usa Macios.jpg', () => {
    expect(getTyreImage('soft')).toBe('/pneus/Macios.jpg')
    expect(getTyreImage('macio')).toBe('/pneus/Macios.jpg')
    expect(LOCAL_TYRE_ASSETS.macio).toBe('/pneus/Macios.jpg')
  })

  // RTUI01-04 Medium usa Médios.jpg
  it('RTUI01-04: Medium usa Médios.jpg', () => {
    expect(getTyreImage('medium')).toBe('/pneus/Médios.jpg')
    expect(getTyreImage('medio')).toBe('/pneus/Médios.jpg')
    expect(LOCAL_TYRE_ASSETS.medio).toBe('/pneus/Médios.jpg')
  })

  // RTUI01-05 Hard usa Duros.jpg
  it('RTUI01-05: Hard usa Duros.jpg', () => {
    expect(getTyreImage('hard')).toBe('/pneus/Duros.jpg')
    expect(getTyreImage('duro')).toBe('/pneus/Duros.jpg')
    expect(LOCAL_TYRE_ASSETS.duro).toBe('/pneus/Duros.jpg')
  })

  // RTUI01-06 Intermediate usa Intermediário.jpg
  it('RTUI01-06: Intermediate usa Intermediário.jpg', () => {
    expect(getTyreImage('intermediate')).toBe('/pneus/Intermediário.jpg')
    expect(getTyreImage('intermediario')).toBe('/pneus/Intermediário.jpg')
    expect(LOCAL_TYRE_ASSETS.intermediario).toBe('/pneus/Intermediário.jpg')
  })

  // RTUI01-07 Wet usa Chuva.jpg
  it('RTUI01-07: Wet usa Chuva.jpg', () => {
    expect(getTyreImage('wet')).toBe('/pneus/Chuva.jpg')
    expect(getTyreImage('chuva_extrema')).toBe('/pneus/Chuva.jpg')
    expect(LOCAL_TYRE_ASSETS.chuva_extrema).toBe('/pneus/Chuva.jpg')
  })

  // RTUI01-08 todas as imagens vêm de getTyreImage()
  it('RTUI01-08: todas as imagens vêm do resolver canônico local getTyreImage()', () => {
    const compounds: TireCompound[] = ['macio', 'medio', 'duro', 'intermediario', 'chuva_extrema']
    for (const c of compounds) {
      const img = getTyreImage(c)
      expect(img).toMatch(/^\/pneus\/[A-Za-zÀ-ÿ]+\.jpg$/)
      expect(img).toBe(LOCAL_TYRE_ASSETS[c])
    }
  })

  // RTUI01-09 zero URL externa de pneu
  it('RTUI01-09: zero URL externa ou não-local de pneu nos arquivos tocados', () => {
    const filesToCheck = [
      'src/lib/tyre-assets.ts',
      'src/components/race/SessionCarPreparationPanel.tsx',
      'src/components/race/PreRaceStrategyPreparationPanel.tsx',
    ]

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath)
      const content = fs.readFileSync(fullPath, 'utf-8')
      expect(content).not.toMatch(/https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|webp|svg)/i)
      expect(content).not.toMatch(/drive\.google\.com/i)
      expect(content).not.toMatch(/dropbox/i)
      expect(content).not.toMatch(/placehold/i)
      expect(content).not.toMatch(/unsplash/i)
    }
  })

  // RTUI01-10 selecionar composto atualiza o estado canônico real
  it('RTUI01-10: SessionCarPreparationPanel e PreRaceStrategyPreparationPanel chamam callbacks canônicos reais sem criar estado paralelo', () => {
    const sessionPanelPath = path.resolve(
      process.cwd(),
      'src/components/race/SessionCarPreparationPanel.tsx',
    )
    const sessionContent = fs.readFileSync(sessionPanelPath, 'utf-8')

    // Deve invocar onSelectTyreSet
    expect(sessionContent).toContain('onSelectTyreSet(set.id)')
    // Proibido estados paralelos especificados
    expect(sessionContent).not.toContain('selectedCompoundVisual')
    expect(sessionContent).not.toContain('selectedTyre2')
    expect(sessionContent).not.toContain('localTyreState')
    expect(sessionContent).not.toContain('fakeTyreInventory')

    const preRacePanelPath = path.resolve(
      process.cwd(),
      'src/components/race/PreRaceStrategyPreparationPanel.tsx',
    )
    const preRaceContent = fs.readFileSync(preRacePanelPath, 'utf-8')
    expect(preRaceContent).toContain('handleSelectTyre(carSlot, tyre)')
    expect(preRaceContent).not.toContain('selectedCompoundVisual')
    expect(preRaceContent).not.toContain('selectedTyre2')
    expect(preRaceContent).not.toContain('localTyreState')
    expect(preRaceContent).not.toContain('fakeTyreInventory')
  })

  // RTUI01-11 estoque permanece correto
  it('RTUI01-11: estoque e disponibilidade por composto são calculados sobre inventory real', () => {
    const sessionPanelPath = path.resolve(
      process.cwd(),
      'src/components/race/SessionCarPreparationPanel.tsx',
    )
    const sessionContent = fs.readFileSync(sessionPanelPath, 'utf-8')

    // Filtra sobre o inventário real por composto
    expect(sessionContent).toContain('inventory.filter((t) => t.compound === comp)')
    // Exibe jogos novos e usados
    expect(sessionContent).toContain('newSetsCount')
    expect(sessionContent).toContain('usedSetsCount')
    expect(sessionContent).toContain('installedCount')
  })

  // RTUI01-12 PreRaceStrategyPreparationPanel usa o resolver canônico
  it('RTUI01-12: PreRaceStrategyPreparationPanel usa getTyreImage e getTyreMeta', () => {
    const preRacePanelPath = path.resolve(
      process.cwd(),
      'src/components/race/PreRaceStrategyPreparationPanel.tsx',
    )
    const preRaceContent = fs.readFileSync(preRacePanelPath, 'utf-8')

    expect(preRaceContent).toContain('getTyreImage')
    expect(preRaceContent).toContain('getTyreImage(car.startingCompound)')
    expect(preRaceContent).toContain('getTyreImage(tyre.compound)')
  })

  // RTUI01-13 nenhum segundo seletor/painel de compostos permanece visível na rota
  it('RTUI01-13: nenhum segundo seletor/painel de compostos permanece visível em WeekendV2Page', () => {
    const weekendFilePath = path.resolve(process.cwd(), 'src/pages/WeekendV2Page.tsx')
    const content = fs.readFileSync(weekendFilePath, 'utf-8')

    expect(content).not.toContain('<TyreInventoryPanel')
  })

  // RTUI01-14 Intermediate e Wet renderizam mesmo com sessão seca
  it('RTUI01-14: Intermediate e Wet têm suporte visual e meta completos em qualquer condição', () => {
    const interMeta = getTyreMeta('intermediario')
    expect(interMeta.name).toBe('INTERMEDIÁRIO')
    expect(interMeta.code).toBe('Intermediate')
    expect(interMeta.localAsset).toBe('/pneus/Intermediário.jpg')

    const wetMeta = getTyreMeta('chuva_extrema')
    expect(wetMeta.name).toBe('CHUVA EXTREMA')
    expect(wetMeta.code).toBe('Wet')
    expect(wetMeta.localAsset).toBe('/pneus/Chuva.jpg')

    // SessionCarPreparationPanel itera todos os 5 compostos de COMPOUND_ORDER:
    // ['macio', 'medio', 'duro', 'intermediario', 'chuva_extrema']
    const sessionPanelPath = path.resolve(
      process.cwd(),
      'src/components/race/SessionCarPreparationPanel.tsx',
    )
    const sessionContent = fs.readFileSync(sessionPanelPath, 'utf-8')

    expect(sessionContent).toContain("['macio', 'medio', 'duro', 'intermediario', 'chuva_extrema']")
  })
})
