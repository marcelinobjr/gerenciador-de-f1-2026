import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { resolveCountryFlag } from '@/lib/country-flag'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { standingsService } from '@/services/standingsService'
import type { DriverModel, TeamModel } from '@/types/f1'

describe('BUG-INTEGRIDADE-05B — Suíte Canônica de Bandeiras', () => {
  // 1. ESP -> 🇪🇸
  it('1. ESP resolve para a bandeira da Espanha 🇪🇸', () => {
    expect(resolveCountryFlag('ESP')).toBe('🇪🇸')
  })

  // 2. MEX -> 🇲🇽
  it('2. MEX resolve para a bandeira do México 🇲🇽', () => {
    expect(resolveCountryFlag('MEX')).toBe('🇲🇽')
  })

  // 3. FIN -> 🇫🇮
  it('3. FIN resolve para a bandeira da Finlândia 🇫🇮', () => {
    expect(resolveCountryFlag('FIN')).toBe('🇫🇮')
  })

  // 4. FRA -> 🇫🇷
  it('4. FRA resolve para a bandeira da França 🇫🇷', () => {
    expect(resolveCountryFlag('FRA')).toBe('🇫🇷')
  })

  // 5. GBR -> 🇬🇧
  it('5. GBR resolve para a bandeira do Reino Unido 🇬🇧', () => {
    expect(resolveCountryFlag('GBR')).toBe('🇬🇧')
  })

  // 6. AUS -> 🇦🇺
  it('6. AUS resolve para a bandeira da Austrália 🇦🇺', () => {
    expect(resolveCountryFlag('AUS')).toBe('🇦🇺')
  })

  // 7. BRA -> 🇧🇷
  it('7. BRA resolve para a bandeira do Brasil 🇧🇷', () => {
    expect(resolveCountryFlag('BRA')).toBe('🇧🇷')
  })

  // 8. ISO3 conhecido resolve (outros códigos ISO3 F1: NLD, MON, CAN, GER, ITA, JPN)
  it('8. Códigos ISO3 conhecidos resolvem para os emojis esperados', () => {
    expect(resolveCountryFlag('NLD')).toBe('🇳🇱')
    expect(resolveCountryFlag('MON')).toBe('🇲🇨')
    expect(resolveCountryFlag('CAN')).toBe('🇨🇦')
    expect(resolveCountryFlag('GER')).toBe('🇩🇪')
    expect(resolveCountryFlag('ITA')).toBe('🇮🇹')
    expect(resolveCountryFlag('JPN')).toBe('🇯🇵')
  })

  // 9. Variação legada ("Brasil", "Espanha", "Reino Unido", "Mexico") continua funcionando
  it('9. Variações por nome extenso legadas continuam funcionando com normalização tolerante', () => {
    expect(resolveCountryFlag('Brasil')).toBe('🇧🇷')
    expect(resolveCountryFlag('Espanha')).toBe('🇪🇸')
    expect(resolveCountryFlag('Reino Unido')).toBe('🇬🇧')
    expect(resolveCountryFlag('México')).toBe('🇲🇽')
    expect(resolveCountryFlag('Mexico')).toBe('🇲🇽')
    expect(resolveCountryFlag('França')).toBe('🇫🇷')
    expect(resolveCountryFlag('Franca')).toBe('🇫🇷')
    expect(resolveCountryFlag('Australia')).toBe('🇦🇺')
    expect(resolveCountryFlag('Austrália')).toBe('🇦🇺')
    expect(resolveCountryFlag('Finlândia')).toBe('🇫🇮')
    expect(resolveCountryFlag('Finlandia')).toBe('🇫🇮')
  })

  // 10. Código desconhecido usa fallback seguro (sem imagem quebrada, sem ?, sem exceção, sem undefined)
  it('10. Código desconhecido usa fallback seguro e determinístico (🏳️)', () => {
    expect(resolveCountryFlag('XYZ')).toBe('🏳️')
    expect(resolveCountryFlag('UNKNOWN_CODE')).toBe('🏳️')
    expect(resolveCountryFlag(null)).toBe('🏳️')
    expect(resolveCountryFlag(undefined)).toBe('🏳️')
    expect(resolveCountryFlag('')).toBe('🏳️')
    // Nunca deve lançar exceção nem retornar undefined/null ou '?'
    expect(() => resolveCountryFlag('INVALID')).not.toThrow()
    expect(resolveCountryFlag('INVALID')).not.toBe('?')
    expect(resolveCountryFlag('INVALID')).not.toBeUndefined()
  })

  // 11. Dados persistidos permanecem ISO (ESP, BRA...) sem alteração para emoji
  it('11. Dados persistidos e records esportivos preservam códigos ISO originais sem alteração', () => {
    const rawDriverRecord = {
      id: 'drv_test_1',
      name: 'Fernando Alonso',
      nationality: 'ESP',
    }
    // A resolução de bandeira não muta a propriedade de nacionalidade do objeto
    const flag = resolveCountryFlag(rawDriverRecord.nationality)
    expect(flag).toBe('🇪🇸')
    expect(rawDriverRecord.nationality).toBe('ESP')
    expect(rawDriverRecord.nationality).not.toBe('🇪🇸')
  })

  // 12. Save/reload preserva nacionalidade em formato de código de país
  it('12. Simulação de save/reload em JSON preserva nacionalidade como ISO/string canônica', () => {
    const originalSave = {
      careerId: 'car_test_01',
      drivers: [
        { id: 'mbj-001', name: 'Gabriel Bortoleto', nationality: 'BRA' },
        { id: 'mbj-002', name: 'Carlos Sainz', nationality: 'ESP' },
      ],
    }

    const serialized = JSON.stringify(originalSave)
    const deserialized = JSON.parse(serialized)

    expect(deserialized.drivers[0].nationality).toBe('BRA')
    expect(deserialized.drivers[1].nationality).toBe('ESP')

    // Na camada de visualização pós-reload, resolve para o emoji correto
    expect(resolveCountryFlag(deserialized.drivers[0].nationality)).toBe('🇧🇷')
    expect(resolveCountryFlag(deserialized.drivers[1].nationality)).toBe('🇪🇸')
  })

  // 13. Sem lookup manual ou getCountryFlag nas superfícies migradas
  it('13. Guarda anti-regressão: Superfícies migradas não contêm chamadas a getCountryFlag do legado', () => {
    const filesToCheck = [
      'src/services/canonicalChampionshipService.ts',
      'src/services/standingsService.ts',
      'src/components/car/TeamCarCard.tsx',
      'src/components/race/DriverLiveOperationsPanel.tsx',
      'src/components/race/PracticeCarPanel.tsx',
      'src/components/race/PracticePreparationView.tsx',
      'src/components/race/RaceHeroCompact.tsx',
      'src/pages/CalendarPage.tsx',
      'src/pages/Teams.tsx',
      'src/pages/DriversPage.tsx',
      'src/components/DriverSidePanel.tsx',
      'src/components/PilotProfileDialog.tsx',
      'src/components/DriverComparisonModal.tsx',
      'src/components/race/SillySeasonModal.tsx',
      'src/pages/Team.tsx',
      'src/pages/Index.tsx',
      'src/services/weekendSimulationService.ts',
    ]

    for (const relativePath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relativePath)
      const content = fs.readFileSync(fullPath, 'utf-8')
      expect(
        content,
        `Arquivo ${relativePath} ainda contém referência a getCountryFlag`,
      ).not.toMatch(/\bgetCountryFlag\b/)
    }
  })

  // 14. Standings usa o canônico e resolve bandeiras de pilotos
  it('14. StandingsService usa o canônico e gera flags corretas para pilotos', () => {
    const mockTeam: TeamModel = {
      id: 'team_test',
      name: 'Escuderia Brasil',
      color: '#00A6FB',
      chassis_level: 70,
      aero_level: 70,
      strategy_level: 70,
      engine_supplier: 'Mercedes',
      budget: 100000000,
      created: '',
      updated: '',
    }

    const mockDrivers: DriverModel[] = [
      {
        id: 'drv_bra',
        name: 'Felipe Drugovich',
        nationality: 'BRA',
        team_id: 'team_test',
        age: 25,
        speed: 82,
        consistency: 80,
        rain: 80,
        defense: 80,
        morale: 85,
        salary: 2000000,
        contract_end: 2026,
        role: 'titular',
        created: '',
        updated: '',
      },
    ]

    const standings = standingsService.calculateStandings({
      team: mockTeam,
      playerDrivers: mockDrivers,
      raceResults: [],
    })

    const drugovichStanding = standings.driverStandings.find((d) => d.id === 'drv_bra')
    expect(drugovichStanding).toBeDefined()
    expect(drugovichStanding?.nationality).toBe('BRA')
    expect(drugovichStanding?.flag).toBe('🇧🇷')

    // Validar grid neutro de canonicalChampionshipService
    const neutralGrid = canonicalChampionshipService.buildNeutralSeasonGrid('ferrari')
    const leclerc = neutralGrid.drivers.find((d) => d.driverName === 'Charles Leclerc')
    expect(leclerc).toBeDefined()
    expect(leclerc?.flag).toBe('🇲🇨')
  })

  // 15. /pilotos (DriversPage) importa e usa CountryFlag canônico
  it('15. DriversPage e superfícies de catálogo usam CountryFlag canônico', () => {
    const driversPageContent = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/DriversPage.tsx'),
      'utf-8',
    )
    expect(driversPageContent).toContain("import { CountryFlag } from '@/components/CountryFlag'")
    expect(driversPageContent).toContain('<CountryFlag code=')
    expect(driversPageContent).not.toContain('from "@/lib/country-flags"')
    expect(driversPageContent).not.toContain("from '@/lib/country-flags'")
  })

  // 16. Guarda do módulo legado country-flags.ts: mantém COUNTRY_CODE_MAP e getCountryCode
  it('16. Módulo legado country-flags.ts mantém COUNTRY_CODE_MAP e getCountryCode para suportar o canônico', () => {
    const flagsContent = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/country-flags.ts'),
      'utf-8',
    )
    expect(flagsContent).toContain('export const COUNTRY_CODE_MAP')
    expect(flagsContent).toContain('export function getCountryCode')
    expect(flagsContent).not.toContain('export function getCountryFlag')
  })
})
