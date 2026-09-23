/**
 * SUÍTE DE TESTES: NEWS-ICONS-01A — CAMADA CANÔNICA DE ÍCONES DE NOTÍCIAS
 *
 * Validação exaustiva da taxonomia, catálogo, resolver, fallback, normalizador de aliases legacy,
 * integridade visual e ausência de dependências/URLs externas no runtime.
 *
 * Critérios formais:
 * - NI01A-01: RACE resolve para ícone canônico (Flag / news_icon_race).
 * - NI01A-02: QUALIFYING resolve corretamente (Timer / news_icon_qualifying).
 * - NI01A-03: DRIVER resolve corretamente (User / news_icon_driver).
 * - NI01A-04: TRANSFER e CONTRACT distinguem-se corretamente.
 * - NI01A-05: INCIDENT e PENALTY distinguem-se corretamente.
 * - NI01A-06: REGULATION resolve corretamente (Scale / news_icon_regulation).
 * - NI01A-07: Alias legacy resolve para categoria canônica (ex.: race_result -> RACE, driver_market -> TRANSFER).
 * - NI01A-08: Categoria desconhecida / nula / vazia usa fallback GENERAL.
 * - NI01A-09: Zero URL externa em runtime em todos os itens do catálogo.
 * - NI01A-10: auditCanonicalNewsIconCatalog() retorna estado 100% limpo.
 * + Fixtures representativos de casos reais do jogo (vitória, pole, contratação, punição, etc.).
 */

import { describe, it, expect } from 'vitest'
import {
  CANONICAL_NEWS_CATEGORIES,
  CANONICAL_FALLBACK_CATEGORY,
  NEWS_ICON_CATALOG,
  LEGACY_NEWS_CATEGORY_ALIASES,
  normalizeNewsCategory,
  resolveNewsIcon,
  resolveNewsLucideIcon,
  auditCanonicalNewsIconCatalog,
} from '@/lib/news-icon-catalog'
import {
  Flag,
  Timer,
  User,
  Repeat,
  FileText,
  AlertCircle,
  AlertTriangle,
  Scale,
  Newspaper,
  Gauge,
  Cog,
  Wrench,
  Shield,
  Building2,
  Trophy,
} from 'lucide-react'

describe('NEWS-ICONS-01A — Canonical News Icon Layer', () => {
  // NI01A-01: RACE resolve para ícone canônico
  it('NI01A-01: RACE resolve para o ícone canônico correspondente (Flag / news_icon_race)', () => {
    const iconDef = resolveNewsIcon('RACE')
    expect(iconDef).toBeDefined()
    expect(iconDef.category).toBe('RACE')
    expect(iconDef.iconId).toBe('news_icon_race')
    expect(iconDef.lucideIcon).toBe(Flag)
    expect(iconDef.label).toContain('Corrida')

    const directIcon = resolveNewsLucideIcon('RACE')
    expect(directIcon).toBe(Flag)
  })

  // NI01A-02: QUALIFYING resolve corretamente
  it('NI01A-02: QUALIFYING resolve corretamente para o ícone de cronômetro (Timer / news_icon_qualifying)', () => {
    const iconDef = resolveNewsIcon('QUALIFYING')
    expect(iconDef).toBeDefined()
    expect(iconDef.category).toBe('QUALIFYING')
    expect(iconDef.iconId).toBe('news_icon_qualifying')
    expect(iconDef.lucideIcon).toBe(Timer)
    expect(iconDef.label).toContain('Classificação')
  })

  // NI01A-03: DRIVER resolve corretamente
  it('NI01A-03: DRIVER resolve corretamente para o ícone de piloto (User / news_icon_driver)', () => {
    const iconDef = resolveNewsIcon('DRIVER')
    expect(iconDef).toBeDefined()
    expect(iconDef.category).toBe('DRIVER')
    expect(iconDef.iconId).toBe('news_icon_driver')
    expect(iconDef.lucideIcon).toBe(User)
    expect(iconDef.label).toContain('Piloto')
  })

  // NI01A-04: TRANSFER/CONTRACT distinguem-se corretamente
  it('NI01A-04: TRANSFER e CONTRACT distinguem-se categoricamente com ícones e IDs exclusivos', () => {
    const transferDef = resolveNewsIcon('TRANSFER')
    const contractDef = resolveNewsIcon('CONTRACT')

    expect(transferDef.category).toBe('TRANSFER')
    expect(contractDef.category).toBe('CONTRACT')

    expect(transferDef.iconId).toBe('news_icon_transfer')
    expect(contractDef.iconId).toBe('news_icon_contract')

    expect(transferDef.lucideIcon).toBe(Repeat)
    expect(contractDef.lucideIcon).toBe(FileText)

    expect(transferDef.iconId).not.toBe(contractDef.iconId)
  })

  // NI01A-05: INCIDENT/PENALTY distinguem-se corretamente
  it('NI01A-05: INCIDENT (alerta/colisão) e PENALTY (punição regulamentar) distinguem-se claramente', () => {
    const incidentDef = resolveNewsIcon('INCIDENT')
    const penaltyDef = resolveNewsIcon('PENALTY')

    expect(incidentDef.category).toBe('INCIDENT')
    expect(penaltyDef.category).toBe('PENALTY')

    expect(incidentDef.iconId).toBe('news_icon_incident')
    expect(penaltyDef.iconId).toBe('news_icon_penalty')

    expect(incidentDef.lucideIcon).toBe(AlertCircle)
    expect(penaltyDef.lucideIcon).toBe(AlertTriangle)

    expect(incidentDef.iconId).not.toBe(penaltyDef.iconId)
  })

  // NI01A-06: REGULATION resolve corretamente
  it('NI01A-06: REGULATION resolve corretamente para o ícone de diretiva/balança (Scale / news_icon_regulation)', () => {
    const regDef = resolveNewsIcon('REGULATION')
    expect(regDef).toBeDefined()
    expect(regDef.category).toBe('REGULATION')
    expect(regDef.iconId).toBe('news_icon_regulation')
    expect(regDef.lucideIcon).toBe(Scale)
    expect(regDef.label).toContain('Regulamento')
  })

  // NI01A-07: alias legacy resolve para categoria canônica
  it('NI01A-07: Aliases legados normalizam perfeitamente para suas respectivas categorias canônicas', () => {
    // Corrida / Resultados
    expect(resolveNewsIcon('race_result').category).toBe('RACE')
    expect(resolveNewsIcon('race-result').category).toBe('RACE')
    expect(resolveNewsIcon('RACE_RESULT').category).toBe('RACE')
    expect(resolveNewsIcon('gp_result').category).toBe('RACE')
    expect(resolveNewsIcon('corrida').category).toBe('RACE')
    expect(resolveNewsIcon('resultado').category).toBe('RACE')

    // Treinos / Qualy
    expect(resolveNewsIcon('quali').category).toBe('QUALIFYING')
    expect(resolveNewsIcon('treino').category).toBe('PRACTICE')
    expect(resolveNewsIcon('fp1').category).toBe('PRACTICE')

    // Transferências / Silly Season
    expect(resolveNewsIcon('driver_market').category).toBe('TRANSFER')
    expect(resolveNewsIcon('silly_season').category).toBe('TRANSFER')
    expect(resolveNewsIcon('transferencia').category).toBe('TRANSFER')

    // Desenvolvimento
    expect(resolveNewsIcon('technical_upgrade').category).toBe('DEVELOPMENT')
    expect(resolveNewsIcon('car_upgrade').category).toBe('DEVELOPMENT')
    expect(resolveNewsIcon('desenvolvimento').category).toBe('DEVELOPMENT')

    // Contratos
    expect(resolveNewsIcon('contrato').category).toBe('CONTRACT')
    expect(resolveNewsIcon('precontract').category).toBe('CONTRACT')

    // Motor
    expect(resolveNewsIcon('motor').category).toBe('ENGINE')
    expect(resolveNewsIcon('power_unit').category).toBe('ENGINE')

    // Punições e Incidentes
    expect(resolveNewsIcon('punicao').category).toBe('PENALTY')
    expect(resolveNewsIcon('acidente').category).toBe('INCIDENT')
    expect(resolveNewsIcon('crash').category).toBe('INCIDENT')
  })

  // NI01A-08: categoria desconhecida usa fallback GENERAL
  it('NI01A-08: Categoria desconhecida, nula, vazia ou inválida utiliza o fallback canônico GENERAL', () => {
    const fallbackNull = resolveNewsIcon(null)
    expect(fallbackNull.category).toBe('GENERAL')
    expect(fallbackNull.iconId).toBe('news_icon_general')
    expect(fallbackNull.lucideIcon).toBe(Newspaper)
    expect(fallbackNull.fallback).toBe(true)

    const fallbackUndefined = resolveNewsIcon(undefined)
    expect(fallbackUndefined.category).toBe('GENERAL')

    const fallbackEmpty = resolveNewsIcon('')
    expect(fallbackEmpty.category).toBe('GENERAL')

    const fallbackUnknown = resolveNewsIcon('categoria_inexistente_xyz_123')
    expect(fallbackUnknown.category).toBe('GENERAL')

    expect(normalizeNewsCategory('random_gibberish')).toBe(CANONICAL_FALLBACK_CATEGORY)
  })

  // NI01A-09: zero URL externa em runtime
  it('NI01A-09: Zero URL externa em runtime em todas as definições do catálogo', () => {
    for (const cat of CANONICAL_NEWS_CATEGORIES) {
      const def = NEWS_ICON_CATALOG[cat]
      expect(def).toBeDefined()
      expect(def.lucideIcon).toBeDefined()

      if (def.localPath) {
        expect(def.localPath.startsWith('http://')).toBe(false)
        expect(def.localPath.startsWith('https://')).toBe(false)
        expect(def.localPath.startsWith('drive.google.com')).toBe(false)
        expect(def.localPath.startsWith('/news-icons/')).toBe(true)
      }
    }
  })

  // NI01A-10: auditCanonicalNewsIconCatalog() retorna estado limpo
  it('NI01A-10: auditCanonicalNewsIconCatalog() atesta integridade canônica completa e sem defeitos', () => {
    const report = auditCanonicalNewsIconCatalog()

    expect(report.canonicalCategories).toBe(23)
    expect(report.mappedCategories).toBe(23)
    expect(report.duplicateCategories).toBe(0)
    expect(report.duplicateIconIds).toBe(0)
    expect(report.unresolvedCategories).toBe(0)
    expect(report.externalRuntimeUrls).toBe(0)
    expect(report.missingFallback).toBe(0)
    expect(report.fallbackCategory).toBe('GENERAL')
    expect(report.legacyAliases).toBeGreaterThan(60)
  })

  // FIXTURES REAIS DO JOGO F1 2026
  describe('Fixtures representativos de casos reais do jogo', () => {
    interface GameNewsFixture {
      title: string
      eventType: string
      expectedCategory: string
      expectedIcon: any
      description: string
    }

    const fixtures: GameNewsFixture[] = [
      {
        title: 'Vitória histórica no GP de Silverstone',
        eventType: 'race_result',
        expectedCategory: 'RACE',
        expectedIcon: Flag,
        description: 'Piloto cruza a linha de chegada em P1',
      },
      {
        title: 'Pole Position cravada no Q3',
        eventType: 'pole',
        expectedCategory: 'QUALIFYING',
        expectedIcon: Timer,
        description: 'Volta mais rápida no treino de classificação',
      },
      {
        title: 'Nova contratação anunciada',
        eventType: 'contrato',
        expectedCategory: 'CONTRACT',
        expectedIcon: FileText,
        description: 'Assinatura formal de contrato com piloto titular',
      },
      {
        title: 'Dança das cadeiras agita o paddock',
        eventType: 'silly_season',
        expectedCategory: 'TRANSFER',
        expectedIcon: Repeat,
        description: 'Movimentação do mercado de pilotos entre escuderias',
      },
      {
        title: 'Novo pacote aerodinâmico pronto na fábrica',
        eventType: 'technical_upgrade',
        expectedCategory: 'DEVELOPMENT',
        expectedIcon: Cog,
        description: 'Peça refinada no túnel de vento concluída',
      },
      {
        title: 'Troca de Unidade de Potência',
        eventType: 'motor',
        expectedCategory: 'ENGINE',
        expectedIcon: Gauge,
        description: 'Introdução do 5º motor na temporada',
      },
      {
        title: 'Penalidade de grid aplicada pelos comissários',
        eventType: 'punicao',
        expectedCategory: 'PENALTY',
        expectedIcon: AlertTriangle,
        description: 'Perda de 5 posições após troca de motor',
      },
      {
        title: 'Colisão violenta na curva 1 causa safety car',
        eventType: 'acidente',
        expectedCategory: 'INCIDENT',
        expectedIcon: AlertCircle,
        description: 'Abandono com quebra de suspensão',
      },
      {
        title: 'Nova diretiva técnica da FIA entra em vigor',
        eventType: 'regulamento',
        expectedCategory: 'REGULATION',
        expectedIcon: Scale,
        description: 'Esclarecimento sobre flexibilidade da asa dianteira',
      },
      {
        title: 'Comunicado da Direção de Prova',
        eventType: 'noticia',
        expectedCategory: 'GENERAL',
        expectedIcon: Newspaper,
        description: 'Notícia informativa geral aos competidores',
      },
      {
        title: 'Instalação do novo simulador concluída',
        eventType: 'fabrica',
        expectedCategory: 'FACILITY',
        expectedIcon: Building2,
        description: 'Upgrade da infraestrutura de simulador para nível 4',
      },
      {
        title: 'Liderança isolada no Mundial de Construtores',
        eventType: 'campeonato',
        expectedCategory: 'CHAMPIONSHIP',
        expectedIcon: Trophy,
        description: 'Vantagem de 32 pontos consolidada na tabela',
      },
    ]

    fixtures.forEach((fixture) => {
      it(`Fixture: "${fixture.title}" (eventType="${fixture.eventType}") -> ${fixture.expectedCategory}`, () => {
        const resolved = resolveNewsIcon(fixture.eventType)
        expect(resolved.category).toBe(fixture.expectedCategory)
        expect(resolved.lucideIcon).toBe(fixture.expectedIcon)
      })
    })
  })
})
