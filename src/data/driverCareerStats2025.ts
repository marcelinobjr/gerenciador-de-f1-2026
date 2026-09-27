/**
 * Estatísticas canônicas de carreira da Fórmula 1 (baseline histórico real até o fim da temporada 2025).
 * Fonte: Registros históricos oficiais da FIA / Formula 1 até 31/12/2025.
 *
 * Chaveado pelos IDs canônicos da base (mbj-001..mbj-135) e aliases conhecidos de runtime.
 * Pilotos sem histórico de F1 têm contadores 0 (zero legítimo).
 *
 * Campos:
 * - races: Grandes Prêmios disputados (largadas / f1RacesCompleted)
 * - wins: Vitórias na F1
 * - poles: Pole positions oficiais na F1
 * - championships: Títulos mundiais de pilotos da F1
 */

export interface DriverHistoricalCareerBaseline {
  races: number
  wins: number
  poles: number
  championships: number
}

export const DRIVER_CAREER_STATS_2025: Record<string, DriverHistoricalCareerBaseline> = {
  // --- TITULARES F1 2026 ---
  // Max Verstappen: 233 largadas em GPs, 71 vitórias, 48 poles, 4 títulos até 31/12/2025
  'mbj-001': { races: 233, wins: 71, poles: 48, championships: 4 },
  de3isw3re1ji2wj: { races: 233, wins: 71, poles: 48, championships: 4 },
  driver_max_verstappen: { races: 233, wins: 71, poles: 48, championships: 4 },
  drv_max_verstappen: { races: 233, wins: 71, poles: 48, championships: 4 },
  verstappen: { races: 233, wins: 71, poles: 48, championships: 4 },

  // Liam Lawson: 11 GPs, 0 vitórias, 0 poles, 0 títulos // probe
  'mbj-002': { races: 11, wins: 0, poles: 0, championships: 0 },
  driver_liam_lawson: { races: 11, wins: 0, poles: 0, championships: 0 },
  drv_liam_lawson: { races: 11, wins: 0, poles: 0, championships: 0 },
  lawson: { races: 11, wins: 0, poles: 0, championships: 0 },

  // Lewis Hamilton: 380 largadas em GPs, 105 vitórias, 104 poles, 7 títulos até 31/12/2025
  'mbj-003': { races: 380, wins: 105, poles: 104, championships: 7 },
  driver_lewis_hamilton: { races: 380, wins: 105, poles: 104, championships: 7 },
  drv_lewis_hamilton: { races: 380, wins: 105, poles: 104, championships: 7 },
  hamilton: { races: 380, wins: 105, poles: 104, championships: 7 },

  // Charles Leclerc: 146 GPs, 8 vitórias, 26 poles, 0 títulos
  'mbj-004': { races: 146, wins: 8, poles: 26, championships: 0 },
  lc6cma46f01dgrj: { races: 146, wins: 8, poles: 26, championships: 0 },
  driver_charles_leclerc: { races: 146, wins: 8, poles: 26, championships: 0 },
  drv_charles_leclerc: { races: 146, wins: 8, poles: 26, championships: 0 },
  leclerc: { races: 146, wins: 8, poles: 26, championships: 0 },

  // Lando Norris: 128 GPs, 4 vitórias, 8 poles, 0 títulos
  'mbj-005': { races: 128, wins: 4, poles: 8, championships: 0 },
  driver_lando_norris: { races: 128, wins: 4, poles: 8, championships: 0 },
  drv_lando_norris: { races: 128, wins: 4, poles: 8, championships: 0 },
  norris: { races: 128, wins: 4, poles: 8, championships: 0 },

  // Oscar Piastri: 46 GPs, 2 vitórias, 0 poles, 0 títulos
  'mbj-006': { races: 46, wins: 2, poles: 0, championships: 0 },
  driver_oscar_piastri: { races: 46, wins: 2, poles: 0, championships: 0 },
  drv_oscar_piastri: { races: 46, wins: 2, poles: 0, championships: 0 },
  piastri: { races: 46, wins: 2, poles: 0, championships: 0 },

  // George Russell: 128 GPs, 3 vitórias, 5 poles, 0 títulos
  'mbj-007': { races: 128, wins: 3, poles: 5, championships: 0 },
  driver_george_russell: { races: 128, wins: 3, poles: 5, championships: 0 },
  drv_george_russell: { races: 128, wins: 3, poles: 5, championships: 0 },
  russell: { races: 128, wins: 3, poles: 5, championships: 0 },

  // Andrea Kimi Antonelli: 24 largadas em GPs até 31/12/2025
  'mbj-008': { races: 24, wins: 0, poles: 0, championships: 0 },
  driver_andrea_kimi_antonelli: { races: 24, wins: 0, poles: 0, championships: 0 },
  drv_andrea_kimi_antonelli: { races: 24, wins: 0, poles: 0, championships: 0 },
  antonelli: { races: 24, wins: 0, poles: 0, championships: 0 },

  // Fernando Alonso: 425 largadas em GPs, 32 vitórias, 22 poles, 2 títulos até 31/12/2025
  'mbj-009': { races: 425, wins: 32, poles: 22, championships: 2 },
  driver_fernando_alonso: { races: 425, wins: 32, poles: 22, championships: 2 },
  drv_fernando_alonso: { races: 425, wins: 32, poles: 22, championships: 2 },
  alonso: { races: 425, wins: 32, poles: 22, championships: 2 },

  // Lance Stroll: 166 GPs, 0 vitórias, 1 pole, 0 títulos
  'mbj-010': { races: 166, wins: 0, poles: 1, championships: 0 },
  driver_lance_stroll: { races: 166, wins: 0, poles: 1, championships: 0 },
  stroll: { races: 166, wins: 0, poles: 1, championships: 0 },

  // Pierre Gasly: 153 GPs, 1 vitória, 0 poles, 0 títulos
  'mbj-011': { races: 153, wins: 1, poles: 0, championships: 0 },
  driver_pierre_gasly: { races: 153, wins: 1, poles: 0, championships: 0 },
  gasly: { races: 153, wins: 1, poles: 0, championships: 0 },

  // Jack Doohan: 1 GP (Abu Dhabi 2024), 0 vitórias, 0 poles, 0 títulos
  'mbj-012': { races: 1, wins: 0, poles: 0, championships: 0 },
  driver_jack_doohan: { races: 1, wins: 0, poles: 0, championships: 0 },
  doohan: { races: 1, wins: 0, poles: 0, championships: 0 },

  // Alexander Albon: 104 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-013': { races: 104, wins: 0, poles: 0, championships: 0 },
  driver_alexander_albon: { races: 104, wins: 0, poles: 0, championships: 0 },
  albon: { races: 104, wins: 0, poles: 0, championships: 0 },

  // Carlos Sainz Jr: 206 GPs, 4 vitórias, 6 poles, 0 títulos
  'mbj-014': { races: 206, wins: 4, poles: 6, championships: 0 },
  driver_carlos_sainz: { races: 206, wins: 4, poles: 6, championships: 0 },
  drv_carlos_sainz: { races: 206, wins: 4, poles: 6, championships: 0 },
  sainz: { races: 206, wins: 4, poles: 6, championships: 0 },

  // Yuki Tsunoda: 87 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-015': { races: 87, wins: 0, poles: 0, championships: 0 },
  driver_yuki_tsunoda: { races: 87, wins: 0, poles: 0, championships: 0 },
  tsunoda: { races: 87, wins: 0, poles: 0, championships: 0 },

  // Isack Hadjar: 23 largadas em GPs até 31/12/2025
  'mbj-016': { races: 23, wins: 0, poles: 0, championships: 0 },
  driver_isack_hadjar: { races: 23, wins: 0, poles: 0, championships: 0 },
  drv_isack_hadjar: { races: 23, wins: 0, poles: 0, championships: 0 },
  hadjar: { races: 23, wins: 0, poles: 0, championships: 0 },

  // Esteban Ocon: 156 GPs, 1 vitória, 0 poles, 0 títulos
  'mbj-017': { races: 156, wins: 1, poles: 0, championships: 0 },
  driver_esteban_ocon: { races: 156, wins: 1, poles: 0, championships: 0 },
  ocon: { races: 156, wins: 1, poles: 0, championships: 0 },

  // Oliver Bearman: 3 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-018': { races: 3, wins: 0, poles: 0, championships: 0 },
  driver_oliver_bearman: { races: 3, wins: 0, poles: 0, championships: 0 },
  bearman: { races: 3, wins: 0, poles: 0, championships: 0 },

  // Nico Hülkenberg: 250 largadas em GPs (excluindo DNS, ex: Itália 2025 DNS), 0 vitórias, 1 pole, 0 títulos até 31/12/2025
  'mbj-019': { races: 250, wins: 0, poles: 1, championships: 0 },
  '0mow8vmzk0y4z9s': { races: 250, wins: 0, poles: 1, championships: 0 },
  driver_nico_hulkenberg: { races: 250, wins: 0, poles: 1, championships: 0 },
  drv_nico_hulkenberg: { races: 250, wins: 0, poles: 1, championships: 0 },
  hulkenberg: { races: 250, wins: 0, poles: 1, championships: 0 },

  // Gabriel Bortoleto: 24 largadas em GPs até 31/12/2025
  'mbj-020': { races: 24, wins: 0, poles: 0, championships: 0 },
  '9uazqw522oc9p4z': { races: 24, wins: 0, poles: 0, championships: 0 },
  driver_gabriel_bortoleto: { races: 24, wins: 0, poles: 0, championships: 0 },
  drv_gabriel_bortoleto: { races: 24, wins: 0, poles: 0, championships: 0 },
  bortoleto: { races: 24, wins: 0, poles: 0, championships: 0 },

  // Sergio Pérez: 281 GPs, 6 vitórias, 3 poles, 0 títulos
  'mbj-021': { races: 281, wins: 6, poles: 3, championships: 0 },
  driver_sergio_perez: { races: 281, wins: 6, poles: 3, championships: 0 },
  perez: { races: 281, wins: 6, poles: 3, championships: 0 },

  // Valtteri Bottas: 246 GPs, 10 vitórias, 20 poles, 0 títulos
  'mbj-022': { races: 246, wins: 10, poles: 20, championships: 0 },
  driver_valtteri_bottas: { races: 246, wins: 10, poles: 20, championships: 0 },
  bottas: { races: 246, wins: 10, poles: 20, championships: 0 },

  // --- RESERVAS E DEMAIS COM EXPERIÊNCIA F1 ---
  // Antonio Giovinazzi: 62 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-024': { races: 62, wins: 0, poles: 0, championships: 0 },
  giovinazzi: { races: 62, wins: 0, poles: 0, championships: 0 },

  // Franco Colapinto: 9 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-029': { races: 9, wins: 0, poles: 0, championships: 0 },
  colapinto: { races: 9, wins: 0, poles: 0, championships: 0 },

  // Daniel Ricciardo: 257 GPs, 8 vitórias, 3 poles, 0 títulos
  'mbj-034': { races: 257, wins: 8, poles: 3, championships: 0 },
  ricciardo: { races: 257, wins: 8, poles: 3, championships: 0 },

  // Kevin Magnussen: 182 GPs, 0 vitórias, 1 pole, 0 títulos
  'mbj-035': { races: 182, wins: 0, poles: 1, championships: 0 },
  magnussen: { races: 182, wins: 0, poles: 1, championships: 0 },

  // Guanyu Zhou: 66 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-036': { races: 66, wins: 0, poles: 0, championships: 0 },
  zhou: { races: 66, wins: 0, poles: 0, championships: 0 },

  // Mick Schumacher: 43 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-037': { races: 43, wins: 0, poles: 0, championships: 0 },
  schumacher: { races: 43, wins: 0, poles: 0, championships: 0 },

  // Logan Sargeant: 36 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-038': { races: 36, wins: 0, poles: 0, championships: 0 },
  sargeant: { races: 36, wins: 0, poles: 0, championships: 0 },

  // Nyck de Vries: 11 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-039': { races: 11, wins: 0, poles: 0, championships: 0 },
  devries: { races: 11, wins: 0, poles: 0, championships: 0 },

  // Stoffel Vandoorne: 42 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-046': { races: 42, wins: 0, poles: 0, championships: 0 },
  vandoorne: { races: 42, wins: 0, poles: 0, championships: 0 },

  // Pascal Wehrlein: 39 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-047': { races: 39, wins: 0, poles: 0, championships: 0 },
  wehrlein: { races: 39, wins: 0, poles: 0, championships: 0 },

  // Jean-Eric Vergne: 58 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-048': { races: 58, wins: 0, poles: 0, championships: 0 },
  vergne: { races: 58, wins: 0, poles: 0, championships: 0 },

  // Kamui Kobayashi: 76 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-051': { races: 76, wins: 0, poles: 0, championships: 0 },
  kobayashi: { races: 76, wins: 0, poles: 0, championships: 0 },

  // Brendon Hartley: 25 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-052': { races: 25, wins: 0, poles: 0, championships: 0 },
  hartley: { races: 25, wins: 0, poles: 0, championships: 0 },

  // Sebastien Buemi: 55 GPs, 0 vitórias, 0 poles, 0 títulos
  'mbj-053': { races: 55, wins: 0, poles: 0, championships: 0 },
  buemi: { races: 55, wins: 0, poles: 0, championships: 0 },

  // Daniil Kvyat: 110 largadas, 0 vitórias, 0 poles, 0 títulos
  kvyat: { races: 110, wins: 0, poles: 0, championships: 0 },
  daniil_kvyat: { races: 110, wins: 0, poles: 0, championships: 0 },
  driver_daniil_kvyat: { races: 110, wins: 0, poles: 0, championships: 0 },
  drv_daniil_kvyat: { races: 110, wins: 0, poles: 0, championships: 0 },

  // Sébastien Bourdais: 27 largadas, 0 vitórias, 0 poles, 0 títulos
  'mbj-128': { races: 27, wins: 0, poles: 0, championships: 0 },
  bourdais: { races: 27, wins: 0, poles: 0, championships: 0 },
  sebastien_bourdais: { races: 27, wins: 0, poles: 0, championships: 0 },
  driver_sebastien_bourdais: { races: 27, wins: 0, poles: 0, championships: 0 },
  drv_sebastien_bourdais: { races: 27, wins: 0, poles: 0, championships: 0 },

  // Nikita Mazepin: 21 largadas, 0 vitórias, 0 poles, 0 títulos
  mazepin: { races: 21, wins: 0, poles: 0, championships: 0 },
  nikita_mazepin: { races: 21, wins: 0, poles: 0, championships: 0 },
  driver_nikita_mazepin: { races: 21, wins: 0, poles: 0, championships: 0 },
  drv_nikita_mazepin: { races: 21, wins: 0, poles: 0, championships: 0 },
}

/**
 * Consulta a baseline histórica real de um piloto a partir de um ID (canônico ou runtime alias).
 * Retorna null se o ID não tiver mapeamento no dicionário.
 */
export function getDriverCareerBaseline2025(
  driverId?: string | null,
): DriverHistoricalCareerBaseline | null {
  if (!driverId) return null
  const key = driverId.trim().toLowerCase()
  if (DRIVER_CAREER_STATS_2025[key]) {
    return DRIVER_CAREER_STATS_2025[key]
  }
  if (DRIVER_CAREER_STATS_2025[driverId]) {
    return DRIVER_CAREER_STATS_2025[driverId]
  }
  return null
}
