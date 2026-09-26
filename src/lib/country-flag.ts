/**
 * Resolução canônica de bandeiras por nacionalidade ou código ISO3/nome de piloto/país.
 * Regra: "Nacionalidade é dado, bandeira é apresentação" — sem alteração de dados no banco.
 */

import { COUNTRY_CODE_MAP, getCountryCode } from './country-flags'

/**
 * Mapa ISO3 -> ISO2
 */
export const ISO3_TO_ISO2: Record<string, string> = {
  // Principais do universo ativo de F1 / Categorias de Base
  DEU: 'DE',
  GER: 'DE',
  BRA: 'BR',
  GBR: 'GB',
  USA: 'US',
  MCO: 'MC',
  MON: 'MC',
  NLD: 'NL',
  NED: 'NL',
  JPN: 'JP',
  ESP: 'ES',
  FRA: 'FR',
  ITA: 'IT',
  AUS: 'AU',
  CAN: 'CA',
  MEX: 'MX',
  ARG: 'AR',
  NZL: 'NZ',
  FIN: 'FI',
  DEN: 'DK',
  DNK: 'DK',
  SWE: 'SE',
  NOR: 'NO',
  BEL: 'BE',
  CHE: 'CH',
  SUI: 'CH',
  AUT: 'AT',
  POL: 'PL',
  CZE: 'CZ',
  COL: 'CO',
  POR: 'PT',
  PRT: 'PT',
  RSA: 'ZA',
  ZAF: 'ZA',
  CHN: 'CN',
  THA: 'TH',
  IND: 'IN',
  IRL: 'IE',
  BRB: 'BB',
  EST: 'EE',
  PRY: 'PY',
  BGR: 'BG',
  BUL: 'BG',
  BHR: 'BH',
  SAU: 'SA',
  HUN: 'HU',
  AZE: 'AZ',
  SGP: 'SG',
  QAT: 'QA',
  UAE: 'AE',
  ARE: 'AE',
}

/**
 * Nomes amigáveis em português para acessibilidade (title / aria-label)
 */
export const COUNTRY_NAMES_PT: Record<string, string> = {
  DEU: 'Alemanha',
  GER: 'Alemanha',
  BRA: 'Brasil',
  GBR: 'Reino Unido',
  USA: 'Estados Unidos',
  MCO: 'Mônaco',
  MON: 'Mônaco',
  NLD: 'Países Baixos',
  NED: 'Países Baixos',
  JPN: 'Japão',
  ESP: 'Espanha',
  FRA: 'França',
  ITA: 'Itália',
  AUS: 'Austrália',
  CAN: 'Canadá',
  MEX: 'México',
  ARG: 'Argentina',
  NZL: 'Nova Zelândia',
  FIN: 'Finlândia',
  DEN: 'Dinamarca',
  DNK: 'Dinamarca',
  SWE: 'Suécia',
  NOR: 'Noruega',
  BEL: 'Bélgica',
  CHE: 'Suíça',
  SUI: 'Suíça',
  AUT: 'Áustria',
  POL: 'Polônia',
  CZE: 'República Tcheca',
  COL: 'Colômbia',
  POR: 'Portugal',
  PRT: 'Portugal',
  RSA: 'África do Sul',
  ZAF: 'África do Sul',
  CHN: 'China',
  THA: 'Tailândia',
  IND: 'Índia',
  IRL: 'Irlanda',
  BRB: 'Barbados',
  EST: 'Estônia',
  PRY: 'Paraguai',
  BGR: 'Bulgária',
  BUL: 'Bulgária',
  BHR: 'Bahrein',
  SAU: 'Arábia Saudita',
  HUN: 'Hungria',
  AZE: 'Azerbaijão',
  SGP: 'Singapura',
  QAT: 'Catar',
  UAE: 'Emirados Árabes Unidos',
  ARE: 'Emirados Árabes Unidos',
}

/**
 * Converte código ISO2 (ex: "BR") em emoji de bandeira usando regional indicators.
 */
export function iso2ToEmoji(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return ''
  const upper = iso2.toUpperCase()
  const codeA = upper.charCodeAt(0)
  const codeB = upper.charCodeAt(1)
  if (codeA < 65 || codeA > 90 || codeB < 65 || codeB > 90) return ''
  return String.fromCodePoint(0x1f1e6 + (codeA - 65), 0x1f1e6 + (codeB - 65))
}

/**
 * Resolve código ISO3 para uma entrada de nacionalidade ou país.
 */
export function resolveIso3(codeOrName?: string | null): string {
  if (!codeOrName || typeof codeOrName !== 'string') return ''
  const trimmed = codeOrName.trim()
  if (!trimmed) return ''

  const upper = trimmed.toUpperCase()
  if (ISO3_TO_ISO2[upper]) {
    return upper
  }

  // Tenta resolver pelo mapa existente pt/en
  const mapped = COUNTRY_CODE_MAP[trimmed.toLowerCase()]
  if (mapped && ISO3_TO_ISO2[mapped]) {
    return mapped
  }

  // Usa helper existente de normalização tolerante
  const resolved = getCountryCode(trimmed)
  if (resolved && resolved !== 'F1' && ISO3_TO_ISO2[resolved]) {
    return resolved
  }

  return upper
}

/**
 * Gera emoji deterministicamente para o código/nome fornecido.
 * Fallback: código desconhecido/vazio -> retorna a própria string de entrada.
 */
export function countryFlag(codeOrName?: string | null): string {
  if (!codeOrName || typeof codeOrName !== 'string') return ''
  const trimmed = codeOrName.trim()
  if (!trimmed) return ''

  // Se já for emoji (ex: procedural_data.countryFlag "🇧🇷")
  if (/\p{Extended_Pictographic}/u.test(trimmed)) {
    return trimmed
  }

  // Caso receba direto ISO2
  if (trimmed.length === 2 && /^[a-zA-Z]{2}$/.test(trimmed)) {
    const emoji = iso2ToEmoji(trimmed)
    if (emoji) return emoji
  }

  const iso3 = resolveIso3(trimmed)
  const iso2 = ISO3_TO_ISO2[iso3]
  if (iso2) {
    const emoji = iso2ToEmoji(iso2)
    if (emoji) return emoji
  }

  // Fallback: código desconhecido retorna a própria string de entrada (nunca undefined, '?' ou bloco quebrado)
  return trimmed
}

/**
 * Retorna o nome amigável em português para acessibilidade (title / aria-label).
 * Desconhecido -> a própria sigla/string de entrada.
 */
export function countryName(codeOrName?: string | null): string {
  if (!codeOrName || typeof codeOrName !== 'string') return ''
  const trimmed = codeOrName.trim()
  if (!trimmed) return ''

  const iso3 = resolveIso3(trimmed)
  if (COUNTRY_NAMES_PT[iso3]) {
    return COUNTRY_NAMES_PT[iso3]
  }

  return trimmed
}
