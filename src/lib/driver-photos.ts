// Service for driver photos mapping and URLs
// Public Dropbox direct URLs for 32 drivers with dl=1
import bortoletoBundledImg from '@/assets/05-gabrielbortoleto-ed602.png'
import ricciardoBundledImg from '@/assets/3-danielricciardo-4d208.jpg'

export interface DriverPhotoInfo {
  filename: string
  normalizedKey: string // e.g. "verstappen"
  surnameVariants: string[]
  bundledImg?: string
  dropboxUrl: string
}

export const DRIVER_PHOTOS: DriverPhotoInfo[] = [
  {
    filename: '1-Ross_Chastain-91a77.jpg',
    normalizedKey: 'chastain',
    surnameVariants: ['chastain', 'ross chastain', 'r. chastain', 'ross_chastain'],
    dropboxUrl: '',
  },
  {
    filename: '1-Dino_Beganovic-83aea.jpg',
    normalizedKey: 'beganovic',
    surnameVariants: ['beganovic', 'dino beganovic', 'd. beganovic', 'dino_beganovic'],
    dropboxUrl: '',
  },
  {
    filename: '1-Rafael_Camara-b1a66.png',
    normalizedKey: 'camara',
    surnameVariants: [
      'camara',
      'câmara',
      'rafael camara',
      'rafael câmara',
      'r. camara',
      'r. câmara',
      'rafael_camara',
    ],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AFglSRVgTsz2f6TmpfB2t64/1-Rafael_Camara.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '3-Daniel_Ricciardo.png',
    normalizedKey: 'ricciardo',
    surnameVariants: ['ricciardo', 'daniel ricciardo'],
    bundledImg: ricciardoBundledImg,
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AHAV-5uijNsZFeC30VyS5lY/3-Daniel_Ricciardo.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '3-Max_Verstappen.png',
    normalizedKey: 'verstappen',
    surnameVariants: ['verstappen', 'max verstappen'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AF85c0pTzJLvXk2jhizWEUg/3-Max_Verstappen.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '4-Lando_Noris.png',
    normalizedKey: 'norris',
    surnameVariants: ['norris', 'noris', 'lando norris', 'lando noris'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AFCxoYih3Ws-PNYanOT00iI/4-Lando_Noris.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '5-Gabriel_Bortoleto.png',
    normalizedKey: 'bortoleto',
    surnameVariants: [
      'bortoleto',
      'bortoletto',
      'gabriel bortoleto',
      'gabriel bortoletto',
      'g. bortoleto',
      'g bortoleto',
    ],
    bundledImg: bortoletoBundledImg,
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AIzc-ON2kz8-VpQLZ1bQRow/5-Gabriel_Bortoleto.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '6-Isack_Hadjar.png',
    normalizedKey: 'hadjar',
    surnameVariants: ['hadjar', 'isack hadjar'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/ANP5LA75bfwvkLdIzuaVQ_4/6-Isack_Hadjar.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '6-Nicola_Tsolov.png',
    normalizedKey: 'tsolov',
    surnameVariants: ['tsolov', 'nicola tsolov', 'nikola tsolov'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AOdbrp18QGvMpFeCgzyw9Qk/6-Nicola_Tsolov.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '7-Jack_Doohan.png',
    normalizedKey: 'doohan',
    surnameVariants: ['doohan', 'jack doohan'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AH82lvd2TvF6YcNupTlv4Hg/7-Jack_Doohan.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '9-Gabriel_Mini.png',
    normalizedKey: 'mini',
    surnameVariants: ['mini', 'minì', 'gabriel mini', 'gabriele mini'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/APsfMTQW8vdhLOdbJH76CXk/9-Gabriel_Mini.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '10-Pierre_Gasly.png',
    normalizedKey: 'gasly',
    surnameVariants: ['gasly', 'pierre gasly'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AAr364Dv7zF1e0CiXB0YQ7I/10-Pierre_Gasly.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '11-Sergio_Pérez.png',
    normalizedKey: 'perez',
    surnameVariants: [
      'perez',
      'pérez',
      'sergio perez',
      'sergio pérez',
      'checo perez',
      'checo pérez',
    ],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AMkXU5E61IrScr1sPGuvPeg/11-Sergio_P%C3%A9rez.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '12-Kimi_Antonelli.png',
    normalizedKey: 'antonelli',
    surnameVariants: ['antonelli', 'kimi antonelli', 'andrea kimi antonelli'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AOuTkqfEQE0Qx-sr5gkp45g/12-Kimi_Antonelli.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '14-Fernando_Alonso.png',
    normalizedKey: 'alonso',
    surnameVariants: ['alonso', 'fernando alonso'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AOm30wqH4WjzkW5oG1BhRGI/14-Fernando_Alonso.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '16-Charles_Leclerc.png',
    normalizedKey: 'leclerc',
    surnameVariants: ['leclerc', 'charles leclerc'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AFOzRDiKaX9g-xYviJC8lFA/16-Charles_Leclerc.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '18-Lance_Stroll.png',
    normalizedKey: 'stroll',
    surnameVariants: ['stroll', 'lance stroll'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AOhYlAh2MvgxYMr6kjxslic/18-Lance_Stroll.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '22-Yuki_Tsunoda.png',
    normalizedKey: 'tsunoda',
    surnameVariants: ['tsunoda', 'yuki tsunoda'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/ACbkfQOIKfqu9KUEq8nqfGM/22-Yuki_Tsunoda.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '23-Alex_Albon.png',
    normalizedKey: 'albon',
    surnameVariants: ['albon', 'alex albon', 'alexander albon'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AEp5qBRo5nlUzmhhdJgtNEg/23-Alex_Albon.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '26-Colton_Herta.png',
    normalizedKey: 'herta',
    surnameVariants: ['herta', 'colton herta'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AMn-aUo1hMuvvN2sYrLKljU/26-Colton_Herta.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '27-Nico_Hulkenberg.png',
    normalizedKey: 'hulkenberg',
    surnameVariants: ['hulkenberg', 'hülkenberg', 'nico hulkenberg', 'nico hülkenberg'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AP-J32t7YfSXL2gEUaCuHHg/27-Nico_Hulkenberg.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '30-Lian_Lawson.png',
    normalizedKey: 'lawson',
    surnameVariants: ['lawson', 'liam lawson', 'lian lawson', '30-liam lawson'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AHJdt-Agv0wy7SLboUAbtOU/30-Lian_Lawson.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '30-Arvid_Lindblad.jpg',
    normalizedKey: 'lindblad',
    surnameVariants: ['lindblad', 'arvid lindblad', '30-arvid lindblad', '31-arvid lindblad'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AOUhlzWLT-o1zfq04WM92wc/31-Arvid_Lindblad.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '31-Esteban_Ocon.png',
    normalizedKey: 'ocon',
    surnameVariants: ['ocon', 'esteban ocon'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/ACWbRGB5eQ_DXYQ5VTD2pgQ/31-Esteban_Ocon.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '34-Felipe_Drugovich.png',
    normalizedKey: 'drugovich',
    surnameVariants: ['drugovich', 'felipe drugovich'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/ANJ5O6AVM30LTIYBgCy_tgw/34-Felipe_Drugovich.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '43-Franco_Colapinto.png',
    normalizedKey: 'colapinto',
    surnameVariants: ['colapinto', 'franco colapinto'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AOy4bA939ZU50tWgWT0Rtf0/43-Franco_Colapinto.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '44-Lewis_Hamilton.png',
    normalizedKey: 'hamilton',
    surnameVariants: ['hamilton', 'lewis hamilton'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AOFye3TWXLxusXfQDRPhxVA/44-Lewis_Hamilton.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '51-Pietro_Fittipaldi.png',
    normalizedKey: 'fittipaldi',
    surnameVariants: ['fittipaldi', 'pietro fittipaldi'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AE35xR33y3BXpPHbuB5wcoY/51-Pietro_Fittipaldi.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '55-Carlos_Sainz.png',
    normalizedKey: 'sainz',
    surnameVariants: ['sainz', 'carlos sainz'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AMwk5BeL0Dgl-_-AnvUq7_0/55-Carlos_Sainz.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '63-George_Russel.png',
    normalizedKey: 'russell',
    surnameVariants: ['russell', 'russel', 'george russell', 'george russel'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AIBFlEZ44c7RKc-IAsl_q-A/63-George_Russel.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '77-Walteri_Botas.jpg',
    normalizedKey: 'bottas',
    surnameVariants: ['bottas', 'botas', 'valtteri bottas', 'walteri botas', 'valteri bottas'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/ACdoJDrAxHz85-k_Sz44BD0/77-Walteri_Botas.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '81-Oscar_Piastri.png',
    normalizedKey: 'piastri',
    surnameVariants: ['piastri', 'oscar piastri'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AI63cn5xaiEk9v48bgl_kyc/81-Oscar_Piastri.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: '87-Olivier_Bearman.png',
    normalizedKey: 'bearman',
    surnameVariants: ['bearman', 'ollie bearman', 'oliver bearman', 'olivier bearman'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/ADt6d7jsUnRu6uuRBhYfjsk/87-Olivier_Bearman.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
  {
    filename: 'Piloto_Genérico.png',
    normalizedKey: 'generico',
    surnameVariants: ['generico', 'generico.png', 'piloto_generico'],
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AMeFY5omivuS07djYnoexEo/Piloto_Gen%C3%A9rico.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
  },
]

// Fallback generico
export const GENERIC_DRIVER_PHOTO = '/pilotos/generico.png'
export const GENERIC_DRIVER_DROPBOX_URL =
  'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AMeFY5omivuS07djYnoexEo/Piloto_Gen%C3%A9rico.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1'

/**
 * Remove diacritics and non-alphanumeric chars
 */
export function normalizeSurname(name: string): string {
  if (!name) return ''
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Extract surname (last name) or canonical token
 */
export function extractDriverSurname(fullName: string): string {
  if (!fullName) return ''
  const cleaned = normalizeSurname(fullName)
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  return parts[parts.length - 1]
}

/**
 * Resolve photo candidates for a driver name:
 * 1. Local /pilotos/{sobrenome}.png
 * 2. Remote direct Dropbox URL for that driver
 * 3. Local /pilotos/generico.png
 * 4. Remote direct Dropbox URL for generico
 */
export function getDriverPhotoSources(driverName?: string): {
  localPath: string
  localCandidates: string[]
  filename?: string
  normalizedKey: string
  bundledImg?: string
  dropboxUrl?: string
  fallbackLocal: string
  fallbackDropbox: string
} {
  const normFullName = normalizeSurname(driverName || '')
  const surname = extractDriverSurname(driverName || '')

  // Find matching driver photo
  let matched = DRIVER_PHOTOS.find((item) => {
    if (item.normalizedKey === 'generico') return false
    if (item.normalizedKey === surname) return true
    return item.surnameVariants.some((v) => {
      const normV = normalizeSurname(v)
      return normV === normFullName || normV === surname || normFullName.includes(normV)
    })
  })

  // Specific spellings tolerance
  if (!matched) {
    if (normFullName.includes('bortoleto') || normFullName.includes('bortoletto')) {
      matched = DRIVER_PHOTOS.find((p) => p.normalizedKey === 'bortoleto')
    } else if (normFullName.includes('norris') || normFullName.includes('noris')) {
      matched = DRIVER_PHOTOS.find((p) => p.normalizedKey === 'norris')
    } else if (normFullName.includes('russell') || normFullName.includes('russel')) {
      matched = DRIVER_PHOTOS.find((p) => p.normalizedKey === 'russell')
    } else if (normFullName.includes('bottas') || normFullName.includes('botas')) {
      matched = DRIVER_PHOTOS.find((p) => p.normalizedKey === 'bottas')
    } else if (normFullName.includes('lawson') || normFullName.includes('lian')) {
      matched = DRIVER_PHOTOS.find((p) => p.normalizedKey === 'lawson')
    } else if (normFullName.includes('bearman') || normFullName.includes('ollie')) {
      matched = DRIVER_PHOTOS.find((p) => p.normalizedKey === 'bearman')
    } else if (normFullName.includes('hulkenberg') || normFullName.includes('hulken')) {
      matched = DRIVER_PHOTOS.find((p) => p.normalizedKey === 'hulkenberg')
    } else if (normFullName.includes('perez') || normFullName.includes('checo')) {
      matched = DRIVER_PHOTOS.find((p) => p.normalizedKey === 'perez')
    } else if (normFullName.includes('antonelli') || normFullName.includes('kimi')) {
      matched = DRIVER_PHOTOS.find((p) => p.normalizedKey === 'antonelli')
    } else if (normFullName.includes('camara') || normFullName.includes('câmara')) {
      matched = DRIVER_PHOTOS.find((p) => p.normalizedKey === 'camara')
    } else if (normFullName.includes('chastain') || normFullName.includes('ross')) {
      matched = DRIVER_PHOTOS.find((p) => p.normalizedKey === 'chastain')
    } else if (normFullName.includes('beganovic') || normFullName.includes('dino')) {
      matched = DRIVER_PHOTOS.find((p) => p.normalizedKey === 'beganovic')
    }
  }

  const key = matched ? matched.normalizedKey : surname
  // Suporte a caminhos locais canônicos: /pilotos/{key}.png ou /pilotos/{filename}
  const localCandidates = [
    matched?.bundledImg,
    // Formato canônico numerado com filename registrado
    matched?.filename ? `/pilotos/${matched.filename}` : null,
    // Variação de extensão do filename registrado (.jpg <-> .png <-> .webp)
    matched?.filename && matched.filename.endsWith('.png')
      ? `/pilotos/${matched.filename.replace('.png', '.jpg')}`
      : null,
    matched?.filename && matched.filename.endsWith('.jpg')
      ? `/pilotos/${matched.filename.replace('.jpg', '.png')}`
      : null,
    matched?.filename
      ? `/pilotos/${matched.filename.replace(/\.(png|jpg|jpeg)$/i, '.webp')}`
      : null,
    // Formato com nome completo e underscore
    normFullName ? `/pilotos/${normFullName.replace(/\s+/g, '_')}.png` : null,
    normFullName ? `/pilotos/${normFullName.replace(/\s+/g, '_')}.jpg` : null,
    normFullName ? `/pilotos/${normFullName.replace(/\s+/g, '_')}.webp` : null,
    // Formato com chave de sobrenome
    `/pilotos/${key}.png`,
    `/pilotos/${key}.jpg`,
    `/pilotos/${key}.webp`,
    // Formato com chave de sobrenome maiúsculo/capitalizado
    `/pilotos/${key.charAt(0).toUpperCase() + key.slice(1)}.png`,
    `/pilotos/${key.charAt(0).toUpperCase() + key.slice(1)}.jpg`,
    // Variações com nomes originais de pôster e extensões
    key === 'colapinto' ? '/pilotos/43-Franco_Colapinto.png' : null,
    key === 'colapinto' ? '/pilotos/43-Franco_Colapinto.jpg' : null,
    key === 'colapinto' ? '/pilotos/43-Franco_Colapinto-5ea8a.jpg' : null,
    key === 'colapinto' ? '/pilotos/43-Franco_Colapinto-5ea8a.png' : null,
    key === 'lindblad' ? '/pilotos/30-Arvid_Lindblad.jpg' : null,
    key === 'lindblad' ? '/pilotos/30-Arvid_Lindblad.png' : null,
    key === 'lindblad' ? '/pilotos/31-Arvid_Lindblad.png' : null,
    key === 'lindblad' ? '/pilotos/31-Arvid_Lindblad.jpg' : null,
    key === 'bottas' ? '/pilotos/77-Walteri_Botas.jpg' : null,
    key === 'bottas' ? '/pilotos/77-Walteri_Botas.png' : null,
    key === 'bottas' ? '/pilotos/77-Valtteri_Bottas.jpg' : null,
    key === 'bottas' ? '/pilotos/77-Valtteri_Bottas.png' : null,
    key === 'chastain' ? '/pilotos/1-Ross_Chastain.jpg' : null,
    key === 'chastain' ? '/pilotos/1-Ross_Chastain.png' : null,
    key === 'chastain' ? '/pilotos/1-Ross_Chastain-91a77.jpg' : null,
    key === 'chastain' ? '/pilotos/ross_chastain.jpg' : null,
    key === 'chastain' ? '/pilotos/ross_chastain.png' : null,
    key === 'beganovic' ? '/pilotos/1-Dino_Beganovic.jpg' : null,
    key === 'beganovic' ? '/pilotos/1-Dino_Beganovic.png' : null,
    key === 'beganovic' ? '/pilotos/1-Dino_Beganovic-83aea.jpg' : null,
    key === 'beganovic' ? '/pilotos/dino_beganovic.jpg' : null,
    key === 'beganovic' ? '/pilotos/dino_beganovic.png' : null,
    key === 'camara' ? '/pilotos/1-Rafael_Camara.png' : null,
    key === 'camara' ? '/pilotos/1-Rafael_Camara.jpg' : null,
    key === 'camara' ? '/pilotos/1-Rafael_Camara-b1a66.png' : null,
    key === 'camara' ? '/pilotos/rafael_camara.png' : null,
    key === 'camara' ? '/pilotos/rafael_camara.jpg' : null,
    // Variações de Bortoleto se aplicável
    key === 'bortoleto' ? '/pilotos/5-Gabriel_Bortoleto.png' : null,
    key === 'bortoleto' ? '/pilotos/5-Gabriel_Bortoleto.jpg' : null,
    key === 'bortoleto' ? '/pilotos/05-Gabriel_Bortoleto.png' : null,
    key === 'bortoleto' ? '/pilotos/gabriel_bortoleto.png' : null,
    key === 'bortoleto' ? '/pilotos/bortoleto.png' : null,
    key === 'bortoleto' ? '/pilotos/bortoletto.png' : null,
  ].filter(Boolean) as string[]

  return {
    localPath: `/pilotos/${key}.png`,
    localCandidates,
    filename: matched?.filename,
    normalizedKey: key,
    bundledImg: matched?.bundledImg,
    dropboxUrl: matched?.dropboxUrl,
    fallbackLocal: GENERIC_DRIVER_PHOTO,
    fallbackDropbox: GENERIC_DRIVER_DROPBOX_URL,
  }
}
