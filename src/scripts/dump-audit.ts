/**
 * src/scripts/dump-audit.ts
 *
 * Script canônico para execução e persistência do BALANCE-AUDIT-01.
 * Gera src/artifacts/audits/balance-audit-01.json a partir de balanceAuditService.runFullAudit().
 * READ-ONLY: não altera nenhum modelo ou dado.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
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

  // Audit hash check for 3 JSON files
  try {
    const p1 = path.resolve(process.cwd(), 'src/assets/01finevoparametros-9bcaa.json')
    const p2 = path.resolve(process.cwd(), 'src/assets/02finevocenariosetestes-e6c0c.json')
    const p3 = path.resolve(process.cwd(), 'src/assets/03finevoformulasefonte-aac56.json')
    const c1 = fs.readFileSync(p1)
    const c2 = fs.readFileSync(p2)
    const c3 = fs.readFileSync(p3)
    const h1 = crypto.createHash('sha256').update(c1).digest('hex')
    const h2 = crypto.createHash('sha256').update(c2).digest('hex')
    const h3 = crypto.createHash('sha256').update(c3).digest('hex')
    const hashFile = path.resolve(process.cwd(), 'docs/calculated-hashes.json')
    fs.writeFileSync(
      hashFile,
      JSON.stringify(
        {
          f1: { sha256: h1, bytes: c1.byteLength },
          f2: { sha256: h2, bytes: c2.byteLength },
          f3: { sha256: h3, bytes: c3.byteLength },
        },
        null,
        2,
      ),
    )
  } catch {
    /* intentionally ignored */
  }

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
