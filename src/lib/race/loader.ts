/**
 * src/lib/race/loader.ts
 *
 * Loader tipado para configurações de corrida versionadas no Skip Cloud (PocketBase).
 * Espelho do padrão arquitetural consolidado em FIN-SOURCE-01A.
 */

import pb from '../pocketbase/client'
import { VersionedRaceConfig, RaceParameters, MANDATORY_RACE_PARAM_KEYS } from './types'

export const DEFAULT_RACE_DRAFT_VERSION = 'RACE-SOURCE-01A-DRAFT-1.0.0'

export class RaceConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'RaceConfigLoadError'
  }
}

/**
 * Validação estrita da estrutura dos parâmetros carregados.
 */
export function validateRaceParameters(params: unknown): asserts params is RaceParameters {
  if (!params || typeof params !== 'object') {
    throw new RaceConfigLoadError(
      'Estrutura de parâmetros de corrida inválida: objeto nulo ou não-objeto.',
    )
  }

  const record = params as Record<string, unknown>
  for (const key of MANDATORY_RACE_PARAM_KEYS) {
    const val = record[key]
    if (key === 'sprint_dry_compound' || key === 'sq1_sq2_dry_compound') {
      if (typeof val !== 'string' || val.trim() === '') {
        throw new RaceConfigLoadError(
          `Parâmetro de composto ausente ou inválido: '${key}'. Esperado texto não-vazio, obtido: ${typeof val}`,
        )
      }
    } else {
      if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
        throw new RaceConfigLoadError(
          `Parâmetro esportivo ausente ou inválido: '${key}'. Esperado número finito, obtido: ${typeof val} (${String(val)})`,
        )
      }
    }
  }

  // Validações de sanidade matemática
  const p = record as unknown as RaceParameters
  if (p.grid_target_spread_ms <= 0) {
    throw new RaceConfigLoadError(`Diferença de grid deve ser positiva: ${p.grid_target_spread_ms}`)
  }
  if (p.fuel_max_kg <= 0) {
    throw new RaceConfigLoadError(`Carga máxima de combustível deve ser positiva: ${p.fuel_max_kg}`)
  }
}

/**
 * Carrega a configuração versionada do banco PocketBase por versão explícita.
 */
export async function loadVersionedRaceConfig(version: string): Promise<VersionedRaceConfig> {
  if (!version || typeof version !== 'string' || version.trim() === '') {
    throw new RaceConfigLoadError(
      'Versão da configuração não informada ou vazia. Versão explícita é obrigatória.',
    )
  }

  try {
    const record = await pb
      .collection('race_versioned_configs')
      .getFirstListItem(`version="${version.trim()}"`)

    if (!record) {
      throw new RaceConfigLoadError(
        `Configuração de corrida versionada não encontrada no banco de dados para a versão '${version}'.`,
      )
    }

    const parameters = record.parameters
    validateRaceParameters(parameters)

    const config: VersionedRaceConfig = {
      id: record.id,
      version: record.version,
      sha256: record.sha256,
      status: record.status,
      is_active: Boolean(record.is_active),
      work_item: record.work_item,
      delivery_version: record.delivery_version,
      source_declared_version: record.source_declared_version,
      source_sha256: record.source_sha256,
      parameters,
      tables: record.tables,
      catalogs: record.catalogs,
      metadata: record.metadata,
      created: record.created,
      updated: record.updated,
    }

    return config
  } catch (err: unknown) {
    if (err instanceof RaceConfigLoadError) {
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    throw new RaceConfigLoadError(
      `Falha ao consultar banco para versão de configuração esportiva '${version}': ${message}`,
      err,
    )
  }
}
