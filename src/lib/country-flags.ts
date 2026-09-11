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
