/**
 * Mapas e helpers para carregamento seguro de pôsteres/fotos locais dos pilotos MBJ 2026.
 * As fotos podem residir em public/pilotos/ (.png, .jpg, .webp) ou nos assets integrados.
 * Suporta resolução canônica com número (ex: "3-Max_Verstappen.png", "16-Charles_Leclerc.png",
 * "11-Sergio_Pérez.png", "5-Gabriel_Bortoleto.png", "77-Walteri_Botas.jpg").
 */
import { getDriverPhotoSources, normalizeSurname } from '@/lib/driver-photos'
import { getDriveStoragePhotoUrl, DRIVE_STORAGE_PHOTOS } from '@/lib/drive-storage-photos'
import { driverVisualAssetService } from '@/services/driverVisualAssetService'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { DriverVisualAssetIdentity } from '@/types/procedural-driver'

export function normalizeDriverSurname(fullName: string): string {
  if (!fullName) return ''
  const parts = fullName.trim().toLowerCase().split(/\s+/)
  return parts[parts.length - 1].normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Mapeamento direto de nome canônico para arquivo em /pilotos/
 * Cobre nomes com numeração oficial e variações .png / .jpg / .webp
 */
const PILOT_FILE_MAP: Record<string, string[]> = {
  verstappen: ['3-Max_Verstappen.png', '3-Max_Verstappen.jpg'],
  ricciardo: ['3-Daniel_Ricciardo.png', '3-Daniel_Ricciardo.jpg'],
  norris: ['4-Lando_Noris.png', '4-Lando_Norris.png', '4-Lando_Noris.jpg', '4-Lando_Norris.jpg'],
  bortoleto: [
    '5-Gabriel_Bortoleto.png',
    '5-Gabriel_Bortoleto.jpg',
    '05-Gabriel_Bortoleto.png',
    '05-Gabriel_Bortoleto.jpg',
  ],
  hadjar: ['6-Isack_Hadjar.png', '6-Isack_Hadjar.jpg'],
  tsolov: ['6-Nicola_Tsolov.png', '6-Nicola_Tsolov.jpg'],
  doohan: ['7-Jack_Doohan.png', '7-Jack_Doohan.jpg'],
  mini: ['9-Gabriel_Mini.png', '9-Gabriel_Mini.jpg'],
  gasly: ['10-Pierre_Gasly.png', '10-Pierre_Gasly.jpg'],
  perez: [
    '11-Sergio_Pérez.png',
    '11-Sergio_Pérez.jpg',
    '11-Sergio_Perez.png',
    '11-Sergio_Perez.jpg',
  ],
  antonelli: ['12-Kimi_Antonelli.png', '12-Kimi_Antonelli.jpg'],
  alonso: ['14-Fernando_Alonso.png', '14-Fernando_Alonso.jpg'],
  leclerc: ['16-Charles_Leclerc.png', '16-Charles_Leclerc.jpg'],
  stroll: ['18-Lance_Stroll.png', '18-Lance_Stroll.jpg'],
  tsunoda: ['22-Yuki_Tsunoda.png', '22-Yuki_Tsunoda.jpg'],
  albon: [
    '23-Alex_Albon.png',
    '23-Alex_Albon.jpg',
    '23-Alexander_Albon.png',
    '23-Alexander_Albon.jpg',
  ],
  herta: ['26-Colton_Herta.png', '26-Colton_Herta.jpg'],
  hulkenberg: [
    '27-Nuco_Hulkemberg.jpg',
    '27-Nico_Hulkenberg.png',
    '27-Nico_Hulkenberg.jpg',
    '27-Nico_Hülkenberg.png',
    '27-Nico_Hülkenberg.jpg',
  ],
  lawson: ['30-Lian_Lawson.png', '30-Lian_Lawson.jpg', '30-Liam_Lawson.png', '30-Liam_Lawson.jpg'],
  lindblad: [
    '30-Arvid_Lindblad.jpg',
    '30-Arvid_Lindblad.png',
    '31-Arvid_Lindblad.png',
    '31-Arvid_Lindblad.jpg',
  ],
  ocon: ['31-Esteban_Ocon.png', '31-Esteban_Ocon.jpg'],
  drugovich: ['34-Felipe_Drugovich.png', '34-Felipe_Drugovich.jpg'],
  colapinto: [
    '43-Franco_Colapinto.png',
    '43-Franco_Colapinto.jpg',
    '43-Franco_Colapinto-5ea8a.jpg',
    '43-Franco_Colapinto-5ea8a.png',
  ],
  hamilton: ['44-Lewis_Hamilton.png', '44-Lewis_Hamilton.jpg'],
  fittipaldi: ['51-Pietro_Fittipaldi.png', '51-Pietro_Fittipaldi.jpg'],
  sainz: ['55-Carlos_Sainz.png', '55-Carlos_Sainz.jpg'],
  russell: [
    '63-George_Russel.png',
    '63-George_Russel.jpg',
    '63-George_Russell.png',
    '63-George_Russell.jpg',
  ],
  bottas: [
    '77-Walteri_Botas.jpg',
    '77-Walteri_Botas.png',
    '77-Valtteri_Bottas.jpg',
    '77-Valtteri_Bottas.png',
    '77-Walteri_Botas-77a8b.jpg',
  ],
  piastri: ['81-Oscar_Piastri.png', '81-Oscar_Piastri.jpg'],
  bearman: [
    '87-Olivier_Bearman.png',
    '87-Olivier_Bearman.jpg',
    '87-Oliver_Bearman.png',
    '87-Oliver_Bearman.jpg',
  ],
  camara: [
    '1-Rafael_Camara.png',
    '1-Rafael_Camara.jpg',
    '1-Rafael_Camara-b1a66.png',
    '1-Rafael_Câmara.png',
  ],
  beganovic: ['1-Dino_Beganovic.jpg', '1-Dino_Beganovic.png', '1-Dino_Beganovic-83aea.jpg'],
  chastain: ['1-Ross_Chastain.jpg', '1-Ross_Chastain.png', '1-Ross_Chastain-91a77.jpg'],
}

/**
 * Retorna uma lista de URLs candidatas locais para o pôster do piloto.
 * Prioriza arquivos locais em /pilotos/ com nomes canônicos numerados (.png / .jpg / .webp),
 * eliminando a dependência do Dropbox como fonte primária.
 */
export function getLocalDriverPosterCandidates(
  name: string,
  driverId?: string,
  visualIdentity?: DriverVisualAssetIdentity | null,
): string[] {
  const candidates: string[] = []

  const addCandidate = (url?: string | null) => {
    if (url && !candidates.includes(url)) {
      candidates.push(url)
    }
  }

  // (0) Resolvedor Canônico Central DRV-DATA-02
  const canonical = resolveDriverPhoto({
    driverId,
    name,
    visualIdentity,
    portraitAssetId: visualIdentity?.portraitAssetId,
  })
  if (canonical.url) {
    addCandidate(canonical.url)
  }
  for (const c of canonical.candidateUrls) {
    addCandidate(c)
  }

  // (i) Imagem personalizada do jogador (isCustom)
  if (visualIdentity?.isCustom && visualIdentity.customImageUrl) {
    addCandidate(visualIdentity.customImageUrl)
  }

  // (ii) portraitAssetId persistido resolvido via driverVisualAssetService.resolveVisualUrls / getFictionalPortraitById
  if (visualIdentity?.portraitAssetId) {
    const resolved = driverVisualAssetService.resolveVisualUrls(visualIdentity)
    if (resolved.displayUrl) {
      addCandidate(resolved.displayUrl)
    }
    if (resolved.thumbnailUrl) {
      addCandidate(resolved.thumbnailUrl)
    }
  }

  // Se já temos URLs do resolvedor canônico ou visualIdentity, usamos estritamente elas
  // Zero pôsteres gráficos/Drive/Dropbox — só /pilotos/DRV_XXXX.jpg ou pilotos-gerados/
  if (candidates.length > 0) {
    return candidates
  }

  // Fallback seguro se não resolveu pelo canônico (nunca Dropbox/Drive externo)
  if (!name && !driverId) return candidates
  const sources = getDriverPhotoSources(name || '')

  if (sources.bundledImg) {
    addCandidate(sources.bundledImg)
  }

  return candidates
}

/**
 * Retorna a primeira URL provável de pôster para o piloto
 */
export function getLocalDriverPosterUrl(
  name: string,
  driverId?: string,
  visualIdentity?: DriverVisualAssetIdentity | null,
): string | null {
  const candidates = getLocalDriverPosterCandidates(name, driverId, visualIdentity)
  return candidates.length > 0 ? candidates[0] : null
}

export function getInitials(name: string): string {
  if (!name) return 'F1'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Verifica se o piloto possui pôster registrado no projeto ou Google Drive
 */
export function hasDriverPoster(
  name: string,
  driverId?: string,
  visualIdentity?: DriverVisualAssetIdentity | null,
): boolean {
  const candidates = getLocalDriverPosterCandidates(name, driverId, visualIdentity)
  return candidates.length > 0
}
