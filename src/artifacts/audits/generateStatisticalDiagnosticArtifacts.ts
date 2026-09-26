/**
 * generateStatisticalDiagnosticArtifacts.ts
 *
 * Script gerador do lote de 1.000 Classificações Canônicas Completas
 * e consolidador dos artefatos oficiais:
 * - JSON (completo com 1.000 amostras + relatório consolidado)
 * - CSV (matriz agregada de 12 equipes e estatísticas de qualificação)
 * - Markdown (relatório executivo detalhado para auditoria)
 */

import { statisticalDiagnosticHarnessService } from '@/services/statisticalDiagnosticHarnessService'

import * as fs from 'node:fs'
import * as path from 'node:path'

export interface PersistedDiagnosticLotResult {
  sampleCount: number
  jsonArtifact: any
  csvArtifact: string
  markdownArtifact: string
  jsonPath: string
  csvPath: string
  markdownPath: string
}

export function generateAndPersistDiagnosticLot(
  sampleSize: number = 1000,
): PersistedDiagnosticLotResult {
  const startTime = Date.now()
  const { samples, report } = statisticalDiagnosticHarnessService.runBatchQualifying(sampleSize)
  const csvArtifact = statisticalDiagnosticHarnessService.generateCsvArtifact(report)
  const markdownArtifact = statisticalDiagnosticHarnessService.generateMarkdownReport(report)

  const jsonArtifact = {
    metadata: {
      ...report.metadata,
      executionDurationMs: Date.now() - startTime,
    },
    integrityValidation: report.integrityValidation,
    structuralBaselines: report.structuralBaselines,
    teamRankings: report.teamRankings,
    driverRankings: report.driverRankings,
    circuitBreakdowns: report.circuitBreakdowns,
    notableFindings: report.notableFindings,
    racePhase2Checkpoint: report.racePhase2Checkpoint,
    // Amostras detalhadas (1.000 execuções completas)
    samples,
  }

  // Persistência em disco dos 3 formatos de artefato se em ambiente Node.js
  let jsonPath = 'src/artifacts/audits/statistical-diagnostic-1000.json'
  let csvPath = 'src/artifacts/audits/statistical-diagnostic-1000.csv'
  let markdownPath = 'src/artifacts/audits/statistical-diagnostic-1000.md'

  try {
    if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      const outDir = path.resolve(process.cwd(), 'src/artifacts/audits')
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true })
      }
      jsonPath = path.join(outDir, 'statistical-diagnostic-1000.json')
      csvPath = path.join(outDir, 'statistical-diagnostic-1000.csv')
      markdownPath = path.join(outDir, 'statistical-diagnostic-1000.md')

      fs.writeFileSync(jsonPath, JSON.stringify(jsonArtifact, null, 2), 'utf-8')
      fs.writeFileSync(csvPath, csvArtifact, 'utf-8')
      fs.writeFileSync(markdownPath, markdownArtifact, 'utf-8')
    }
  } catch (err) {
    console.warn('[StatisticalDiagnostic] Falha ao persistir artefatos no disco:', err)
  }

  return {
    sampleCount: samples.length,
    jsonArtifact,
    csvArtifact,
    markdownArtifact,
    jsonPath,
    csvPath,
    markdownPath,
  }
}
