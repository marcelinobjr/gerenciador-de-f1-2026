/**
 * src/scripts/dump-audit.ts
 *
 * Script canônico para execução e persistência do BALANCE-AUDIT-01.
 * Gera src/artifacts/audits/balance-audit-01.json a partir de balanceAuditService.runFullAudit().
 * READ-ONLY: não altera nenhum modelo ou dado.
 */

import fs from 'node:fs'
import path from 'node:path'
import { balanceAuditService, BalanceAuditReport } from '../services/balanceAuditService'
import {
  diagnosticExtractionService,
  DiagnosticExtractionReport,
} from '../services/diagnosticExtractionService'

export interface BalanceAuditArtifactResult {
  report: BalanceAuditReport
  diagnosis: DiagnosticExtractionReport
  outFile: string
}

export function executeAndPersistBalanceAudit(): BalanceAuditArtifactResult {
  const report = balanceAuditService.runFullAudit()
  const diagnosis = diagnosticExtractionService.extractFullDiagnosis(report)

  const outDir = path.resolve(process.cwd(), 'src/artifacts/audits')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const outFile = path.join(outDir, 'balance-audit-01.json')

  // O artefato estruturado contém o relatório canônico e a camada diagnóstica consolidada
  const fullArtifact = {
    ...report,
    diagnostics: {
      structuralRankingP1P29: diagnosis.structuralRankingP1P29,
      championshipRankingP1P29: diagnosis.championshipRankingP1P29,
      structuralVsChampionship: diagnosis.structuralVsChampionship,
      top10Gains: diagnosis.top10Gains,
      top10Losses: diagnosis.top10Losses,
      teamsAboveExpected: diagnosis.teamsAboveExpected,
      teamsBelowExpected: diagnosis.teamsBelowExpected,
      largeGapInversionsSection: diagnosis.largeGapInversionsSection,
      trackFitDominanceTop20: diagnosis.trackFitDominanceTop20,
      dominanceStats: diagnosis.dominanceStats,
      closeGapAnalysis: diagnosis.closeGapAnalysis,
      groupHierarchies: diagnosis.groupHierarchies,
      groupHeadToHead: diagnosis.groupHeadToHead,
      audiVsHaasFull: diagnosis.audiVsHaasFull,
      trackRankingByShift: diagnosis.trackRankingByShift,
      globalTrackFitStats: diagnosis.globalTrackFitStats,
      teamTrackFitBias: diagnosis.teamTrackFitBias,
      trackTrackFitBias: diagnosis.trackTrackFitBias,
      diagnosticHypothesesAF: diagnosis.diagnosticHypothesesAF,
      decisionTable: diagnosis.decisionTable,
      diagnostico8Respostas: diagnosis.diagnostico8Respostas,
    },
  }

  fs.writeFileSync(outFile, JSON.stringify(fullArtifact, null, 2), 'utf-8')

  return { report, diagnosis, outFile }
}
