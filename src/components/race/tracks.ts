/**
 * Definição dos Circuitos para o Módulo de Corrida / Pit Wall do APEX GP Manager.
 *
 * Cada circuito contém:
 * - id: identificador único
 * - name: nome oficial do circuito
 * - country: país
 * - totalLaps: número total de voltas padrão para a corrida (ex: 10 voltas para simulação rápida / sprint configurada)
 * - lapLengthKm: comprimento em km
 * - viewBox: sistema de coordenadas do SVG
 * - path: SVG path string representando o traçado completo
 * - points: array de pontos {x, y} ao longo do traçado para interpolação/animação suave dos carros
 * - startFinish: ponto de largada / linha de chegada
 * - isDefault: true para Interlagos (circuito padrão)
 */

export interface TrackPoint {
  x: number
  y: number
}

export interface TrackDefinition {
  id: string
  name: string
  country: string
  totalLaps: number
  lapLengthKm: number
  viewBox: string
  path: string
  points: TrackPoint[]
  startFinish: TrackPoint
  isDefault?: boolean
  description: string
  baseLapTimeSec: number // tempo base de volta (ex: ~71s em Interlagos)
}

/**
 * Função utilitária para converter uma sequência de pontos em SVG path contínuo fechado
 */
export function pointsToSvgPath(points: TrackPoint[]): string {
  if (!points || points.length === 0) return ''
  const first = points[0]
  let d = `M ${first.x} ${first.y}`
  for (let i = 1; i < points.length; i++) {
    const pt = points[i]
    d += ` L ${pt.x} ${pt.y}`
  }
  d += ' Z'
  return d
}

/**
 * Traçado simplificado e fiel de Interlagos (São Paulo, Brasil)
 * Sentido anti-horário:
 * Reta dos boxes -> S do Senna -> Curva do Sol -> Reta Oposta ->
 * Ferradura -> Laranjinha -> Pinheirinho -> Bico de Pato -> Mergulho -> Junção -> Subida dos Boxes
 */
const INTERLAGOS_POINTS: TrackPoint[] = [
  { x: 120, y: 195 }, // Reta dos boxes / Largada
  { x: 92, y: 195 }, // Fim da reta dos boxes
  { x: 74, y: 178 }, // S do Senna (Curva 1 descendo)
  { x: 70, y: 148 }, // S do Senna (Curva 2)
  { x: 90, y: 122 }, // Curva do Sol (saída para Reta Oposta)
  { x: 120, y: 92 }, // Reta Oposta
  { x: 160, y: 76 }, // Meio da Reta Oposta
  { x: 206, y: 90 }, // Entrada da Ferradura
  { x: 236, y: 102 }, // Ápice Ferradura
  { x: 270, y: 72 }, // Laranjinha
  { x: 295, y: 44 }, // Contorno externo miolo
  { x: 316, y: 56 }, // Topo
  { x: 308, y: 104 }, // Pinheirinho descida
  { x: 278, y: 142 }, // Bico de Pato
  { x: 242, y: 166 }, // Curva do Mergulho
  { x: 195, y: 174 }, // Entrada da Junção
  { x: 154, y: 180 }, // Junção
  { x: 135, y: 195 }, // Subida dos boxes / reta de chegada
]

/**
 * Traçado de Silverstone (Reino Unido)
 * Abbey -> Farm -> Loop -> Wellington -> Brooklands -> Luffield -> Copse -> Maggotts/Becketts/Chapel -> Hangar -> Stowe -> Club
 */
const SILVERSTONE_POINTS: TrackPoint[] = [
  { x: 175, y: 202 }, // Start/Finish Reta The Wing
  { x: 140, y: 212 },
  { x: 105, y: 188 },
  { x: 72, y: 180 }, // Village & Loop
  { x: 55, y: 140 },
  { x: 65, y: 100 }, // Wellington Straight
  { x: 95, y: 70 }, // Brooklands
  { x: 130, y: 55 }, // Luffield
  { x: 180, y: 64 }, // Woodcote / Copse
  { x: 232, y: 45 }, // Maggotts
  { x: 268, y: 35 }, // Becketts
  { x: 288, y: 65 }, // Chapel
  { x: 290, y: 105 }, // Hangar Straight
  { x: 275, y: 138 }, // Stowe
  { x: 235, y: 154 }, // Vale
  { x: 195, y: 175 }, // Club
]

/**
 * Traçado de Monza (Itália)
 * Rettifilo -> Variante Rettifilo -> Curva Grande -> Roggia -> Lesmo 1 & 2 -> Serraglio -> Ascari -> Parabolica
 */
const MONZA_POINTS: TrackPoint[] = [
  { x: 60, y: 140 }, // Rettifilo (Linha de Chegada)
  { x: 60, y: 80 }, // Fim da reta principal
  { x: 72, y: 50 }, // Variante del Rettifilo
  { x: 110, y: 52 }, // Curva Grande (Biassono)
  { x: 155, y: 74 }, // Variante della Roggia
  { x: 195, y: 66 }, // Lesmo 1
  { x: 238, y: 34 }, // Lesmo 2
  { x: 280, y: 32 }, // Serraglio
  { x: 286, y: 80 }, // Descida em alta velocidade
  { x: 286, y: 130 }, // Variante Ascari entrada
  { x: 260, y: 165 }, // Saída da Ascari
  { x: 215, y: 190 }, // Reta oposta para a Parabolica
  { x: 120, y: 192 }, // Curva Parabolica (Alboreto)
  { x: 70, y: 185 }, // Saída da Parabolica em direção aos boxes
]

/**
 * Traçado de Spa-Francorchamps (Bélgica)
 * La Source -> Eau Rouge -> Raidillon -> Kemmel -> Les Combes -> Malmedy -> Rivage -> Pouhon -> Blanchimont -> Bus Stop
 */
const SPA_POINTS: TrackPoint[] = [
  { x: 80, y: 132 }, // Reta dos boxes
  { x: 50, y: 145 }, // La Source (hairpin)
  { x: 75, y: 122 }, // Descida para Eau Rouge
  { x: 115, y: 118 }, // Subida do Raidillon
  { x: 128, y: 68 }, // Kemmel Straight
  { x: 145, y: 26 }, // Les Combes
  { x: 180, y: 28 }, // Malmedy
  { x: 226, y: 58 }, // Rivage
  { x: 280, y: 50 }, // Pouhon
  { x: 308, y: 40 }, // Fagnes / Stavelot
  { x: 298, y: 95 }, // Blanchimont
  { x: 265, y: 145 }, // Bus Stop chicane
  { x: 210, y: 172 },
  { x: 150, y: 180 },
  { x: 105, y: 198 },
]

export const TRACKS: Record<string, TrackDefinition> = {
  interlagos: {
    id: 'interlagos',
    name: 'Autódromo de Interlagos',
    country: 'Brasil',
    totalLaps: 10,
    lapLengthKm: 4.309,
    viewBox: '0 0 360 240',
    path: pointsToSvgPath(INTERLAGOS_POINTS),
    points: INTERLAGOS_POINTS,
    startFinish: { x: 120, y: 195 },
    isDefault: true,
    description:
      'Circuito clássico anti-horário com S do Senna em descida, Reta Oposta veloz e miolo técnico da Junção.',
    baseLapTimeSec: 71.5,
  },
  silverstone: {
    id: 'silverstone',
    name: 'Circuito de Silverstone',
    country: 'Reino Unido',
    totalLaps: 10,
    lapLengthKm: 5.891,
    viewBox: '0 0 360 240',
    path: pointsToSvgPath(SILVERSTONE_POINTS),
    points: SILVERSTONE_POINTS,
    startFinish: { x: 175, y: 202 },
    isDefault: false,
    description:
      'O templo da velocidade com a sequência histórica de Copse, Maggotts, Becketts e Hangar Straight.',
    baseLapTimeSec: 88.2,
  },
  monza: {
    id: 'monza',
    name: 'Autodromo Nazionale Monza',
    country: 'Itália',
    totalLaps: 10,
    lapLengthKm: 5.793,
    viewBox: '0 0 360 240',
    path: pointsToSvgPath(MONZA_POINTS),
    points: MONZA_POINTS,
    startFinish: { x: 60, y: 140 },
    isDefault: false,
    description:
      'O Templo da Velocidade com aceleração máxima em 80% da pista, chicanes fortes e a mítica Parabolica.',
    baseLapTimeSec: 81.0,
  },
  spa: {
    id: 'spa',
    name: 'Circuito de Spa-Francorchamps',
    country: 'Bélgica',
    totalLaps: 10,
    lapLengthKm: 7.004,
    viewBox: '0 0 360 240',
    path: pointsToSvgPath(SPA_POINTS),
    points: SPA_POINTS,
    startFinish: { x: 80, y: 132 },
    isDefault: false,
    description:
      'Sete quilômetros lendários através das Ardenas com Eau Rouge/Raidillon, Pouhon e a longa reta Kemmel.',
    baseLapTimeSec: 105.4,
  },
}

export const DEFAULT_TRACK_ID = 'interlagos'

export function getTrack(trackId?: string): TrackDefinition {
  if (trackId && TRACKS[trackId]) {
    return TRACKS[trackId]
  }
  return TRACKS[DEFAULT_TRACK_ID]
}

export function getAllTracks(): TrackDefinition[] {
  return Object.values(TRACKS)
}
