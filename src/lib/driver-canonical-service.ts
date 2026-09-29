/**
 * driver-canonical-service.ts
 *
 * Módulo mestre para:
 * 1. Mapeamento canônico de nomes de pilotos, deduplicação e resolução de aliases.
 * 2. Mapeamento estrito e confiável de fotos de pilotos (DRV_0001..DRV_0151 e pilotos-gerados).
 *
 * Casos Canônicos Homologados:
 * - Álex Palou / Alex Palou -> "Álex Palou" (1 só registro)
 * - Alex Albon / Alexander Albon -> "Alexander Albon" (1 só registro)
 * - Alex Dunne / Alexander Dunne -> "Alexander Dunne" (1 só registro)
 * - Andre Lotterer / André Lotterer -> "André Lotterer" (1 só registro)
 * - Antonio Felix da Costa / António Félix da Costa -> "António Félix da Costa" (1 só registro)
 * - Gabriele Mini / Gabriele Minì -> "Gabriele Mini" (1 só registro)
 * - Brad Keselowiski / Brad Keselowski -> "Brad Keselowski"
 * - Callum Llott / Callum Ilott -> "Callum Ilott"
 */

// Tabela de normalização para nome canônico
export const CANONICAL_NAME_MAP: Record<string, string> = {
  // Alex Albon
  'alex albon': 'Alexander Albon',
  'alexander albon': 'Alexander Albon',

  // Alex Dunne
  'alex dunne': 'Alexander Dunne',
  'alexander dunne': 'Alexander Dunne',

  // Álex Palou vs Alex Palou -> "Alex Palou"
  'alex palou': 'Alex Palou',
  'alex palou ': 'Alex Palou',
  'álex palou': 'Alex Palou',

  // André Lotterer
  'andre lotterer': 'André Lotterer',
  'andré lotterer': 'André Lotterer',

  // António Félix da Costa
  'antonio felix da costa': 'António Félix da Costa',
  'antónio félix da costa': 'António Félix da Costa',
  'antonio felix da costa ': 'António Félix da Costa',
  'antonio félix da costa': 'António Félix da Costa',
  'antónio felix da costa': 'António Félix da Costa',

  // Gabriele Mini
  'gabriele mini': 'Gabriele Mini',
  'gabriele minì': 'Gabriele Mini',
  'gabriele mini ': 'Gabriele Mini',

  // Brad Keselowski
  'brad keselowiski': 'Brad Keselowski',
  'brad keselowski': 'Brad Keselowski',

  // Callum Ilott
  'callum llott': 'Callum Ilott',
  'callum ilott': 'Callum Ilott',

  // Antonio Fuoco
  'antonio fuoco': 'Antonio Fuoco',
  'antónio fuoco': 'Antonio Fuoco',

  // Helio Castroneves
  'helio castroneves': 'Hélio Castroneves',
  'hélio castroneves': 'Hélio Castroneves',

  // Emerson Fittipaldi Jr.
  'emerson fittipaldi jr': 'Emerson Fittipaldi Jr.',
  'emerson fittipaldi jr.': 'Emerson Fittipaldi Jr.',
  'emerson fittipaldi junior': 'Emerson Fittipaldi Jr.',

  // Felipe Albuquerque
  'felipe albuquerque': 'Felipe Albuquerque',
  'filipe albuquerque': 'Felipe Albuquerque',

  // Aliases canônicos especificados na frente PILOTOS-FOTOS-GITHUB-01
  'nyck de vries': 'Nyck de Vries',
  'nicky de vries': 'Nyck de Vries',
  'rubens barichello': 'Rubens Barrichello',
  'rubens barrichello': 'Rubens Barrichello',
  'lucas di gassi': 'Lucas di Grassi',
  'lucas di grassi': 'Lucas di Grassi',
  'william bryon': 'William Byron',
  'william byron': 'William Byron',
  'jose maria lopez': 'José María López',
  'josé maría lópez': 'José María López',
  'jose maria lópez': 'José María López',
  'patricio o’ward': "Pato O'Ward",
  "patricio o'ward": "Pato O'Ward",
  'pato o’ward': "Pato O'Ward",
  "pato o'ward": "Pato O'Ward",
  'rene rast': 'René Rast',
  'rené rast': 'René Rast',
  'noel león': 'Noel León',
  'noel leon': 'Noel León',
  'sebastián montoya': 'Sebastián Montoya',
  'sebastian montoya': 'Sebastián Montoya',
  'roman stanêk': 'Roman Staněk',
  'roman stanek': 'Roman Staněk',
  'roman staněk': 'Roman Staněk',
  'kévin estre': 'Kévin Estre',
  'kevin estre': 'Kévin Estre',

  // Robin Frijns (WEC deve ser excluído ou unificado em Robin Frijns)
  'robin frijns': 'Robin Frijns',
  'robin frijns wec': 'Robin Frijns',
  'robin frijns-wec': 'Robin Frijns',
}

/**
 * Normaliza uma string de nome para token limpo (sem acento, lowercase, sem espaços extras)
 */
export function normalizeDriverNameToken(name: string): string {
  if (!name) return ''
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Chave canônica única para agrupamento de pilotos
 */
export function getDriverCanonicalKey(name: string): string {
  const cleanName = (name || '').trim()
  const lower = cleanName.toLowerCase()
  if (CANONICAL_NAME_MAP[lower]) {
    return normalizeDriverNameToken(CANONICAL_NAME_MAP[lower])
  }
  return normalizeDriverNameToken(cleanName)
}

/**
 * Retorna o nome canônico preferido para exibição
 */
export function getCanonicalDisplayName(name: string): string {
  if (!name) return ''
  const clean = name.trim()
  const lower = clean.toLowerCase()
  if (CANONICAL_NAME_MAP[lower]) {
    return CANONICAL_NAME_MAP[lower]
  }
  return clean
}

/**
 * Mapeamento direto de nomes normalizados (ou IDs) para arquivo de foto em public/pilotos ou public/pilotos-gerados
 */
export const DRIVER_CANONICAL_PHOTO_MAP: Record<string, string> = {
  // Pilotos Bloco 1 (DRV_0001 a DRV_0151 e Piloto_14)
  albahuruplarsen: '/pilotos/DRV_0001.jpg',
  albalarsen: '/pilotos/DRV_0001.jpg',
  alessandropierguidi: '/pilotos/DRV_0081.jpg',
  alexdunne: '/pilotos/DRV_0042.jpg',
  alexanderdunne: '/pilotos/DRV_0042.jpg',
  alexlynn: '/pilotos/DRV_0138.jpg',
  alishapalmowski: '/pilotos/DRV_0082.jpg',
  amaurycordeel: '/pilotos/DRV_0083.jpg',
  amauricordell: '/pilotos/DRV_0083.jpg',
  antoniofuoco: '/pilotos/DRV_0084.jpg',
  avadobson: '/pilotos/DRV_0086.jpg',
  bradkeselowski: '/pilotos/DRV_0004.jpg',
  bradkeselowiski: '/pilotos/DRV_0004.jpg',
  callumhedge: '/pilotos/DRV_0088.jpg',
  callumilott: '/pilotos/DRV_0139.jpg',
  callumllott: '/pilotos/DRV_0139.jpg',
  callumvoisin: '/pilotos/DRV_0140.jpg',
  chaseelliott: '/pilotos/DRV_0006.jpg',
  christianmansell: '/pilotos/DRV_0141.jpg',
  christopherbell: '/pilotos/DRV_0048.jpg',
  connordephillippi: '/pilotos/DRV_0142.jpg',
  danecameron: '/pilotos/DRV_0143.jpg',
  daniilkvyat: '/pilotos/DRV_0136.jpg',
  dennishauger: '/pilotos/DRV_0144.jpg',
  dennyhamlin: '/pilotos/DRV_0051.jpg',
  driesvanthoor: '/pilotos/DRV_0145.jpg',
  earlbamber: '/pilotos/DRV_0146.jpg',
  edoardomortara: '/pilotos/DRV_0090.jpg',
  ellalloyd: '/pilotos/DRV_0091.jpg',
  ellastevens: '/pilotos/DRV_0147.jpg',
  emersonfittipaldijr: '/pilotos/DRV_0148.jpg',
  emersonfittipaldijunior: '/pilotos/DRV_0148.jpg',
  emmafelbermayr: '/pilotos/DRV_0010.jpg',
  enzofittipaldi: '/pilotos/DRV_0149.jpg',
  esmeekosterman: '/pilotos/DRV_0092.jpg',
  freddieslater: '/pilotos/DRV_0150.jpg', // arquivo real no GitHub/repo: DRV_0150.jpg
  drvdrv0150: '/pilotos/DRV_0150.jpg',
  gabrielemini: '/pilotos/DRV_0013.jpg',
  heliocastroneves: '/pilotos/DRV_0151.jpg',
  alexalbon: '/pilotos/DRV_0041.jpg',
  alexanderalbon: '/pilotos/DRV_0041.jpg',
  alexpalou: '/pilotos/DRV_0043.jpg',
  antoniofelixdacosta: '/pilotos/DRV_0044.jpg',
  andrelotterer: '/pilotos/DRV_0003.jpg',

  // Felipe Albuquerque -> usar Piloto_xx.jpg em "pilotos-gerados" (Piloto_14 masculino)
  felipealbuquerque: '/pilotos-gerados/Piloto_14.jpg',
  filipealbuquerque: '/pilotos-gerados/Piloto_14.jpg',
  'mbj-122': '/pilotos-gerados/Piloto_14.jpg',

  // BLOCO 2
  jadejacquet: '/pilotos/DRV_0097.jpg',
  jamescalado: '/pilotos/DRV_0099.jpg',
  joeylogano: '/pilotos/DRV_0058.jpg',
  jonathanbrowne: '/pilotos/DRV_0100.jpg',
  josefnesgarden: '/pilotos/DRV_0016.jpg',
  josefnewgarden: '/pilotos/DRV_0016.jpg',
  josepmariamarti: '/pilotos/DRV_0101.jpg',
  pepemarti: '/pilotos/DRV_0101.jpg',
  joshuadurksen: '/pilotos/DRV_0116.jpg',
  joshuaduerksen: '/pilotos/DRV_0116.jpg',
  kamuikobayashi: '/pilotos/DRV_0017.jpg',
  kayleecountryman: '/pilotos/DRV_0102.jpg',
  kevinestre: '/pilotos/DRV_0103.jpg',
  kevinmagnussen: '/pilotos/DRV_0059.jpg',
  lisabillard: '/pilotos/DRV_0066.jpg',
  lucasdigassi: '/pilotos/DRV_0067.jpg',
  lucasdigrassi: '/pilotos/DRV_0067.jpg',
  marianacosta: '/pilotos-gerados/Piloto_55.jpg',
  mathildapaatz: '/pilotos/DRV_0021.jpg',
  mylesrowe: '/pilotos/DRV_0122.jpg',
  nataliagranada: '/pilotos/DRV_0123.jpg',
  nelsonpiquetjr: '/pilotos/DRV_0026.jpg',
  nelsonpiquetjunior: '/pilotos/DRV_0026.jpg',
  nickcassidy: '/pilotos/DRV_0106.jpg',
  nikitamazepin: '/pilotos/DRV_0135.jpg',
  nikolatsolov: '/pilotos/DRV_0027.jpg',
  ninagademan: '/pilotos/DRV_0028.jpg',
  noelleon: '/pilotos/DRV_0124.jpg',
  nolanallaer: '/pilotos/DRV_0125.jpg',
  olivergoethe: '/pilotos/DRV_0126.jpg',
  paytonwestcott: '/pilotos/DRV_0030.jpg',
  rachelrobertson: '/pilotos/DRV_0112.jpg',
  rafaelvillagomez: '/pilotos/DRV_0127.jpg',
  rafaelaferreira: '/pilotos/DRV_0071.jpg',
  richardverschoor: '/pilotos/DRV_0128.jpg',
  ritomomiyata: '/pilotos/DRV_0129.jpg',
  robertkubica: '/pilotos/DRV_0113.jpg',
  romanbilinski: '/pilotos/DRV_0130.jpg',
  romanstanek: '/pilotos/DRV_0131.jpg',
  rubensbarichello: '/pilotos/DRV_0072.jpg',
  rubensbarrichello: '/pilotos/DRV_0072.jpg',
  ryanblaney: '/pilotos/DRV_0073.jpg',
  ryohirakawa: '/pilotos/DRV_0033.jpg',
  salvadordealba: '/pilotos/DRV_0132.jpg',
  scottdixon: '/pilotos/DRV_0074.jpg',
  sebastianmontoya: '/pilotos/DRV_0134.jpg',
  tylerreddick: '/pilotos/DRV_0114.jpg',
  willpower: '/pilotos/DRV_0077.jpg',
  williambryon: '/pilotos/DRV_0078.jpg',
  williambyron: '/pilotos/DRV_0078.jpg',

  // BUG-PILOTOS-01B1A: IDs PocketBase / MBJ diretos mapeando para as fotos canônicas dos 16 pilotos
  '9v5e8eui71eusma': '/pilotos/DRV_0001.jpg', // Alba Hurup Larsen
  '96j5j7yw9rzrniw': '/pilotos/DRV_0081.jpg', // Alessandro Pier Guidi
  hl14dawcbv4jv79: '/pilotos/DRV_0042.jpg', // Alex Dunne
  'mbj-103': '/pilotos/DRV_0138.jpg', // Alex Lynn
  y6yxh8xqcjon2un: '/pilotos/DRV_0082.jpg', // Alisha Palmowski
  '1jtl9kaxbv1ptps': '/pilotos/DRV_0083.jpg', // Amauri Cordell / Amaury Cordeel
  v29qlvsii7r9us0: '/pilotos/DRV_0084.jpg', // Antonio Fuoco
  kw21vwkrfiludy2: '/pilotos/DRV_0086.jpg', // Ava Dobson
  zdxbpd8b2jrtq1y: '/pilotos/DRV_0004.jpg', // Brad Keselowski
  h3llycw9bdhwrac: '/pilotos/DRV_0088.jpg', // Callum Hedge
  'mbj-100': '/pilotos/DRV_0139.jpg', // Callum Ilott
  'mbj-076': '/pilotos/DRV_0140.jpg', // Callum Voisin
  m2tpbn2r0mak1ut: '/pilotos/DRV_0006.jpg', // Chase Elliott
  'mbj-077': '/pilotos/DRV_0141.jpg', // Christian Mansell
  ap51biwjhwsh2pf: '/pilotos/DRV_0048.jpg', // Christopher Bell
  'mbj-115': '/pilotos/DRV_0142.jpg', // Connor de Phillippi
}

/**
 * Resolve a imagem de um piloto de forma resiliente por ID ou Nome
 */
export function resolveCanonicalDriverImagePath(
  driverId?: string | null,
  driverName?: string | null,
): string | null {
  if (driverName) {
    const key = normalizeDriverNameToken(driverName)
    if (DRIVER_CANONICAL_PHOTO_MAP[key]) {
      return DRIVER_CANONICAL_PHOTO_MAP[key]
    }
    // Tenta também buscar pelo canonical display name
    const canName = getCanonicalDisplayName(driverName)
    const canKey = normalizeDriverNameToken(canName)
    if (DRIVER_CANONICAL_PHOTO_MAP[canKey]) {
      return DRIVER_CANONICAL_PHOTO_MAP[canKey]
    }
  }

  if (driverId) {
    const key = normalizeDriverNameToken(driverId)
    if (DRIVER_CANONICAL_PHOTO_MAP[key]) {
      return DRIVER_CANONICAL_PHOTO_MAP[key]
    }
    // Suporte direto a chaves case-preserved ou diretas
    if (DRIVER_CANONICAL_PHOTO_MAP[driverId]) {
      return DRIVER_CANONICAL_PHOTO_MAP[driverId]
    }
  }

  return null
}
