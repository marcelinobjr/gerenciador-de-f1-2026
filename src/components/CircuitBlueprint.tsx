import React from 'react'

/**
 * Biblioteca de traçados dos circuitos oficiais da Fórmula 1 2026.
 * Silhuetas fiéis aos mapas e geometrias reais das 24 pistas oficiais da FIA.
 * Estilizado no modo blueprint técnico aeronáutico/automotivo:
 * - Grade milimetrada de fundo
 * - Linha de largada/chegada com indicador de sentido
 * - Ponto exato da reta dos boxes
 * - Traçado fechado com curvas reais (S do Senna, Grand Hotel Hairpin + Túnel, Eau Rouge/Raidillon, Maggotts-Becketts-Chapel, 8 de Suzuka, caracol de Xangai, Parabolica, etc.)
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
  // 1: Albert Park, Melbourne (Austrália) - Sentido horário oficial FIA (START na reta inferior apontando para T1 à esquerda / sentido anti-horário na projeção 2D do mapa fornecido)
  // Reta principal inferior (T14 -> T1), chicane T1-T2, subida técnica T3-T4-T5, curva rápida T6-T7, topo do lago T8,
  // descida rápida pelo contorno do lago até T9-T10, setor nordeste T11-T12, fechando em T13-T14 e pit lane paralelo.
  1: {
    round: 1,
    code: 'ALB',
    name: 'Albert Park, Melbourne',
    viewBox: '0 0 320 220',
    svgPath:
      'M 178 175 L 142 175 C 135 175 130 171 130 163 C 130 156 126 153 118 150 L 59 133 C 54 131 52 127 54 122 L 62 105 C 64 100 62 97 56 91 L 43 78 C 39 74 39 67 43 60 L 56 36 C 58 31 63 26 69 26 L 73 26 C 79 26 83 23 88 18 L 94 13 C 103 5 116 5 126 12 L 145 28 C 153 35 158 45 160 55 L 165 77 C 167 85 173 92 181 96 L 202 104 C 211 107 222 106 230 102 L 238 98 C 242 96 247 96 251 98 L 297 122 C 304 126 307 133 304 140 L 290 164 C 286 170 280 174 272 174 L 260 173 C 255 173 250 170 246 166 L 235 152 C 230 146 222 144 214 146 L 207 148 C 201 150 197 155 197 161 L 197 167 C 197 172 193 175 188 175 Z',
    startFinish: { x: 178, y: 175 },
    antiClockwise: true,
    description:
      'Circuito ao redor do lago de Albert Park com retas velozes, chicanes técnicas e a longa reta dos boxes na orla sul.',
  },

  // 2: Xangai (China) - Horário
  // Geometria inconfundível do caractere chinês "上" (shang):
  // Reta dos boxes entra na espiral de raio decrescente Curvas 1-2-3-4 (caracol para a direita e esquerda fechando),
  // descida para T6 hairpin, esse 7-8 rápido, curvas 9-10, curva 11 lenta entrando na GIGANTESCA reta oposta de 1.200m (T13-T14),
  // hairpin fortíssimo T14 e curva final rápida T16 de volta aos boxes.
  2: {
    round: 2,
    code: 'SHA',
    name: 'Circuito Internacional de Xangai',
    viewBox: '0 0 320 220',
    svgPath:
      'M 60 175 L 60 75 C 60 48 85 32 115 32 C 148 32 172 52 172 82 C 172 108 152 126 128 126 C 112 126 102 114 108 100 C 114 88 130 88 136 98 L 165 142 C 172 152 186 156 198 148 L 228 126 C 238 120 252 122 258 134 L 282 178 C 288 190 278 204 262 204 L 105 204 C 88 204 75 198 68 185 L 60 175 Z',
    startFinish: { x: 60, y: 120 },
    antiClockwise: false,
    description:
      'Fiel ao caractere "Shang": famoso caracol de curvas 1 a 4 que fecha em si mesmo e reta oposta brutal de 1,2 km.',
  },

  // 3: Suzuka (Japão) - Horário com formato de "8" (Crossover / Viaduto)
  // O único traçado em "8" do calendário: Reta principal descendo para Curva 1-2, subida nos Esses (T3-T6),
  // Curvas Degner 1 e 2, passagem POR BAIXO do viaduto, Hairpin T11, curva 200R, curva da Colher (Spoon Curve T13-14),
  // reta de retorno passando POR CIMA do viaduto, a lendária e assustadora 130R (T15) e a Chicane Casio Triangle (T16-17).
  3: {
    round: 3,
    code: 'SUZ',
    name: 'Circuito de Suzuka',
    viewBox: '0 0 320 220',
    svgPath:
      'M 82 195 L 82 145 C 82 130 92 118 104 112 L 122 102 C 132 96 135 84 128 74 L 115 56 C 108 46 112 32 125 30 C 138 28 150 40 155 52 L 168 85 C 175 102 192 112 210 110 L 255 105 C 275 102 292 85 288 64 C 282 42 260 35 240 42 L 195 58 C 182 62 172 54 168 42 L 162 25 C 152 6 128 8 116 22 L 75 65 C 60 80 52 102 58 124 L 64 150 C 70 172 58 192 44 200 C 35 208 48 218 62 216 L 145 205 C 158 202 165 190 158 178 L 148 162 C 140 148 122 146 110 158 L 82 195 Z',
    startFinish: { x: 82, y: 170 },
    antiClockwise: false,
    description:
      'Lendário traçado em "8" desenhado por John Hugenholtz, com Esses técnicos, o viaduto cruzado e a mítica curva 130R.',
  },

  // 4: Sakhir (Bahrein) - Horário
  // Reta principal longa, freada brusca para Curva 1 (hairpin à direita) e saída imediata na curva 2-3,
  // subida para T4 aberta, descida técnica sinuosa em T5-6-7, T8 hairpin fechadíssimo à esquerda,
  // curva cega 9-10 com bloqueio frequente de roda dianteira esquerda, reta de trás para T11, T12-13 e dupla curva 14-15 de volta aos boxes.
  4: {
    round: 4,
    code: 'BHR',
    name: 'Circuito Internacional do Bahrein',
    viewBox: '0 0 320 220',
    svgPath:
      'M 62 198 L 62 52 C 62 38 78 30 90 40 L 116 62 C 126 70 142 70 150 60 L 180 25 C 192 10 215 16 220 32 L 236 85 C 242 102 232 118 218 124 L 175 138 C 160 142 152 158 158 172 L 170 198 C 176 212 162 222 148 216 L 95 196 C 82 192 68 194 62 198 Z',
    startFinish: { x: 62, y: 125 },
    antiClockwise: false,
    description:
      'Pista no deserto de Sakhir com 4 longas retas de ultrapassagem e frenagens violentas pós-retas.',
  },

  // 5: Jeddah Corniche (Arábia Saudita) - Anti-horário
  // Circuito de rua ultra estreito, fino e sinuoso à beira do Mar Vermelho:
  // Hairpin sul fechado na Curva 27, aceleração na reta do mar, chicanes cegas contínuas de 250+ km/h,
  // curva inclinada T13 com banking de 12°, ziguezague norte e curva hairpin de retorno T1.
  5: {
    round: 5,
    code: 'JED',
    name: 'Circuito de Corniche de Jeddah',
    viewBox: '0 0 320 220',
    svgPath:
      'M 48 190 C 38 178 44 158 60 148 L 108 120 C 122 112 138 106 155 102 L 222 88 C 242 84 260 74 274 58 L 298 28 C 310 14 322 25 316 42 L 286 94 C 272 118 250 132 225 140 L 155 162 C 135 168 118 180 105 195 L 85 212 C 72 222 55 214 48 190 Z',
    startFinish: { x: 55, y: 155 },
    antiClockwise: true,
    description:
      'Circuito de rua mais veloz do mundo com 27 curvas cegas, média superior a 250 km/h e muros a centímetros das rodas.',
  },

  // 6: Miami (EUA) - Anti-horário
  // Contorno completo do Hard Rock Stadium:
  // Reta dos boxes, Curvas 1-2-3 fluidas, esse sinuoso 4-8, reta curta da marina (T9), hairpin 11,
  // complexo técnico lento em aclive sob viaduto (T14-15 chicane), reta gigantesca de 1.3km e hairpin 17.
  6: {
    round: 6,
    code: 'MIA',
    name: 'Autódromo Internacional de Miami',
    viewBox: '0 0 320 220',
    svgPath:
      'M 54 182 L 54 86 C 54 68 70 56 86 64 L 135 86 C 150 94 172 90 184 76 L 226 34 C 242 18 270 24 274 46 L 285 105 C 288 122 274 138 255 142 L 192 150 C 176 152 165 165 168 180 L 170 195 C 172 208 158 218 144 212 L 82 186 C 68 180 54 184 54 182 Z',
    startFinish: { x: 88, y: 184 },
    antiClockwise: true,
    description:
      'Traçado urbano em torno do Hard Rock Stadium mesclando setor sinuoso da marina com reta oposta de 340 km/h.',
  },

  // 7: Madri (Madring, Espanha) - Horário
  // Circuito semi-urbano Madring (IFEMA e Valdebebas):
  // Reta principal dos boxes em IFEMA, freada técnica para as curvas 1-2-3, passagem pelo túnel sob a M-11,
  // setor veloz em Valdebebas com curvas sinuosas de média e alta, a impressionante curva parabólica inclinada (banking),
  // monumental reta longa de ultrapassagem (~1,3 km com modo overtake 2026 a mais de 340 km/h)
  // e retorno técnico com chicanes e grampos até a linha de chegada.
  7: {
    round: 7,
    code: 'MAD',
    name: 'Circuito Madring, Madrid',
    viewBox: '0 0 320 220',
    svgPath:
      'M 58 176 L 165 176 C 185 176 200 162 208 144 L 222 112 C 230 95 248 84 268 84 L 290 84 C 304 84 314 70 306 58 L 290 34 C 280 20 262 14 246 22 L 182 48 C 166 54 152 46 148 30 L 142 22 C 134 10 118 8 108 18 L 76 52 C 64 64 62 82 72 96 L 90 120 C 100 134 94 154 78 162 L 60 172 C 54 175 54 176 58 176 Z',
    startFinish: { x: 108, y: 176 },
    antiClockwise: false,
    description:
      'Estreia na F1 2026: circuito semi-urbano Madring com monumental reta de ultrapassagem de 1,3 km e 22 curvas técnicas.',
  },

  // 8: Mônaco (Monte Carlo) - Horário
  // Geometria autêntica inconfundível do principado:
  // Reta dos boxes subindo para Sainte-Dévote (T1), subida íngreme da Beau Rivage, curva longa à esquerda Massenet (T2),
  // contorno da praça do Cassino (T3-4), descida Mirabeau Haute (T5),
  // O FAMOSÍSSIMO GRAND HOTEL HAIRPIN (T6 - curva mais lenta e fechada de toda a F1 a 45 km/h),
  // Mirabeau Bas (T7), Portier (T8) entrando no TÚNEL sob o hotel Fairmont, saída cega na Nouvelle Chicane do porto (T10-11),
  // Tabac (T12), complexo veloz da Piscina Louis Chiron (T13-16), La Rascasse (T18) e Virage Antony Noghès (T19).
  8: {
    round: 8,
    code: 'MCO',
    name: 'Circuito de Mônaco, Monte Carlo',
    viewBox: '0 0 320 220',
    svgPath:
      'M 82 192 C 72 180 75 160 92 144 L 120 118 C 128 108 136 94 132 78 C 126 62 140 42 158 42 C 175 42 192 56 195 72 L 198 94 C 200 106 192 118 178 120 C 164 122 160 136 170 144 L 195 164 C 208 174 228 174 240 162 L 272 130 C 284 118 300 128 294 144 L 278 185 C 268 208 240 216 216 204 L 142 164 C 124 154 100 164 92 184 L 88 194 C 86 198 83 197 82 192 Z',
    startFinish: { x: 84, y: 172 },
    antiClockwise: false,
    description:
      'A joia da coroa da F1: subida de Sainte-Dévote, praça do Cassino, o lendário hairpin do Grand Hotel, Túnel e Rascasse.',
  },

  // 9: Barcelona-Catalunha (Espanha) - Horário
  // Reta principal longa de 1km, chicane Elf T1-2, subida na longa e exigente Curva 3 Renault (apoio aerodinâmico total),
  // curva fechada Repsol T4, descida no hairpin Seat T5, subida na Moreneta T7-8, reta dos fundos,
  // setor do estádio com a chicane remodelada liberando as duas curvas de alta finais Europcar e New Holland.
  9: {
    round: 9,
    code: 'BCN',
    name: 'Circuito de Barcelona-Catalunha',
    viewBox: '0 0 320 220',
    svgPath:
      'M 58 190 L 230 190 C 250 190 265 176 270 155 L 276 108 C 280 88 266 70 245 68 L 196 64 C 180 62 168 50 168 35 C 168 18 150 8 135 15 L 102 28 C 85 34 75 50 78 68 L 84 94 C 88 110 78 126 62 130 L 44 135 C 28 140 25 160 38 172 L 58 190 Z',
    startFinish: { x: 125, y: 190 },
    antiClockwise: false,
    description:
      'O teste supremo de eficiência aerodinâmica com a longa Curva 3 de alta pressão e retas velozes.',
  },

  // 10: Montreal (Gilles Villeneuve, Canadá) - Horário
  // Construído na Ilha artificial de Notre-Dame:
  // Reta dos boxes com o Muro dos Campeões na chicane final (T13-14), mergulho nas curvas 1-2 (S do Senna),
  // retas pontilhadas por chicanes rápidas ao longo do canal olímpico (T3-4 e T8-9),
  // o famoso Hairpin da ponta da ilha L'Épingle (T10) e a enorme reta do Cassino Droit du Casino (T12).
  10: {
    round: 10,
    code: 'MTL',
    name: 'Circuito Gilles Villeneuve, Montreal',
    viewBox: '0 0 320 220',
    svgPath:
      'M 42 135 C 32 120 38 98 55 92 L 125 72 C 150 64 215 64 255 68 L 288 72 C 308 76 312 102 296 114 L 274 128 C 258 138 242 135 228 125 L 178 92 C 162 82 142 85 130 98 L 78 152 C 64 166 48 155 42 135 Z',
    startFinish: { x: 62, y: 98 },
    antiClockwise: false,
    description:
      'Na ilha de Notre-Dame: estilo stop-and-go entre muros, o hairpin do cassino e a chicane do Muro dos Campeões.',
  },

  // 11: Red Bull Ring (Áustria) - Horário
  // Volta mais curta e rápida do campeonato (em torno de 64 segundos):
  // Reta principal subindo para a Curva 1 (Niki Lauda), subida íngreme até o grampo Remus (T3),
  // descida acentuada para a Curva 4 (frenagem forte com inclinação lateral), curvas rápidas 6-7 e duas curvas de 90° finais (Jochen Rindt e Red Bull Mobile).
  11: {
    round: 11,
    code: 'RBR',
    name: 'Red Bull Ring, Spielberg',
    viewBox: '0 0 320 220',
    svgPath:
      'M 68 180 L 68 85 C 68 70 82 58 98 64 L 178 92 C 194 98 240 50 268 44 C 288 40 298 60 285 80 L 246 135 C 236 150 216 160 196 155 L 165 148 C 148 144 135 155 132 172 L 128 185 C 122 202 96 205 82 192 L 68 180 Z',
    startFinish: { x: 68, y: 135 },
    antiClockwise: false,
    description:
      'Volta relâmpago de 64 segundos nas colinas da Estíria com elevação acentuada e grampo Remus.',
  },

  // 12: Silverstone (Reino Unido) - Horário
  // O templo do automobilismo mundial com a sequência mais lendária da F1:
  // Reta The Wing, Abbey (T1) a fundo, Farm curve, Village e The Loop (hairpin), Wellington Straight,
  // Brooklands, Luffield, Woodcote, Copse (a 290 km/h sem frear),
  // O LENDÁRIO COMPLEXO MAGGOTTS-BECKETTS-CHAPEL (curvas 10-14 mudando de direção a 280 km/h com 5G de força lateral),
  // Hangar Straight a mais de 330 km/h, Stowe (T15), chicane Vale e Club.
  12: {
    round: 12,
    code: 'SIL',
    name: 'Circuito de Silverstone',
    viewBox: '0 0 320 220',
    svgPath:
      'M 68 182 C 48 166 42 136 56 116 L 82 78 C 96 58 122 48 146 54 L 182 64 C 200 68 220 58 232 42 C 248 22 276 28 284 52 L 292 92 C 298 118 280 144 254 150 L 210 160 C 190 164 175 180 172 200 C 168 218 145 224 132 212 L 95 180 C 86 172 76 186 68 182 Z',
    startFinish: { x: 172, y: 200 },
    antiClockwise: false,
    description:
      'Berço da Fórmula 1 com o combo Copse, o épico complexo Maggotts-Becketts-Chapel e a Hangar Straight.',
  },

  // 13: Spa-Francorchamps (Bélgica) - Horário
  // O maior circuito do calendário (7.004 m):
  // Reta dos boxes, o hairpin lento La Source (T1), descida vertiginosa para a compressão da
  // MÍTICA EAU ROUGE E A SUBIDA CEGA DO RAIDILLON (curvas 2-4),
  // Reta Kemmel a 345 km/h, chicane Les Combes e Malmedy (T5-7), descida para o grampo inclinado Rivage/Bruxelles (T8-9),
  // a dupla curva de esquerda mais impressionante do mundo POUHON (T10-11 a 260 km/h),
  // Campus, Stavelot (T14-15), a rapidíssima Blanchimont (T16-17) e a chicane final Bus Stop (T18-19).
  13: {
    round: 13,
    code: 'SPA',
    name: 'Circuito de Spa-Francorchamps',
    viewBox: '0 0 320 220',
    svgPath:
      'M 62 194 L 46 172 C 34 154 44 128 66 125 L 108 120 C 120 118 128 108 128 96 L 130 46 C 132 24 156 12 174 24 L 224 58 C 240 70 265 68 280 54 L 298 36 C 312 22 324 34 316 52 L 285 130 C 275 155 250 172 222 174 L 165 178 C 145 180 130 195 125 214 C 120 226 100 226 92 214 L 62 194 Z',
    startFinish: { x: 74, y: 128 },
    antiClockwise: false,
    description:
      'O templo das Ardenas com 7 km de extensão: La Source, a mítica subida da Eau Rouge/Raidillon, Kemmel e Pouhon.',
  },

  // 14: Hungaroring (Hungria) - Horário
  // Circuito travado de rua construído em anfiteatro natural:
  // Reta principal longa, T1 hairpin em descida, curva 2 longa para a esquerda, T3 rápida, T4 cega rápida subindo,
  // curva 5 longa à direita, chicane 6-7, sequências técnicas de média velocidade 8 a 11,
  // curva 12 de 90° e curvas 13-14 de longo raio contornando o paddock.
  14: {
    round: 14,
    code: 'HUN',
    name: 'Hungaroring',
    viewBox: '0 0 320 220',
    svgPath:
      'M 68 190 L 222 190 C 242 190 256 176 256 156 L 256 130 C 256 110 242 96 222 96 L 205 96 C 190 96 178 84 178 70 C 178 52 192 38 210 38 L 230 38 C 245 38 255 26 250 12 C 245 0 225 -2 212 4 L 155 25 C 135 32 120 50 120 72 L 120 95 C 120 115 105 132 85 138 L 52 148 C 35 154 35 178 50 186 L 68 190 Z',
    startFinish: { x: 140, y: 190 },
    antiClockwise: false,
    description:
      '"Mônaco sem muros": sinuoso, sem descanso, com altas temperaturas e difícil ultrapassagem.',
  },

  // 15: Zandvoort (Países Baixos) - Horário
  // Construído nas dunas à beira do Mar do Norte com curvas inclinadas estilo oval americano:
  // Reta dos boxes, o lendário hairpin Tarzanbocht (T1), Gerlachbocht, o banking inclinado de 18° Hugenholtzbocht (T3),
  // Hunserug, a descida cega de Scheivlak (T7), Slotenmakerbocht, Hans Ernst chicane e a
  // INCRÍVEL CURVA INCLINADA ARIE LUYENDYK (T14 com 18° de banking contornando a fundo a mais de 280 km/h).
  15: {
    round: 15,
    code: 'ZAN',
    name: 'Circuito de Zandvoort',
    viewBox: '0 0 320 220',
    svgPath:
      'M 72 186 C 52 176 46 148 60 128 L 80 100 C 90 86 94 68 86 52 C 78 32 94 12 116 16 C 136 20 150 38 150 58 L 150 90 C 150 110 168 126 188 122 L 235 112 C 255 108 274 122 275 142 C 276 165 258 184 235 184 L 180 184 C 162 184 150 170 148 152 L 145 135 C 142 120 125 112 112 122 L 85 145 C 72 155 68 176 72 186 Z',
    startFinish: { x: 72, y: 186 },
    antiClockwise: false,
    description:
      'Circuito clássico nas dunas holandesas com inclinações (bankings) de 18° nas curvas Hugenholtz e Arie Luyendyk.',
  },

  // 16: Monza (Itália) - Horário
  // O lendário "Templo da Velocidade":
  // Reta Rettifilo longa (ultrapassa 350 km/h), freada brutal para a Variante del Rettifilo (T1-2 chicane),
  // a velocíssima Curva Grande / Biassono (T3), freada para a Variante della Roggia (T4-5),
  // as duas curvas em 90° de tração perfeita Lesmo 1 e Lesmo 2 (T6-7), descida da Curva del Serraglio sob o antigo anel de velocidade,
  // a técnica e rápida Variante Ascari (T8-10) e a MÍTICA E LONGA CURVA PARABOLICA (Alboreto T11).
  16: {
    round: 16,
    code: 'MNZ',
    name: 'Autodromo Nazionale Monza',
    viewBox: '0 0 320 220',
    svgPath:
      'M 50 188 L 50 72 C 50 48 70 36 94 46 L 142 70 C 158 78 178 76 192 65 L 236 28 C 256 12 286 26 286 54 L 286 142 C 286 170 260 192 230 192 L 108 192 C 82 192 60 198 50 188 Z',
    startFinish: { x: 50, y: 130 },
    antiClockwise: false,
    description:
      'O Templo da Velocidade: 80% da volta em aceleração máxima, Variante del Rettifilo, Lesmos, Ascari e a mítica Parabolica.',
  },

  // 17: Baku (Azerbaijão) - Anti-horário
  // O circuito urbano mais contrastante do mundo:
  // Reta monumental da orla do Mar Cáspio de 2.200 m (maior reta da F1 a 360 km/h),
  // quatro curvas retangulares de 90° no setor moderno (T1-4),
  // A FAMOSA SUBIDA DO CASTELO MEDIEVAL (Curvas 8 a 11 com apenas 7,6 m de largura entre as pedras do castelo),
  // descida ziguezagueante e curvas cegas rápidas 13 a 15 até abrir na reta infinita.
  17: {
    round: 17,
    code: 'BAK',
    name: 'Circuito de Rua de Baku',
    viewBox: '0 0 320 220',
    svgPath:
      'M 46 192 L 46 68 C 46 50 62 40 80 48 L 148 80 C 164 88 184 84 194 70 L 228 24 C 240 8 264 12 268 30 L 284 84 C 288 102 278 120 260 125 L 208 140 C 194 144 184 160 186 176 L 190 192 L 46 192 Z',
    startFinish: { x: 118, y: 192 },
    antiClockwise: true,
    description:
      'Reta de 2,2 km junto ao Mar Cáspio atingindo 360 km/h e a estreitíssima passagem medieval da torre do castelo.',
  },

  // 18: Marina Bay (Singapura) - Anti-horário
  // GP noturno na baía de Marina Bay:
  // Reta dos boxes, complexo de curvas Sheares T1-3, Republic Boulevard, chicane T7, Padang,
  // passagem pela ponte histórica Anderson Bridge, hairpin da Fullerton,
  // novo setor fluido do cais (retas unificadas) e as curvas do estádio sob a arquibancada.
  18: {
    round: 18,
    code: 'SIN',
    name: 'Circuito de Marina Bay, Singapura',
    viewBox: '0 0 320 220',
    svgPath:
      'M 60 186 C 46 166 50 136 68 118 L 104 85 C 118 72 138 68 155 75 L 195 90 C 215 98 238 90 250 72 L 272 42 C 285 25 310 32 312 55 L 315 110 C 318 135 300 158 275 165 L 225 178 C 205 184 190 200 185 220 C 175 225 155 210 145 195 L 115 160 C 102 148 85 152 75 168 L 60 186 Z',
    startFinish: { x: 78, y: 104 },
    antiClockwise: true,
    description:
      'Espetáculo noturno sob holofotes entre arranha-céus, calor sufocante e alta exigência de tração.',
  },

  // 19: COTA - Circuit of the Americas (Austin, EUA) - Anti-horário
  // Pista moderna de Herman Tilke com homenagens aos melhores trechos do mundo:
  // Reta principal com subida brutal de 40 metros até a CURVA 1 HAIRPIN CEGA, descida alucinante no
  // ESSE VELOZ DE ALTA (inspirado em Maggotts/Becketts curvas 2-6), curva cega 9-10, hairpin 11,
  // reta de 1 km, complexo do estádio e a FERRADURA QUÁDRUPLA (curvas 16-18 inspiradas na curva 8 de Istambul).
  19: {
    round: 19,
    code: 'COT',
    name: 'Circuito das Américas, Austin',
    viewBox: '0 0 320 220',
    svgPath:
      'M 52 188 L 52 78 C 52 50 80 35 105 52 L 140 76 C 155 88 178 86 192 72 L 235 28 C 252 10 280 20 282 44 L 285 94 C 288 120 270 142 245 148 L 195 160 C 175 165 160 182 160 204 C 158 218 140 224 128 214 L 86 180 C 74 170 58 176 52 188 Z',
    startFinish: { x: 52, y: 122 },
    antiClockwise: true,
    description:
      'Subida cega de 40 metros para a Curva 1, sequência em S veloz inspirada em Silverstone e ferradura quádrupla.',
  },

  // 20: Autódromo Hermanos Rodríguez (México) - Horário
  // A mais de 2.200 metros acima do nível do mar (ar rarefeito):
  // Longuíssima reta de largada (1.300 m a mais de 350 km/h), chicane 1-2-3 Moisés Solana, reta intermediária,
  // complexo 4-5-6, Esse veloz nas curvas 7 a 11, reta dos fundos e a
  // INCRÍVEL PASSAGEM POR DENTRO DO ESTÁDIO DE BEISEBOL FORO SOL (curvas 12 a 16 cercadas por 40 mil torcedores) e retorno na antiga curva Peraltada.
  20: {
    round: 20,
    code: 'MEX',
    name: 'Autódromo Hermanos Rodríguez, México',
    viewBox: '0 0 320 220',
    svgPath:
      'M 50 190 L 225 190 C 245 190 262 174 266 152 L 278 90 C 282 62 262 36 234 36 L 180 36 C 160 36 145 48 140 68 L 132 102 C 128 120 112 134 92 134 L 50 134 L 50 190 Z',
    startFinish: { x: 135, y: 190 },
    antiClockwise: false,
    description:
      'Altitude de 2.200m com ar rarefeito, reta inicial de 1,3 km e a apoteose do estádio de beisebol Foro Sol.',
  },

  // 21: Interlagos - Autódromo de São Paulo (Brasil) - Anti-horário
  // TRAÇADO OBRIGATÓRIO FIEL AO ÍCONE BRASILEIRO (Sentido anti-horário):
  // Reta dos boxes descendo no icônico e mergulhante S DO SENNA (Curva 1 para a esquerda em descida íngreme e Curva 2 contornando para a direita),
  // Curva do Sol (T3) acelerando na Reta Oposta, freada em descida para a Curva da Ferradura (T6-7),
  // subida para a Curva do Laranjinha (T8), Pinheirinho (T9), o fechadíssimo Bico de Pato (T10),
  // Curva do Mergulho (T11), a decisiva Junção (T12), subida na Subida dos Boxes a fundo e Curva do Café até a linha de chegada.
  21: {
    round: 21,
    code: 'INT',
    name: 'Autódromo de Interlagos, São Paulo',
    viewBox: '0 0 320 220',
    svgPath:
      'M 82 192 C 60 174 62 142 84 120 L 118 88 C 130 76 148 70 165 76 L 208 92 C 230 100 258 90 270 68 L 288 40 C 300 18 326 28 322 54 L 312 110 C 304 145 272 172 235 174 L 175 176 C 152 178 132 192 125 214 C 118 226 98 224 88 208 L 82 192 Z',
    startFinish: { x: 104, y: 190 },
    antiClockwise: true,
    description:
      'Anti-horário autêntico com o lendário "S do Senna", Curva do Sol, Reta Oposta, Ferradura, Bico de Pato e Subida dos Boxes.',
  },

  // 22: Las Vegas Strip (EUA) - Anti-horário
  // Circuito de rua pelas avenidas mais famosas de Nevada:
  // Paddock fechado no miolo leste (T1-4), Koval Lane em alta velocidade, curva contornando a gigantesca ESFERA (MSG Sphere curvas 5-9),
  // Sands Avenue e a ENORME RETA DA STRIP DE 1.900 METROS passando em frente ao Bellagio, Caesars Palace e Paris a 350 km/h,
  // freada na Harmon Avenue e curva final de volta ao paddock.
  22: {
    round: 22,
    code: 'LVG',
    name: 'Circuito da Las Vegas Strip',
    viewBox: '0 0 320 220',
    svgPath:
      'M 56 178 L 56 78 C 56 56 78 42 100 52 L 186 92 C 200 98 216 95 230 84 L 262 55 C 276 42 300 52 300 72 L 300 142 C 300 166 280 186 254 186 L 142 186 C 122 186 106 198 92 206 C 76 214 56 200 56 178 Z',
    startFinish: { x: 56, y: 128 },
    antiClockwise: true,
    description:
      'Espetáculo noturno no coração de Las Vegas: contorno da Esfera e reta monumental de 1,9 km na Strip a mais de 345 km/h.',
  },

  // 23: Lusail (Catar) - Horário
  // Circuito de motovelocidade adaptado para F1:
  // Reta de chegada de mais de 1 km, Curva 1 de raio médio, curva 2-3 fluida,
  // sequência ininterrupta de curvas rápidas no deserto (T4 a T10 gerando 4G laterais contínuos),
  // reta intermediária curta e o impressionante ápice triplo das curvas 12-14.
  23: {
    round: 23,
    code: 'QAT',
    name: 'Circuito Internacional de Lusail',
    viewBox: '0 0 320 220',
    svgPath:
      'M 65 188 L 232 188 C 258 188 278 170 282 145 L 292 92 C 296 64 276 38 248 38 L 205 38 C 185 38 170 50 165 70 L 158 96 C 152 118 132 134 110 134 L 80 134 C 58 134 46 154 56 175 L 65 188 Z',
    startFinish: { x: 135, y: 188 },
    antiClockwise: false,
    description:
      'Pista ultramoderna com curvas fluidas e velozes sob holofotes, exigindo máxima resistência física aos pilotos.',
  },

  // 24: Yas Marina (Abu Dhabi) - Anti-horário
  // A grande decisão do campeonato ao entardecer no Golfo Pérsico:
  // Reta dos boxes, Curva 1 para a esquerda, rápida subida nas curvas 2-3, hairpin remodelado T5 na ponta norte,
  // Reta de 1.200 m, chicane rápida T6-7, segunda reta oposta com a curva inclinada com banking T9,
  // passagem cinematográfica por baixo do hotel W Abu Dhabi iluminado por LEDs coloridos e contorno da marina.
  24: {
    round: 24,
    code: 'ABU',
    name: 'Circuito de Yas Marina, Abu Dhabi',
    viewBox: '0 0 320 220',
    svgPath:
      'M 65 182 C 48 162 52 128 72 110 L 102 82 C 115 70 125 52 125 35 C 125 15 145 2 164 12 L 215 38 C 235 48 260 45 275 30 L 290 15 C 305 0 325 12 322 32 L 312 95 C 305 130 275 158 240 162 L 180 168 C 158 170 142 185 135 205 C 128 225 102 230 88 214 L 65 182 Z',
    startFinish: { x: 88, y: 96 },
    antiClockwise: true,
    description:
      'O crepúsculo da grande final: marina de iates de luxo, hotel W Abu Dhabi iluminado e traçado fluido e veloz.',
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
          <span className="px-1.5 py-0.5 rounded bg-[#11161F] border border-[#1F2733] text-cyan-300 font-bold">
            {track.antiClockwise ? '↺ Anti-horário' : '↻ Horário'}
          </span>
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

          {/* Pit lane representation for Albert Park if round 1 */}
          {round === 1 && (
            <path
              d="M 234 167 C 220 167 190 167 155 167"
              fill="none"
              stroke="#64748B"
              strokeWidth="2"
              strokeDasharray="4 2"
              opacity="0.75"
            />
          )}

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
            {/* Checkerboard flag label with directional arrow */}
            <text
              x={round === 1 ? track.startFinish.x - 4 : track.startFinish.x + 8}
              y={round === 1 ? track.startFinish.y + 14 : track.startFinish.y + 4}
              textAnchor={round === 1 ? 'middle' : 'start'}
              fill="#F5F7FA"
              fontSize="7.5"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {round === 1 ? '◀ LARGADA' : 'LARGADA'}
            </text>
          </g>
        </svg>

        {/* Compass direction badge */}
        <div className="absolute bottom-1 left-2 text-[9px] text-slate-500 font-mono">
          {track.antiClockwise ? '↺ SENTIDO ANTI-HORÁRIO' : '↻ SENTIDO HORÁRIO'}
        </div>
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

      <p className="text-[10px] text-[#8B95A7] mt-2 line-clamp-2 italic">{track.description}</p>
    </div>
  )
}
