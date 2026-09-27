/**
 * Loader tipado para configurações econômicas versionadas no Skip Cloud (PocketBase).
 *
 * REGRAS DE INTEGRIDADE:
 * 1. Requer versão explícita solicitada (não carrega versão mágica ou padrão silencioso).
 * 2. Valida todos os campos obrigatórios de regras e metadados.
 * 3. Falha ruidosamente (throw new Error explícito) caso não encontre ou esteja malformado.
 * 4. Jamais usa eval ou Function constructor.
 * 5. Não inventa coeficientes nem usa fallbacks silenciosos.
 */

import pb from '../pocketbase/client'
import { VersionedEconomicConfig, FinancialEconomicRules, MANDATORY_RULE_KEYS } from './types'

export const ACTIVE_SOURCE_ECONOMIC_VERSION = 'v1.0.0-draft'

/**
 * Carrega a configuração econômica versionada ativa na carreira de teste.
 */
export async function loadActiveEconomicConfig(
  version: string = ACTIVE_SOURCE_ECONOMIC_VERSION,
): Promise<{ version: string; rules: FinancialEconomicRules; config: VersionedEconomicConfig }> {
  const config = await loadVersionedEconomicConfig(version)
  return {
    version: config.version,
    rules: config.parameters,
    config,
  }
}

export class FinancialConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'FinancialConfigLoadError'
  }
}

/**
 * Validação estrita da estrutura dos parâmetros carregados.
 */
export function validateEconomicRules(rules: unknown): asserts rules is FinancialEconomicRules {
  if (!rules || typeof rules !== 'object') {
    throw new FinancialConfigLoadError(
      'Estrutura de parâmetros inválida: objeto nulo ou não-objeto.',
    )
  }

  const record = rules as Record<string, unknown>
  for (const key of MANDATORY_RULE_KEYS) {
    const val = record[key]
    if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
      throw new FinancialConfigLoadError(
        `Parâmetro econômico ausente ou inválido: '${key}'. Esperado número finito, obtido: ${typeof val} (${String(val)})`,
      )
    }
  }

  // Validações de sanidade matemática dos parâmetros-fonte
  const r = record as unknown as FinancialEconomicRules
  if (r.months_per_year !== 12) {
    throw new FinancialConfigLoadError(
      `Inconsistência estrutural: months_per_year deve ser exatamente 12, obtido: ${r.months_per_year}`,
    )
  }
  if (r.monetary_scale_to_usd !== 1000000) {
    throw new FinancialConfigLoadError(
      `Inconsistência de escala: monetary_scale_to_usd deve ser 1.000.000, obtido: ${r.monetary_scale_to_usd}`,
    )
  }
  if (r.reconciliation_tolerance <= 0) {
    throw new FinancialConfigLoadError(
      `Tolerância de reconciliação inválida: deve ser estritamente positiva, obtido: ${r.reconciliation_tolerance}`,
    )
  }
}

/**
 * Carrega a configuração versionada do banco PocketBase por versão explícita.
 */
export async function loadVersionedEconomicConfig(
  version: string,
): Promise<VersionedEconomicConfig> {
  if (!version || typeof version !== 'string' || version.trim() === '') {
    throw new FinancialConfigLoadError(
      'Versão da configuração não informada ou vazia. Versão explícita é obrigatória.',
    )
  }

  try {
    const record = await pb
      .collection('financial_versioned_configs')
      .getFirstListItem(`version="${version.trim()}"`)

    if (!record) {
      throw new FinancialConfigLoadError(
        `Configuração financeira versionada não encontrada no banco de dados para a versão '${version}'.`,
      )
    }

    const parameters = record.parameters
    validateEconomicRules(parameters)

    const config: VersionedEconomicConfig = {
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
      catalogs: record.catalogs,
      metadata: record.metadata,
      created: record.created,
      updated: record.updated,
    }

    return config
  } catch (err: unknown) {
    if (err instanceof FinancialConfigLoadError) {
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    throw new FinancialConfigLoadError(
      `Falha ao consultar banco para versão de configuração financeira '${version}': ${message}`,
      err,
    )
  }
}
