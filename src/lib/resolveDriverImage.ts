/**
 * Resolver canônico para imagens de pilotos geradas/fictícias.
 *
 * Regras:
 * - Pilotos reais da temporada 2026: retorna null (usam o avatar/iniciais padrão atual).
 * - Pilotos fictícios ou novos gerados pelo jogador: mapeia deterministicamente
 *   para uma das 39 imagens em /pilotos-gerados/Piloto_XX.jpg usando hash estável do ID.
 */

// Lista de IDs conhecidos de pilotos reais da temporada 2026
// Pilotos fictícios da base usam IDs gerados ou têm flag isReal === false / isGenerated === true
export interface ResolvableDriver {
  id?: string
  code?: string
  name?: string
  firstName?: string
  lastName?: string
  isReal?: boolean
  isGenerated?: boolean
  isCustom?: boolean
  isFictional?: boolean
  avatarUrl?: string
  image?: string
  photoUrl?: string
}

const TOTAL_GENERATED_IMAGES = 39

// Algoritmo de hash determinístico (FNV-1a 32 bits) para estabilidade estrita
export function hashDriverId(id: string): number {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

/**
 * Retorna o índice de 1 a 39 de forma determinística a partir de um ID de piloto.
 */
export function getGeneratedDriverImageIndex(driverId: string): number {
  if (!driverId) return 1
  const hash = hashDriverId(driverId)
  return (hash % TOTAL_GENERATED_IMAGES) + 1
}

/**
 * Retorna o caminho público da imagem gerada para o índice fornecido.
 * Formato: /pilotos-gerados/Piloto_01.jpg até Piloto_39.jpg
 */
export function getGeneratedDriverImagePath(index: number): string {
  const safeIndex = Math.max(1, Math.min(TOTAL_GENERATED_IMAGES, index))
  const paddedIndex = String(safeIndex).padStart(2, '0')
  return `/pilotos-gerados/Piloto_${paddedIndex}.jpg`
}

/**
 * Verifica se um piloto é real ou fictício/gerado.
 * Retorna true se for piloto fictício / novo gerado pelo jogador.
 */
export function isFictionalOrGeneratedDriver(driver?: ResolvableDriver | null): boolean {
  if (!driver) return false

  // Se tem flag explícita
  if (driver.isReal === false) return true
  if (driver.isGenerated === true) return true
  if (driver.isCustom === true) return true
  if (driver.isFictional === true) return true

  return false
}

/**
 * Resolver canônico: dado um piloto, retorna a URL da imagem gerada correspondente,
 * ou null se for um piloto real ou sem identificador.
 */
export function resolveDriverImage(driver?: ResolvableDriver | null): string | null {
  if (!driver) return null

  // Se já tiver uma URL de foto personalizada definida que não seja vazia
  // mas seja explicitamente externa ou custom
  if (!isFictionalOrGeneratedDriver(driver)) {
    return null
  }

  const id = driver.id || driver.code || driver.name || ''
  if (!id) return null

  const index = getGeneratedDriverImageIndex(id)
  return getGeneratedDriverImagePath(index)
}
