/**
 * Manifest Canônico de Assets de Pilotos (Driver Assets)
 *
 * Arquitetura de Migração:
 * 1. Prioriza asset local (/assets/drivers/<filename> ou bundle local)
 * 2. Fallback transitório nas 77 fotos de CDN do drive-storage-photos
 * 3. Fallback limpo sem quebra de imagem
 */

import { getDriveStoragePhotoUrl } from '@/lib/drive-storage-photos'

export interface DriverAssetDefinition {
  id: string
  name: string
  normalizedKey: string
  localFileName?: string
  localPath?: string
  fallbackDriveKey?: string
  aliases: string[]
}

export const DRIVER_ASSET_MANIFEST: Record<string, DriverAssetDefinition> = {
  bortoleto: {
    id: 'gabriel_bortoleto',
    name: 'Gabriel Bortoleto',
    normalizedKey: 'bortoleto',
    localFileName: '05-Gabriel_Bortoleto.jpg',
    localPath: '/assets/drivers/05-Gabriel_Bortoleto.jpg',
    fallbackDriveKey: '05-Gabriel_Bortoleto.jpg',
    aliases: ['bortoleto', 'gabriel bortoleto', 'g. bortoleto'],
  },
  ricciardo: {
    id: 'daniel_ricciardo',
    name: 'Daniel Ricciardo',
    normalizedKey: 'ricciardo',
    localFileName: '3-Daniel_Ricciardo.png',
    localPath: '/assets/drivers/3-Daniel_Ricciardo.png',
    fallbackDriveKey: '3-Daniel_Ricciardo.png',
    aliases: ['ricciardo', 'daniel ricciardo', 'd. ricciardo'],
  },
  camara: {
    id: 'rafael_camara',
    name: 'Rafael Câmara',
    normalizedKey: 'camara',
    localFileName: '1-Rafael_Camara.jpg',
    localPath: '/assets/drivers/1-Rafael_Camara.jpg',
    fallbackDriveKey: '1-Rafael_Camara.jpg',
    aliases: ['camara', 'rafael camara', 'rafael câmara', 'r. camara'],
  },
  verstappen: {
    id: 'max_verstappen',
    name: 'Max Verstappen',
    normalizedKey: 'verstappen',
    localFileName: '3-Max_Verstappen.jpg',
    localPath: '/assets/drivers/3-Max_Verstappen.jpg',
    fallbackDriveKey: '3-Max_Verstappen.jpg',
    aliases: ['verstappen', 'max verstappen', 'm. verstappen'],
  },
  hamilton: {
    id: 'lewis_hamilton',
    name: 'Lewis Hamilton',
    normalizedKey: 'hamilton',
    localFileName: '44-Lewis_Hamilton.jpg',
    localPath: '/assets/drivers/44-Lewis_Hamilton.jpg',
    fallbackDriveKey: '44-Lewis_Hamilton.jpg',
    aliases: ['hamilton', 'lewis hamilton', 'l. hamilton'],
  },
  leclerc: {
    id: 'charles_leclerc',
    name: 'Charles Leclerc',
    normalizedKey: 'leclerc',
    localFileName: '16-Charles_Leclerc.jpg',
    localPath: '/assets/drivers/16-Charles_Leclerc.jpg',
    fallbackDriveKey: '16-Charles_Leclerc.jpg',
    aliases: ['leclerc', 'charles leclerc', 'c. leclerc'],
  },
  norris: {
    id: 'lando_norris',
    name: 'Lando Norris',
    normalizedKey: 'norris',
    localFileName: '4-Lando_Noris.jpg',
    localPath: '/assets/drivers/4-Lando_Noris.jpg',
    fallbackDriveKey: '4-Lando_Noris.jpg',
    aliases: ['norris', 'lando norris', 'noris', 'lando noris'],
  },
  piastri: {
    id: 'oscar_piastri',
    name: 'Oscar Piastri',
    normalizedKey: 'piastri',
    localFileName: '81-Oscar_Piastri.jpg',
    localPath: '/assets/drivers/81-Oscar_Piastri.jpg',
    fallbackDriveKey: '81-Oscar_Piastri.jpg',
    aliases: ['piastri', 'oscar piastri', 'o. piastri'],
  },
  russell: {
    id: 'george_russell',
    name: 'George Russell',
    normalizedKey: 'russell',
    localFileName: '63-George_Russel.jpg',
    localPath: '/assets/drivers/63-George_Russel.jpg',
    fallbackDriveKey: '63-George_Russel.jpg',
    aliases: ['russell', 'george russell', 'russel', 'george russel'],
  },
  sainz: {
    id: 'carlos_sainz',
    name: 'Carlos Sainz',
    normalizedKey: 'sainz',
    localFileName: '55-Carlos_Sainz.jpg',
    localPath: '/assets/drivers/55-Carlos_Sainz.jpg',
    fallbackDriveKey: '55-Carlos_Sainz.jpg',
    aliases: ['sainz', 'carlos sainz', 'c. sainz'],
  },
  alonso: {
    id: 'fernando_alonso',
    name: 'Fernando Alonso',
    normalizedKey: 'alonso',
    localFileName: '14-Fernando_Alonso.jpg',
    localPath: '/assets/drivers/14-Fernando_Alonso.jpg',
    fallbackDriveKey: '14-Fernando_Alonso.jpg',
    aliases: ['alonso', 'fernando alonso', 'f. alonso'],
  },
  palmowski: {
    id: 'alisha_palmowski',
    name: 'Alisha Palmowski',
    normalizedKey: 'palmowski',
    localFileName: 'Alisha_Palmowski.jpg',
    localPath: '/assets/drivers/Alisha_Palmowski.jpg',
    fallbackDriveKey: 'Alisha_Palmowski.jpg',
    aliases: ['palmowski', 'alisha palmowski', 'a. palmowski'],
  },
}

/**
 * Normaliza o identificador ou nome do piloto para busca no manifest
 */
export function normalizeDriverKey(driverIdOrName: string | null | undefined): string {
  if (!driverIdOrName) return ''
  const clean = driverIdOrName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  for (const [key, item] of Object.entries(DRIVER_ASSET_MANIFEST)) {
    if (key === clean || item.id === clean) return key
    if (item.aliases.some((alias) => clean.includes(alias) || alias === clean)) {
      return key
    }
  }

  // Tenta extrair último sobrenome se formato composto
  const parts = clean.split(/\s+/)
  const lastName = parts[parts.length - 1]
  if (DRIVER_ASSET_MANIFEST[lastName]) {
    return lastName
  }

  return clean
}

/**
 * Retorna URL de imagem do piloto priorizando caminho local e caindo em CDN / fallback limpo
 */
export function getDriverPhoto(driverIdOrName: string | null | undefined): string | null {
  return getDriverImage(driverIdOrName)
}

export function getDriverImage(driverIdOrName: string | null | undefined): string | null {
  if (!driverIdOrName) return null
  const key = normalizeDriverKey(driverIdOrName)
  const asset = DRIVER_ASSET_MANIFEST[key]

  if (asset) {
    if (asset.localPath) return asset.localPath
    if (asset.fallbackDriveKey) {
      const driveUrl = getDriveStoragePhotoUrl(asset.fallbackDriveKey)
      if (driveUrl) return driveUrl
    }
  }

  // Fallback transitório no storage de fotos
  const driveFallback = getDriveStoragePhotoUrl(driverIdOrName)
  if (driveFallback) return driveFallback

  return null
}
