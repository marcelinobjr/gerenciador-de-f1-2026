/**
 * generated-driver-profiles.ts
 *
 * Catálogo e resolvedor de retratos para pilotos procedurais / newgens (Piloto_01..Piloto_13).
 * Uso EXCLUSIVO para pilotos procedurais/newgens — NUNCA para pilotos reais.
 *
 * Gêneros canônicos verificados:
 * - FEMININOS: Piloto_03, 04, 05, 07, 09, 11, 13
 * - MASCULINOS: Piloto_01, 02, 06, 08, 10, 12
 */

export interface GeneratedDriverPortraitProfile {
  profileId: string // ex: 'GEN_01', 'GEN_02'...
  fileName: string // ex: 'Piloto_01.jpg'
  gender: 'female' | 'male'
  sourceType: 'generated_seed_profile'
  path: string // ex: '/pilotos-gerados/Piloto_01.jpg'
  index: number // 1..13
}

export const GENERATED_DRIVER_PORTRAIT_PROFILES: GeneratedDriverPortraitProfile[] = [
  {
    profileId: 'GEN_01',
    fileName: 'Piloto_01.jpg',
    gender: 'male',
    sourceType: 'generated_seed_profile',
    path: '/pilotos-gerados/Piloto_01.jpg',
    index: 1,
  },
  {
    profileId: 'GEN_02',
    fileName: 'Piloto_02.jpg',
    gender: 'male',
    sourceType: 'generated_seed_profile',
    path: '/pilotos-gerados/Piloto_02.jpg',
    index: 2,
  },
  {
    profileId: 'GEN_03',
    fileName: 'Piloto_03.jpg',
    gender: 'female',
    sourceType: 'generated_seed_profile',
    path: '/pilotos-gerados/Piloto_03.jpg',
    index: 3,
  },
  {
    profileId: 'GEN_04',
    fileName: 'Piloto_04.jpg',
    gender: 'female',
    sourceType: 'generated_seed_profile',
    path: '/pilotos-gerados/Piloto_04.jpg',
    index: 4,
  },
  {
    profileId: 'GEN_05',
    fileName: 'Piloto_05.jpg',
    gender: 'female',
    sourceType: 'generated_seed_profile',
    path: '/pilotos-gerados/Piloto_05.jpg',
    index: 5,
  },
  {
    profileId: 'GEN_06',
    fileName: 'Piloto_06.jpg',
    gender: 'male',
    sourceType: 'generated_seed_profile',
    path: '/pilotos-gerados/Piloto_06.jpg',
    index: 6,
  },
  {
    profileId: 'GEN_07',
    fileName: 'Piloto_07.jpg',
    gender: 'female',
    sourceType: 'generated_seed_profile',
    path: '/pilotos-gerados/Piloto_07.jpg',
    index: 7,
  },
  {
    profileId: 'GEN_08',
    fileName: 'Piloto_08.jpg',
    gender: 'male',
    sourceType: 'generated_seed_profile',
    path: '/pilotos-gerados/Piloto_08.jpg',
    index: 8,
  },
  {
    profileId: 'GEN_09',
    fileName: 'Piloto_09.jpg',
    gender: 'female',
    sourceType: 'generated_seed_profile',
    path: '/pilotos-gerados/Piloto_09.jpg',
    index: 9,
  },
  {
    profileId: 'GEN_10',
    fileName: 'Piloto_10.jpg',
    gender: 'male',
    sourceType: 'generated_seed_profile',
    path: '/pilotos-gerados/Piloto_10.jpg',
    index: 10,
  },
  {
    profileId: 'GEN_11',
    fileName: 'Piloto_11.jpg',
    gender: 'female',
    sourceType: 'generated_seed_profile',
    path: '/pilotos-gerados/Piloto_11.jpg',
    index: 11,
  },
  {
    profileId: 'GEN_12',
    fileName: 'Piloto_12.jpg',
    gender: 'male',
    sourceType: 'generated_seed_profile',
    path: '/pilotos-gerados/Piloto_12.jpg',
    index: 12,
  },
  {
    profileId: 'GEN_13',
    fileName: 'Piloto_13.jpg',
    gender: 'female',
    sourceType: 'generated_seed_profile',
    path: '/pilotos-gerados/Piloto_13.jpg',
    index: 13,
  },
]

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
