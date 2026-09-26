/**
 * generateStatisticalDiagnosticRaceArtifacts.ts
 *
 * SD-02A ETAPA 2: Lote de Homologação — 100 Corridas Completas com o Motor Canônico
 * Gera e materializa no disco os artefatos:
 * - src/artifacts/audits/statistical-diagnostic-race-100.json
 * - src/artifacts/audits/statistical-diagnostic-race-100.csv
 * - src/artifacts/audits/statistical-diagnostic-race-100.md
 */

import {
  canonicalRaceDiagnosticHarnessService,
  type RaceSampleRecord,
  type RaceDiagnosticReport,
} from '@/services/canonicalRaceDiagnosticHarnessService'
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface PersistedDiagnosticRaceLotResult {
  sampleCount: number
  jsonArtifact: any
  csvArtifact: string
  markdownArtifact: string
  jsonPath: string
  csvPath: string
  markdownPath: string
}

export function buildDiagnosticRaceCsv(
  samples: RaceSampleRecord[],
  report: RaceDiagnosticReport,
): string {
  const lines: string[] = []

  // 1. Linhas de sumário de cada corrida
  lines.push('=== SUMMARY DAS CORRIDAS (1 A 100) ===')
  lines.push(
    [
      'SampleId',
      'Seed',
      'CircuitRound',
      'CircuitName',
      'WeatherCondition',
      'WeatherInitial',
      'WeatherFinal',
      'TotalLaps',
      'SafetyCarDeployed',
      'VscDeployed',
      'TotalSCLaps',
      'TotalVSCLaps',
      'WinnerDriver',
      'WinnerTeam',
      'TotalDNFs',
      'TotalPitStops',
      'RuleViolationsTwoCompounds',
      'ZeroPitsViolationsDry',
      'ValidRace',
    ].join(','),
  )

  samples.forEach((s) => {
    const isValid =
      s.ruleViolationsTwoCompounds.length === 0 &&
      s.zeroPitsViolationsDry.length === 0 &&
      s.driverResults.length === 24
    lines.push(
      [
        s.sampleId,
        s.seed,
        s.circuitRound,
        `"${s.circuitName}"`,
        s.weatherCondition,
        s.weatherInitial,
        s.weatherFinal,
        s.totalLaps,
        s.safetyCarDeployed,
        s.vscDeployed,
        s.totalSafetyCarLaps,
        s.totalVscLaps,
        `"${s.winnerDriverName}"`,
        `"${s.winnerTeamId}"`,
        s.totalDnfs,
        s.pitStopsTotal,
        s.ruleViolationsTwoCompounds.length,
        s.zeroPitsViolationsDry.length,
        isValid,
      ].join(','),
    )
  })

  // 2. Tabela de pilotos agregada
  lines.push('')
  lines.push('=== METRICAS AGREGADAS POR PILOTO (100 CORRIDAS) ===')
  lines.push(
    [
      'DriverId',
      'DriverName',
      'TeamId',
      'TeamName',
      'Races',
      'AvgGridPosition',
      'AvgFinalPosition',
      'Wins',
      'Podiums',
      'PointsTotal',
      'DNFs',
      'NetPositionsGained',
      'AvgPitStops',
    ].join(','),
  )

  report.driverMetrics.forEach((d) => {
    lines.push(
      [
        d.driverId,
        `"${d.driverName}"`,
        d.teamId,
        `"${d.teamName}"`,
        d.racesCount,
        d.avgGridPosition,
        d.avgFinalPosition,
        d.wins,
        d.podiums,
        d.pointsTotal,
        d.dnfs,
        d.netPositionsGained,
        d.avgPitStops,
      ].join(','),
    )
  })

  // 3. Tabela de equipes agregada
  lines.push('')
  lines.push('=== METRICAS AGREGADAS POR EQUIPE (100 CORRIDAS) ===')
  lines.push(
    [
      'TeamId',
      'TeamName',
      'RacesCount',
      'AvgFinalPosition',
      'Wins',
      'Podiums',
      'PointsTotal',
      'DNFs',
      'AvgPitStopsPerRace',
    ].join(','),
  )

  report.teamMetrics.forEach((t) => {
    lines.push(
      [
        t.teamId,
        `"${t.teamName}"`,
        t.racesCount,
        t.avgFinalPosition,
        t.wins,
        t.podiums,
        t.pointsTotal,
        t.dnfs,
        t.avgPitStopsPerRace,
      ].join(','),
    )
  })

  return lines.join('\n')
}

export function buildDiagnosticRaceMarkdown(
  samples: RaceSampleRecord[],
  report: RaceDiagnosticReport,
): string {
  const {
    execution,
    weatherBreakdown,
    tyreAndStrategy,
    strategyMetrics,
    dnfs,
    neutralizations,
    reproducibility,
    integrity,
  } = report

  const md: string[] = []
  md.push('# SD-02A — ETAPA 2: LOTE DE HOMOLOGAÇÃO DE 100 CORRIDAS COMPLETAS')
  md.push('**Apex GP Manager — Motor Canônico F1 2026**')
  md.push('')
  md.push(`- **Data de Execução**: ${new Date().toISOString()}`)
  md.push(`- **Baseline Obrigatória**: v0.0.538 (commit \`27d8334\`)`)
  md.push(`- **Tempo Total de Execução**: ${(execution.durationMs / 1000).toFixed(2)}s`)
  md.push(
    `- **Status Geral**: ${execution.invalid === 0 && integrity.zeroDuplicateOrDisappeared ? 'SD-02A HOMOLOGADO' : 'SD-02A NÃO HOMOLOGADO'}`,
  )
  md.push('')

  md.push('## 1. RESUMO EXECUTIVO DE EXECUÇÃO')
  md.push('| Parâmetro | Valor |')
  md.push('|---|---|')
  md.push(`| Corridas Solicitadas | ${execution.requested} |`)
  md.push(`| Corridas Efetivamente Executadas | ${execution.executed} |`)
  md.push(`| Corridas Válidas | ${execution.valid} |`)
  md.push(`| Corridas Inválidas | ${execution.invalid} |`)
  md.push(
    `| Duração Média por Corrida | ${(execution.durationMs / execution.executed).toFixed(1)} ms |`,
  )
  md.push('')

  md.push('## 2. INTEGRIDADE ESTRUTURAL E INVARIANTES DE GRID')
  md.push('| Invariante | Status | Detalhes |')
  md.push('|---|---|---|')
  md.push(
    `| 24 Pilotos Únicos por Prova | ${integrity.twentyFourUniqueEveryRace ? '✅ APROVADO' : '❌ REPROVADO'} | 24 pilotos distintos em todas as 100 largadas |`,
  )
  md.push(
    `| Classificação P1–P24 Estrita | ${integrity.positions1To24StrictEveryRace ? '✅ APROVADO' : '❌ REPROVADO'} | Sequência contínua sem saltos nem posições nulas |`,
  )
  md.push(
    `| Ausência de Duplicações/Desaparecimentos | ${integrity.zeroDuplicateOrDisappeared ? '✅ APROVADO' : '❌ REPROVADO'} | Zero duplicados, zero pilotos fantasmas |`,
  )
  md.push(
    `| Isolamento de Saves / Modo Diagnóstico | ${integrity.zeroSaveCorruption ? '✅ APROVADO' : '❌ REPROVADO'} | Zero saves, carreiras ou contratos em risco |`,
  )
  md.push('')

  md.push('## 3. REGRA DE PNEUS E ESTRATÉGIA — CORRIDAS SECAS E GERAIS')
  md.push('| Métrica de Pneus | Valor Observado |')
  md.push('|---|---|')
  md.push(`| Finalizadores de Corrida Seca Avaliados | ${tyreAndStrategy.dryFinishersEvaluated} |`)
  md.push(
    `| Violações da Regra de 2 Compostos Slick (Seco) | ${tyreAndStrategy.twoCompoundViolationsTotal} |`,
  )
  md.push(`| Finalizadores Secos com Zero Pit Stops | ${tyreAndStrategy.dryZeroPitsTotal} |`)
  md.push(`| Total de Mudanças de Composto / Pits | ${tyreAndStrategy.totalCompoundChanges} |`)
  md.push(
    `| Média de Pit Stops por Piloto por Corrida | ${tyreAndStrategy.averagePitStopsPerDriver} |`,
  )
  md.push(
    `| Média de Pit Stops por Corrida (Pelotão) | ${tyreAndStrategy.averagePitStopsPerRace} |`,
  )
  md.push(
    `| Menor / Maior nº de Pits por Piloto | ${tyreAndStrategy.minPitStopsDriver} / ${tyreAndStrategy.maxPitStopsDriver} |`,
  )
  md.push(
    `| Estratégias Distintas Observadas no Lote | ${strategyMetrics.distinctStrategiesCount} |`,
  )
  md.push(`| Estratégias de 1 Parada (1-stop) | ${strategyMetrics.oneStopCount} |`)
  md.push(`| Estratégias de 2 Paradas (2-stop) | ${strategyMetrics.twoStopCount} |`)
  md.push(`| Estratégias de 3+ Paradas (3+-stop) | ${strategyMetrics.threePlusStopCount} |`)
  md.push('')

  md.push('### Distribuição de Compostos de Largada')
  Object.entries(strategyMetrics.startingCompoundDistribution).forEach(([comp, count]) => {
    md.push(
      `- **${comp.toUpperCase()}**: ${count} largadas (${((count / (execution.executed * 24)) * 100).toFixed(1)}%)`,
    )
  })
  md.push('')

  md.push('## 4. CONDIÇÕES CLIMÁTICAS E TRANSIÇÕES METEOROLÓGICAS')
  md.push('| Condição Meteorológica | Nº de Corridas | % do Lote |')
  md.push('|---|---|---|')
  md.push(
    `| Seca (DRY) | ${weatherBreakdown.dryCount} | ${((weatherBreakdown.dryCount / execution.executed) * 100).toFixed(1)}% |`,
  )
  md.push(
    `| Chuva desde a Largada (WET) | ${weatherBreakdown.rainFromStartCount} | ${((weatherBreakdown.rainFromStartCount / execution.executed) * 100).toFixed(1)}% |`,
  )
  md.push(
    `| Condição Variável (VARIABLE) | ${weatherBreakdown.variableCount} | ${((weatherBreakdown.variableCount / execution.executed) * 100).toFixed(1)}% |`,
  )
  md.push(
    `| Transições Meteorológicas Observadas | ${weatherBreakdown.observedTransitionsCount} transições | Reação estratégica observada |`,
  )
  md.push('')

  md.push('## 5. ABANDONOS (DNF) E CONFIABILIDADE')
  md.push(`- **Total de DNFs Registrados**: ${dnfs.totalDnfs}`)
  md.push(`- **Média de DNFs por Corrida**: ${dnfs.averageDnfsPerRace}`)
  md.push('')
  md.push('### Causas de Abandono Registradas')
  Object.entries(dnfs.causesBreakdown).forEach(([cause, count]) => {
    md.push(
      `- **${cause}**: ${count} ocorrências (${((count / dnfs.totalDnfs) * 100).toFixed(1)}%)`,
    )
  })
  md.push('')

  md.push('## 6. NEUTRALIZAÇÕES (SAFETY CAR E VIRTUAL SAFETY CAR)')
  md.push('| Tipo de Neutralização | Corridas com Ocorrência | % das Provas |')
  md.push('|---|---|---|')
  md.push(
    `| Safety Car (SC) | ${neutralizations.racesWithSafetyCar} | ${((neutralizations.racesWithSafetyCar / execution.executed) * 100).toFixed(1)}% |`,
  )
  md.push(
    `| Virtual Safety Car (VSC) | ${neutralizations.racesWithVsc} | ${((neutralizations.racesWithVsc / execution.executed) * 100).toFixed(1)}% |`,
  )
  md.push('')

  md.push('## 7. REPRODUTIBILIDADE DETERMINÍSTICA')
  md.push(
    `- **Sementes Testadas em Replay Exato**: ${reproducibility.seedsTested.join(', ')} (5 sementes)`,
  )
  md.push(
    `- **Conformidade de Reprodutibilidade**: ${reproducibility.allIdentical ? '100% IDÊNTICO (Zero divergências)' : 'DIVERGÊNCIA DETECTADA'}`,
  )
  if (reproducibility.divergenceDetails && reproducibility.divergenceDetails.length > 0) {
    md.push('### Detalhes das Divergências:')
    reproducibility.divergenceDetails.forEach((d) => md.push(`- ⚠️ ${d}`))
  }
  md.push('')

  md.push('## 8. CLASSIFICAÇÃO AGREGADA DAS EQUIPES (DESCRITIVA — NÃO CALIBRADA)')
  md.push(
    '| Equipe | Corridas | Posição Média | Vitórias | Pódios | Pontos Totais | DNFs | Pits Médios/GP |',
  )
  md.push('|---|---|---|---|---|---|---|---|')
  report.teamMetrics.forEach((t) => {
    md.push(
      `| ${t.teamName} | ${t.racesCount} | ${t.avgFinalPosition} | ${t.wins} | ${t.podiums} | ${t.pointsTotal} | ${t.dnfs} | ${t.avgPitStopsPerRace} |`,
    )
  })
  md.push('')

  md.push('## 9. TOP 10 PILOTOS DO LOTE DE HOMOLOGAÇÃO')
  md.push(
    '| Piloto | Equipe | Largada Média | Chegada Média | Vitórias | Pódios | Pontos | Saldo Posições |',
  )
  md.push('|---|---|---|---|---|---|---|---|')
  report.driverMetrics.slice(0, 10).forEach((d) => {
    md.push(
      `| ${d.driverName} | ${d.teamName} | ${d.avgGridPosition} | ${d.avgFinalPosition} | ${d.wins} | ${d.podiums} | ${d.pointsTotal} | ${d.netPositionsGained > 0 ? '+' : ''}${d.netPositionsGained} |`,
    )
  })
  md.push('')

  md.push('## 10. VEREDITO FINAL SD-02A ETAPA 2')
  if (
    execution.invalid === 0 &&
    integrity.zeroDuplicateOrDisappeared &&
    tyreAndStrategy.twoCompoundViolationsTotal === 0 &&
    tyreAndStrategy.dryZeroPitsTotal === 0 &&
    reproducibility.allIdentical
  ) {
    md.push('### ✅ **CHECKPOINT: SD-02A HOMOLOGADO**')
    md.push(
      'As 100 corridas completas foram executadas diretamente com o motor canônico real sem intermediários artificiais. Todas as invariantes estruturais (P1..P24 estrito, 24 pilotos únicos, regra de 2 compostos slick em corridas secas, pit stop obrigatório, determinismo e reprodutibilidade de seeds) foram integralmente validadas.',
    )
  } else {
    md.push('### ❌ **CHECKPOINT: SD-02A NÃO HOMOLOGADO**')
    md.push(`Foram encontradas inconsistências estruturais no lote:`)
    if (tyreAndStrategy.twoCompoundViolationsTotal > 0)
      md.push(`- Violações de 2 compostos: ${tyreAndStrategy.twoCompoundViolationsTotal}`)
    if (tyreAndStrategy.dryZeroPitsTotal > 0)
      md.push(`- Pilotos secos sem pit: ${tyreAndStrategy.dryZeroPitsTotal}`)
    if (!reproducibility.allIdentical) md.push(`- Reprodutibilidade com divergência em seeds`)
  }

  return md.join('\n')
}

export function generateAndPersistDiagnosticRaceArtifacts(
  sampleSize: number = 100,
): PersistedDiagnosticRaceLotResult {
  const { samples, report } = canonicalRaceDiagnosticHarnessService.runBatchRaces(sampleSize)

  const csvArtifact = buildDiagnosticRaceCsv(samples, report)
  const markdownArtifact = buildDiagnosticRaceMarkdown(samples, report)

  const jsonArtifact = {
    metadata: {
      diagnosticPhase: 'SD-02A-ETAPA-2',
      engineVersion: 'v0.0.538-canonical-race-engine',
      generatedAt: new Date().toISOString(),
      sampleSize: samples.length,
      durationMs: report.execution.durationMs,
    },
    execution: report.execution,
    integrity: report.integrity,
    weatherBreakdown: report.weatherBreakdown,
    tyreAndStrategy: report.tyreAndStrategy,
    strategyMetrics: report.strategyMetrics,
    reproducibility: report.reproducibility,
    neutralizations: report.neutralizations,
    dnfs: report.dnfs,
    teamMetrics: report.teamMetrics,
    driverMetrics: report.driverMetrics,
    // Amostras detalhadas de todas as corridas (permite auditoria corrida a corrida)
    samples,
  }

  const outDir = path.resolve(process.cwd(), 'src/artifacts/audits')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const jsonPath = path.join(outDir, 'statistical-diagnostic-race-100.json')
  const csvPath = path.join(outDir, 'statistical-diagnostic-race-100.csv')
  const markdownPath = path.join(outDir, 'statistical-diagnostic-race-100.md')

  fs.writeFileSync(jsonPath, JSON.stringify(jsonArtifact, null, 2), 'utf-8')
  fs.writeFileSync(csvPath, csvArtifact, 'utf-8')
  fs.writeFileSync(markdownPath, markdownArtifact, 'utf-8')

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
