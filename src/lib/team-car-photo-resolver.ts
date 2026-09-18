/**
 * Resolver centralizado oficial de Fotos dos Carros das Equipes da F1.
 * Fonte Exclusiva Obrigatória: Google Drive (Pasta 1m-te17DaTDBcBvj3r_ryk-ZQGeM-vTr- - "Equipes")
 *
 * Mapeia as 28 fotos de carros dos construtores oficiais para URLs de alta disponibilidade no Google Drive Thumbnail CDN.
 *
 * IMPORTANTE:
 * - As logos existentes (TeamReducedLogoDef) permanecem 100% INTACTAS e SEPARADAS.
 * - Este módulo serve EXCLUSIVAMENTE para a foto do carro correspondente a cada equipe.
 */

export interface TeamCarPhotoDef {
  teamKey: string
  displayName: string
  fileName: string
  fileId: string
  photoUrl: string
  aliases: string[]
}

/**
 * Catálogo canônico com os 28 arquivos de fotos de carros extraídos diretamente da pasta do Google Drive:
 * https://drive.google.com/drive/folders/1m-te17DaTDBcBvj3r_ryk-ZQGeM-vTr-?usp=drive_link
 */
export const TEAM_CAR_PHOTOS_MANIFEST: Record<string, TeamCarPhotoDef> = {
  alfaromeo: {
    teamKey: 'alfaromeo',
    displayName: 'Alfa Romeo',
    fileName: 'Alfa_Romeo.jpg',
    fileId: '1kEQcCb2VWqcxhyDk9srHtJmTW-4fpckT',
    photoUrl: 'https://drive.google.com/thumbnail?id=1kEQcCb2VWqcxhyDk9srHtJmTW-4fpckT&sz=w1200',
    aliases: ['alfa', 'alfa_romeo', 'alfaromeof1', 'sauber_alfa_romeo', 'alfa-romeo'],
  },
  alphatauri: {
    teamKey: 'alphatauri',
    displayName: 'AlphaTauri',
    fileName: 'Alfa_Tauri.jpg',
    fileId: '1wJda9fksvF9DE-mXja0_vgkPQKCldETZ',
    photoUrl: 'https://drive.google.com/thumbnail?id=1wJda9fksvF9DE-mXja0_vgkPQKCldETZ&sz=w1200',
    aliases: [
      'alpha_tauri',
      'scuderia_alphatauri',
      'toro_rosso',
      'tororosso',
      'alpha-tauri',
      'alfa_tauri',
    ],
  },
  alpine: {
    teamKey: 'alpine',
    displayName: 'Alpine',
    fileName: 'Alpine.jpg',
    fileId: '1oeO-Lw5tivCc9CxClOluriH2zCvwD4G3',
    photoUrl: 'https://drive.google.com/thumbnail?id=1oeO-Lw5tivCc9CxClOluriH2zCvwD4G3&sz=w1200',
    aliases: ['alpine_f1', 'alpine_f1_team', 'renault_alpine', 'bwt_alpine'],
  },
  andretti: {
    teamKey: 'andretti',
    displayName: 'Andretti',
    fileName: 'Andretti.jpg',
    fileId: '1Cjrd_lSrSQzc46P4u8ZnM6FHInH9lnjC',
    photoUrl: 'https://drive.google.com/thumbnail?id=1Cjrd_lSrSQzc46P4u8ZnM6FHInH9lnjC&sz=w1200',
    aliases: ['andretti_global', 'andretti_cadillac', 'andrettif1', 'andretti-cadillac'],
  },
  astonmartin: {
    teamKey: 'astonmartin',
    displayName: 'Aston Martin',
    fileName: 'Aston_Martin.jpg',
    fileId: '10I4OzkFFtr4K_-kzAJXbt30qSxkor7in',
    photoUrl: 'https://drive.google.com/thumbnail?id=10I4OzkFFtr4K_-kzAJXbt30qSxkor7in&sz=w1200',
    aliases: ['aston_martin', 'aston', 'amr', 'aston_martin_aramco', 'aston-martin'],
  },
  audi: {
    teamKey: 'audi',
    displayName: 'Audi',
    fileName: 'Audi.jpg',
    fileId: '1YQZoSU6vfd6kxDR9rv3tyvqrDkVIJWau',
    photoUrl: 'https://drive.google.com/thumbnail?id=1YQZoSU6vfd6kxDR9rv3tyvqrDkVIJWau&sz=w1200',
    aliases: ['audi_f1', 'audi_sport', 'audi_revolut', 'audi_f1_team', 'audisport', 'audi-revolut'],
  },
  benetton: {
    teamKey: 'benetton',
    displayName: 'Benetton',
    fileName: 'Benetton.jpg',
    fileId: '1ukq2n86gbG5IT2pwl7ootxhael1zTXMV',
    photoUrl: 'https://drive.google.com/thumbnail?id=1ukq2n86gbG5IT2pwl7ootxhael1zTXMV&sz=w1200',
    aliases: ['benetton_formula', 'benetton_f1', 'benetton-formula'],
  },
  byd: {
    teamKey: 'byd',
    displayName: 'BYD',
    fileName: 'BYD.jpg',
    fileId: '1Cxxqmb4MzkiSkP5xe_TTOJF7lkdzRlj8',
    photoUrl: 'https://drive.google.com/thumbnail?id=1Cxxqmb4MzkiSkP5xe_TTOJF7lkdzRlj8&sz=w1200',
    aliases: ['byd_racing', 'byd_formula', 'bydf1', 'byd-racing'],
  },
  cadillac: {
    teamKey: 'cadillac',
    displayName: 'Cadillac',
    fileName: 'Cadilac.jpg',
    fileId: '152U1QSl8neP6WgA7kkUZZbUZSGD_wYnP',
    photoUrl: 'https://drive.google.com/thumbnail?id=152U1QSl8neP6WgA7kkUZZbUZSGD_wYnP&sz=w1200',
    aliases: ['cadilac', 'cadillac_f1', 'cadillac_racing', 'gm_cadillac', 'cadillac-racing'],
  },
  copersucar: {
    teamKey: 'copersucar',
    displayName: 'Copersucar',
    fileName: 'Copersucar.jpg',
    fileId: '1XWWrAIS3qkg7a1BSo7aYSdTim0nCVzwj',
    photoUrl: 'https://drive.google.com/thumbnail?id=1XWWrAIS3qkg7a1BSo7aYSdTim0nCVzwj&sz=w1200',
    aliases: ['copersucar_fittipaldi', 'copersucar_racing', 'copersucar-fittipaldi'],
  },
  ferrari: {
    teamKey: 'ferrari',
    displayName: 'Ferrari',
    fileName: 'Ferrari.jpg',
    fileId: '1_g3tRsxYS6hsD22C7HElFVXV3gbFQHKq',
    photoUrl: 'https://drive.google.com/thumbnail?id=1_g3tRsxYS6hsD22C7HElFVXV3gbFQHKq&sz=w1200',
    aliases: ['scuderia_ferrari', 'scuderia_ferrari_hp', 'ferrari_hp', 'scuderia-ferrari'],
  },
  fittipaldi: {
    teamKey: 'fittipaldi',
    displayName: 'Fittipaldi',
    fileName: 'Fittipapdi.jpg',
    fileId: '1HwTr_N61oNU9S0ShN4qsS59IqMhPFg5Z',
    photoUrl: 'https://drive.google.com/thumbnail?id=1HwTr_N61oNU9S0ShN4qsS59IqMhPFg5Z&sz=w1200',
    aliases: ['fittipapdi', 'fittipaldi_automotive', 'fittipaldi_f1'],
  },
  haas: {
    teamKey: 'haas',
    displayName: 'Haas',
    fileName: 'Haas.jpg',
    fileId: '1P0xFx6Z_DHsH7k7gO09fj4Q13fTNw9o9',
    photoUrl: 'https://drive.google.com/thumbnail?id=1P0xFx6Z_DHsH7k7gO09fj4Q13fTNw9o9&sz=w1200',
    aliases: ['haas_f1_team', 'moneygram_haas', 'haasf1', 'haas-f1-team'],
  },
  honda: {
    teamKey: 'honda',
    displayName: 'Honda',
    fileName: 'Honda.jpg',
    fileId: '1oaGLWFYM872ruAduBV0t9rdcKtfhaHsK',
    photoUrl: 'https://drive.google.com/thumbnail?id=1oaGLWFYM872ruAduBV0t9rdcKtfhaHsK&sz=w1200',
    aliases: ['honda_racing', 'honda_hrc', 'hrc', 'hondaf1', 'honda-racing'],
  },
  jordan: {
    teamKey: 'jordan',
    displayName: 'Jordan',
    fileName: 'Jordan.jpg',
    fileId: '1vM8oG5vsN-Q0Vnl_6q37IJ1jtBVRf-mO',
    photoUrl: 'https://drive.google.com/thumbnail?id=1vM8oG5vsN-Q0Vnl_6q37IJ1jtBVRf-mO&sz=w1200',
    aliases: ['jordan_grand_prix', 'jordan_f1', 'jordan-grand-prix'],
  },
  lamborghini: {
    teamKey: 'lamborghini',
    displayName: 'Lamborghini',
    fileName: 'Lamborguini.jpg',
    fileId: '1-lPPrwnlmjhTee_mDF-AX2a2GX93AgWq',
    photoUrl: 'https://drive.google.com/thumbnail?id=1-lPPrwnlmjhTee_mDF-AX2a2GX93AgWq&sz=w1200',
    aliases: ['lamborguini', 'squadra_corse', 'lamborghini_sc', 'lamborghini-sc'],
  },
  lotus: {
    teamKey: 'lotus',
    displayName: 'Lotus',
    fileName: 'Lotus.jpg',
    fileId: '15EUohuP6t7k4yv7Q_wNDqAblmtVrhufD',
    photoUrl: 'https://drive.google.com/thumbnail?id=15EUohuP6t7k4yv7Q_wNDqAblmtVrhufD&sz=w1200',
    aliases: ['team_lotus', 'lotus_f1', 'classic_lotus', 'team-lotus'],
  },
  mclaren: {
    teamKey: 'mclaren',
    displayName: 'McLaren',
    fileName: 'McLAren.jpg',
    fileId: '1HHNdRJ7luyS3V9trN4hB3w_p8jnji8h-',
    photoUrl: 'https://drive.google.com/thumbnail?id=1HHNdRJ7luyS3V9trN4hB3w_p8jnji8h-&sz=w1200',
    aliases: ['mclaren_f1', 'mclaren_racing', 'mclaren_mercedes', 'mclaren-f1-team'],
  },
  mercedes: {
    teamKey: 'mercedes',
    displayName: 'Mercedes',
    fileName: 'Mercedes.jpg',
    fileId: '18RSb6trOpyEXL2tIqN10cqFAl7WMLtj0',
    photoUrl: 'https://drive.google.com/thumbnail?id=18RSb6trOpyEXL2tIqN10cqFAl7WMLtj0&sz=w1200',
    aliases: [
      'mercedes_amg',
      'mercedes_amg_petronas',
      'amg_petronas',
      'mercedes_f1',
      'mercedes-amg-petronas',
    ],
  },
  penske: {
    teamKey: 'penske',
    displayName: 'Penske',
    fileName: 'Penske.jpg',
    fileId: '1KXpojRbcX2vzhLBr44FSxhDZx87YUu7n',
    photoUrl: 'https://drive.google.com/thumbnail?id=1KXpojRbcX2vzhLBr44FSxhDZx87YUu7n&sz=w1200',
    aliases: ['team_penske', 'penske_racing', 'team-penske'],
  },
  porsche: {
    teamKey: 'porsche',
    displayName: 'Porsche',
    fileName: 'Porshe.jpg',
    fileId: '1szMpDKu3tbCIy2uCOmN93Hk46a5fS7Qy',
    photoUrl: 'https://drive.google.com/thumbnail?id=1szMpDKu3tbCIy2uCOmN93Hk46a5fS7Qy&sz=w1200',
    aliases: ['porshe', 'porsche_motorsport', 'tag_heuer_porsche', 'porsche-motorsport'],
  },
  racingbulls: {
    teamKey: 'racingbulls',
    displayName: 'Racing Bulls (VCARB)',
    fileName: 'Racing_Bulls.jpg',
    fileId: '1TCM56nW5n5yMHZa6GBvO8EpzcYin-9Xv',
    photoUrl: 'https://drive.google.com/thumbnail?id=1TCM56nW5n5yMHZa6GBvO8EpzcYin-9Xv&sz=w1200',
    aliases: [
      'vcarb',
      'visa_cash_app_rb',
      'rb',
      'racing_bulls',
      'toro_rosso',
      'racing-bulls',
      'visa-cash-app-rb',
    ],
  },
  redbull: {
    teamKey: 'redbull',
    displayName: 'Red Bull Racing',
    fileName: 'Red_Bull.jpg',
    fileId: '1FoLfr9inIIZGXbJYxWT7FetkZNNrraUE',
    photoUrl: 'https://drive.google.com/thumbnail?id=1FoLfr9inIIZGXbJYxWT7FetkZNNrraUE&sz=w1200',
    aliases: [
      'red_bull',
      'rbr',
      'oracle_red_bull_racing',
      'redbullracing',
      'red-bull',
      'red-bull-racing',
    ],
  },
  renault: {
    teamKey: 'renault',
    displayName: 'Renault',
    fileName: 'Renaut.jpg',
    fileId: '10iZfwnOZqUHrEOdJE2ktkmWVJW9VFKZf',
    photoUrl: 'https://drive.google.com/thumbnail?id=10iZfwnOZqUHrEOdJE2ktkmWVJW9VFKZf&sz=w1200',
    aliases: ['renaut', 'renault_f1', 'renault_dp_world', 'renault-f1-team'],
  },
  sauber: {
    teamKey: 'sauber',
    displayName: 'Sauber',
    fileName: 'Sauber.jpg',
    fileId: '1tbH18-8H-J7IC2VmAakPeD0FP52bjdbS',
    photoUrl: 'https://drive.google.com/thumbnail?id=1tbH18-8H-J7IC2VmAakPeD0FP52bjdbS&sz=w1200',
    aliases: ['stake_f1', 'kick_sauber', 'sauber_motorsport', 'stake-f1-team-kick-sauber'],
  },
  toleman: {
    teamKey: 'toleman',
    displayName: 'Toleman',
    fileName: 'Tolerman.jpg',
    fileId: '11zIKX4sTJ1Z1FQ1kl1NGHn__IkUwWipf',
    photoUrl: 'https://drive.google.com/thumbnail?id=11zIKX4sTJ1Z1FQ1kl1NGHn__IkUwWipf&sz=w1200',
    aliases: ['tolerman', 'toleman_motorsport', 'tg184', 'toleman-group-motorsport'],
  },
  toyota: {
    teamKey: 'toyota',
    displayName: 'Toyota',
    fileName: 'Toyota.jpg',
    fileId: '1FN4SfuT9EveEjcRcRWctOZfaLembyvMy',
    photoUrl: 'https://drive.google.com/thumbnail?id=1FN4SfuT9EveEjcRcRWctOZfaLembyvMy&sz=w1200',
    aliases: [
      'toyota_racing',
      'panasonic_toyota',
      'gazoo_racing',
      'toyota_gazoo',
      'toyota-gazoo-racing',
    ],
  },
  williams: {
    teamKey: 'williams',
    displayName: 'Williams',
    fileName: 'Williams.jpg',
    fileId: '1e6obc_1hCsaOc3-H6tlN2iqJCwvqJ7pw',
    photoUrl: 'https://drive.google.com/thumbnail?id=1e6obc_1hCsaOc3-H6tlN2iqJCwvqJ7pw&sz=w1200',
    aliases: ['williams_racing', 'williamsf1', 'williams_mercedes', 'williams-racing'],
  },
}

/**
 * Normaliza qualquer identificador, nome completo ou slug de equipe para encontrar a foto do carro.
 */
export function normalizeCarPhotoIdentifier(input: string | null | undefined): string {
  if (!input) return ''
  const clean = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/^ai_/, '') // remove prefixo de IA se houver
    .replace(/[-\s]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

  // 1. Match direto de chave
  if (TEAM_CAR_PHOTOS_MANIFEST[clean]) {
    return clean
  }

  // 2. Match por alias
  for (const [key, item] of Object.entries(TEAM_CAR_PHOTOS_MANIFEST)) {
    if (key === clean) return key
    if (
      item.aliases.some((alias) => {
        const normAlias = alias.toLowerCase().replace(/[-\s]+/g, '_')
        return normAlias === clean || clean.includes(normAlias) || normAlias.includes(clean)
      })
    ) {
      return key
    }
  }

  // 3. Match por nome limpo contido
  const cleanPlain = clean.replace(/_/g, '')
  for (const [key] of Object.entries(TEAM_CAR_PHOTOS_MANIFEST)) {
    if (cleanPlain.includes(key) || key.includes(cleanPlain)) {
      return key
    }
  }

  return clean
}

/**
 * Retorna a definição canônica da foto do carro da equipe do Google Drive.
 */
export function getTeamCarPhotoDef(
  teamCodeOrName: string | null | undefined,
): TeamCarPhotoDef | null {
  const normKey = normalizeCarPhotoIdentifier(teamCodeOrName)
  return TEAM_CAR_PHOTOS_MANIFEST[normKey] || null
}

/**
 * Retorna a URL direta da foto oficial do carro da equipe (Google Drive CDN).
 * Caso não exista registro, retorna null (permitindo fallback neutro limpo sem imagem quebrada).
 */
export function getTeamCarPhotoUrl(teamCodeOrName: string | null | undefined): string | null {
  const def = getTeamCarPhotoDef(teamCodeOrName)
  return def ? def.photoUrl : null
}
