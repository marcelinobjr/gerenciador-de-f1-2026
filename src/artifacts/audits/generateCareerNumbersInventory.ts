import { MBJ_2026_PILOTS, getDriverCareerStats } from '@/lib/mbj-drivers-data'
import {
  DRIVER_CAREER_STATS_2025,
  getDriverCareerBaseline2025,
  type DriverHistoricalCareerBaseline,
} from '@/data/driverCareerStats2025'
import { DRIVER_PROVENANCE_135_137A } from '@/data/driverProvenance135137a'

export type ResolutionStatus = 'RESOLVIDO' | 'NAO_ENCONTRADO' | 'AMBIGUO' | 'ERRO'

export interface DriverInventoryEntry {
  id: string
  name: string
  category: string
  historicalKey: string | null
  resolutionPath: string
  resolutionStatus: ResolutionStatus
  baseline: {
    races: number | null
    wins: number | null
    poles: number | null
    championships: number | null
  }
  isZeroExplicitlyRegistered: boolean
  isZeroFromFallback: boolean
  hasDocumentedReference: boolean
  documentaryReferenceNote: string | null
  structuralInconsistencies: string[]
  factualReviewStatus: 'NAO_EXECUTADA' | 'PENDENTE_PESQUISA' | 'REVISADA'
}

export interface CareerNumbersCurrentStateInventory {
  schemaVersion: '1.0.0'
  targetHistoricalCutoff: '2025-12-31'
  baseCommit: string
  generatedAt: string
  nature: 'INVENTARIO_ESTRUTURAL'
  externalFactualValidation: 'NAO_EXECUTADA'
  totalEffectiveDrivers: number
  summary: {
    resolvedCount: number
    notFoundCount: number
    ambiguousCount: number
    errorCount: number
    withDocumentaryReferenceCount: number
    inconsistenciesCount: number
  }
  entries: DriverInventoryEntry[]
}

/**
 * Gera o inventário estrutural de todos os pilotos atualmente carregados no catálogo canônico MBJ_2026_PILOTS.
 * Execução 100% somente leitura sobre dados de produção.
 */
export function generateCareerNumbersCurrentStateInventory(
  baseCommit: string = 'HEAD',
): CareerNumbersCurrentStateInventory {
  const entries: DriverInventoryEntry[] = []

  let resolvedCount = 0
  let notFoundCount = 0
  let ambiguousCount = 0
  let errorCount = 0
  let withDocRefCount = 0
  let inconsistenciesCount = 0

  for (const pilot of MBJ_2026_PILOTS) {
    const inconsistencies: string[] = []
    let resolutionStatus: ResolutionStatus = 'NAO_ENCONTRADO'
    let resolutionPath = ''
    let historicalKey: string | null = null
    let baselineData: DriverHistoricalCareerBaseline | null = null

    try {
      // 1. Resolução via ID canônico exato ou alias em DRIVER_CAREER_STATS_2025
      const pilotId = pilot.id
      const lowerId = (pilotId || '').trim().toLowerCase()

      if (DRIVER_CAREER_STATS_2025[pilotId]) {
        historicalKey = pilotId
        resolutionPath = 'DRIVER_CAREER_STATS_2025[exact_id]'
        baselineData = DRIVER_CAREER_STATS_2025[pilotId]
        resolutionStatus = 'RESOLVIDO'
      } else if (DRIVER_CAREER_STATS_2025[lowerId]) {
        historicalKey = lowerId
        resolutionPath = 'DRIVER_CAREER_STATS_2025[lowercase_id]'
        baselineData = DRIVER_CAREER_STATS_2025[lowerId]
        resolutionStatus = 'RESOLVIDO'
      } else {
        // Tentar resolver via função getDriverCareerBaseline2025
        const fromBaselineFn = getDriverCareerBaseline2025(pilotId)
        if (fromBaselineFn) {
          historicalKey = pilotId
          resolutionPath = 'getDriverCareerBaseline2025(pilotId)'
          baselineData = fromBaselineFn
          resolutionStatus = 'RESOLVIDO'
        }
      }

      // 2. Verificar se o método consumido pela ficha (getDriverCareerStats) bate com a baseline
      const statsFromProfile = getDriverCareerStats({ pilot: pilot as any })

      // Detectar fallback local do objeto MBJ caso ausente do dicionário 2025
      const isZeroExplicitlyRegistered =
        baselineData !== null &&
        baselineData.races === 0 &&
        baselineData.wins === 0 &&
        baselineData.poles === 0 &&
        baselineData.championships === 0

      const isZeroFromFallback = baselineData === null && statsFromProfile.races === 0

      // Inconsistências estruturais
      if (!pilot.id) {
        inconsistencies.push('Piloto sem ID canônico')
      }
      if (!pilot.name) {
        inconsistencies.push('Piloto sem nome')
      }
      if (baselineData && statsFromProfile.races !== baselineData.races) {
        inconsistencies.push(
          `Divergência entre baseline (${baselineData.races}) e getDriverCareerStats (${statsFromProfile.races})`,
        )
      }

      // Se não está no dicionário 2025 mas tem números de F1 no objeto MBJ:
      if (!baselineData && (pilot.f1RacesCompleted ?? 0) > 0) {
        resolutionPath = 'MBJ_2026_PILOTS[f1RacesCompleted_fallback]'
        resolutionStatus = 'RESOLVIDO'
        inconsistencies.push(
          `Presente no catálogo MBJ com ${pilot.f1RacesCompleted} GPs, mas ausente do dicionário DRIVER_CAREER_STATS_2025`,
        )
      } else if (!baselineData && resolutionStatus === 'NAO_ENCONTRADO') {
        resolutionPath = 'MBJ_FALLBACK_ZERO'
      }

      // Checar se há referência documental existente (ex: proveniência 135-137a)
      const docProvenance = DRIVER_PROVENANCE_135_137A[pilot.id]
      const hasDocumentedReference = Boolean(docProvenance)
      const documentaryReferenceNote = docProvenance
        ? `${docProvenance.sourceTitle} (${docProvenance.sourceAuthor})`
        : null

      if (hasDocumentedReference) {
        withDocRefCount++
      }

      if (inconsistencies.length > 0) {
        inconsistenciesCount++
      }

      if (resolutionStatus === 'RESOLVIDO') {
        resolvedCount++
      } else if (resolutionStatus === 'NAO_ENCONTRADO') {
        notFoundCount++
      } else if (resolutionStatus === 'AMBIGUO') {
        ambiguousCount++
      } else {
        errorCount++
      }

      entries.push({
        id: pilot.id,
        name: pilot.name,
        category: pilot.category || 'mercado',
        historicalKey,
        resolutionPath,
        resolutionStatus,
        baseline: {
          races: baselineData ? baselineData.races : (pilot.f1RacesCompleted ?? null),
          wins: baselineData ? baselineData.wins : (pilot.f1Wins ?? null),
          poles: baselineData ? baselineData.poles : (pilot.f1Poles ?? null),
          championships: baselineData
            ? baselineData.championships
            : (pilot.f1Championships ?? (pilot as any).f1Titles ?? null),
        },
        isZeroExplicitlyRegistered,
        isZeroFromFallback,
        hasDocumentedReference,
        documentaryReferenceNote,
        structuralInconsistencies: inconsistencies,
        factualReviewStatus: 'NAO_EXECUTADA',
      })
    } catch (err: any) {
      errorCount++
      inconsistenciesCount++
      entries.push({
        id: pilot?.id || 'DESCONHECIDO',
        name: pilot?.name || 'DESCONHECIDO',
        category: pilot?.category || 'desconhecido',
        historicalKey: null,
        resolutionPath: 'ERRO_DE_EXECUCAO',
        resolutionStatus: 'ERRO',
        baseline: {
          races: null,
          wins: null,
          poles: null,
          championships: null,
        },
        isZeroExplicitlyRegistered: false,
        isZeroFromFallback: false,
        hasDocumentedReference: false,
        documentaryReferenceNote: null,
        structuralInconsistencies: [`Erro na resolução: ${err?.message || String(err)}`],
        factualReviewStatus: 'NAO_EXECUTADA',
      })
    }
  }

  return {
    schemaVersion: '1.0.0',
    targetHistoricalCutoff: '2025-12-31',
    baseCommit,
    generatedAt: new Date().toISOString(),
    nature: 'INVENTARIO_ESTRUTURAL',
    externalFactualValidation: 'NAO_EXECUTADA',
    totalEffectiveDrivers: entries.length,
    summary: {
      resolvedCount,
      notFoundCount,
      ambiguousCount,
      errorCount,
      withDocumentaryReferenceCount: withDocRefCount,
      inconsistenciesCount,
    },
    entries,
  }
}
