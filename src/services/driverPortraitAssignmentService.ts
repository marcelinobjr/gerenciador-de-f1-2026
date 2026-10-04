/**
 * driverPortraitAssignmentService.ts
 *
 * Serviço canônico para atribuição automática de retratos a pilotos sem foto:
 * - Catálogo do usuário: índices masculinos = [1, 2, 6, 8, 10, 12, 14, 17, 19, 20, 21, 23, 28, 30, 31, 33, 35, 37, 39, 42, 46, 49, 52, 58].
 * - TODOS os demais índices existentes em /public/pilotos-gerados/ são femininos.
 * - Hash estável (FNV-1a 32-bit) do driverId (fallback nome) % tamanho do pool do gênero:
 *   o mesmo piloto sempre recebe a mesma foto, sem trocar a cada render ou recarregamento.
 * - Resolução de gênero a partir de visualIdentity.gender, driver.gender, prospect.gender, etc.
 *   Se ausente ou desconhecido, fallback masculino documentado.
 * - Pilotos reais com foto mapeada (DRV_0001..DRV_0188) NÃO são afetados.
 */

import { DriverVisualAssetIdentity } from '@/types/procedural-driver'

/**
 * Constante dedicada com os índices masculinos homologados pelo usuário.
 * Pedido do usuário verbatim: "são homens os Pilotos_01, 2, 6, 8, 10, 12, 14, 17, 19, 20, 21, 23, 28, 30, 31, 33, 35, 37, 39, 42, 46, 49, 52, 58."
 */
export const MALE_PORTRAIT_INDICES: readonly number[] = Object.freeze([
  1, 2, 6, 8, 10, 12, 14, 17, 19, 20, 21, 23, 28, 30, 31, 33, 35, 37, 39, 42, 46, 49, 52, 58,
])

export const MALE_PORTRAIT_INDICES_SET = new Set<number>(MALE_PORTRAIT_INDICES)

/**
 * Mapeamento de caminhos físicos exatos em public/pilotos-gerados/ para cada índice de 1 a 67.
 * Nota física do filesystem:
 * - O arquivo 52 foi gravado no repositório como "Piloto52.jpg" (sem underline).
 * - O arquivo 48 existe como "Piloto_48.jpg" e "piloto_48.jpg".
 */
export function getGeneratedFileNameForIndex(index: number): string {
  if (index === 52) {
    return 'Piloto52.jpg'
  }
  const pad = String(index).padStart(2, '0')
  return `Piloto_${pad}.jpg`
}

/**
 * Total de índices conhecidos (1..67).
 * Nota: índices 1..67 exceto Piloto_52 que é Piloto52.jpg, perfazendo 66 arquivos únicos.
 */
export const KNOWN_PORTRAIT_INDICES: readonly number[] = Object.freeze(
  Array.from({ length: 67 }, (_, i) => i + 1),
)

/**
 * Pool de caminhos de retratos MASCULINOS (24 imagens).
 */
export const MALE_PORTRAITS_POOL: readonly string[] = Object.freeze(
  MALE_PORTRAIT_INDICES.map((idx) => `/pilotos-gerados/${getGeneratedFileNameForIndex(idx)}`),
)

/**
 * Pool de caminhos de retratos FEMININOS (42 imagens).
 * Todos os índices existentes em public/pilotos-gerados/ que NÃO constam na lista masculina.
 */
export const FEMALE_PORTRAITS_POOL: readonly string[] = Object.freeze(
  KNOWN_PORTRAIT_INDICES.filter((idx) => !MALE_PORTRAIT_INDICES_SET.has(idx)).map(
    (idx) => `/pilotos-gerados/${getGeneratedFileNameForIndex(idx)}`,
  ),
)

export const TOTAL_ASSIGNABLE_PORTRAITS = MALE_PORTRAITS_POOL.length + FEMALE_PORTRAITS_POOL.length // 66

/**
 * Hash determinístico de string para uint32 (algoritmo FNV-1a de 32 bits).
 * Garante distribuição uniforme e perfeita estabilidade sem depender de PRNG volátil.
 */
export function hashDriverIdentifier(identifier: string): number {
  if (!identifier) return 0
  let hash = 2166136261
  for (let i = 0; i < identifier.length; i++) {
    hash ^= identifier.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) // Garante uint32 não-negativo
}

export type DriverGender = 'male' | 'female'

export interface DriverGenderExtractionContext {
  gender?: string | null
  visualIdentity?: DriverVisualAssetIdentity | { gender?: string | null } | null
  prospect?: { gender?: string | null } | null
}

/**
 * Resolução do gênero de identidade a partir de múltiplos locais canônicos possíveis:
 * 1. options.gender direto
 * 2. visualIdentity.gender
 * 3. prospect.gender
 * 4. Fallback masculino documentado quando ausente ou desconhecido.
 */
export function resolveDriverIdentityGender(context?: DriverGenderExtractionContext | null): DriverGender {
  if (!context) return 'male'

  const direct = context.gender
  if (typeof direct === 'string') {
    const norm = direct.trim().toLowerCase()
    if (norm === 'female' || norm === 'mulher' || norm === 'f') return 'female'
    if (norm === 'male' || norm === 'homem' || norm === 'm') return 'male'
  }

  const viGender = context.visualIdentity?.gender
  if (typeof viGender === 'string') {
    const norm = viGender.trim().toLowerCase()
    if (norm === 'female' || norm === 'mulher' || norm === 'f') return 'female'
    if (norm === 'male' || norm === 'homem' || norm === 'm') return 'male'
  }

  const prGender = context.prospect?.gender
  if (typeof prGender === 'string') {
    const norm = prGender.trim().toLowerCase()
    if (norm === 'female' || norm === 'mulher' || norm === 'f') return 'female'
    if (norm === 'male' || norm === 'homem' || norm === 'm') return 'male'
  }

  // Fallback masculino padrão documentado
  return 'male'
}

export interface DriverPortraitAssignmentOptions {
  driverId?: string | null
  name?: string | null
  gender?: string | null
  visualIdentity?: DriverVisualAssetIdentity | { gender?: string | null } | null
  prospect?: { gender?: string | null } | null
}

/**
 * Atribui de forma determinística um caminho de retrato `/pilotos-gerados/...`
 * respeitando estritamente o gênero de identidade.
 */
export function assignGeneratedPortrait(options: DriverPortraitAssignmentOptions): string {
  const gender = resolveDriverIdentityGender(options)
  const pool = gender === 'female' ? FEMALE_PORTRAITS_POOL : MALE_PORTRAITS_POOL

  const identifier =
    (options.driverId && options.driverId.trim()) ||
    (options.name && options.name.trim().toLowerCase()) ||
    'fallback_unnamed_driver'

  const hash = hashDriverIdentifier(identifier)
  const indexInPool = hash % pool.length

  return pool[indexInPool]
}
