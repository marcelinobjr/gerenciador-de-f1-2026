/**
 * Mapeamento e resolução de bandeiras por nacionalidade (ou país) dos pilotos e equipes de F1.
 */

const COUNTRY_FLAG_MAP: Record<string, string> = {
  // Brasil
  brasil: '🇧🇷',
  brazil: '🇧🇷',
  brasileiro: '🇧🇷',
  brasileira: '🇧🇷',
  bra: '🇧🇷',
  br: '🇧🇷',

  // Reino Unido / Grã-Bretanha / Inglaterra / Escócia
  'reino unido': '🇬🇧',
  'united kingdom': '🇬🇧',
  uk: '🇬🇧',
  gbr: '🇬🇧',
  inglaterra: '🇬🇧',
  england: '🇬🇧',
  britânico: '🇬🇧',
  britanico: '🇬🇧',
  britânica: '🇬🇧',
  britanica: '🇬🇧',
  british: '🇬🇧',
  escócia: '🇬🇧',
  scotland: '🇬🇧',

  // Holanda / Países Baixos
  holanda: '🇳🇱',
  netherlands: '🇳🇱',
  holandês: '🇳🇱',
  holandes: '🇳🇱',
  holandesa: '🇳🇱',
  dutch: '🇳🇱',
  ned: '🇳🇱',
  nld: '🇳🇱',

  // Mônaco
  mônaco: '🇲🇨',
  monaco: '🇲🇨',
  monegasco: '🇲🇨',
  monegasca: '🇲🇨',
  mon: '🇲🇨',

  // Espanha
  espanha: '🇪🇸',
  spain: '🇪🇸',
  espanhol: '🇪🇸',
  espanhola: '🇪🇸',
  spanish: '🇪🇸',
  esp: '🇪🇸',

  // Austrália
  austrália: '🇦🇺',
  australia: '🇦🇺',
  australiano: '🇦🇺',
  australiana: '🇦🇺',
  australian: '🇦🇺',
  aus: '🇦🇺',

  // México
  méxico: '🇲🇽',
  mexico: '🇲🇽',
  mexicano: '🇲🇽',
  mexicana: '🇲🇽',
  mexican: '🇲🇽',
  mex: '🇲🇽',

  // França
  frança: '🇫🇷',
  france: '🇫🇷',
  francês: '🇫🇷',
  frances: '🇫🇷',
  francesa: '🇫🇷',
  french: '🇫🇷',
  fra: '🇫🇷',

  // Alemanha
  alemanha: '🇩🇪',
  germany: '🇩🇪',
  alemão: '🇩🇪',
  alemao: '🇩🇪',
  alemã: '🇩🇪',
  alema: '🇩🇪',
  german: '🇩🇪',
  ger: '🇩🇪',
  deu: '🇩🇪',

  // Canadá
  canadá: '🇨🇦',
  canada: '🇨🇦',
  canadense: '🇨🇦',
  canadian: '🇨🇦',
  can: '🇨🇦',

  // Japão
  japão: '🇯🇵',
  japao: '🇯🇵',
  japan: '🇯🇵',
  japonês: '🇯🇵',
  japones: '🇯🇵',
  japonesa: '🇯🇵',
  japanese: '🇯🇵',
  jpn: '🇯🇵',

  // Itália
  itália: '🇮🇹',
  italia: '🇮🇹',
  italiano: '🇮🇹',
  italiana: '🇮🇹',
  italian: '🇮🇹',
  ita: '🇮🇹',

  // EUA / Estados Unidos
  eua: '🇺🇸',
  usa: '🇺🇸',
  'estados unidos': '🇺🇸',
  'united states': '🇺🇸',
  americano: '🇺🇸',
  americana: '🇺🇸',
  estadunidense: '🇺🇸',
  american: '🇺🇸',

  // Argentina
  argentina: '🇦🇷',
  argentino: '🇦🇷',
  argentina_: '🇦🇷',
  argentine: '🇦🇷',
  arg: '🇦🇷',

  // Finlândia
  finlândia: '🇫🇮',
  finlandia: '🇫🇮',
  finland: '🇫🇮',
  finlandês: '🇫🇮',
  finlandes: '🇫🇮',
  finnish: '🇫🇮',
  fin: '🇫🇮',

  // China
  china: '🇨🇳',
  chinês: '🇨🇳',
  chines: '🇨🇳',
  chinesa: '🇨🇳',
  chinese: '🇨🇳',
  chn: '🇨🇳',

  // Dinamarca
  dinamarca: '🇩🇰',
  denmark: '🇩🇰',
  dinamarquês: '🇩🇰',
  dinamarques: '🇩🇰',
  danish: '🇩🇰',
  den: '🇩🇰',
  dnk: '🇩🇰',

  // Tailândia
  tailândia: '🇹🇭',
  tailandia: '🇹🇭',
  thailand: '🇹🇭',
  tailandês: '🇹🇭',
  tailandes: '🇹🇭',
  thai: '🇹🇭',
  tha: '🇹🇭',

  // Nova Zelândia
  'nova zelândia': '🇳🇿',
  'nova zelandia': '🇳🇿',
  'new zealand': '🇳🇿',
  neozelandês: '🇳🇿',
  neozelandes: '🇳🇿',
  kiwi: '🇳🇿',
  nzl: '🇳🇿',

  // Barbados
  barbados: '🇧🇧',
  barbadiano: '🇧🇧',
  barbadiana: '🇧🇧',
  brb: '🇧🇧',

  // Estônia
  estônia: '🇪🇪',
  estonia: '🇪🇪',
  estoniano: '🇪🇪',
  estoniana: '🇪🇪',
  estonian: '🇪🇪',
  est: '🇪🇪',

  // Outros comuns na F1/Motorsport
  áustria: '🇦🇹',
  austria: '🇦🇹',
  austríaco: '🇦🇹',
  austriaco: '🇦🇹',
  aut: '🇦🇹',
  suíça: '🇨🇭',
  suica: '🇨🇭',
  switzerland: '🇨🇭',
  suíço: '🇨🇭',
  suico: '🇨🇭',
  sui: '🇨🇭',
  bélgica: '🇧🇪',
  belgica: '🇧🇪',
  belgium: '🇧🇪',
  belga: '🇧🇪',
  bel: '🇧🇪',
  irlanda: '🇮🇪',
  ireland: '🇮🇪',
  irl: '🇮🇪',
  polônia: '🇵🇱',
  polonia: '🇵🇱',
  poland: '🇵🇱',
  pol: '🇵🇱',

  // Suécia
  suécia: '🇸🇪',
  suecia: '🇸🇪',
  sweden: '🇸🇪',
  sueco: '🇸🇪',
  sueca: '🇸🇪',
  swedish: '🇸🇪',
  swe: '🇸🇪',

  // Colômbia
  colômbia: '🇨🇴',
  colombia: '🇨🇴',
  colombiano: '🇨🇴',
  colombiana: '🇨🇴',
  colombian: '🇨🇴',
  col: '🇨🇴',

  // Noruega
  noruega: '🇳🇴',
  norway: '🇳🇴',
  norueguês: '🇳🇴',
  noruegues: '🇳🇴',
  norueguesa: '🇳🇴',
  norwegian: '🇳🇴',
  nor: '🇳🇴',

  // Paraguai
  paraguai: '🇵🇾',
  paraguay: '🇵🇾',
  paraguaio: '🇵🇾',
  paraguaia: '🇵🇾',
  paraguayan: '🇵🇾',
  pry: '🇵🇾',

  // Índia
  índia: '🇮🇳',
  india: '🇮🇳',
  indiano: '🇮🇳',
  indiana: '🇮🇳',
  indian: '🇮🇳',
  ind: '🇮🇳',

  // República Tcheca / Chéquia
  'república tcheca': '🇨🇿',
  'republica tcheca': '🇨🇿',
  'czech republic': '🇨🇿',
  czechia: '🇨🇿',
  tcheco: '🇨🇿',
  tcheca: '🇨🇿',
  czech: '🇨🇿',
  cze: '🇨🇿',

  // Portugal
  portugal: '🇵🇹',
  português: '🇵🇹',
  portugues: '🇵🇹',
  portuguesa: '🇵🇹',
  portuguese: '🇵🇹',
  prt: '🇵🇹',
  por: '🇵🇹',

  // Bulgária
  bulgária: '🇧🇬',
  bulgaria: '🇧🇬',
  búlgaro: '🇧🇬',
  bulgaro: '🇧🇬',
  búlgara: '🇧🇬',
  bulgara: '🇧🇬',
  bulgarian: '🇧🇬',
  bgr: '🇧🇬',
  bul: '🇧🇬',
}

/**
 * Normaliza e retorna a bandeira emoji correspondente à nacionalidade ou país.
 * Fallback: 🏁
 */
export const COUNTRY_CODE_MAP: Record<string, string> = {
  // Brasil
  brasil: 'BRA',
  brazil: 'BRA',
  brasileiro: 'BRA',
  brasileira: 'BRA',
  bra: 'BRA',
  br: 'BRA',

  // Reino Unido / Grã-Bretanha / Inglaterra / Escócia
  'reino unido': 'GBR',
  'united kingdom': 'GBR',
  uk: 'GBR',
  gbr: 'GBR',
  inglaterra: 'GBR',
  england: 'GBR',
  britanico: 'GBR',
  britânico: 'GBR',
  britânica: 'GBR',
  britanica: 'GBR',
  british: 'GBR',
  escosia: 'GBR',
  escócia: 'GBR',
  scotland: 'GBR',

  // Holanda / Países Baixos
  holanda: 'NLD',
  netherlands: 'NLD',
  holandes: 'NLD',
  holandês: 'NLD',
  holandesa: 'NLD',
  dutch: 'NLD',
  ned: 'NLD',
  nld: 'NLD',

  // Mônaco
  monaco: 'MCO',
  mônaco: 'MCO',
  monegasco: 'MCO',
  monegasca: 'MCO',
  mon: 'MCO',
  mco: 'MCO',

  // Espanha
  espanha: 'ESP',
  spain: 'ESP',
  espanhol: 'ESP',
  espanhola: 'ESP',
  spanish: 'ESP',
  esp: 'ESP',

  // Austrália
  australia: 'AUS',
  austrália: 'AUS',
  australiano: 'AUS',
  australiana: 'AUS',
  australian: 'AUS',
  aus: 'AUS',

  // México
  mexico: 'MEX',
  méxico: 'MEX',
  mexicano: 'MEX',
  mexicana: 'MEX',
  mexican: 'MEX',
  mex: 'MEX',

  // França
  franca: 'FRA',
  frança: 'FRA',
  france: 'FRA',
  frances: 'FRA',
  francês: 'FRA',
  francesa: 'FRA',
  french: 'FRA',
  fra: 'FRA',

  // Alemanha
  alemanha: 'DEU',
  germany: 'DEU',
  alemao: 'DEU',
  alemão: 'DEU',
  alema: 'DEU',
  alemã: 'DEU',
  german: 'DEU',
  ger: 'DEU',
  deu: 'DEU',

  // Canadá
  canada: 'CAN',
  canadá: 'CAN',
  canadense: 'CAN',
  canadian: 'CAN',
  can: 'CAN',

  // Japão
  japao: 'JPN',
  japão: 'JPN',
  japan: 'JPN',
  japones: 'JPN',
  japonês: 'JPN',
  japonesa: 'JPN',
  japanese: 'JPN',
  jpn: 'JPN',

  // Itália
  italia: 'ITA',
  itália: 'ITA',
  italiano: 'ITA',
  italiana: 'ITA',
  italian: 'ITA',
  ita: 'ITA',

  // EUA
  eua: 'USA',
  usa: 'USA',
  'estados unidos': 'USA',
  'united states': 'USA',
  americano: 'USA',
  americana: 'USA',
  estadunidense: 'USA',
  american: 'USA',

  // Argentina
  argentina: 'ARG',
  argentino: 'ARG',
  argentine: 'ARG',
  arg: 'ARG',

  // Finlândia
  finlandia: 'FIN',
  finlândia: 'FIN',
  finland: 'FIN',
  finlandes: 'FIN',
  finlandês: 'FIN',
  finnish: 'FIN',
  fin: 'FIN',

  // China
  china: 'CHN',
  chines: 'CHN',
  chinês: 'CHN',
  chinesa: 'CHN',
  chinese: 'CHN',
  chn: 'CHN',

  // Dinamarca
  dinamarca: 'DNK',
  denmark: 'DNK',
  dinamarques: 'DNK',
  dinamarquês: 'DNK',
  danish: 'DNK',
  den: 'DNK',
  dnk: 'DNK',

  // Tailândia
  tailandia: 'THA',
  tailândia: 'THA',
  thailand: 'THA',
  tailandes: 'THA',
  tailandês: 'THA',
  thai: 'THA',
  tha: 'THA',

  // Nova Zelândia
  'nova zelandia': 'NZL',
  'nova zelândia': 'NZL',
  'new zealand': 'NZL',
  neozelandes: 'NZL',
  neozelandês: 'NZL',
  kiwi: 'NZL',
  nzl: 'NZL',

  // Barbados
  barbados: 'BRB',
  barbadiano: 'BRB',
  barbadiana: 'BRB',
  brb: 'BRB',

  // Estônia
  estonia: 'EST',
  estônia: 'EST',
  estoniano: 'EST',
  estoniana: 'EST',
  estonian: 'EST',
  est: 'EST',

  // Áustria
  austria: 'AUT',
  áustria: 'AUT',
  austriaco: 'AUT',
  austríaco: 'AUT',
  aut: 'AUT',

  // Suíça
  suica: 'SUI',
  suíça: 'SUI',
  switzerland: 'SUI',
  suico: 'SUI',
  suíço: 'SUI',
  sui: 'SUI',
  che: 'SUI',

  // Bélgica
  belgica: 'BEL',
  bélgica: 'BEL',
  belgium: 'BEL',
  belga: 'BEL',
  bel: 'BEL',

  // Irlanda
  irlanda: 'IRL',
  ireland: 'IRL',
  irl: 'IRL',

  // Polônia
  polonia: 'POL',
  polônia: 'POL',
  poland: 'POL',
  pol: 'POL',

  // Suécia
  suecia: 'SWE',
  suécia: 'SWE',
  sweden: 'SWE',
  sueco: 'SWE',
  sueca: 'SWE',
  swe: 'SWE',

  // Colômbia
  colombia: 'COL',
  colômbia: 'COL',
  colombiano: 'COL',
  colombiana: 'COL',
  col: 'COL',

  // Noruega
  noruega: 'NOR',
  norway: 'NOR',
  noruegues: 'NOR',
  norueguês: 'NOR',
  nor: 'NOR',

  // Paraguai
  paraguay: 'PRY',
  paraguai: 'PRY',
  paraguaio: 'PRY',
  pry: 'PRY',

  // Índia
  india: 'IND',
  índia: 'IND',
  indiano: 'IND',
  ind: 'IND',

  // República Tcheca
  'republica tcheca': 'CZE',
  'república tcheca': 'CZE',
  'czech republic': 'CZE',
  czechia: 'CZE',
  tcheco: 'CZE',
  cze: 'CZE',

  // Portugal
  portugal: 'PRT',
  portugues: 'PRT',
  português: 'PRT',
  prt: 'PRT',
  por: 'PRT',

  // Bulgária
  bulgaria: 'BGR',
  bulgária: 'BGR',
  bulgaro: 'BGR',
  búlgaro: 'BGR',
  bgr: 'BGR',
  bul: 'BGR',

  // Bahrein
  bahrein: 'BHR',
  bahrain: 'BHR',
  bhr: 'BHR',

  // Arábia Saudita
  'arabia saudita': 'SAU',
  'arábia saudita': 'SAU',
  'saudi arabia': 'SAU',
  sau: 'SAU',

  // Hungria
  hungria: 'HUN',
  hungary: 'HUN',
  hun: 'HUN',

  // Azerbaijão
  azerbaijao: 'AZE',
  azerbaijão: 'AZE',
  azerbaijan: 'AZE',
  aze: 'AZE',

  // Singapura
  singapura: 'SGP',
  singapore: 'SGP',
  sgp: 'SGP',

  // Catar
  catar: 'QAT',
  qatar: 'QAT',
  qat: 'QAT',

  // Emirados Árabes Unidos
  'emirados arabes unidos': 'UAE',
  'emirados árabes unidos': 'UAE',
  'united arab emirates': 'UAE',
  uae: 'UAE',
  are: 'UAE',
}

export const ROUND_COUNTRY_CODE_MAP: Record<number, string> = {
  1: 'AUS',
  2: 'CHN',
  3: 'JPN',
  4: 'BHR',
  5: 'SAU',
  6: 'USA',
  7: 'CAN',
  8: 'MCO',
  9: 'ESP',
  10: 'AUT',
  11: 'GBR',
  12: 'BEL',
  13: 'HUN',
  14: 'NLD',
  15: 'ITA',
  16: 'ESP',
  17: 'AZE',
  18: 'SGP',
  19: 'USA',
  20: 'MEX',
  21: 'BRA',
  22: 'USA',
  23: 'QAT',
  24: 'UAE',
}

/**
 * Retorna o código de 3 letras do país (AUS, CHN, JPN, BRA...)
 * Derivado de país/nacionalidade ou do número da rodada.
 */
export function getCountryCode(
  countryOrNationality?: string | null,
  round?: number | null,
): string {
  if (countryOrNationality) {
    const raw = countryOrNationality.trim().toLowerCase()
    if (COUNTRY_CODE_MAP[raw]) {
      return COUNTRY_CODE_MAP[raw]
    }
    const clean = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (COUNTRY_CODE_MAP[clean]) {
      return COUNTRY_CODE_MAP[clean]
    }
    for (const [key, code] of Object.entries(COUNTRY_CODE_MAP)) {
      const keyClean = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (clean === keyClean || clean.includes(keyClean) || keyClean.includes(clean)) {
        return code
      }
    }
  }

  if (round && ROUND_COUNTRY_CODE_MAP[round]) {
    return ROUND_COUNTRY_CODE_MAP[round]
  }

  if (countryOrNationality) {
    const rawClean = countryOrNationality
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
    if (rawClean.length >= 2) {
      return rawClean.slice(0, 3)
    }
  }

  return 'F1'
}

export function getCountryFlag(nationality?: string | null): string {
  if (!nationality) return '🏁'
  const clean = nationality
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos para lookup tolerante

  // Busca direta
  if (COUNTRY_FLAG_MAP[nationality.trim().toLowerCase()]) {
    return COUNTRY_FLAG_MAP[nationality.trim().toLowerCase()]
  }

  // Busca sem acentos
  if (COUNTRY_FLAG_MAP[clean]) {
    return COUNTRY_FLAG_MAP[clean]
  }

  // Busca por contenção de palavra-chave
  for (const [key, flag] of Object.entries(COUNTRY_FLAG_MAP)) {
    const keyClean = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (clean === keyClean || clean.includes(keyClean) || keyClean.includes(clean)) {
      return flag
    }
  }

  return '🏁'
}
