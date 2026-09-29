/**
 * driver-canonical-service.ts
 *
 * Módulo mestre para:
 * 1. Mapeamento canônico de nomes de pilotos, deduplicação e resolução de aliases.
 * 2. Mapeamento estrito e confiável de fotos de pilotos (DRV_0001..DRV_0188 e pilotos-gerados).
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
  'gabriele miní': 'Gabriele Mini',
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
  'patricio oward': "Pato O'Ward",
  'patricio o ward': "Pato O'Ward",
  'pato o’ward': "Pato O'Ward",
  "pato o'ward": "Pato O'Ward",
  'pato oward': "Pato O'Ward",
  'pato o ward': "Pato O'Ward",
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

  // Nicky Yelloly / Nick Yelloly
  'nicky yelloly': 'Nicky Yelloly',
  'nick yelloly': 'Nicky Yelloly',

  // Norman Nato / Norm Nato
  'norman nato': 'Norman Nato',
  'norm nato': 'Norman Nato',

  // CP6 ALIASES CANÔNICOS
  'lello marciello': 'Raffaele Marciello',
  'raffaele marciello': 'Raffaele Marciello',
  'renger v.d. zande': 'Renger van der Zande',
  'renger vd zande': 'Renger van der Zande',
  'renger van der zande': 'Renger van der Zande',
  'rinus van kalmthout': 'Rinus VeeKay',
  'rinus veekay': 'Rinus VeeKay',
  'ricky taylor': 'Ricky Taylor',
  'robert shwartzman': 'Robert Shwartzman',
  'romain grosjean': 'Romain Grosjean',
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
  // === BLOCO 1 — CP1 (PRIMEIROS 10 MAPPINGS CANÔNICOS VALIDADOS: PILOTOS-FOTOS-GITHUB-01B-CP1) ===
  // 1. Alba Hurup Larsen -> DRV_0001.jpg
  albahuruplarsen: '/pilotos/DRV_0001.jpg',
  albalarsen: '/pilotos/DRV_0001.jpg',
  // 2. Alessandro Pier Guidi -> DRV_0081.jpg
  alessandropierguidi: '/pilotos/DRV_0081.jpg',
  // 3. Alex Dunne / Alexander Dunne -> DRV_0042.jpg (Alias canônico obrigatório)
  alexdunne: '/pilotos/DRV_0042.jpg',
  alexanderdunne: '/pilotos/DRV_0042.jpg',
  // 4. Alex Lynn -> DRV_0138.jpg
  alexlynn: '/pilotos/DRV_0138.jpg',
  // 5. Alisha Palmowski -> DRV_0082.jpg
  alishapalmowski: '/pilotos/DRV_0082.jpg',
  // 6. Amauri Cordell / Amaury Cordeel -> DRV_0083.jpg
  amaurycordeel: '/pilotos/DRV_0083.jpg',
  amauricordell: '/pilotos/DRV_0083.jpg',
  // 7. Antonio Fuoco -> DRV_0084.jpg
  antoniofuoco: '/pilotos/DRV_0084.jpg',
  // 8. Ava Dobson -> DRV_0086.jpg
  avadobson: '/pilotos/DRV_0086.jpg',
  // 9. Brad Keselowski / Brad Keselowiski -> DRV_0004.jpg
  bradkeselowski: '/pilotos/DRV_0004.jpg',
  bradkeselowiski: '/pilotos/DRV_0004.jpg',
  // 10. Callum Hedge -> DRV_0088.jpg
  callumhedge: '/pilotos/DRV_0088.jpg',

  // === BLOCO 1 — CP2 (PRÓXIMOS 10 MAPPINGS CANÔNICOS VALIDADOS: PILOTOS-FOTOS-GITHUB-01B-CP2) ===
  // 11. Callum Llott / Callum Ilott -> DRV_0139.jpg
  callumllott: '/pilotos/DRV_0139.jpg',
  callumilott: '/pilotos/DRV_0139.jpg',
  // 12. Callum Voisin -> DRV_0140.jpg
  callumvoisin: '/pilotos/DRV_0140.jpg',
  // 13. Chase Elliott / Chase Elliot -> DRV_0006.jpg
  chaseelliott: '/pilotos/DRV_0006.jpg',
  chaseelliot: '/pilotos/DRV_0006.jpg',
  // 14. Christian Mansell -> DRV_0141.jpg
  christianmansell: '/pilotos/DRV_0141.jpg',
  // 15. Christopher Bell -> DRV_0048.jpg
  christopherbell: '/pilotos/DRV_0048.jpg',
  // 16. Connor de Phillippi / Connor De Phillippi -> DRV_0142.jpg
  connordephillippi: '/pilotos/DRV_0142.jpg',
  // 17. Dane Cameron -> DRV_0143.jpg
  danecameron: '/pilotos/DRV_0143.jpg',
  // 18. Daniil Kvyat -> DRV_0136.jpg
  daniilkvyat: '/pilotos/DRV_0136.jpg',
  // 19. Dennis Hauger -> DRV_0144.jpg
  dennishauger: '/pilotos/DRV_0144.jpg',
  // 20. Denny Hamlin -> DRV_0051.jpg
  dennyhamlin: '/pilotos/DRV_0051.jpg',

  // === BLOCO 1 — CP3 (PRÓXIMOS 10 MAPPINGS CANÔNICOS VALIDADOS: PILOTOS-FOTOS-GITHUB-01B-CP3) ===
  // 21. Dries Vanthoor -> DRV_0145.jpg
  driesvanthoor: '/pilotos/DRV_0145.jpg',
  // 22. Earl Bamber -> DRV_0146.jpg
  earlbamber: '/pilotos/DRV_0146.jpg',
  // 23. Edoardo Mortara -> DRV_0090.jpg
  edoardomortara: '/pilotos/DRV_0090.jpg',
  // 24. Ella Lloyd -> DRV_0091.jpg
  ellalloyd: '/pilotos/DRV_0091.jpg',
  // 25. Ella Stevens -> DRV_0147.jpg
  ellastevens: '/pilotos/DRV_0147.jpg',
  // 26. Emerson Fittipaldi Jr. -> DRV_0148.jpg
  emersonfittipaldijr: '/pilotos/DRV_0148.jpg',
  emersonfittipaldijunior: '/pilotos/DRV_0148.jpg',
  // 27. Emma Felbermayr -> DRV_0010.jpg
  emmafelbermayr: '/pilotos/DRV_0010.jpg',
  // 28. Enzo Fittipaldi -> DRV_0149.jpg
  enzofittipaldi: '/pilotos/DRV_0149.jpg',
  // 29. Esmee Kosterman -> DRV_0092.jpg
  esmeekosterman: '/pilotos/DRV_0092.jpg',
  // 30. Gabriele Mini / Gabriele Minì -> DRV_0013.jpg
  gabrielemini: '/pilotos/DRV_0013.jpg',

  // === BLOCO 1 — CP4 (PRÓXIMOS 10 MAPPINGS CANÔNICOS VALIDADOS: PILOTOS-FOTOS-GITHUB-01B-CP4) ===
  // 31. Helio Castroneves / Hélio Castroneves -> DRV_0151.jpg
  // 32. Jade Jacquet -> DRV_0097.jpg
  // 33. James Calado -> DRV_0099.jpg
  // 34. Joey Logano -> DRV_0058.jpg
  // 35. Jonathan Browne -> DRV_0100.jpg
  // 36. Josef Newgarden / Josef Nesgarden -> DRV_0016.jpg
  // 37. Josep Maria Marti / Pepe Marti / Josep Maria Martí -> DRV_0101.jpg
  // 38. Joshua Dürksen / Joshua Durksen / Joshua Duerksen -> DRV_0116.jpg
  // 39. Kamui Kobayashi -> DRV_0017.jpg
  // 40. Freddie Slater -> DRV_0150.jpg (Verificado: DRV_0150.jpg existe; DRV_DRV_0150.jpg é alias/inexistente)
  // 32. Freddie Slater -> DRV_0150.jpg (verificado arquivo real DRV_0150.jpg)
  freddieslater: '/pilotos/DRV_0150.jpg',
  drvdrv0150: '/pilotos/DRV_0150.jpg',
  // 33. Jack Aitken -> DRV_0152.jpg
  jackaitken: '/pilotos/DRV_0152.jpg',
  // 34. Jacob Abel -> DRV_0153.jpg
  jacobabel: '/pilotos/DRV_0153.jpg',
  // 35. Jordan Taylor -> DRV_0154.jpg
  jordantaylor: '/pilotos/DRV_0154.jpg',
  // 36. José María López / Jose Maria Lopez -> DRV_0155.jpg
  josemarialopez: '/pilotos/DRV_0155.jpg',
  josemaríalopez: '/pilotos/DRV_0155.jpg',
  josémaríalópez: '/pilotos/DRV_0155.jpg',
  // 37. Kyffin Simpson -> DRV_0156.jpg
  kyffinsimpson: '/pilotos/DRV_0156.jpg',
  // 38. Linus Lundqvist -> DRV_0157.jpg
  linuslundqvist: '/pilotos/DRV_0157.jpg',
  // 39. Logan Sargeant -> DRV_0158.jpg
  logansargeant: '/pilotos/DRV_0158.jpg',
  // 40. Louis Delétraz / Louis Deletraz -> DRV_0159.jpg
  louisdeletraz: '/pilotos/DRV_0159.jpg',
  loisdeletraz: '/pilotos/DRV_0159.jpg',

  felipealbuquerque: '/pilotos-gerados/Piloto_14.jpg',
  filipealbuquerque: '/pilotos-gerados/Piloto_14.jpg',
  alexalbon: '/pilotos/DRV_0041.jpg',
  alexanderalbon: '/pilotos/DRV_0041.jpg',
  alexpalou: '/pilotos/DRV_0043.jpg',
  antoniofelixdacosta: '/pilotos/DRV_0044.jpg',
  andrelotterer: '/pilotos/DRV_0003.jpg',

  // === BLOCO 2 ===
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
  williambyron: '/pilotos/DRV_0078.jpg',
  williambryon: '/pilotos/DRV_0078.jpg',

  // === BLOCO 1 — CP5 (PRÓXIMOS 10 MAPPINGS CANÔNICOS VALIDADOS: PILOTOS-FOTOS-GITHUB-01B-CP5) ===
  // 41. Marco Wittmann -> DRV_0160.jpg (mbj-117)
  marcowittmann: '/pilotos/DRV_0160.jpg',
  // 42. Marcus Armstrong -> DRV_0161.jpg (mbj-096)
  marcusarmstrong: '/pilotos/DRV_0161.jpg',
  // 43. Mathieu Jaminet -> DRV_0162.jpg (mbj-113)
  mathieujaminet: '/pilotos/DRV_0162.jpg',
  // 44. Matt Campbell -> DRV_0163.jpg (mbj-114)
  mattcampbell: '/pilotos/DRV_0163.jpg',
  // 45. Matteo Cairoli -> DRV_0164.jpg
  matteocairoli: '/pilotos/DRV_0164.jpg',
  // 46. Mike Conway -> DRV_0165.jpg (mbj-107)
  mikeconway: '/pilotos/DRV_0165.jpg',
  // 47. Mirko Bortolotti -> DRV_0166.jpg
  mirkobortolotti: '/pilotos/DRV_0166.jpg',
  // 48. Nicky Yelloly / Nick Yelloly -> DRV_0167.jpg (Alias canônico)
  nickyelloly: '/pilotos/DRV_0167.jpg',
  // nickyelloly token is identical for "Nick Yelloly" (nickyelloly) and "Nicky Yelloly" (nickyyelloly)
  nickyyelloly: '/pilotos/DRV_0167.jpg',
  // 49. Nolan Siegel -> DRV_0168.jpg (mbj-101)
  nolansiegel: '/pilotos/DRV_0168.jpg',
  // 50. Norman Nato / Norm Nato -> DRV_0169.jpg (Alias canônico)
  normannato: '/pilotos/DRV_0169.jpg',
  normnato: '/pilotos/DRV_0169.jpg',

  // === BLOCO 1 — CP6 (PRÓXIMOS 10 MAPPINGS CANÔNICOS VALIDADOS: PILOTOS-FOTOS-GITHUB-01B-CP6) ===
  // 51. Nyck de Vries / Nicky de Vries -> DRV_0170.jpg (mbj-039)
  nickydevries: '/pilotos/DRV_0170.jpg',
  nyckdevries: '/pilotos/DRV_0170.jpg',
  // 52. Patricio O'Ward / Pato O'Ward -> DRV_0171.jpg (mbj-025)
  patriciooward: '/pilotos/DRV_0171.jpg',
  patooward: '/pilotos/DRV_0171.jpg',
  // 53. Raffaele Marciello / Lello Marciello -> DRV_0172.jpg (mbj-120)
  raffaelemarciello: '/pilotos/DRV_0172.jpg',
  lellomarciello: '/pilotos/DRV_0172.jpg',
  // 54. Rene Rast / René Rast -> DRV_0173.jpg (mbj-106)
  renerast: '/pilotos/DRV_0173.jpg',
  renérast: '/pilotos/DRV_0173.jpg',
  // 55. Renger van der Zande -> DRV_0174.jpg (mbj-129)
  rengervanderzande: '/pilotos/DRV_0174.jpg',
  rengervdzande: '/pilotos/DRV_0174.jpg',
  // 56. Ricky Taylor -> DRV_0175.jpg (mbj-121)
  rickytaylor: '/pilotos/DRV_0175.jpg',
  // 57. Rinus VeeKay / Rinus van Kalmthout -> DRV_0176.jpg (mbj-094)
  rinusveekay: '/pilotos/DRV_0176.jpg',
  rinusvankalmthout: '/pilotos/DRV_0176.jpg',
  // 58. Robert Shwartzman -> DRV_0177.jpg (mbj-040)
  robertshwartzman: '/pilotos/DRV_0177.jpg',
  // 59. Robin Frijns -> DRV_0178.jpg (mbj-084)
  robinfrijns: '/pilotos/DRV_0178.jpg',
  // 60. Romain Grosjean -> DRV_0179.jpg (mbj-130)
  romaingrosjean: '/pilotos/DRV_0179.jpg',

  // === BLOCO D: DEMAIS PILOTOS DO CATÁLOGO ===
  noahtaylor: '/pilotos-gerados/Piloto_58.jpg',
  sheldonvanderlinde: '/pilotos/DRV_0180.jpg',
  takumasato: '/pilotos/DRV_0181.jpg',
  timtramnitz: '/pilotos/DRV_0182.jpg',
  tomblomqvist: '/pilotos/DRV_0183.jpg',
  tonykanaan: '/pilotos/DRV_0184.jpg',
  tuukkataponen: '/pilotos/DRV_0185.jpg',
  ugougochukwu: '/pilotos/DRV_0186.jpg',
  willstevens: '/pilotos/DRV_0187.jpg',
  zakosullivan: '/pilotos/DRV_0188.jpg',

  // Chaves MBJ e PocketBase diretas
  'mbj-122': '/pilotos-gerados/Piloto_14.jpg',
  '9v5e8eui71eusma': '/pilotos/DRV_0001.jpg',
  '96j5j7yw9rzrniw': '/pilotos/DRV_0081.jpg',
  hl14dawcbv4jv79: '/pilotos/DRV_0042.jpg',
  'mbj-103': '/pilotos/DRV_0138.jpg',
  y6yxh8xqcjon2un: '/pilotos/DRV_0082.jpg',
  '1jtl9kaxbv1ptps': '/pilotos/DRV_0083.jpg',
  v29qlvsii7r9us0: '/pilotos/DRV_0084.jpg',
  kw21vwkrfiludy2: '/pilotos/DRV_0086.jpg',
  zdxbpd8b2jrtq1y: '/pilotos/DRV_0004.jpg',
  h3llycw9bdhwrac: '/pilotos/DRV_0088.jpg',
  'mbj-100': '/pilotos/DRV_0139.jpg',
  'mbj-076': '/pilotos/DRV_0140.jpg',
  m2tpbn2r0mak1ut: '/pilotos/DRV_0006.jpg',
  'mbj-077': '/pilotos/DRV_0141.jpg',
  ap51biwjhwsh2pf: '/pilotos/DRV_0048.jpg',
  'mbj-115': '/pilotos/DRV_0142.jpg',
  'mbj-111': '/pilotos/DRV_0143.jpg',
  'mbj-137': '/pilotos/DRV_0136.jpg',
  'mbj-059': '/pilotos/DRV_0144.jpg',

  // CP3 direct ID keys
  'mbj-119': '/pilotos/DRV_0145.jpg',
  'mbj-102': '/pilotos/DRV_0146.jpg',
  du0sd86hxglnw4a: '/pilotos/DRV_0090.jpg',
  g0xh5dajfkkaa3b: '/pilotos/DRV_0091.jpg',
  m7e24lcm065h1xg: '/pilotos/DRV_0147.jpg',
  v5llmbtfjovvv4c: '/pilotos/DRV_0148.jpg',
  fah70cg7nh6uzki: '/pilotos/DRV_0010.jpg',
  'mbj-057': '/pilotos/DRV_0149.jpg',
  '8srxswzj5r17dma': '/pilotos/DRV_0092.jpg',
  'mbj-063': '/pilotos/DRV_0013.jpg',

  // CP5 direct ID keys
  'mbj-117': '/pilotos/DRV_0160.jpg',
  'mbj-096': '/pilotos/DRV_0161.jpg',
  'mbj-113': '/pilotos/DRV_0162.jpg',
  'mbj-114': '/pilotos/DRV_0163.jpg',
  'mbj-107': '/pilotos/DRV_0165.jpg',
  'mbj-101': '/pilotos/DRV_0168.jpg',

  // CP6 direct ID keys
  'mbj-039': '/pilotos/DRV_0170.jpg',
  'mbj-025': '/pilotos/DRV_0171.jpg',
  'mbj-120': '/pilotos/DRV_0172.jpg',
  'mbj-106': '/pilotos/DRV_0173.jpg',
  'mbj-129': '/pilotos/DRV_0174.jpg',
  'mbj-131': '/pilotos/DRV_0174.jpg',
  'mbj-121': '/pilotos/DRV_0175.jpg',
  'mbj-094': '/pilotos/DRV_0176.jpg',
  'mbj-040': '/pilotos/DRV_0177.jpg',
  'mbj-084': '/pilotos/DRV_0178.jpg',
  'mbj-087': '/pilotos/DRV_0178.jpg',
  'mbj-130': '/pilotos/DRV_0179.jpg',
  'mbj-132': '/pilotos/DRV_0179.jpg',
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
