import {
  generateAndPersistDiagnosticRaceArtifacts,
  type PersistedDiagnosticRaceLotResult,
} from './generateStatisticalDiagnosticRaceArtifacts'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Carrega artefatos pré-existentes no disco para evitar reexecução custosa durante imports casuais,
 * ou gera e persiste se ainda não existirem.
 */
function getOrGenerateDiagnosticRaceArtifacts(): PersistedDiagnosticRaceLotResult {
  const jsonFile = path.resolve(
    process.cwd(),
    'src/artifacts/audits/statistical-diagnostic-race-100.json',
  )
  const csvFile = path.resolve(
    process.cwd(),
    'src/artifacts/audits/statistical-diagnostic-race-100.csv',
  )
  const mdFile = path.resolve(
    process.cwd(),
    'src/artifacts/audits/statistical-diagnostic-race-100.md',
  )

  if (fs.existsSync(jsonFile) && fs.existsSync(csvFile) && fs.existsSync(mdFile)) {
    try {
      const jsonArtifact = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'))
      const csvArtifact = fs.readFileSync(csvFile, 'utf-8')
      const markdownArtifact = fs.readFileSync(mdFile, 'utf-8')
      return {
        sampleCount: jsonArtifact.samples?.length || 100,
        jsonArtifact,
        csvArtifact,
        markdownArtifact,
        jsonPath: jsonFile,
        csvPath: csvFile,
        markdownPath: mdFile,
      }
    } catch {
      // Se falhar ao ler cache, executa geração
    }
  }

  return generateAndPersistDiagnosticRaceArtifacts(100)
}

export const diagnosticRaceExecutionLot: PersistedDiagnosticRaceLotResult =
  getOrGenerateDiagnosticRaceArtifacts()

export const DIAGNOSTIC_RACE_JSON_ARTIFACT = diagnosticRaceExecutionLot.jsonArtifact
export const DIAGNOSTIC_RACE_CSV_ARTIFACT = diagnosticRaceExecutionLot.csvArtifact
export const DIAGNOSTIC_RACE_MARKDOWN_REPORT = diagnosticRaceExecutionLot.markdownArtifact
