import {
  generateAndPersistDiagnosticLot,
  type PersistedDiagnosticLotResult,
} from './generateStatisticalDiagnosticArtifacts'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Carrega artefatos pré-existentes no disco para evitar reexecução custosa durante imports casuais,
 * ou gera e persiste se ainda não existirem.
 */
function getOrGenerateDiagnosticArtifacts(): PersistedDiagnosticLotResult {
  const jsonFile = path.resolve(
    process.cwd(),
    'src/artifacts/audits/statistical-diagnostic-1000.json',
  )
  const csvFile = path.resolve(
    process.cwd(),
    'src/artifacts/audits/statistical-diagnostic-1000.csv',
  )
  const mdFile = path.resolve(process.cwd(), 'src/artifacts/audits/statistical-diagnostic-1000.md')

  if (fs.existsSync(jsonFile) && fs.existsSync(csvFile) && fs.existsSync(mdFile)) {
    try {
      const jsonArtifact = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'))
      const csvArtifact = fs.readFileSync(csvFile, 'utf-8')
      const markdownArtifact = fs.readFileSync(mdFile, 'utf-8')
      return {
        sampleCount: jsonArtifact.samples?.length || 1000,
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

  return generateAndPersistDiagnosticLot(1000)
}

export const diagnosticExecutionLot: PersistedDiagnosticLotResult =
  getOrGenerateDiagnosticArtifacts()

export const DIAGNOSTIC_JSON_ARTIFACT = diagnosticExecutionLot.jsonArtifact
export const DIAGNOSTIC_CSV_ARTIFACT = diagnosticExecutionLot.csvArtifact
export const DIAGNOSTIC_MARKDOWN_REPORT = diagnosticExecutionLot.markdownArtifact
