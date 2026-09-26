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

export function generateAndPersistDiagnosticLot(): {
  sampleCount: number
  jsonArtifact: any
  csvArtifact: string
  markdownArtifact: string
} {
  const { samples, report } = statisticalDiagnosticHarnessService.runBatchQualifying(1000)
  const csvArtifact = statisticalDiagnosticHarnessService.generateCsvArtifact(report)
  const markdownArtifact = statisticalDiagnosticHarnessService.generateMarkdownReport(report)

  const jsonArtifact = {
    metadata: report.metadata,
    integrityValidation: report.integrityValidation,
    structuralBaselines: report.structuralBaselines,
    teamRankings: report.teamRankings,
    driverRankings: report.driverRankings,
    circuitBreakdowns: report.circuitBreakdowns,
    notableFindings: report.notableFindings,
    racePhase2Checkpoint: report.racePhase2Checkpoint,
    // Amostras detalhadas
    samples,
  }

  return {
    sampleCount: samples.length,
    jsonArtifact,
    csvArtifact,
    markdownArtifact,
  }
}
