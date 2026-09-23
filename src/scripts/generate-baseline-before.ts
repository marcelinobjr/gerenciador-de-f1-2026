/**
 * generate-baseline-before.ts
 *
 * Utilitário / script para gerar ou validar os artefatos BEFORE de auditoria:
 * - src/data/baseline-2026-before.json
 * - docs/baseline-performance-2026-before.md
 *
 * Compatível tanto com ambiente Node/scripts quanto com bundling Vite/Vitest.
 * Não depende estritamente de tipos globais de Node para passar no tsconfig.app do browser.
 */

import { auditTeamPerformanceBaseline } from '../services/teamPerformanceBaselineAuditService'

export interface GenerateBaselineBeforeOptions {
  seed?: number
  qualifyingIterations?: number
  raceIterations?: number
  totalRaceLaps?: number
  dryRun?: boolean
}

export function generateBaselineBeforeArtifacts(options: GenerateBaselineBeforeOptions = {}) {
  const seed = options.seed ?? 20260315
  const qIters = options.qualifyingIterations ?? 1000
  const rIters = options.raceIterations ?? 1000
  const totalRaceLaps = options.totalRaceLaps ?? 30

  const report = auditTeamPerformanceBaseline({
    seed,
    qualifyingIterations: qIters,
    raceIterations: rIters,
    totalRaceLaps,
  })

  const markdownContent = [
    '# FC02D — FASE A: AUDITORIA DO BASELINE DE PERFORMANCE 2026',
    '',
    '## 1. Contexto e Objetivo',
    '',
    'Esta auditoria representa a **FASE A (BEFORE)** do plano de balanceamento e calibragem canônica FC02D da temporada 2026 da Fórmula 1.',
    'Nenhum rating de piloto, fator técnico, rating de PU ou RNG foi alterado nesta rodada.',
    `O objetivo é estritamente **observacional**: registrar como a engine canônica existente (\`calculateCombinedPace\`, \`canonicalRaceEngineService\`, \`carTechnicalService\`, \`Mulberry32\`) se comporta hoje sob ${qIters.toLocaleString()} qualificações e ${rIters.toLocaleString()} corridas completas.`,
    '',
    '---',
    '',
    '## 2. Princípios e Restrições Rígidas',
    '',
    '- **PROIBIDO**: `teamPositionCap`, `winChance`, `podiumChance`, `forcedGridPosition`, `frontRunnerFlag`.',
    '- A hierarquia deve emergir naturalmente de chassi, aerodinâmica, PU, pilotos, desgaste, ritmo e estocástica.',
    '- Pilotos têm ratings preservados (Albon 83/82/80, Colton Herta 80/77/78, etc.).',
    `- RNG centralizado e seedável com Mulberry32 determinístico (\`seed: ${seed}\`).`,
    '',
    '---',
    '',
    '## 3. Tabela Resumo BEFORE (Estado Atual)',
    '',
    '|  Pos   | Construtor            | Grupo Alvo | Chassi |  PU  | CarPerf | Grid Méd | Corrida Méd | Vitórias % | Pódios % | Pontos/GP |',
    '| :----: | :-------------------- | :--------: | :----: | :--: | :-----: | :------: | :---------: | :--------: | :------: | :-------: |',
    ...report.teamsStats.map(
      (t, idx) =>
        `| **${idx + 1}**  | ${t.teamName.padEnd(21)} |   **${t.targetGroup}**    |  ${t.chassisRating.toFixed(1).padStart(4)}  | ${t.puRating.toFixed(1)} |  ${t.carPerfRating.toFixed(1).padStart(4)}   |  P${t.avgGridPosition.toFixed(2).padEnd(5)} |   P${t.avgFinishPosition.toFixed(2).padEnd(5)} |   ${(t.winPercentage.toFixed(1) + '%').padStart(6)}   | ${(t.podiumPercentage.toFixed(1) + '%').padStart(6)} |  ${t.avgPointsPerRace.toFixed(1).padStart(5)}    |`,
    ),
    '',
    '---',
    '',
    '## 4. Auditoria de Conformidade e Relatório de Gaps vs Hierarquia Alvo',
    '',
    '### 4.1 Regras Conformes (SATISFIED)',
    '',
    ...report.findings
      .filter((f) => f.status === 'SATISFIED')
      .map((f, i) => `${i + 1}. **${f.rule}**: ${f.detail}`),
    '',
    '### 4.2 Gaps Identificados para Calibração Futura (FASE B)',
    '',
    ...report.findings
      .filter((f) => f.status === 'DIVERGENT')
      .map(
        (f, i) =>
          `${i + 1}. **${f.rule}**:\n   - **Estado BEFORE**: ${f.actualValue}\n   - **Alvo Esperado**: ${f.expectedTarget}\n   - **Diagnóstico**: ${f.detail}`,
      ),
    '',
    '---',
    '',
    '## 5. Arquivos Gerados',
    '',
    '- `src/services/teamPerformanceBaselineAuditService.ts`: Serviço canônico com Monte Carlo determinístico e comparador de hierarquias.',
    '- `src/test/fc02d-baseline-audit.test.ts`: Suíte de testes automatizados FC02D-01..12.',
    '- `src/data/baseline-2026-before.json`: Registro integral das estatísticas BEFORE de simulações Monte Carlo.',
    '- `docs/baseline-performance-2026-before.md`: Este relatório executivo da Fase A.',
    '',
  ].join('\n')

  return {
    report,
    markdownContent,
  }
}
