import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { countryFlag, resolveCountryFlag, resolveIso3, countryName } from '@/lib/country-flag'
import { getCountryCode } from '@/lib/country-flags'

describe('BANDEIRAS-01 — Suíte Canônica de Bandeiras para Circuitos e Equipes', () => {
  // A. Circuito canônico -> bandeira correta
  describe('A. Circuito canônico -> bandeira correta', () => {
    it('resolve Mônaco / Monte Carlo para 🇲🇨', () => {
      expect(countryFlag('monaco')).toBe('🇲🇨')
      expect(countryFlag('Mônaco')).toBe('🇲🇨')
      expect(countryFlag('Monte Carlo')).toBe('🇲🇨')
      expect(countryFlag('MCO')).toBe('🇲🇨')
      expect(countryFlag('MON')).toBe('🇲🇨')
    })

    it('resolve Interlagos / São Paulo / Brasil para 🇧🇷', () => {
      expect(countryFlag('interlagos')).toBe('🇧🇷')
      expect(countryFlag('São Paulo')).toBe('🇧🇷')
      expect(countryFlag('Sao Paulo')).toBe('🇧🇷')
      expect(countryFlag('Brasil')).toBe('🇧🇷')
      expect(countryFlag('BRA')).toBe('🇧🇷')
    })

    it('resolve Spa / Spa-Francorchamps / Bélgica para 🇧🇪', () => {
      expect(countryFlag('spa')).toBe('🇧🇪')
      expect(countryFlag('Spa-Francorchamps')).toBe('🇧🇪')
      expect(countryFlag('Bélgica')).toBe('🇧🇪')
      expect(countryFlag('BEL')).toBe('🇧🇪')
    })

    it('resolve Las Vegas / Austin / Miami / USA para 🇺🇸', () => {
      expect(countryFlag('las vegas')).toBe('🇺🇸')
      expect(countryFlag('Austin')).toBe('🇺🇸')
      expect(countryFlag('Miami')).toBe('🇺🇸')
      expect(countryFlag('USA')).toBe('🇺🇸')
      expect(countryFlag('Estados Unidos')).toBe('🇺🇸')
    })

    it('resolve Abu Dhabi / Yas Marina / UAE / ARE para 🇦🇪', () => {
      expect(countryFlag('abu dhabi')).toBe('🇦🇪')
      expect(countryFlag('Yas Marina')).toBe('🇦🇪')
      expect(countryFlag('UAE')).toBe('🇦🇪')
      expect(countryFlag('ARE')).toBe('🇦🇪')
    })

    it('resolve Suzuka / Japão / JPN para 🇯🇵', () => {
      expect(countryFlag('suzuka')).toBe('🇯🇵')
      expect(countryFlag('Japão')).toBe('🇯🇵')
      expect(countryFlag('Japan')).toBe('🇯🇵')
      expect(countryFlag('JPN')).toBe('🇯🇵')
    })

    it('resolve Silverstone / Reino Unido / GBR para 🇬🇧', () => {
      expect(countryFlag('silverstone')).toBe('🇬🇧')
      expect(countryFlag('Reino Unido')).toBe('🇬🇧')
      expect(countryFlag('GBR')).toBe('🇬🇧')
    })

    it('resolve Monza / Itália / ITA para 🇮🇹', () => {
      expect(countryFlag('monza')).toBe('🇮🇹')
      expect(countryFlag('Itália')).toBe('🇮🇹')
      expect(countryFlag('ITA')).toBe('🇮🇹')
    })
  })

  // B. Equipe canônica -> bandeira correta (país de licença)
  describe('B. Equipe canônica -> bandeira correta (país de licença)', () => {
    it('Mercedes -> Alemanha 🇩🇪', () => {
      expect(countryFlag('Mercedes')).toBe('🇩🇪')
      expect(countryFlag('Mercedes-AMG Petronas')).toBe('🇩🇪')
      expect(resolveCountryFlag('Mercedes')).toBe('🇩🇪')
    })

    it('Ferrari -> Itália 🇮🇹', () => {
      expect(countryFlag('Ferrari')).toBe('🇮🇹')
      expect(countryFlag('Scuderia Ferrari')).toBe('🇮🇹')
      expect(resolveCountryFlag('Ferrari')).toBe('🇮🇹')
    })

    it('McLaren -> Reino Unido 🇬🇧', () => {
      expect(countryFlag('McLaren')).toBe('🇬🇧')
      expect(countryFlag('McLaren F1 Team')).toBe('🇬🇧')
      expect(resolveCountryFlag('McLaren')).toBe('🇬🇧')
    })

    it('Red Bull -> Áustria 🇦🇹', () => {
      expect(countryFlag('Red Bull')).toBe('🇦🇹')
      expect(countryFlag('Red Bull Racing')).toBe('🇦🇹')
      expect(resolveCountryFlag('Red Bull')).toBe('🇦🇹')
    })

    it('Audi -> Alemanha 🇩🇪', () => {
      expect(countryFlag('Audi')).toBe('🇩🇪')
      expect(countryFlag('Audi F1 Team')).toBe('🇩🇪')
      expect(resolveCountryFlag('Audi')).toBe('🇩🇪')
    })

    it('Aston Martin -> Reino Unido 🇬🇧', () => {
      expect(countryFlag('Aston Martin')).toBe('🇬🇧')
      expect(countryFlag('Aston Martin Aramco')).toBe('🇬🇧')
      expect(resolveCountryFlag('Aston Martin')).toBe('🇬🇧')
    })

    it('Alpine -> França 🇫🇷', () => {
      expect(countryFlag('Alpine')).toBe('🇫🇷')
      expect(countryFlag('Alpine F1 Team')).toBe('🇫🇷')
      expect(resolveCountryFlag('Alpine')).toBe('🇫🇷')
    })

    it('Haas -> Estados Unidos 🇺🇸', () => {
      expect(countryFlag('Haas')).toBe('🇺🇸')
      expect(countryFlag('Haas F1 Team')).toBe('🇺🇸')
      expect(resolveCountryFlag('Haas')).toBe('🇺🇸')
    })

    it('Williams -> Reino Unido 🇬🇧', () => {
      expect(countryFlag('Williams')).toBe('🇬🇧')
      expect(countryFlag('Williams Racing')).toBe('🇬🇧')
      expect(resolveCountryFlag('Williams')).toBe('🇬🇧')
    })

    it('Visa Cash App RB / Racing Bulls -> Itália 🇮🇹', () => {
      expect(countryFlag('Visa Cash App RB')).toBe('🇮🇹')
      expect(countryFlag('Racing Bulls')).toBe('🇮🇹')
      expect(countryFlag('RB')).toBe('🇮🇹')
      expect(countryFlag('VCARB')).toBe('🇮🇹')
    })

    it('Cadillac e Andretti -> Estados Unidos 🇺🇸', () => {
      expect(countryFlag('Cadillac')).toBe('🇺🇸')
      expect(countryFlag('Cadillac F1 Team')).toBe('🇺🇸')
      expect(countryFlag('Andretti')).toBe('🇺🇸')
      expect(countryFlag('Andretti Global')).toBe('🇺🇸')
    })
  })

  // C. Piloto -> bandeira da 05B intacta (regressão)
  describe('C. Piloto -> regressão 05B intacta', () => {
    it('pilotos com ISO3 continuam resolvendo normalmente', () => {
      expect(countryFlag('ESP')).toBe('🇪🇸')
      expect(countryFlag('MEX')).toBe('🇲🇽')
      expect(countryFlag('FIN')).toBe('🇫🇮')
      expect(countryFlag('FRA')).toBe('🇫🇷')
      expect(countryFlag('GBR')).toBe('🇬🇧')
      expect(countryFlag('AUS')).toBe('🇦🇺')
      expect(countryFlag('BRA')).toBe('🇧🇷')
      expect(countryFlag('DEU')).toBe('🇩🇪')
      expect(countryFlag('GER')).toBe('🇩🇪')
      expect(countryFlag('NLD')).toBe('🇳🇱')
      expect(countryFlag('MON')).toBe('🇲🇨')
      expect(countryFlag('MCO')).toBe('🇲🇨')
    })

    it('nomes completos em pt/en continuam resolvendo', () => {
      expect(countryFlag('Brasil')).toBe('🇧🇷')
      expect(countryFlag('Alemanha')).toBe('🇩🇪')
      expect(countryFlag('Reino Unido')).toBe('🇬🇧')
      expect(countryFlag('Espanha')).toBe('🇪🇸')
      expect(countryFlag('Mônaco')).toBe('🇲🇨')
    })
  })

  // D. Fallback honesto
  describe('D. Fallback honesto: código/circuito desconhecido exibe a sigla/string, sem inventar', () => {
    it('countryFlag() retorna a string de entrada para termos desconhecidos', () => {
      expect(countryFlag('XYZ')).toBe('XYZ')
      expect(countryFlag('UNKNOWN_CIRCUIT')).toBe('UNKNOWN_CIRCUIT')
      expect(countryFlag('UNKNOWN_TEAM')).toBe('UNKNOWN_TEAM')
      expect(countryFlag('')).toBe('')
      expect(countryFlag(null)).toBe('')
      expect(countryFlag(undefined)).toBe('')
    })

    it('resolveCountryFlag() usa fallback configurado para termos desconhecidos', () => {
      expect(resolveCountryFlag('XYZ')).toBe('🏳️')
      expect(resolveCountryFlag('XYZ', '🏁')).toBe('🏁')
      expect(resolveCountryFlag('')).toBe('🏳️')
      expect(resolveCountryFlag(null)).toBe('🏳️')
    })

    it('resolveIso3() retorna a própria string em maiúsculas se desconhecido', () => {
      expect(resolveIso3('XYZ')).toBe('XYZ')
      expect(resolveIso3('abc')).toBe('ABC')
    })
  })

  // E. Integridade do código fonte nas telas migradas
  describe('E. Telas migradas utilizam o resolver canônico', () => {
    it('Index.tsx importa e usa resolver canônico para GP e Construtores', () => {
      const indexPath = path.resolve(process.cwd(), 'src/pages/Index.tsx')
      const indexContent = fs.readFileSync(indexPath, 'utf-8')

      // Não usa mais CountryFlagChip no topo da Próxima Corrida ou sobre os pilotos
      expect(indexContent).not.toContain('<CountryFlagChip')
      expect(indexContent).toContain('countryFlag(')
      expect(indexContent).toContain('countryName(')
    })

    it('DriverSummaryCard.tsx usa CountryFlag com emoji', () => {
      const cardPath = path.resolve(process.cwd(), 'src/components/team/DriverSummaryCard.tsx')
      const cardContent = fs.readFileSync(cardPath, 'utf-8')

      expect(cardContent).not.toContain('<CountryFlagChip')
      expect(cardContent).toContain('<CountryFlag code={nationality}')
    })

    it('Standings.tsx exibe bandeira da escuderia nos Construtores', () => {
      const standingsPath = path.resolve(process.cwd(), 'src/pages/Standings.tsx')
      const standingsContent = fs.readFileSync(standingsPath, 'utf-8')

      expect(standingsContent).toContain('<CountryFlag code={cTeam.name}')
    })

    it('TracksPage.tsx resolve bandeira do GP com resolveCountryFlag', () => {
      const tracksPath = path.resolve(process.cwd(), 'src/pages/TracksPage.tsx')
      const tracksContent = fs.readFileSync(tracksPath, 'utf-8')

      expect(tracksContent).toContain('resolveCountryFlag(')
    })
  })
})
