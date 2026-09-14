/**
 * Mapas e helpers para carregamento seguro de pôsteres/fotos locais dos pilotos MBJ 2026.
 * As fotos podem residir em public/pilotos/ (.png, .jpg, .webp) ou nos assets integrados.
 * Suporta resolução canônica com número (ex: "3-Max_Verstappen.png", "16-Charles_Leclerc.png",
 * "11-Sergio_Pérez.png", "5-Gabriel_Bortoleto.png", "77-Walteri_Botas.jpg").
 */
import { getDriverPhotoSources, normalizeSurname } from '@/lib/driver-photos'

export function normalizeDriverSurname(fullName: string): string {
  if (!fullName) return ''
  const parts = fullName.trim().toLowerCase().split(/\s+/)
  return parts[parts.length - 1].normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Mapeamento direto de nome canônico para arquivo em /pilotos/
 * Cobre nomes com numeração oficial e variações .png / .jpg / .webp
 */
const PILOT_FILE_MAP: Record<string, string> = {
  verstappen: '3-Max_Verstappen.png',
  ricciardo: '3-Daniel_Ricciardo.png',
  norris: '4-Lando_Noris.png',
  bortoleto: '5-Gabriel_Bortoleto.png',
  hadjar: '6-Isack_Hadjar.png',
  tsolov: '6-Nicola_Tsolov.png',
  doohan: '7-Jack_Doohan.png',
  mini: '9-Gabriel_Mini.png',
  gasly: '10-Pierre_Gasly.png',
  perez: '11-Sergio_Pérez.png',
  antonelli: '12-Kimi_Antonelli.png',
  alonso: '14-Fernando_Alonso.png',
  leclerc: '16-Charles_Leclerc.png',
  stroll: '18-Lance_Stroll.png',
  tsunoda: '22-Yuki_Tsunoda.png',
  albon: '23-Alex_Albon.png',
  herta: '26-Colton_Herta.png',
  hulkenberg: '27-Nico_Hulkenberg.png',
  lawson: '30-Lian_Lawson.png',
  lindblad: '31-Arvid_Lindblad.png',
  ocon: '31-Esteban_Ocon.png',
  drugovich: '34-Felipe_Drugovich.png',
  colapinto: '43-Franco_Colapinto.png',
  hamilton: '44-Lewis_Hamilton.png',
  fittipaldi: '51-Pietro_Fittipaldi.png',
  sainz: '55-Carlos_Sainz.png',
  russell: '63-George_Russel.png',
  bottas: '77-Walteri_Botas.jpg',
  piastri: '81-Oscar_Piastri.png',
  bearman: '87-Olivier_Bearman.png',
  camara: '1-Rafael_Camara-b1a66.png',
  beganovic: '1-Dino_Beganovic-83aea.jpg',
  chastain: '1-Ross_Chastain-91a77.jpg',
}

/**
 * Retorna uma lista de URLs candidatas locais para o pôster do piloto,
 * integrando a pipeline driver-photos.ts e variações canônicas de extensão.
 */
export function getLocalDriverPosterCandidates(name: string): string[] {
  if (!name) return []
  const sources = getDriverPhotoSources(name)
  const norm = normalizeSurname(name)
  const surname = normalizeDriverSurname(name)

  const candidates: string[] = []

  // 1. Asset empacotado no bundle se houver
  if (sources.bundledImg) {
    candidates.push(sources.bundledImg)
  }

  // 2. Mapeamento explícito de arquivo canônico numerado
  const mappedFile =
    PILOT_FILE_MAP[surname] || (sources.normalizedKey && PILOT_FILE_MAP[sources.normalizedKey])
  if (mappedFile) {
    candidates.push(`/pilotos/${mappedFile}`)
    // Se for .jpg ou .png tenta a outra extensão também
    if (mappedFile.endsWith('.jpg')) {
      candidates.push(`/pilotos/${mappedFile.replace('.jpg', '.png')}`)
    } else if (mappedFile.endsWith('.png')) {
      candidates.push(`/pilotos/${mappedFile.replace('.png', '.jpg')}`)
    }
  }

  // 3. Dropbox URL direta do piloto como candidato confiável
  if (sources.dropboxUrl) {
    candidates.push(sources.dropboxUrl)
  }

  // 4. Fontes locais de driver-photos
  if (sources.filename) {
    const fn = `/pilotos/${sources.filename}`
    if (!candidates.includes(fn)) candidates.push(fn)
  }

  if (sources.localCandidates) {
    for (const c of sources.localCandidates) {
      if (c && !candidates.includes(c)) candidates.push(c)
    }
  }

  // 5. Formatos padrão com extensões variadas
  const keysToTry = [sources.normalizedKey, surname].filter(Boolean)
  for (const k of keysToTry) {
    for (const ext of ['.png', '.jpg', '.webp']) {
      const p = `/pilotos/${k}${ext}`
      if (!candidates.includes(p)) candidates.push(p)
    }
  }

  // 6. Nome com underscore
  if (norm) {
    const under = norm.replace(/\s+/g, '_')
    for (const ext of ['.png', '.jpg', '.webp']) {
      const p = `/pilotos/${under}${ext}`
      if (!candidates.includes(p)) candidates.push(p)
    }
  }
  // 7. Fallback para Dropbox genérico antes de desistir totalmente
  if (sources.fallbackDropbox && !candidates.includes(sources.fallbackDropbox)) {
    candidates.push(sources.fallbackDropbox)
  }

  return candidates
}

/**
 * Retorna a primeira URL provável de pôster para o piloto
 */
export function getLocalDriverPosterUrl(name: string): string | null {
  const candidates = getLocalDriverPosterCandidates(name)
  return candidates.length > 0 ? candidates[0] : null
}

export function getInitials(name: string): string {
  if (!name) return 'F1'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
