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
  // 54..64 (Piloto_58 é Noah Taylor, masculino)
  58,
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
 * Perfis adicionais específicos de retratos femininos (GDP-01: Piloto_65, Piloto_66, Piloto_67).
 * Uso exclusivo para perfis femininos gerados — NUNCA atribuídos a pilotos masculinos.
 */
export const ADDITIONAL_FEMALE_GENERATED_INDICES = [65, 66, 67] as const

export const ADDITIONAL_FEMALE_GENERATED_PORTRAITS: GeneratedDriverPortraitProfile[] =
  ADDITIONAL_FEMALE_GENERATED_INDICES.map((index) => {
    const pad = String(index).padStart(2, '0')
    return {
      profileId: `GEN_${pad}`,
      fileName: `Piloto_${pad}.jpg`,
      gender: 'female' as const,
      sourceType: 'generated_seed_profile' as const,
      path: `/pilotos-gerados/Piloto_${pad}.jpg`,
      index,
    }
  })

/**
 * Pool completo de retratos gerados para pilotos FEMININOS.
 * Inclui os 30 femininos do catálogo base (Piloto_01..Piloto_53) mais Piloto_65, 66 e 67.
 * Total: 33 retratos femininos.
 */
export const ALL_FEMALE_GENERATED_PORTRAITS: readonly GeneratedDriverPortraitProfile[] = [
  ...GENERATED_DRIVER_PORTRAIT_PROFILES.filter((p) => p.gender === 'female'),
  ...ADDITIONAL_FEMALE_GENERATED_PORTRAITS,
]

/**
 * Pool completo de retratos gerados para pilotos MASCULINOS.
 * Exatamente os 23 masculinos do catálogo base (Piloto_01..Piloto_53).
 * NENHUM retrato de 65, 66 ou 67 é incluído aqui.
 */
export const ALL_MALE_GENERATED_PORTRAITS: readonly GeneratedDriverPortraitProfile[] =
  GENERATED_DRIVER_PORTRAIT_PROFILES.filter((p) => p.gender === 'male')

/**
 * Catálogo consolidado de lookup (base 53 + novos perfis adicionais femininos 65..67).
 */
export const ALL_KNOWN_GENERATED_PORTRAITS: readonly GeneratedDriverPortraitProfile[] = [
  ...GENERATED_DRIVER_PORTRAIT_PROFILES,
  ...ADDITIONAL_FEMALE_GENERATED_PORTRAITS,
]

/**
 * Busca perfil por profileId ou nome do arquivo
 */
export function getGeneratedDriverPortraitProfile(
  idOrFileName?: string | null,
): GeneratedDriverPortraitProfile | null {
  if (!idOrFileName) return null
  const cleaned = idOrFileName.trim()
  return (
    ALL_KNOWN_GENERATED_PORTRAITS.find(
      (p) =>
        p.profileId.toLowerCase() === cleaned.toLowerCase() ||
        p.fileName.toLowerCase() === cleaned.toLowerCase() ||
        p.fileName.toLowerCase().replace(/\.jpg$/i, '') === cleaned.toLowerCase(),
    ) || null
  )
}

/**
 * Alocação determinística de perfil de retrato para novos pilotos procedurais/newgens.
 * - Respeita o gênero especificado:
 *   - 'female': usa ALL_FEMALE_GENERATED_PORTRAITS (30 base + Piloto_65, 66, 67 = 33 retratos).
 *   - 'male': usa ALL_MALE_GENERATED_PORTRAITS (23 perfis estritamente masculinos).
 * - Prioriza perfis ainda não alocados no save atual (allocatedProfileIds).
 * - Quando todas as sementes do mesmo gênero estiverem ocupadas, reutiliza de forma controlada
 *   usando o seed determinístico (estável, previsível, sem loop).
 * - Retorna o profile completo cuja profileId deve ser persistida como `generatedPortraitProfileId`.
 */
export function allocateGeneratedPortraitProfile(
  gender: 'female' | 'male',
  seed: number,
  allocatedProfileIds: string[] = [],
): GeneratedDriverPortraitProfile {
  const pool = gender === 'female' ? ALL_FEMALE_GENERATED_PORTRAITS : ALL_MALE_GENERATED_PORTRAITS

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
