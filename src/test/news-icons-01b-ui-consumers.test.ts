/**
 * news-icons-01b-ui-consumers.test.ts
 *
 * Suíte de testes para validação dos consumidores da UI migrados para o resolver canônico:
 * - NI01B-01: Index.tsx usa resolveNewsIcon().
 * - NI01B-02: Index.tsx não possui heurística textual ativa para escolher ícone.
 * - NI01B-03: Index.tsx não usa URL externa para news icons.
 * - NI01B-04: NotificationBell usa resolveNewsIcon().
 * - NI01B-05: NotificationBell não possui switch/mapa local ativo.
 * - NI01B-06: categoria desconhecida -> GENERAL.
 * - NI01B-07: legacy alias resolve pelo catálogo.
 * - NI01B-08: prova de falsa inferência — category=FINANCE com headline contendo "vitória" ("Vitória aumenta receita da equipe") continua FINANCE, NÃO RACE.
 * - NI01B-09: retrato/logo não são confundidos com news icon (entidades separadas).
 * - NI01B-10: zero Google Drive no runtime de news icons.
 */

import { describe, it, expect } from 'vitest'
import indexSource from '@/pages/Index.tsx?raw'
import notificationBellSource from '@/components/NotificationBell.tsx?raw'
import {
  resolveNewsIcon,
  resolveNewsLucideIcon,
  NEWS_ICON_CATALOG,
  CANONICAL_FALLBACK_CATEGORY,
} from '@/lib/news-icon-catalog'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import {
  Flag,
  Timer,
  User,
  Shield,
  Wrench,
  DollarSign,
  Newspaper,
  Radio,
  Handshake,
  Gauge,
  AlertTriangle,
  HeartPulse,
} from 'lucide-react'

describe('NEWS-ICONS-01B: Homologação dos Consumidores de News Icons na UI (NI01B-01..10)', () => {
  // NI01B-01: Index.tsx usa resolveNewsIcon()
  it('NI01B-01: Index.tsx importa e invoca resolveNewsIcon() para renderizar ícones de notícias', () => {
    expect(indexSource).toContain("import { resolveNewsIcon } from '@/lib/news-icon-catalog'")
    expect(indexSource).toMatch(/resolveNewsIcon\(/)
  })

  // NI01B-02: Index.tsx não possui heurística textual ativa para escolher ícone
  it('NI01B-02: Index.tsx não possui heurística textual ativa (headline/title/textLower.includes) para escolher ícone', () => {
    // Não pode haver checagem de palavras-chave para derivar ícone
    expect(indexSource).not.toMatch(
      /includes\(['"](asa|assoalho|pit|simulador|túnel|tunel|fábrica|fabrica)['"]\)/i,
    )
    expect(indexSource).not.toMatch(/textLower\s*\.\s*includes/)
    expect(indexSource).not.toMatch(/headline\s*\.\s*includes/)
    expect(indexSource).not.toMatch(/snippet\s*\.\s*includes/)
  })

  // NI01B-03: Index.tsx não usa URL externa para news icons
  it('NI01B-03: Index.tsx não usa URL externa (Google Drive, lh3, thumbnail) para o sistema de news icons', () => {
    // Isolar a seção de notícias do Index.tsx
    const newsSectionMatch = indexSource.match(
      /Notícias do Paddock[\s\S]*?Acessar Paddock Completo/,
    )
    expect(newsSectionMatch).not.toBeNull()
    const newsSection = newsSectionMatch ? newsSectionMatch[0] : ''

    expect(newsSection).not.toContain('drive.google.com')
    expect(newsSection).not.toContain('lh3.googleusercontent.com')
    expect(newsSection).not.toContain('thumbnail')
    expect(newsSection).not.toContain('uc?id=')
    expect(newsSection).not.toContain('DRIVE_STORAGE_PHOTOS')
  })

  // NI01B-04: NotificationBell usa resolveNewsIcon()
  it('NI01B-04: NotificationBell importa e invoca resolveNewsIcon()', () => {
    expect(notificationBellSource).toContain(
      "import { resolveNewsIcon } from '@/lib/news-icon-catalog'",
    )
    expect(notificationBellSource).toMatch(/resolveNewsIcon\(/)
  })

  // NI01B-05: NotificationBell não possui switch/mapa local ativo
  it('NI01B-05: NotificationBell não possui switch/mapa local de tipos para escolher ícones', () => {
    // O switch interno com case 'radio', case 'motor', etc. foi completamente removido
    expect(notificationBellSource).not.toMatch(
      /switch\s*\(\s*(type|category|n\.type)\s*\)\s*\{[\s\S]*?case\s+['"]radio['"]/,
    )
    expect(notificationBellSource).not.toMatch(
      /switch\s*\(\s*(type|category|n\.type)\s*\)\s*\{[\s\S]*?case\s+['"]motor['"]/,
    )
    expect(notificationBellSource).not.toMatch(
      /switch\s*\(\s*(type|category|n\.type)\s*\)\s*\{[\s\S]*?case\s+['"]patrocinio['"]/,
    )
    expect(notificationBellSource).not.toContain('getNotificationIcon')
  })

  // NI01B-06: categoria desconhecida -> GENERAL
  it('NI01B-06: categoria desconhecida / null / vazia cai naturalmente no fallback GENERAL (Newspaper)', () => {
    const unknownRes = resolveNewsIcon('categoria_inventada_123')
    expect(unknownRes.category).toBe('GENERAL')
    expect(unknownRes.iconId).toBe('news_icon_general')
    expect(unknownRes.lucideIcon).toBe(Newspaper)
    expect(unknownRes.fallback).toBe(true)

    const nullRes = resolveNewsIcon(null)
    expect(nullRes.category).toBe('GENERAL')
    expect(nullRes.lucideIcon).toBe(Newspaper)

    const undefinedRes = resolveNewsIcon(undefined)
    expect(undefinedRes.category).toBe('GENERAL')
    expect(undefinedRes.lucideIcon).toBe(Newspaper)

    const emptyRes = resolveNewsIcon('')
    expect(emptyRes.category).toBe('GENERAL')
    expect(emptyRes.lucideIcon).toBe(Newspaper)
  })

  // NI01B-07: legacy alias resolve pelo catálogo
  it('NI01B-07: legacy aliases (radio, patrocinio, motor, fia, lesao, corrida, sistema, race_result, driver_market, technical_upgrade, contrato, punicao, acidente) resolvem pelo catálogo canônico', () => {
    expect(resolveNewsIcon('radio').category).toBe('RADIO')
    expect(resolveNewsIcon('radio').lucideIcon).toBe(Radio)

    expect(resolveNewsIcon('patrocinio').category).toBe('SPONSOR')
    expect(resolveNewsIcon('patrocinio').lucideIcon).toBe(Handshake)

    expect(resolveNewsIcon('motor').category).toBe('ENGINE')
    expect(resolveNewsIcon('motor').lucideIcon).toBe(Gauge)

    expect(resolveNewsIcon('fia').category).toBe('REGULATION')
    expect(resolveNewsIcon('fia').lucideIcon).toBe(NEWS_ICON_CATALOG.REGULATION.lucideIcon)

    expect(resolveNewsIcon('lesao').category).toBe('INJURY')
    expect(resolveNewsIcon('lesao').lucideIcon).toBe(HeartPulse)

    expect(resolveNewsIcon('corrida').category).toBe('RACE')
    expect(resolveNewsIcon('corrida').lucideIcon).toBe(Flag)

    expect(resolveNewsIcon('sistema').category).toBe('GENERAL')
    expect(resolveNewsIcon('sistema').lucideIcon).toBe(Newspaper)

    expect(resolveNewsIcon('race_result').category).toBe('RACE')
    expect(resolveNewsIcon('driver_market').category).toBe('TRANSFER')
    expect(resolveNewsIcon('technical_upgrade').category).toBe('DEVELOPMENT')
    expect(resolveNewsIcon('contrato').category).toBe('CONTRACT')
    expect(resolveNewsIcon('punicao').category).toBe('PENALTY')
    expect(resolveNewsIcon('acidente').category).toBe('INCIDENT')
  })

  // NI01B-08: prova de falsa inferência — category=FINANCE com headline contendo "vitória" continua FINANCE, NÃO RACE
  it('NI01B-08: prova de falsa inferência — category=FINANCE com headline contendo "vitória" continua FINANCE, NÃO RACE', () => {
    const mockNewsItem = {
      title: 'Vitória aumenta receita da equipe em 15%',
      snippet: 'Premiação acumulada após a vitória em Silverstone bate recorde financeiro.',
      category: 'FINANCE',
    }

    // Regra de Ouro: o ícone deve depender unicamente da categoria informada,
    // e NUNCA da heurística textual do título/headline.
    const resolved = resolveNewsIcon(mockNewsItem.category)

    expect(resolved.category).toBe('FINANCE')
    expect(resolved.category).not.toBe('RACE')
    expect(resolved.iconId).toBe('news_icon_finance')
    expect(resolved.lucideIcon).toBe(DollarSign)
    expect(resolved.lucideIcon).not.toBe(Flag)

    // Outro teste de falsa inferência: category=DEVELOPMENT com headline "Piloto aprova novo assoalho"
    const mockNewsItem2 = {
      title: 'Piloto aprova novo assoalho no simulador',
      category: 'DEVELOPMENT',
    }
    const resolved2 = resolveNewsIcon(mockNewsItem2.category)
    expect(resolved2.category).toBe('DEVELOPMENT')
    expect(resolved2.category).not.toBe('DRIVER')
  })

  // NI01B-09: retrato/logo não são confundidos com news icon (entidades separadas)
  it('NI01B-09: retrato/logo não são confundidos com news icon (entidades separadas sob contratos distintos)', () => {
    // 1. Piloto tem retrato via resolveDriverPhoto (PORTRAIT-MAP canônico)
    const driverPhoto = resolveDriverPhoto({ driverId: 'mbj-006' })
    expect(driverPhoto.url).toBe('/pilotos/DRV_0108.jpg')
    expect(driverPhoto.sourceType).toBe('canonical_real')

    // 2. Notícia tem ícone temático via resolveNewsIcon
    const newsIcon = resolveNewsIcon('DRIVER')
    expect(newsIcon.category).toBe('DRIVER')
    expect(newsIcon.iconId).toBe('news_icon_driver')
    expect(newsIcon.lucideIcon).toBe(User)

    // 3. Os dois sistemas nunca colidem nem dependem um do outro
    expect(driverPhoto.url).not.toBe(newsIcon.iconId)
    expect((newsIcon as any).candidateUrls).toBeUndefined()
  })

  // NI01B-10: zero Google Drive no runtime de news icons
  it('NI01B-10: zero Google Drive ou links externos no catálogo e no runtime de news icons', () => {
    const forbiddenPatterns = [
      'drive.google.com',
      'lh3.googleusercontent.com',
      'thumbnail',
      'uc?id=',
    ]

    for (const [cat, def] of Object.entries(NEWS_ICON_CATALOG)) {
      if (def.localPath) {
        for (const pattern of forbiddenPatterns) {
          expect(def.localPath.toLowerCase()).not.toContain(pattern)
        }
      }
      expect(def.iconId).toMatch(/^news_icon_[a-z0-9_]+$/)
      expect(typeof def.lucideIcon).toBe('object')
    }
  })
})
