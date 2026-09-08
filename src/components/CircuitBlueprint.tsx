import React from 'react'

/**
 * Biblioteca de traçados dos circuitos oficiais da Fórmula 1 2026.
 * Silhuetas estilizadas no estilo blueprint técnico (grid, cotas e iluminação neon/cyan).
 * Cada traçado é fiel à geometria real da pista (retas, curvas características, chicanes, hairpins).
 */

export interface CircuitTrackData {
  round: number
  code: string
  name: string
  svgPath: string
  viewBox: string
  startFinish: { x: number; y: number }
  drsZones?: Array<{ x1: number; y1: number; x2: number; y2: number }>
  sectorPoints?: Array<{ x: number; y: number; label: string }>
  antiClockwise?: boolean
  description: string
}

export const TRACK_LAYOUTS: Record<number, CircuitTrackData> = {
  // 1: Melbourne Albert Park
  1: {
    round: 1,
    code: 'ALB',
    name: 'Albert Park, Melbourne',
    viewBox: '0 0 320 220',
    // Circuito ao redor do lago de Albert Park: reta principal na base esquerda, curva 1-2, subida para T3-4, lago à direita, chicanes velozes 9-10 e contorno final
    svgPath:
      'M 68 182 L 42 165 C 32 150 32 125 44 105 L 68 70 C 82 50 115 42 145 42 L 205 45 C 235 48 268 70 282 98 C 292 120 286 148 268 168 L 240 188 C 224 198 198 198 178 186 L 152 172 C 142 166 128 170 120 180 L 105 194 C 92 202 78 195 68 182 Z',
    startFinish: { x: 55, y: 173 },
    antiClockwise: false,
    description: 'Circuito misto ao redor do lago de Albert Park, rápido com freadas pesadas.',
  },
  // 2: Shanghai
  2: {
    round: 2,
    code: 'SHA',
    name: 'Xangai',
    viewBox: '0 0 320 220',
    // Caractere "Shang": caracol T1-T4 à esquerda/topo, reta interna, curva fechada T6, contorno T7-T8, reta gigantesca de 1.2km na base e hairpin final
    svgPath:
      'M 72 178 L 72 90 C 72 65 92 50 120 50 C 148 50 172 68 170 95 C 168 118 145 132 122 130 C 105 128 100 115 108 102 C 114 94 128 92 136 98 L 180 138 C 192 148 210 148 222 138 L 260 98 C 272 86 286 92 284 108 L 280 162 C 278 176 264 184 250 184 L 110 184 C 90 184 76 190 72 178 Z',
    startFinish: { x: 72, y: 135 },
    antiClockwise: false,
    description:
      'Formato do caractere chinês "shang", famosa curva em caracol 1-2 e reta de 1,2 km.',
  },
  // 3: Suzuka
  3: {
    round: 3,
    code: 'SUZ',
    name: 'Suzuka',
    viewBox: '0 0 320 220',
    // Formato de "8" com cruzamento em viaduto: Esse curva 1-7, Degner, viaduto, hairpin, Spoon curve, reta de volta, 130R e chicane Casio
    svgPath:
      'M 80 184 C 65 170 60 142 75 125 L 95 105 C 105 95 110 80 105 68 C 98 52 110 38 126 40 C 142 42 155 58 162 74 L 175 102 C 185 120 205 132 226 128 L 260 122 C 280 118 295 100 290 80 C 285 58 262 48 242 55 L 205 68 C 190 74 175 68 168 54 L 160 38 C 150 20 130 18 115 28 L 88 50 C 70 65 62 88 68 110 L 74 135 C 78 152 70 170 55 178 C 45 184 55 196 68 196 L 140 196 C 152 196 160 188 156 176 L 152 165 C 146 150 128 145 115 155 L 80 184 Z',
    startFinish: { x: 105, y: 196 },
    antiClockwise: false,
    description: 'Lendário traçado em "oito" com curvas em S, Degner e a mítica 130R.',
  },
  // 4: Bahrein (Sakhir)
  4: {
    round: 4,
    code: 'BHR',
    name: 'Sakhir, Bahrein',
    viewBox: '0 0 320 220',
    // Reta de largada na esquerda/base descendo, T1 hairpin, subida T2-T3, reta interna, T4, T5-6-7 miolo técnico, hairpin T8, reta oposta, curvas 14-15
    svgPath:
      'M 68 192 L 68 56 C 68 40 85 32 98 44 L 126 70 C 136 80 152 80 162 70 L 194 38 C 206 26 226 32 230 48 L 244 100 C 248 114 240 128 226 132 L 180 144 C 166 148 158 162 162 176 L 170 200 C 174 212 162 220 150 216 L 102 200 C 90 196 76 198 68 192 Z',
    startFinish: { x: 68, y: 125 },
    antiClockwise: false,
    description: 'Stop-and-go no deserto de Sakhir com 4 longas retas e asfalto muito abrasivo.',
  },
  // 5: Jeddah
  5: {
    round: 5,
    code: 'JED',
    name: 'Corniche de Jeddah',
    viewBox: '0 0 320 220',
    // Muito longo, fino e sinuoso ao longo da costa: hairpin no topo direito, reta e esse de alta na descida, hairpin inclinado na base
    svgPath:
      'M 52 195 C 44 185 48 168 62 158 L 100 132 C 114 122 130 115 146 112 L 210 98 C 228 94 245 85 258 72 L 290 38 C 302 24 315 36 308 52 L 282 94 C 270 112 250 124 230 130 L 165 150 C 148 155 132 165 120 178 L 92 204 C 80 216 60 212 52 195 Z',
    startFinish: { x: 62, y: 158 },
    antiClockwise: true,
    description: 'Circuito de rua mais veloz do mundo com 27 curvas cegas à beira do Mar Vermelho.',
  },
  // 6: Miami
  6: {
    round: 6,
    code: 'MIA',
    name: 'Miami International Autodrome',
    viewBox: '0 0 320 220',
    // Ao redor do estádio: reta principal inferior, curvas 1-3, setor sinuoso 4-8, reta oposta do topo, chicane lenta 14-15 sob o viaduto, hairpin 17
    svgPath:
      'M 50 175 L 50 82 C 50 64 68 52 85 60 L 132 82 C 148 90 172 88 185 75 L 225 35 C 240 20 268 25 272 45 L 284 100 C 288 118 275 135 256 138 L 195 146 C 180 148 170 160 172 175 L 174 190 C 176 205 160 214 146 208 L 78 184 C 62 178 50 182 50 175 Z',
    startFinish: { x: 100, y: 184 },
    antiClockwise: true,
    description:
      'Contorno ao redor do Hard Rock Stadium, setor técnico da marina e retas de mais de 330 km/h.',
  },
  // 7: Imola (Enzo e Dino Ferrari)
  7: {
    round: 7,
    code: 'IMO',
    name: 'Enzo e Dino Ferrari, Imola',
    viewBox: '0 0 320 220',
    // Sentido anti-horário: reta principal, Variante Tamburello, Villeneuve, Tosa hairpin, Piratella, Acque Minerali, Variante Alta e Rivazza
    svgPath:
      'M 68 185 L 120 185 C 138 185 152 175 160 160 L 180 120 C 190 100 212 90 234 94 L 270 100 C 286 102 296 86 288 72 L 260 28 C 248 10 224 8 210 22 L 165 65 C 150 80 130 85 110 80 L 72 70 C 52 65 38 82 46 100 L 58 130 C 66 148 60 170 45 182 C 40 188 52 185 68 185 Z',
    startFinish: { x: 90, y: 185 },
    antiClockwise: true,
    description:
      'Pista clássica italiana anti-horária com as icônicas Tamburello, Piratella e Acque Minerali.',
  },
  // 8: Monaco
  8: {
    round: 8,
    code: 'MCO',
    name: 'Monte Carlo, Mônaco',
    viewBox: '0 0 320 220',
    // Sainte Dévote subindo para Beau Rivage, Massenet, Cassino, Mirabeau, Hairpin do Grand Hotel (apertado), Portier, Túnel, Chicane do Porto, Piscina e Rascasse
    svgPath:
      'M 78 190 C 68 180 72 160 88 145 L 115 120 C 125 110 135 95 130 80 C 125 65 138 45 155 45 C 172 45 188 58 192 75 L 195 95 C 198 108 190 120 176 122 C 162 124 158 138 168 146 L 192 165 C 205 175 224 175 236 164 L 268 132 C 280 120 295 130 290 146 L 275 185 C 265 208 238 215 215 202 L 140 162 C 122 152 98 162 90 182 L 86 192 C 84 196 80 196 78 190 Z',
    startFinish: { x: 80, y: 175 },
    antiClockwise: false,
    description:
      'O circuito mais glamoroso e apertado: Sainte-Dévote, Cassino, Hairpin do Grand Hotel e Túnel.',
  },
  // 9: Barcelona-Catalunya
  9: {
    round: 9,
    code: 'BCN',
    name: 'Barcelona-Catalunha',
    viewBox: '0 0 320 220',
    // Reta longa inferior, T1-T2 chicane, curva 3 longo raio para a direita subindo, T4, hairpin T5 descendo, T7-8 esse da subida, reta de trás, curva rápida final
    svgPath:
      'M 60 188 L 225 188 C 245 188 260 175 264 155 L 272 110 C 276 90 262 72 242 70 L 195 66 C 180 64 168 52 168 38 C 168 22 152 12 136 18 L 105 30 C 88 36 78 52 82 70 L 88 95 C 92 110 82 126 66 130 L 48 135 C 32 140 28 160 40 172 L 60 188 Z',
    startFinish: { x: 120, y: 188 },
    antiClockwise: false,
    description: 'Balanço aerodinâmico perfeito exigido: Curva 3 de raio longo e freadas de apoio.',
  },
  // 10: Montreal (Gilles Villeneuve)
  10: {
    round: 10,
    code: 'MTL',
    name: 'Gilles Villeneuve, Montreal',
    viewBox: '0 0 320 220',
    // Na ilha: formato alongado clássico: reta principal, S do Senna na esquerda, retas com chicanes rápidas ao longo do canal, hairpin no extremo direito e Muro dos Campeões
    svgPath:
      'M 42 135 C 32 120 38 98 55 92 L 120 72 C 145 64 210 64 250 68 L 285 72 C 304 76 308 102 292 114 L 270 128 C 255 138 240 135 225 125 L 175 92 C 160 82 140 85 128 98 L 78 152 C 64 166 48 155 42 135 Z',
    startFinish: { x: 60, y: 100 },
    antiClockwise: false,
    description:
      'Na Ilha de Notre-Dame: zebras altas, hairpin do cassino e o temido Muro dos Campeões.',
  },
  // 11: Red Bull Ring (Austria)
  11: {
    round: 11,
    code: 'RBR',
    name: 'Red Bull Ring, Spielberg',
    viewBox: '0 0 320 220',
    // Volta curta nas colinas da Estíria: subida íngreme para Curva 1, reta longa subindo até Remus hairpin (T3), descida para T4, setor rápido 6-7 e duas curvas de 90° finais
    svgPath:
      'M 72 178 L 72 88 C 72 72 86 60 102 66 L 180 94 C 195 100 240 52 268 46 C 288 42 298 62 284 82 L 245 135 C 235 150 215 160 195 155 L 165 148 C 148 144 135 155 132 172 L 128 185 C 122 202 98 205 84 192 L 72 178 Z',
    startFinish: { x: 72, y: 140 },
    antiClockwise: false,
    description:
      'Volta mais rápida do ano em tempo (64s), fortes subidas e descidas nos Alpes austríacos.',
  },
  // 12: Silverstone
  12: {
    round: 12,
    code: 'SIL',
    name: 'Silverstone',
    viewBox: '0 0 320 220',
    // Abbey, Farm, Arena, Wellington straight, Brooklands, Luffield, Woodcote, Copse, complexo ultra veloz Maggotts-Becketts-Chapel, Hangar Straight, Stowe, Vale e Club
    svgPath:
      'M 68 180 C 48 165 42 135 56 115 L 82 78 C 96 58 122 48 146 54 L 182 64 C 200 68 220 58 232 42 C 248 22 276 28 284 52 L 292 92 C 298 118 280 144 254 150 L 210 160 C 190 164 175 180 172 200 C 168 218 145 224 132 212 L 95 180 C 86 172 76 186 68 180 Z',
    startFinish: { x: 172, y: 200 },
    antiClockwise: false,
    description: 'Berço da F1 com o lendário complexo veloz de Maggotts, Becketts e Chapel.',
  },
  // 13: Spa-Francorchamps
  13: {
    round: 13,
    code: 'SPA',
    name: 'Spa-Francorchamps',
    viewBox: '0 0 320 220',
    // La Source hairpin, descida para Eau Rouge e subida apoteótica no Raidillon, Reta Kemmel, Les Combes, Malmedy, Rivage, Pouhon dupla para a esquerda, Stavelot, Blanchimont e chicane Bus Stop
    svgPath:
      'M 65 192 L 48 170 C 35 152 46 128 68 125 L 110 120 C 122 118 130 108 130 96 L 132 48 C 134 26 158 14 176 26 L 225 60 C 242 72 266 70 280 55 L 296 38 C 310 24 322 36 315 54 L 285 130 C 275 155 250 172 222 174 L 165 178 C 145 180 130 195 125 214 C 120 226 102 226 95 214 L 65 192 Z',
    startFinish: { x: 75, y: 130 },
    antiClockwise: false,
    description: 'O circuito mais longo (7 km) nas Ardenas com a mítica Eau Rouge e Raidillon.',
  },
  // 14: Hungaroring
  14: {
    round: 14,
    code: 'HUN',
    name: 'Hungaroring',
    viewBox: '0 0 320 220',
    // Estilo "kartódromo gigante": reta de largada longa na base, descida T1 hairpin para a direita, curva 2 para esquerda descendo, curva 3 rápida, T4 cega rápida subindo, T5 longa, chicane 6-7, setor técnico 8-11, curvas 12-14 de retorno
    svgPath:
      'M 70 190 L 220 190 C 240 190 255 176 255 156 L 255 130 C 255 110 240 96 220 96 L 205 96 C 190 96 178 84 178 70 C 178 52 192 38 210 38 L 230 38 C 245 38 255 26 250 12 C 245 0 225 -2 212 4 L 155 25 C 135 32 120 50 120 72 L 120 95 C 120 115 105 132 85 138 L 52 148 C 35 154 35 178 50 186 L 70 190 Z',
    startFinish: { x: 145, y: 190 },
    antiClockwise: false,
    description:
      '"Mônaco sem muros", travado, sinuoso e sem descanso para os pilotos sob forte calor.',
  },
  // 15: Zandvoort
  15: {
    round: 15,
    code: 'ZAN',
    name: 'Zandvoort',
    viewBox: '0 0 320 220',
    // Nas dunas holandesas: Tarzanbocht (T1), Gerlach, Hugenholtzbocht com banking de 18°, Hunserug, chicane das dunas, Scheivlak ultra rápida, Hans Ernst chicane e Arie Luyendyk com forte inclinação
    svgPath:
      'M 75 185 C 55 175 48 148 62 128 L 82 100 C 92 86 95 68 88 52 C 80 32 96 12 118 16 C 138 20 152 38 152 58 L 152 90 C 152 110 170 126 190 122 L 235 112 C 255 108 274 122 275 142 C 276 165 258 184 235 184 L 180 184 C 162 184 150 170 148 152 L 145 135 C 142 120 125 112 112 122 L 85 145 C 72 155 70 175 75 185 Z',
    startFinish: { x: 75, y: 185 },
    antiClockwise: false,
    description:
      'Nas dunas holandesas com curvas inclinadas (banking) de 18 graus em Tarzan e Arie Luyendyk.',
  },
  // 16: Monza
  16: {
    round: 16,
    code: 'MNZ',
    name: 'Monza',
    viewBox: '0 0 320 220',
    // O Templo da Velocidade: Rettifilo chicane (T1-2), Curva Grande (Curva Biassono), Variante della Roggia, Lesmo 1 e Lesmo 2, descida da Serraglio, Variante Ascari e a lendária Parabolica (Alboreto)
    svgPath:
      'M 52 185 L 52 75 C 52 50 72 38 95 48 L 142 70 C 158 78 178 76 192 65 L 235 30 C 255 14 285 28 285 55 L 285 140 C 285 168 260 190 230 190 L 110 190 C 85 190 62 195 52 185 Z',
    startFinish: { x: 52, y: 130 },
    antiClockwise: false,
    description:
      'O Templo da Velocidade: quase 80% da volta em aceleração plena, Variante del Rettifilo e Parabolica.',
  },
  // 17: Baku City Circuit
  17: {
    round: 17,
    code: 'BAK',
    name: 'Baku City Circuit',
    viewBox: '0 0 320 220',
    // Cidade velha e reta infinita da orla: 4 curvas de 90° no setor moderno (T1-T4), subida do castelo medieval estreitíssimo (T8-T11), descida rápida T13-T15 e reta reta plana de 2.2km na avenida Neftchilar
    svgPath:
      'M 48 190 L 48 70 C 48 52 64 42 82 50 L 150 82 C 165 90 185 85 195 72 L 230 25 C 242 10 265 14 270 32 L 285 85 C 290 102 280 120 262 125 L 210 140 C 195 145 185 160 188 176 L 192 190 L 48 190 Z',
    startFinish: { x: 120, y: 190 },
    antiClockwise: true,
    description:
      'Reta gigantesca de 2,2 km junto ao Mar Cáspio e a seção medieval do castelo com apenas 7,6 m de largura.',
  },
  // 18: Marina Bay (Singapura)
  18: {
    round: 18,
    code: 'SIN',
    name: 'Marina Bay, Singapura',
    viewBox: '0 0 320 220',
    // Noturna nas ruas de Singapura: Sheares (T1-3), Republic Boulevard, T7 chicane, Padang, Anderson Bridge, hairpin da Fullerton, novo setor rápido da reta do cais e curva 16-19 sob a arquibancada
    svgPath:
      'M 62 185 C 48 165 52 135 70 118 L 105 85 C 118 72 138 68 155 75 L 195 90 C 215 98 238 90 250 72 L 272 42 C 285 25 310 32 312 55 L 315 110 C 318 135 300 158 275 165 L 225 178 C 205 184 190 200 185 220 C 175 225 155 210 145 195 L 115 160 C 102 148 85 152 75 168 L 62 185 Z',
    startFinish: { x: 80, y: 105 },
    antiClockwise: true,
    description:
      'GP noturno tropical mais desgastante do ano: calor de 32°C, 80% de umidade e mais de 60 voltas.',
  },
  // 19: Circuit of the Americas (Austin)
  19: {
    round: 19,
    code: 'COT',
    name: 'Circuit of the Americas, Austin',
    viewBox: '0 0 320 220',
    // Subida cega de 40m para a curva 1 hairpin, descida para o Esse de alta velocidade (inspirado em Maggotts/Becketts), curva cega 10, hairpin 11, longa reta de trás, complexo do estádio e a ferradura quádrupla (T16-18)
    svgPath:
      'M 55 185 L 55 80 C 55 52 82 38 106 54 L 140 78 C 155 90 178 88 192 74 L 235 30 C 252 12 280 22 282 46 L 285 95 C 288 120 270 142 245 148 L 195 160 C 175 165 160 182 160 204 C 158 218 140 224 128 214 L 88 180 C 75 170 60 175 55 185 Z',
    startFinish: { x: 55, y: 125 },
    antiClockwise: true,
    description:
      'Subida íngreme para a Curva 1, esse veloz inspirado em Silverstone e ferradura quádrupla.',
  },
  // 20: Hermanos Rodríguez (México)
  20: {
    round: 20,
    code: 'MEX',
    name: 'Hermanos Rodríguez, México',
    viewBox: '0 0 320 220',
    // Longuíssima reta principal (1.3km), curvas 1-2-3 em chicane, reta curta, T4-5-6, o Esse de média/alta velocidade (T7-11), reta dos fundos e a lendária passagem pelo Estádio Foro Sol (curvas 12-16)
    svgPath:
      'M 52 188 L 220 188 C 242 188 260 172 264 150 L 275 90 C 280 62 260 38 232 38 L 180 38 C 160 38 145 50 140 70 L 132 102 C 128 120 112 134 92 134 L 52 134 L 52 188 Z',
    startFinish: { x: 130, y: 188 },
    antiClockwise: false,
    description:
      'Altitude extrema de 2.200 m com ar rarefeito e passagem apoteótica pelo Estádio Foro Sol.',
  },
  // 21: Interlagos (Brasil)
  21: {
    round: 21,
    code: 'INT',
    name: 'Interlagos, São Paulo',
    viewBox: '0 0 320 220',
    // Autêntico clássico brasileiro anti-horário: Reta dos Boxes descendo em mergulho no S do Senna (T1-T2), Curva do Sol (T3), Reta Oposta, Ferradura descendo (T6-T7), Laranjinha, Pinheirinho, Bico de Pato, Junção e subida da Subida dos Boxes
    svgPath:
      'M 82 188 C 62 172 65 140 85 118 L 115 88 C 128 75 145 70 162 76 L 205 92 C 228 100 255 90 268 68 L 285 40 C 298 18 325 28 322 54 L 312 110 C 304 145 272 172 235 174 L 175 176 C 152 178 132 192 125 214 C 118 226 98 224 88 208 L 82 188 Z',
    startFinish: { x: 105, y: 188 },
    antiClockwise: true,
    description:
      'Anti-horário autêntico com o "S do Senna", Curva do Sol, Reta Oposta, Ferradura e Junção.',
  },
  // 22: Las Vegas Strip
  22: {
    round: 22,
    code: 'LVG',
    name: 'Las Vegas Strip Circuit',
    viewBox: '0 0 320 220',
    // Paddock e T1-T4 no miolo leste, Koval Lane, curva 5 contornando a Esfera MSG Sphere (curvas 6-7-8), Sands Avenue, virada fechada na Strip com reta plana de 1.9km passando pelo Bellagio e Caesars, chicane final Harmon Ave
    svgPath:
      'M 58 175 L 58 80 C 58 58 80 44 102 54 L 185 92 C 200 98 215 95 228 84 L 260 55 C 275 42 298 52 298 72 L 298 140 C 298 165 278 185 252 185 L 140 185 C 120 185 105 198 90 205 C 75 212 58 198 58 175 Z',
    startFinish: { x: 58, y: 130 },
    antiClockwise: true,
    description:
      'Frio noturno no coração de Las Vegas, reta de 1,9 km na Strip a mais de 345 km/h.',
  },
  // 23: Lusail (Catar)
  23: {
    round: 23,
    code: 'QAT',
    name: 'Lusail International Circuit',
    viewBox: '0 0 320 220',
    // Pista veloz com 16 curvas fluidas: reta principal de 1km, curva 1 de raio médio, curva 2-3 fluida, sequência contínua de curvas rápidas 4 a 10 no deserto, reta curta e o triplo apex das curvas 12-14
    svgPath:
      'M 68 185 L 230 185 C 255 185 275 168 280 144 L 290 92 C 295 65 275 40 248 40 L 205 40 C 185 40 170 52 165 72 L 158 98 C 152 120 132 136 110 136 L 82 136 C 60 136 48 155 58 175 L 68 185 Z',
    startFinish: { x: 135, y: 185 },
    antiClockwise: false,
    description:
      'Circuito ultramoderno e ultraveloz sob holofotes com altíssimas forças G laterais.',
  },
  // 24: Yas Marina (Abu Dhabi)
  24: {
    round: 24,
    code: 'ABU',
    name: 'Yas Marina, Abu Dhabi',
    viewBox: '0 0 320 220',
    // Traçado reformado e veloz: T1 para a esquerda, curvas 2-3 rápidas para a direita, hairpin T5 na ponta norte, reta de 1.2km, chicane e hairpin T9 com banking, contorno sob o hotel W Abu Dhabi iluminado e setor da marina
    svgPath:
      'M 65 180 C 48 160 52 128 72 110 L 102 82 C 115 70 125 52 125 35 C 125 15 145 2 164 12 L 215 38 C 235 48 260 45 275 30 L 290 15 C 305 0 325 12 322 32 L 312 95 C 305 130 275 158 240 162 L 180 168 C 158 170 142 185 135 205 C 128 225 102 230 88 214 L 65 180 Z',
    startFinish: { x: 90, y: 95 },
    antiClockwise: true,
    description:
      'A grande final sob o pôr do sol no Golfo: marina, hotel iluminado por LEDs e setor técnico final.',
  },
}

interface CircuitBlueprintProps {
  round: number
  circuitName?: string
  laps?: number
  lengthKm?: number
  className?: string
  interactive?: boolean
}

export const CircuitBlueprint: React.FC<CircuitBlueprintProps> = ({
  round,
  circuitName,
  laps,
  lengthKm,
  className = '',
  interactive = true,
}) => {
  const track = TRACK_LAYOUTS[round] || TRACK_LAYOUTS[1]

  return (
    <div
      className={`relative rounded-xl bg-[#08101E] border border-[#1E293B] p-4 font-mono select-none overflow-hidden ${className}`}
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(0, 166, 251, 0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0, 166, 251, 0.05) 1px, transparent 1px)
        `,
        backgroundSize: '16px 16px',
      }}
    >
      {/* Blueprint Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1E293B]/70">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00A6FB] animate-pulse" />
          <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
            LAYOUT DO CIRCUITO FIA // {track.code}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>{track.antiClockwise ? '↺ Anti-horário' : '↻ Horário'}</span>
          {laps && <span className="text-white font-bold">• {laps} voltas</span>}
        </div>
      </div>

      {/* SVG Circuit Path Render */}
      <div className="relative flex items-center justify-center py-2">
        <svg
          viewBox={track.viewBox}
          className="w-full h-auto max-h-[170px] drop-shadow-[0_0_15px_rgba(0,166,251,0.25)]"
        >
          <defs>
            <filter id={`circuitGlow-${round}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id={`circuitGrad-${round}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00A6FB" />
              <stop offset="50%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#E10600" />
            </linearGradient>
          </defs>

          {/* Circuit track background shadow line */}
          <path
            d={track.svgPath}
            fill="none"
            stroke="#0B1628"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Circuit kerb/contour outline */}
          <path
            d={track.svgPath}
            fill="none"
            stroke="#1E293B"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Glowing racing line */}
          <path
            d={track.svgPath}
            fill="none"
            stroke={`url(#circuitGrad-${round})`}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#circuitGlow-${round})`}
          />

          {/* Start/Finish Line marker */}
          <g>
            <circle
              cx={track.startFinish.x}
              cy={track.startFinish.y}
              r="6"
              fill="#E10600"
              className="animate-pulse"
            />
            <circle cx={track.startFinish.x} cy={track.startFinish.y} r="2.5" fill="#FFFFFF" />
            {/* Checkerboard flag label */}
            <text
              x={track.startFinish.x + 8}
              y={track.startFinish.y + 4}
              fill="#F5F7FA"
              fontSize="8"
              fontFamily="monospace"
              fontWeight="bold"
            >
              LARGADA
            </text>
          </g>
        </svg>

        {/* Compass direction badge */}
        <div className="absolute bottom-1 left-2 text-[9px] text-slate-500 font-mono">NORTE ▲</div>
      </div>

      {/* Circuit Specs Footer */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1E293B]/70 text-[10px] text-center">
        <div>
          <span className="text-[#8B95A7] block text-[9px]">TOTAL VOLTAS</span>
          <strong className="text-white text-xs">{laps || 58} voltas</strong>
        </div>
        <div>
          <span className="text-[#8B95A7] block text-[9px]">EXTENSÃO</span>
          <strong className="text-cyan-400 text-xs">{lengthKm || 5.2} km</strong>
        </div>
        <div>
          <span className="text-[#8B95A7] block text-[9px]">DISTÂNCIA</span>
          <strong className="text-emerald-400 text-xs">
            {((laps || 58) * (lengthKm || 5.2)).toFixed(1)} km
          </strong>
        </div>
      </div>

      <p className="text-[10px] text-[#8B95A7] mt-2 line-clamp-1 italic">{track.description}</p>
    </div>
  )
}
