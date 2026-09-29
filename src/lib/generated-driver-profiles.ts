/**
 * generated-driver-profiles.ts
 *
 * Catálogo e resolvedor de retratos para pilotos procedurais / newgens (Piloto_01..Piloto_53).
 * Uso EXCLUSIVO para pilotos procedurais/newgens — NUNCA para pilotos reais.
 *
 * Gêneros canônicos verificados:
 * - 01..13:
 *   - FEMININOS (7): Piloto_03, 04, 05, 07, 09, 11, 13
 *   - MASCULINOS (6): Piloto_01, 02, 06, 08, 10, 12
 * - 14..53:
 *   - MASCULINOS (16): Piloto_14, 17, 19, 20, 21, 23, 28, 30, 31, 33, 35, 37, 39, 42, 46, 49
 *   - FEMININOS (23): Piloto_16, 18, 22, 24, 25, 26, 27, 29, 32, 34, 36, 38, 40, 41, 43, 44, 45, 47, 48, 50, 51, 52, 53
 * - Total (53): 23 masculinos e 30 femininos.
 */

export interface GeneratedDriverPortraitProfile {
  profileId: string // ex: 'GEN_01', 'GEN_02'...
  fileName: string // ex: 'Piloto_01.jpg'
  gender: 'female' | 'male'
  sourceType: 'generated_seed_profile'
  path: string // ex: '/pilotos-gerados/Piloto_01.jpg'
  index: number // 1..53
}

/**
 * Fonte única de verdade para os índices masculinos do catálogo gerado (1..53).
 *
 * Piloto_01..13 (intactos):
 * - Masculinos (6): 1, 2, 6, 8, 10, 12
 * - Femininos (7): 3, 4, 5, 7, 9, 11, 13
 *
 * Piloto_14..53 (homologado pelo usuário):
 * - Masculinos (16): 14, 17, 19, 20, 21, 23, 28, 30, 31, 33, 35, 37, 39, 42, 46, 49
 * - Femininos (23): 16, 18, 22, 24, 25, 26, 27, 29, 32, 34, 36, 38, 40, 41, 43, 44, 45, 47, 48, 50, 51, 52, 53
 *
 * Total geral (1..53): 23 masculinos e 30 femininos.
 */
export const GENERATED_DRIVER_MALE_INDICES = new Set<number>([
  // 01..13
  1, 2, 6, 8, 10, 12,
  // 14..53
  14, 17, 19, 20, 21, 23, 28, 30, 31, 33, 35, 37, 39, 42, 46, 49,
])

export const TOTAL_GENERATED_DRIVER_PROFILES = 53

export const GENERATED_DRIVER_PORTRAIT_PROFILES: GeneratedDriverPortraitProfile[] = Array.from(
  { length: TOTAL_GENERATED_DRIVER_PROFILES },
  (_, i) => {
    const index = i + 1
    const pad = String(index).padStart(2, '0')
    const gender: 'female' | 'male' = GENERATED_DRIVER_MALE_INDICES.has(index) ? 'male' : 'female'
    return {
      profileId: `GEN_${pad}`,
      fileName: `Piloto_${pad}.jpg`,
      gender,
      sourceType: 'generated_seed_profile' as const,
      path: `/pilotos-gerados/Piloto_${pad}.jpg`,
      index,
    }
  },
)

export const generatedDriverPortraitProfiles = GENERATED_DRIVER_PORTRAIT_PROFILES

/**
 * Busca perfil por profileId ou nome do arquivo
 */
export function getGeneratedDriverPortraitProfile(
  idOrFileName?: string | null,
): GeneratedDriverPortraitProfile | null {
  if (!idOrFileName) return null
  const cleaned = idOrFileName.trim()
  return (
    GENERATED_DRIVER_PORTRAIT_PROFILES.find(
      (p) =>
        p.profileId.toLowerCase() === cleaned.toLowerCase() ||
        p.fileName.toLowerCase() === cleaned.toLowerCase() ||
        p.fileName.toLowerCase().replace(/\.jpg$/i, '') === cleaned.toLowerCase(),
    ) || null
  )
}

/**
 * Alocação determinística de perfil de retrato para novos pilotos procedurais/newgens.
 * - Respeita o gênero especificado.
 * - Prioriza perfis ainda não alocados no save atual (allocatedProfileIds).
 * - Quando todas as sementes do mesmo gênero estiverem ocupadas, reutiliza de forma controlada
 *   usando o seed determinístico (evitando loop infinito).
 * - Retorna o profile completo cuja profileId deve ser persistida como `generatedPortraitProfileId`.
 */
export function allocateGeneratedPortraitProfile(
  gender: 'female' | 'male',
  seed: number,
  allocatedProfileIds: string[] = [],
): GeneratedDriverPortraitProfile {
  const matchingGender = GENERATED_DRIVER_PORTRAIT_PROFILES.filter((p) => p.gender === gender)
  const pool = matchingGender.length > 0 ? matchingGender : GENERATED_DRIVER_PORTRAIT_PROFILES

  const allocatedSet = new Set(allocatedProfileIds.map((id) => id.toLowerCase().trim()))

  // 1. Filtrar perfis livres do mesmo gênero
  const freeProfiles = pool.filter(
    (p) =>
      !allocatedSet.has(p.profileId.toLowerCase()) && !allocatedSet.has(p.fileName.toLowerCase()),
  )

  const effectivePool = freeProfiles.length > 0 ? freeProfiles : pool
  const safeSeed = Math.abs(Math.floor(seed)) || 0
  const chosenIndex = safeSeed % effectivePool.length

  return effectivePool[chosenIndex]
}
