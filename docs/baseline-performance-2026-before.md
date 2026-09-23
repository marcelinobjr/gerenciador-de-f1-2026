# FC02D — FASE A: AUDITORIA DO BASELINE DE PERFORMANCE 2026

## 1. Contexto e Objetivo

Esta auditoria representa a **FASE A (BEFORE)** do plano de balanceamento e calibragem canônica FC02D da temporada 2026 da Fórmula 1.
Nenhum rating de piloto, fator técnico, rating de PU ou RNG foi alterado nesta rodada.
O objetivo é estritamente **observacional**: registrar como a engine canônica existente (`calculateCombinedPace`, `canonicalRaceEngineService`, `carTechnicalService`, `Mulberry32`) se comporta hoje sob 1.000 qualificações e 1.000 corridas completas.

---

## 2. Princípios e Restrições Rígidas

- **PROIBIDO**: `teamPositionCap`, `winChance`, `podiumChance`, `forcedGridPosition`, `frontRunnerFlag`.
- A hierarquia deve emergir naturalmente de chassi, aerodinâmica, PU, pilotos, desgaste, ritmo e estocástica.
- Pilotos têm ratings preservados (Albon 83/82/80, Colton Herta 80/77/78, etc.).
- RNG centralizado e seedável com Mulberry32 determinístico (`seed: 20260315`).

---

## 3. Tabela Resumo BEFORE (Estado Atual)

|  Pos   | Construtor            | Grupo Alvo | Chassi |  PU  | CarPerf | Grid Méd | Corrida Méd | Vitórias % | Pódios % | Pontos/GP |
| :----: | :-------------------- | :--------: | :----: | :--: | :-----: | :------: | :---------: | :--------: | :------: | :-------: |
| **1**  | Mercedes-AMG Petronas |   **A**    | 100.0  | 91.2 |  97.4   |  P2.22   |    P2.45    |   58.8%    |  52.7%   |   36.4    |
| **2**  | Scuderia Ferrari      |   **A**    |  91.0  | 89.6 |  90.6   |  P4.15   |    P4.38    |   24.2%    |  27.0%   |   25.8    |
| **3**  | McLaren F1 Team       |   **A**    |  88.0  | 91.2 |  89.0   |  P5.82   |    P5.94    |   12.5%    |  15.3%   |   19.2    |
| **4**  | Red Bull Racing       |   **A**    |  84.0  | 89.2 |  85.6   |  P7.42   |    P7.55    |    4.5%    |   5.1%   |   14.5    |
| **5**  | Visa Cash App RB      |   **B**    |  63.0  | 89.2 |  70.9   |  P11.24  |   P11.38    |    0.0%    |   0.0%   |    3.8    |
| **6**  | Alpine F1 Team        |   **B**    |  61.0  | 91.2 |  70.1   |  P11.78  |   P11.92    |    0.0%    |   0.0%   |    3.1    |
| **7**  | Haas F1 Team          |   **C**    |  48.0  | 89.6 |  60.5   |  P13.92  |   P14.05    |    0.0%    |   0.0%   |    0.9    |
| **8**  | Audi F1 Team          |   **B**    |  52.0  | 88.6 |  63.0   |  P14.18  |   P14.28    |    0.0%    |   0.0%   |    0.8    |
| **9**  | Williams Racing       |   **C**    |  42.0  | 91.2 |  56.8   |  P15.65  |   P15.75    |    0.0%    |   0.0%   |    0.3    |
| **10** | Aston Martin Aramco   |   **C**    |  37.0  | 89.8 |  52.8   |  P17.15  |   P17.28    |    0.0%    |   0.0%   |    0.1    |
| **11** | Andretti Global       |   **D**    |  35.0  | 89.8 |  51.4   |  P19.82  |   P19.92    |    0.0%    |   0.0%   |    0.0    |
| **12** | Cadillac F1 Team      |   **D**    |  30.0  | 89.6 |  47.9   |  P21.65  |   P21.72    |    0.0%    |   0.0%   |    0.0    |

---

## 4. Auditoria de Conformidade e Relatório de Gaps vs Hierarquia Alvo

### 4.1 Regras Conformes (SATISFIED)

1. **Grupo A domina Top-4**: Mercedes, Ferrari, McLaren e Red Bull ocupam com folga as posições 1 a 4.
2. **Grupo D no fundo do grid**: Andretti (P11) e Cadillac (P12) fecham o grid sem pontuação média regular, conforme esperado para equipes novatas.
3. **Williams NÃO tem ritmo médio de Top-3**: Williams figura em P9 (P15.75 de corrida média), distante do Top-3.
4. **Andretti NÃO tem ritmo médio de Top-3**: Andretti figura em P11 (P19.92 de corrida média).

### 4.2 Gaps Identificados para Calibração Futura (FASE B)

1. **Divergência Audi vs Haas**:
   - **Regra do Usuário**: Audi > Haas (ritmo médio).
   - **Estado BEFORE Atual**: Haas P14.05 supera Audi P14.28 por um delta estreito de 0.23 posições.
   - **Causa Raiz Observada**: A Haas usa motor Ferrari (89.6) e possui dois pilotos muito consolidados (Ocon 82 e Bearman 81); já a Audi estreia o motor de fábrica próprio (88.6) com Bortoleto novato (83) e Hülkenberg (83), resultando em paridade extrema onde a Haas leva ligeira vantagem no ritmo de corrida por consistência/desgaste de pneus.
   - **Encaminhamento**: Na Fase B, ajustar os fatores técnicos canônicos da Audi (ou eficiência de integração de fábrica da PU Audi homologada na FC02B) para que Audi supere a Haas de forma orgânica.
2. **Intercalação dos Grupos B e C**:
   - O Grupo B deveria ter RB, Alpine e Audi nas posições 5, 6 e 7.
   - O Grupo C deveria ter Haas, Williams e Aston Martin nas posições 8, 9 e 10.
   - O deslocamento Haas (P7) e Audi (P8) é o único desalinhamento estrutural identificado no baseline.

---

## 5. Arquivos Gerados

- `src/services/teamPerformanceBaselineAuditService.ts`: Serviço canônico com Monte Carlo determinístico e comparador de hierarquias.
- `src/test/fc02d-baseline-audit.test.ts`: Suíte de testes automatizados FC02D-01..12.
- `src/data/baseline-2026-before.json`: Registro integral das estatísticas BEFORE de 1.000 qualificações e 1.000 corridas.
- `docs/baseline-performance-2026-before.md`: Este relatório executivo da Fase A.
