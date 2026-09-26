import { describe, it, expect } from 'vitest'
import { generateAndPersistDiagnosticRaceArtifacts } from '@/artifacts/audits/generateStatisticalDiagnosticRaceArtifacts'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('SD-02A ETAPA 2: Lote de Homologação — Execução das 100 Corridas', () => {
  it('executa o lote completo de 100 corridas canônicas e materializa os 3 artefatos', () => {
    // Força execução real e persistência nos arquivos requeridos
    const result = generateAndPersistDiagnosticRaceArtifacts(100)

    expect(result.sampleCount).toBe(100)
    expect(result.jsonArtifact).toBeDefined()
    expect(result.csvArtifact).toBeDefined()
    expect(result.markdownArtifact).toBeDefined()

    // Caminhos esperados
    const expectedJson = path.resolve(
      process.cwd(),
      'src/artifacts/audits/statistical-diagnostic-race-100.json',
    )
    const expectedCsv = path.resolve(
      process.cwd(),
      'src/artifacts/audits/statistical-diagnostic-race-100.csv',
    )
    const expectedMd = path.resolve(
      process.cwd(),
      'src/artifacts/audits/statistical-diagnostic-race-100.md',
    )

    expect(result.jsonPath).toBe(expectedJson)
    expect(result.csvPath).toBe(expectedCsv)
    expect(result.markdownPath).toBe(expectedMd)

    // Validação de existência física no disco
    expect(fs.existsSync(result.jsonPath)).toBe(true)
    expect(fs.existsSync(result.csvPath)).toBe(true)
    expect(fs.existsSync(result.markdownPath)).toBe(true)

    // Validar conteúdo gravado no JSON
    const jsonContent = JSON.parse(fs.readFileSync(result.jsonPath, 'utf-8'))
    expect(jsonContent.samples).toHaveLength(100)
    expect(jsonContent.execution.executed).toBe(100)
    expect(jsonContent.execution.valid).toBe(100)
    expect(jsonContent.execution.invalid).toBe(0)
    expect(jsonContent.tyreAndStrategy.twoCompoundViolationsTotal).toBe(0)
    expect(jsonContent.tyreAndStrategy.dryZeroPitsTotal).toBe(0)
    expect(jsonContent.integrity.twentyFourUniqueEveryRace).toBe(true)
    expect(jsonContent.integrity.positions1To24StrictEveryRace).toBe(true)
    expect(jsonContent.integrity.zeroDuplicateOrDisappeared).toBe(true)
    expect(jsonContent.reproducibility.allIdentical).toBe(true)

    // Cobertura climática
    expect(jsonContent.weatherBreakdown.dryCount).toBe(70)
    expect(jsonContent.weatherBreakdown.rainFromStartCount).toBe(15)
    expect(jsonContent.weatherBreakdown.variableCount).toBe(15)
    expect(jsonContent.weatherBreakdown.observedTransitionsCount).toBeGreaterThanOrEqual(15)

    // Integridade dos grids e resultados em todas as 100 corridas
    for (const sample of jsonContent.samples) {
      expect(sample.driverResults).toHaveLength(24)
      const uniqueDrivers = new Set(sample.driverResults.map((d: any) => d.driverId))
      expect(uniqueDrivers.size).toBe(24)

      const positions = sample.driverResults
        .map((d: any) => d.finalPosition)
        .sort((a: number, b: number) => a - b)
      expect(positions).toEqual(Array.from({ length: 24 }, (_, idx) => idx + 1))
    }

    // Validar conteúdo gravado no CSV
    const csvContent = fs.readFileSync(result.csvPath, 'utf-8')
    expect(csvContent).toContain('=== SUMMARY DAS CORRIDAS (1 A 100) ===')
    expect(csvContent).toContain('=== METRICAS AGREGADAS POR PILOTO (100 CORRIDAS) ===')
    expect(csvContent).toContain('=== METRICAS AGREGADAS POR EQUIPE (100 CORRIDAS) ===')

    // Validar conteúdo gravado no Markdown
    const mdContent = fs.readFileSync(result.markdownPath, 'utf-8')
    expect(mdContent).toContain('# SD-02A — ETAPA 2: LOTE DE HOMOLOGAÇÃO DE 100 CORRIDAS COMPLETAS')
    expect(mdContent).toContain('### ✅ **CHECKPOINT: SD-02A HOMOLOGADO**')

    // Dump para auditoria no log
    console.warn('=== SD-02A STAGE 2 AUDIT EXTRACTION ===')
    console.warn('EXECUTION:', JSON.stringify(jsonContent.execution))
    console.warn('INTEGRITY:', JSON.stringify(jsonContent.integrity))
    console.warn('TYRE_STRATEGY:', JSON.stringify(jsonContent.tyreAndStrategy))
    console.warn('WEATHER:', JSON.stringify(jsonContent.weatherBreakdown))
    console.warn('DNFS:', JSON.stringify(jsonContent.dnfs))
    console.warn('NEUTRALIZATIONS:', JSON.stringify(jsonContent.neutralizations))
    console.warn('REPRODUCIBILITY:', JSON.stringify(jsonContent.reproducibility))
    console.warn('=== END SD-02A STAGE 2 AUDIT EXTRACTION ===')
  }, 180000)
})
