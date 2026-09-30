/**
 * Resolução canônica de bandeiras por nacionalidade ou código ISO3/nome de piloto/país.
 * Regra: "Nacionalidade é dado, bandeira é apresentação" — sem alteração de dados no banco.
 */

import { COUNTRY_CODE_MAP, getCountryCode } from './country-flags'

/**
 * Mapa ISO3 -> ISO2
 */
export type CountryInput = string | string[] | null | undefined

/**
 * Mapa canônico ISO3 -> ISO2
 */
export const ISO3_TO_ISO2: Record<string, string> = {
  // Principais do universo ativo de F1 / Categorias de Base / Base Real
  BRA: 'BR',
  DEU: 'DE',
  GER: 'DE',
  GBR: 'GB',
  USA: 'US',
  NLD: 'NL',
  NED: 'NL',
  MCO: 'MC',
  MON: 'MC',
  JPN: 'JP',
  AUS: 'AU',
  FRA: 'FR',
  ITA: 'IT',
  THA: 'TH',
  FIN: 'FI',
  ESP: 'ES',
  CAN: 'CA',
  MEX: 'MX',
  ARG: 'AR',
  NZL: 'NZ',
  CHE: 'CH',
  SUI: 'CH',
  AUT: 'AT',
  BEL: 'BE',
  SWE: 'SE',
  DNK: 'DK',
  DEN: 'DK',
  NOR: 'NO',
  IRL: 'IE',
  CHN: 'CN',
  POL: 'PL',
  CZE: 'CZ',
  COL: 'CO',
  POR: 'PT',
  PRT: 'PT',
  RSA: 'ZA',
  ZAF: 'ZA',
  IND: 'IN',
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
  RUS: 'RU',
  ISR: 'IL',
  TUR: 'TR',
  IDN: 'ID',
  INA: 'ID',
  MYS: 'MY',
  MAS: 'MY',
}

/**
 * Conjunto de códigos ISO2 suportados diretamente.
 */
export const SUPPORTED_ISO2 = new Set<string>([
  'BR',
  'DE',
  'GB',
  'US',
  'NL',
  'MC',
  'JP',
  'AU',
  'FR',
  'IT',
  'TH',
  'FI',
  'ES',
  'CA',
  'MX',
  'AR',
  'NZ',
  'CH',
  'AT',
  'BE',
  'SE',
  'DK',
  'NO',
  'IE',
  'CN',
  'PL',
  'CZ',
  'CO',
  'PT',
  'ZA',
  'IN',
  'BB',
  'EE',
  'PY',
  'BG',
  'BH',
  'SA',
  'HU',
  'AZ',
  'SG',
  'QA',
  'AE',
  'RU',
  'IL',
  'TR',
  'ID',
  'MY',
])

/**
 * Nomes amigáveis em português para acessibilidade (title / aria-label)
 */
export const COUNTRY_NAMES_PT: Record<string, string> = {
  // ISO3 e ISO2 mapeando para o mesmo nome canônico
  BR: 'Brasil',
  BRA: 'Brasil',
  DE: 'Alemanha',
  DEU: 'Alemanha',
  GER: 'Alemanha',
  GB: 'Reino Unido',
  GBR: 'Reino Unido',
  US: 'Estados Unidos',
  USA: 'Estados Unidos',
  NL: 'Países Baixos',
  NLD: 'Países Baixos',
  NED: 'Países Baixos',
  MC: 'Mônaco',
  MCO: 'Mônaco',
  MON: 'Mônaco',
  JP: 'Japão',
  JPN: 'Japão',
  AU: 'Austrália',
  AUS: 'Austrália',
  FR: 'França',
  FRA: 'França',
  IT: 'Itália',
  ITA: 'Itália',
  TH: 'Tailândia',
  THA: 'Tailândia',
  FI: 'Finlândia',
  FIN: 'Finlândia',
  ES: 'Espanha',
  ESP: 'Espanha',
  CA: 'Canadá',
  CAN: 'Canadá',
  MX: 'México',
  MEX: 'México',
  AR: 'Argentina',
  ARG: 'Argentina',
  NZ: 'Nova Zelândia',
  NZL: 'Nova Zelândia',
  CH: 'Suíça',
  CHE: 'Suíça',
  SUI: 'Suíça',
  AT: 'Áustria',
  AUT: 'Áustria',
  BE: 'Bélgica',
  BEL: 'Bélgica',
  SE: 'Suécia',
  SWE: 'Suécia',
  DK: 'Dinamarca',
  DEN: 'Dinamarca',
  DNK: 'Dinamarca',
  NO: 'Noruega',
  NOR: 'Noruega',
  IE: 'Irlanda',
  IRL: 'Irlanda',
  CN: 'China',
  CHN: 'China',
  PL: 'Polônia',
  POL: 'Polônia',
  CZ: 'República Tcheca',
  CZE: 'República Tcheca',
  CO: 'Colômbia',
  COL: 'Colômbia',
  PT: 'Portugal',
  POR: 'Portugal',
  PRT: 'Portugal',
  ZA: 'África do Sul',
  RSA: 'África do Sul',
  ZAF: 'África do Sul',
  IN: 'Índia',
  IND: 'Índia',
  BB: 'Barbados',
  BRB: 'Barbados',
  EE: 'Estônia',
  EST: 'Estônia',
  PY: 'Paraguai',
  PRY: 'Paraguai',
  BG: 'Bulgária',
  BGR: 'Bulgária',
  BUL: 'Bulgária',
  BH: 'Bahrein',
  BHR: 'Bahrein',
  SA: 'Arábia Saudita',
  SAU: 'Arábia Saudita',
  HU: 'Hungria',
  HUN: 'Hungria',
  AZ: 'Azerbaijão',
  AZE: 'Azerbaijão',
  SG: 'Singapura',
  SGP: 'Singapura',
  QA: 'Catar',
  QAT: 'Catar',
  AE: 'Emirados Árabes Unidos',
  UAE: 'Emirados Árabes Unidos',
  ARE: 'Emirados Árabes Unidos',
  RU: 'Rússia',
  RUS: 'Rússia',
  IL: 'Israel',
  ISR: 'Israel',
  TR: 'Turquia',
  TUR: 'Turquia',
  ID: 'Indonésia',
  IDN: 'Indonésia',
  INA: 'Indonésia',
  MY: 'Malásia',
  MYS: 'Malásia',
  MAS: 'Malásia',
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
/**
 * Normaliza input que pode ser string, array de strings, null ou undefined.
 * Se array, utiliza a primeira entrada como principal (não descartando na UI).
 */
export function normalizeCountryInput(input?: CountryInput): {
  primary: string
  rawFirst: string
} {
  if (input === null || input === undefined) return { primary: '', rawFirst: '' }
  if (Array.isArray(input)) {
    const first = input.find((item) => typeof item === 'string' && item.trim().length > 0)
    const raw = first ? first.trim() : ''
    return { primary: raw, rawFirst: raw }
  }
  if (typeof input === 'string') {
    const trimmed = input.trim()
    return { primary: trimmed, rawFirst: trimmed }
  }
  return { primary: '', rawFirst: '' }
}

/**
 * Resolve código ISO2 e ISO3 a partir de CountryInput em memória (sem mutar dados persistidos).
 */
export function resolveIso2(input?: CountryInput): string {
  const { primary: trimmed } = normalizeCountryInput(input)
  if (!trimmed) return ''

  const upper = trimmed.toUpperCase()

  // Se já for ISO2 de 2 letras
  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) {
    return upper
  }

  // Se for ISO3 conhecido
  if (ISO3_TO_ISO2[upper]) {
    return ISO3_TO_ISO2[upper]
  }

  // Tenta resolver por mapa de nomes/cidades (COUNTRY_CODE_MAP em minúsculas)
  const mappedIso3 = COUNTRY_CODE_MAP[trimmed.toLowerCase()]
  if (mappedIso3) {
    const upperMapped = mappedIso3.toUpperCase()
    if (ISO3_TO_ISO2[upperMapped]) {
      return ISO3_TO_ISO2[upperMapped]
    }
    if (upperMapped.length === 2 && /^[A-Z]{2}$/.test(upperMapped)) {
      return upperMapped
    }
  }

  // Helper getCountryCode tolerante
  const resolvedCode = getCountryCode(trimmed)
  if (resolvedCode && resolvedCode !== 'F1') {
    const upperResolved = resolvedCode.toUpperCase()
    if (ISO3_TO_ISO2[upperResolved]) {
      return ISO3_TO_ISO2[upperResolved]
    }
    if (upperResolved.length === 2 && /^[A-Z]{2}$/.test(upperResolved)) {
      return upperResolved
    }
  }

  return ''
}

export function resolveIso3(codeOrName?: CountryInput): string {
  const { primary: trimmed } = normalizeCountryInput(codeOrName)
  if (!trimmed) return ''

  const upper = trimmed.toUpperCase()
  if (ISO3_TO_ISO2[upper]) {
    return upper
  }

  // Se for ISO2, busca chave ISO3 equivalente
  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) {
    for (const [iso3, iso2] of Object.entries(ISO3_TO_ISO2)) {
      if (iso2 === upper) return iso3
    }
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
 * Aceita ISO2 (BR, DE, GB, US, NL, MC, JP, AU, FR, IT, TH...) e ISO3 (BRA, DEU, GBR, USA...).
 * Se array, usa a primeira entrada como bandeira principal (sem mutar o array).
 * Fallback: código não resolvido -> retorna o CÓDIGO ORIGINAL recebido (string, ex: "XYZ").
 * Nunca undefined, null, '?', nem bandeira errada.
 */
export function countryFlag(codeOrName?: CountryInput): string {
  const { primary: trimmed, rawFirst } = normalizeCountryInput(codeOrName)
  if (!trimmed) return ''

  // Se já for emoji (ex: procedural_data.countryFlag "🇧🇷")
  if (/\p{Extended_Pictographic}/u.test(trimmed)) {
    return trimmed
  }

  // Resolução canônica ISO2 direta ou convertida de ISO3
  const iso2 = resolveIso2(trimmed)
  if (iso2) {
    const emoji = iso2ToEmoji(iso2)
    if (emoji) return emoji
  }

  // Fallback D-A7: código desconhecido (XYZ) -> retorna código original recebido ("XYZ")
  return rawFirst || trimmed
}

/**
 * Resolver canônico de bandeiras com fallback seguro determinístico.
 * Aceita CountryInput = string | string[] | null | undefined.
 * Se array, usa a PRIMEIRA entrada como bandeira principal (ex: ["TH", "GB"] -> TH).
 * Se fallback for omitido, desconhecido retorna o próprio código (ex: "XYZ").
 * Para null/undefined/[] retorna string vazia (ou fallback fornecido).
 */
export function resolveCountryFlag(codeOrName?: CountryInput, fallback?: string): string {
  const { primary: trimmed, rawFirst } = normalizeCountryInput(codeOrName)
  if (!trimmed) {
    return fallback !== undefined ? fallback : ''
  }

  const flag = countryFlag(trimmed)
  const isEmoji = /\p{Extended_Pictographic}/u.test(flag)
  if (isEmoji) {
    return flag
  }

  // Se o chamador especificou fallback explícito
  if (fallback !== undefined) {
    return fallback
  }

  // Fallback canônico: código não resolvido -> retornar o CÓDIGO ORIGINAL recebido (string)
  return rawFirst || trimmed
}

/**
 * Retorna o nome amigável em português para acessibilidade (title / aria-label).
 * BR e BRA -> "Brasil"; DE e DEU -> "Alemanha"; GB e GBR -> "Reino Unido"; US e USA -> "Estados Unidos".
 * Desconhecido -> a própria sigla/string de entrada.
 */
export function countryName(codeOrName?: CountryInput): string {
  const { primary: trimmed } = normalizeCountryInput(codeOrName)
  if (!trimmed) return ''

  const upper = trimmed.toUpperCase()

  // 1. Busca direta por upper no dicionário canônico (cobre ISO2 e ISO3 mapeados)
  if (COUNTRY_NAMES_PT[upper]) {
    return COUNTRY_NAMES_PT[upper]
  }

  // 2. Tenta via ISO2
  const iso2 = resolveIso2(trimmed)
  if (iso2 && COUNTRY_NAMES_PT[iso2]) {
    return COUNTRY_NAMES_PT[iso2]
  }

  // 3. Tenta via ISO3
  const iso3 = resolveIso3(trimmed)
  if (iso3 && COUNTRY_NAMES_PT[iso3]) {
    return COUNTRY_NAMES_PT[iso3]
  }

  return trimmed
}
