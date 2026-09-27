/**
 * Mapeamento canônico explícito entre circuitos e assets locais de public/circuitos/
 * CALENDARIO-CIRCUITOS-01
 */

export interface CircuitAssetMapping {
  circuitId: string
  imagePath: string
  displayName: string
}

export const CANONICAL_CIRCUIT_IMAGES: Record<string, string> = {
  // IDs canônicos e chaves padronizadas de circuitos da F1
  bahrain: '/circuitos/bahrain.png',
  sakhir: '/circuitos/bahrain.png',
  jeddah: '/circuitos/jeddah.png',
  melbourne: '/circuitos/melbourne.png',
  albert_park: '/circuitos/melbourne.png',
  suzuka: '/circuitos/suzuka.png',
  shanghai: '/circuitos/shanghai.png',
  miami: '/circuitos/miami.png',
  imola: '/circuitos/imola.png',
  monaco: '/circuitos/monaco.png',
  montreal: '/circuitos/montreal.png',
  gilles_villeneuve: '/circuitos/montreal.png',
  villeneuve: '/circuitos/montreal.png',
  barcelona: '/circuitos/barcelona.png',
  catalunya: '/circuitos/barcelona.png',
  spielberg: '/circuitos/spielberg.png',
  red_bull_ring: '/circuitos/spielberg.png',
  silverstone: '/circuitos/silverstone.png',
  budapest: '/circuitos/budapest.png',
  hungaroring: '/circuitos/budapest.png',
  spa: '/circuitos/spa.png',
  spa_francorchamps: '/circuitos/spa.png',
  zandvoort: '/circuitos/zandvoort.png',
  monza: '/circuitos/monza.png',
  baku: '/circuitos/baku.png',
  singapore: '/circuitos/singapore.png',
  marina_bay: '/circuitos/singapore.png',
  austin: '/circuitos/austin.png',
  cota: '/circuitos/austin.png',
  mexico: '/circuitos/mexico.png',
  hermanos_rodriguez: '/circuitos/mexico.png',
  interlagos: '/circuitos/interlagos.png',
  sao_paulo: '/circuitos/interlagos.png',
  las_vegas: '/circuitos/las_vegas.png',
  lusail: '/circuitos/lusail.png',
  qatar: '/circuitos/lusail.png',
  yas_marina: '/circuitos/abu_dhabi.png',
  abu_dhabi: '/circuitos/abu_dhabi.png',
}

/**
 * Resolve a URL da imagem real do circuito em public/circuitos.
 * Retorna null se não houver asset correspondente, sem fallback silencioso para outro circuito.
 */
export function resolveCircuitImagePath(circuitKeyOrId?: string | null): string | null {
  if (!circuitKeyOrId) return null
  const normalizedKey = circuitKeyOrId
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '_')
  return CANONICAL_CIRCUIT_IMAGES[normalizedKey] || null
}
