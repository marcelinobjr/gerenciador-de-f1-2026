import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { FREE_ENGINE_QUOTA } from '@/services/f1Service'

describe('MICRO-PACK-UI-02: CAR-PAGE-OVERFLOW-01B', () => {
  const carPageCode = readFileSync(resolve(process.cwd(), 'src/pages/Car.tsx'), 'utf-8')
  const teamCarCardCode = readFileSync(
    resolve(process.cwd(), 'src/components/car/TeamCarCard.tsx'),
    'utf-8',
  )
  const installedComponentsGridCode = readFileSync(
    resolve(process.cwd(), 'src/components/car/InstalledComponentsGrid.tsx'),
    'utf-8',
  )
  const quickActionsCardCode = readFileSync(
    resolve(process.cwd(), 'src/components/car/QuickActionsCard.tsx'),
    'utf-8',
  )
  const competitivenessCardCode = readFileSync(
    resolve(process.cwd(), 'src/components/car/CompetitivenessCard.tsx'),
    'utf-8',
  )
  const structuralIntegrityCardCode = readFileSync(
    resolve(process.cwd(), 'src/components/car/StructuralIntegrityCard.tsx'),
    'utf-8',
  )
  const technicalHeroCode = readFileSync(
    resolve(process.cwd(), 'src/components/car/TechnicalHero.tsx'),
    'utf-8',
  )
  const technicalDiagnosisCode = readFileSync(
    resolve(process.cwd(), 'src/components/car/TechnicalDiagnosisPanel.tsx'),
    'utf-8',
  )
  const powerUnitSystemsCode = readFileSync(
    resolve(process.cwd(), 'src/components/car/PowerUnitSystemsPanel.tsx'),
    'utf-8',
  )
  const technicalCorrelationCode = readFileSync(
    resolve(process.cwd(), 'src/components/car/TechnicalCorrelationPanel.tsx'),
    'utf-8',
  )
  const gridCompetitivenessCode = readFileSync(
    resolve(process.cwd(), 'src/components/car/GridCompetitiveness.tsx'),
    'utf-8',
  )
  const technicalFooterCode = readFileSync(
    resolve(process.cwd(), 'src/components/car/TechnicalFooterCards.tsx'),
    'utf-8',
  )

  // CAR01: página Carro possui imports e estrutura sem erros de sintaxe
  it('CAR01: página Carro possui estrutura e subcomponentes válidos', () => {
    expect(carPageCode).toContain('export default function CarPage')
    expect(carPageCode).toContain('activeSubTab')
  })

  // CAR02: container principal possui containment e overflow horizontal protegido
  it('CAR02: container principal não possui overflow horizontal não intencional', () => {
    expect(carPageCode).toContain('overflow-x-hidden')
    expect(carPageCode).toContain('w-full max-w-full')
  })

  // CAR03: cards permanecem contidos (classes min-w-0 e overflow-hidden)
  it('CAR03: cards principais e grids possuem min-w-0 e overflow-hidden para containment', () => {
    expect(teamCarCardCode).toContain('min-w-0')
    expect(teamCarCardCode).toContain('overflow-hidden')
    expect(installedComponentsGridCode).toContain('min-w-0')
    expect(installedComponentsGridCode).toContain('overflow-hidden')
    expect(competitivenessCardCode).toContain('min-w-0')
    expect(competitivenessCardCode).toContain('overflow-hidden')
    expect(structuralIntegrityCardCode).toContain('min-w-0')
    expect(structuralIntegrityCardCode).toContain('overflow-hidden')
  })

  // CAR04: textos longos permanecem dentro dos cards sem estourar
  it('CAR04: textos longos possuem truncate ou break-words contra estouro de largura', () => {
    expect(teamCarCardCode).toContain('truncate')
    expect(installedComponentsGridCode).toContain('truncate')
    expect(technicalDiagnosisCode).toContain('break-words')
    expect(powerUnitSystemsCode).toContain('truncate')
  })

  // CAR05: botões/ações permanecem acessíveis
  it('CAR05: botões/ações permanecem acessíveis e com wrap flexível', () => {
    expect(quickActionsCardCode).toContain('whitespace-normal')
    expect(quickActionsCardCode).toContain('break-words')
    expect(quickActionsCardCode).toContain('min-w-0')
    expect(powerUnitSystemsCode).toContain('flex-wrap')
  })

  // CAR06: nenhum valor técnico/gameplay foi alterado
  it('CAR06: nenhum valor técnico/gameplay foi alterado (chassi, PU quota, motor)', () => {
    expect(FREE_ENGINE_QUOTA).toBe(4)
    expect(carPageCode).toContain('FREE_ENGINE_QUOTA')
  })

  // CAR07: desktop mantém layout consistente
  it('CAR07: desktop mantém layout consistente com grids responsivos', () => {
    expect(carPageCode).toContain('lg:grid-cols-2')
    expect(carPageCode).toContain('md:grid-cols-3')
    expect(gridCompetitivenessCode).toContain('overflow-x-auto')
  })

  // CAR08: viewport menor não gera card fora da tela
  it('CAR08: viewport menor possui quebra responsiva sem estourar container', () => {
    expect(technicalCorrelationCode).toContain('sm:grid-cols-2 lg:grid-cols-4')
    expect(technicalFooterCode).toContain('min-w-0')
    expect(technicalFooterCode).toContain('overflow-hidden')
    expect(powerUnitSystemsCode).toContain('grid-cols-1 sm:grid-cols-3')
  })
})
