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
  // 24 arquivos reais de public/circuitos:
  // 01-Australia.jpg, 02-China.jpg, 03-Japao.jpg, 04-Bahrein.jpg, 05-Arabia_Saudita.jpg,
  // 06-Miami.jpg, 07-Canada.jpg, 08-Monaco.jpg, 09-Barcelona.jpg, 10-Madrid.jpg,
  // 11-Austria.jpg, 12-Silverstone.jpg, 13-Belgica.jpg, 14-Hungria.jpg, 15-Holanda.jpg,
  // 16-Monza.jpg, 17-Azerbaijao.jpg, 18-Singapura.jpg, 19-USA.jpg, 20-Mexico.jpg,
  // 21-Brasil.jpg, 22-Las_Vegas.jpg, 23-Qatar.jpg, 24-Abu_Dhabi.jpg
  australia: '/circuitos/01-Australia.jpg',
  albert_park: '/circuitos/01-Australia.jpg',
  melbourne: '/circuitos/01-Australia.jpg',
  china: '/circuitos/02-China.jpg',
  shanghai: '/circuitos/02-China.jpg',
  japao: '/circuitos/03-Japao.jpg',
  japan: '/circuitos/03-Japao.jpg',
  suzuka: '/circuitos/03-Japao.jpg',
  bahrein: '/circuitos/04-Bahrein.jpg',
  bahrain: '/circuitos/04-Bahrein.jpg',
  sakhir: '/circuitos/04-Bahrein.jpg',
  arabia_saudita: '/circuitos/05-Arabia_Saudita.jpg',
  saudi_arabia: '/circuitos/05-Arabia_Saudita.jpg',
  jeddah: '/circuitos/05-Arabia_Saudita.jpg',
  miami: '/circuitos/06-Miami.jpg',
  canada: '/circuitos/07-Canada.jpg',
  montreal: '/circuitos/07-Canada.jpg',
  gilles_villeneuve: '/circuitos/07-Canada.jpg',
  villeneuve: '/circuitos/07-Canada.jpg',
  monaco: '/circuitos/08-Monaco.jpg',
  monte_carlo: '/circuitos/08-Monaco.jpg',
  barcelona: '/circuitos/09-Barcelona.jpg',
  catalunya: '/circuitos/09-Barcelona.jpg',
  spain: '/circuitos/09-Barcelona.jpg',
  espanha: '/circuitos/09-Barcelona.jpg',
  madrid: '/circuitos/10-Madrid.jpg',
  madring: '/circuitos/10-Madrid.jpg',
  austria: '/circuitos/11-Austria.jpg',
  spielberg: '/circuitos/11-Austria.jpg',
  red_bull_ring: '/circuitos/11-Austria.jpg',
  silverstone: '/circuitos/12-Silverstone.jpg',
  great_britain: '/circuitos/12-Silverstone.jpg',
  gra_bretanha: '/circuitos/12-Silverstone.jpg',
  belgica: '/circuitos/13-Belgica.jpg',
  belgium: '/circuitos/13-Belgica.jpg',
  spa: '/circuitos/13-Belgica.jpg',
  spa_francorchamps: '/circuitos/13-Belgica.jpg',
  hungria: '/circuitos/14-Hungria.jpg',
  hungary: '/circuitos/14-Hungria.jpg',
  budapest: '/circuitos/14-Hungria.jpg',
  hungaroring: '/circuitos/14-Hungria.jpg',
  holanda: '/circuitos/15-Holanda.jpg',
  netherlands: '/circuitos/15-Holanda.jpg',
  zandvoort: '/circuitos/15-Holanda.jpg',
  monza: '/circuitos/16-Monza.jpg',
  italia: '/circuitos/16-Monza.jpg',
  italy: '/circuitos/16-Monza.jpg',
  azerbaijao: '/circuitos/17-Azerbaijao.jpg',
  azerbaijan: '/circuitos/17-Azerbaijao.jpg',
  baku: '/circuitos/17-Azerbaijao.jpg',
  singapura: '/circuitos/18-Singapura.jpg',
  singapore: '/circuitos/18-Singapura.jpg',
  marina_bay: '/circuitos/18-Singapura.jpg',
  usa: '/circuitos/19-USA.jpg',
  united_states: '/circuitos/19-USA.jpg',
  austin: '/circuitos/19-USA.jpg',
  cota: '/circuitos/19-USA.jpg',
  mexico: '/circuitos/20-Mexico.jpg',
  hermanos_rodriguez: '/circuitos/20-Mexico.jpg',
  brasil: '/circuitos/21-Brasil.jpg',
  brazil: '/circuitos/21-Brasil.jpg',
  interlagos: '/circuitos/21-Brasil.jpg',
  sao_paulo: '/circuitos/21-Brasil.jpg',
  las_vegas: '/circuitos/22-Las_Vegas.jpg',
  vegas: '/circuitos/22-Las_Vegas.jpg',
  qatar: '/circuitos/23-Qatar.jpg',
  lusail: '/circuitos/23-Qatar.jpg',
  abu_dhabi: '/circuitos/24-Abu_Dhabi.jpg',
  yas_marina: '/circuitos/24-Abu_Dhabi.jpg',
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
