/**
 * resolve-driver-image.ts
 *
 * Canonical resolver for driver portraits / images (PILOTOS-IMAGENS-GERADAS).
 *
 * Requirements:
 * 1. Fictional drivers (invented names from database, procedural/newgen) and custom
 *    drivers created by player use generated images from public/pilotos-gerados/ (Piloto_01..Piloto_39.jpg).
 * 2. Real drivers from 2026 season (Verstappen, Norris, etc.) remain untouched (no generated photo assigned).
 * 3. Stable deterministic mapping derived from persisted ID (hash-based, cyclic index over 39 images).
 *    Never random, never array index.
 * 4. Fallback: if image is missing or fails to load, fallback initials/avatar standard.
 */

export const GENERATED_DRIVER_IMAGES_COUNT = 39

export const GENERATED_DRIVER_IMAGE_FILES: string[] = Array.from(
  { length: GENERATED_DRIVER_IMAGES_COUNT },
  (_, i) => `/pilotos-gerados/Piloto_${String(i + 1).padStart(2, '0')}.jpg`,
)

/**
 * Computes a deterministic non-negative 32-bit integer hash from a string.
 */
export function hashDriverId(id: string): number {
  let hash = 0
  if (!id || id.length === 0) return hash
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Resolves the generated image URL for a given stable driver ID.
 * Returns /pilotos-gerados/Piloto_XX.jpg based on hashDriverId(id) % 39.
 */
export function getGeneratedDriverImageUrl(driverId: string): string {
  if (!driverId) return GENERATED_DRIVER_IMAGE_FILES[0]
  const hash = hashDriverId(driverId)
  const index = hash % GENERATED_DRIVER_IMAGES_COUNT
  return GENERATED_DRIVER_IMAGE_FILES[index]
}
