import { generateAndPersistDiagnosticLot } from './generateStatisticalDiagnosticArtifacts'

export const diagnosticExecutionLot = generateAndPersistDiagnosticLot()

export const DIAGNOSTIC_JSON_ARTIFACT = diagnosticExecutionLot.jsonArtifact
export const DIAGNOSTIC_CSV_ARTIFACT = diagnosticExecutionLot.csvArtifact
export const DIAGNOSTIC_MARKDOWN_REPORT = diagnosticExecutionLot.markdownArtifact
