/**
 * Manifest Canônico de Assets de Circuitos (Circuit Assets)
 */

export interface CircuitAssetDefinition {
  code: string
  name: string
  country: string
  trackMapFileName?: string
  trackMapPath?: string
  blueprintFileName?: string
  blueprintPath?: string
  aliases: string[]
}

export const CIRCUIT_ASSET_MANIFEST: Record<string, CircuitAssetDefinition> = {
  bahrain: {
    code: 'bahrain',
    name: 'Bahrain International Circuit',
    country: 'Bahrein',
    trackMapFileName: 'bahrain_map.png',
    trackMapPath: '/assets/circuits/bahrain_map.png',
    aliases: ['bahrain', 'sakhir', 'bhr'],
  },
  jeddah: {
    code: 'jeddah',
    name: 'Jeddah Corniche Circuit',
    country: 'Arábia Saudita',
    trackMapFileName: 'jeddah_map.png',
    trackMapPath: '/assets/circuits/jeddah_map.png',
    aliases: ['jeddah', 'saudi', 'sau'],
  },
  melbourne: {
    code: 'melbourne',
    name: 'Albert Park Circuit',
    country: 'Austrália',
    trackMapFileName: 'albert_park_map.png',
    trackMapPath: '/assets/circuits/albert_park_map.png',
    aliases: ['melbourne', 'albert_park', 'australia', 'aus'],
  },
  suzuka: {
    code: 'suzuka',
    name: 'Suzuka International Racing Course',
    country: 'Japão',
    trackMapFileName: 'suzuka_map.png',
    trackMapPath: '/assets/circuits/suzuka_map.png',
    aliases: ['suzuka', 'japan', 'jpn'],
  },
  shanghai: {
    code: 'shanghai',
    name: 'Shanghai International Circuit',
    country: 'China',
    trackMapFileName: 'shanghai_map.png',
    trackMapPath: '/assets/circuits/shanghai_map.png',
    aliases: ['shanghai', 'china', 'chn'],
  },
  miami: {
    code: 'miami',
    name: 'Miami International Autodrome',
    country: 'Estados Unidos',
    trackMapFileName: 'miami_map.png',
    trackMapPath: '/assets/circuits/miami_map.png',
    aliases: ['miami', 'mia', 'usa_miami'],
  },
  imola: {
    code: 'imola',
    name: 'Autodromo Enzo e Dino Ferrari',
    country: 'Itália',
    trackMapFileName: 'imola_map.png',
    trackMapPath: '/assets/circuits/imola_map.png',
    aliases: ['imola', 'emilia_romagna', 'ita_imola'],
  },
  monaco: {
    code: 'monaco',
    name: 'Circuit de Monaco',
    country: 'Mônaco',
    trackMapFileName: 'monaco_map.png',
    trackMapPath: '/assets/circuits/monaco_map.png',
    aliases: ['monaco', 'monte_carlo', 'mco'],
  },
  montreal: {
    code: 'montreal',
    name: 'Circuit Gilles Villeneuve',
    country: 'Canadá',
    trackMapFileName: 'montreal_map.png',
    trackMapPath: '/assets/circuits/montreal_map.png',
    aliases: ['montreal', 'canada', 'can', 'gilles_villeneuve'],
  },
  barcelona: {
    code: 'barcelona',
    name: 'Circuit de Barcelona-Catalunya',
    country: 'Espanha',
    trackMapFileName: 'catalunya_map.png',
    trackMapPath: '/assets/circuits/catalunya_map.png',
    aliases: ['barcelona', 'catalunya', 'spain', 'esp'],
  },
  spielberg: {
    code: 'spielberg',
    name: 'Red Bull Ring',
    country: 'Áustria',
    trackMapFileName: 'red_bull_ring_map.png',
    trackMapPath: '/assets/circuits/red_bull_ring_map.png',
    aliases: ['spielberg', 'austria', 'red_bull_ring', 'aut'],
  },
  silverstone: {
    code: 'silverstone',
    name: 'Silverstone Circuit',
    country: 'Reino Unido',
    trackMapFileName: 'silverstone_map.png',
    trackMapPath: '/assets/circuits/silverstone_map.png',
    aliases: ['silverstone', 'great_britain', 'uk', 'gbr'],
  },
  spa: {
    code: 'spa',
    name: 'Circuit de Spa-Francorchamps',
    country: 'Bélgica',
    trackMapFileName: 'spa_map.png',
    trackMapPath: '/assets/circuits/spa_map.png',
    aliases: ['spa', 'spa_francorchamps', 'belgium', 'bel'],
  },
  monza: {
    code: 'monza',
    name: 'Autodromo Nazionale Monza',
    country: 'Itália',
    trackMapFileName: 'monza_map.png',
    trackMapPath: '/assets/circuits/monza_map.png',
    aliases: ['monza', 'italy', 'ita'],
  },
  interlagos: {
    code: 'interlagos',
    name: 'Autódromo de Interlagos',
    country: 'Brasil',
    trackMapFileName: 'interlagos_map.png',
    trackMapPath: '/assets/circuits/interlagos_map.png',
    aliases: ['interlagos', 'brazil', 'brasil', 'sao_paulo', 'bra'],
  },
}

/**
 * Normaliza o código do circuito
 */
export function normalizeCircuitKey(circuitCodeOrName: string | null | undefined): string {
  if (!circuitCodeOrName) return ''
  const clean = circuitCodeOrName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[-\s]+/g, '_')

  for (const [key, item] of Object.entries(CIRCUIT_ASSET_MANIFEST)) {
    if (key === clean || item.code === clean) return key
    if (item.aliases.some((alias) => alias === clean || clean.includes(alias))) {
      return key
    }
  }

  return clean
}

/**
 * Retorna o mapa do circuito com fallback limpo
 */
export function getCircuitImage(circuitCodeOrName: string | null | undefined): string | null {
  if (!circuitCodeOrName) return null
  const key = normalizeCircuitKey(circuitCodeOrName)
  const asset = CIRCUIT_ASSET_MANIFEST[key]
  return asset?.trackMapPath || null
}
