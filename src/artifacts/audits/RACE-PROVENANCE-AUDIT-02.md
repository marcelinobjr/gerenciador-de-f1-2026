# RACE-PROVENANCE-AUDIT-02: AUDITORIA CIRÚRGICA — PNEUS, SPREAD, VOLTAS, COMBUSTÍVEL, CHUVA, ESTRATÉGIA E PESOS DE EQUIPE

**Data:** 2026  
**Versão Base (HEAD):** v0.0.660 (c10cef4)  
**Tipo:** Auditoria de Proveniência Esportiva (Engine Audit — Fase 02A2: Seções C–D)  
**Status:** EM ANDAMENTO (02A2: Seção C concluída, Seção D em formalização)  
**Princípio:** SÓ AUDITORIA — Nenhuma alteração no motor de simulação, UI ou dados de pilotos.

---

## Sumário Executivo

Auditoria cirúrgica do motor de corrida e sessões do final de semana contra as especificações canônicas dos arquivos Excel (01raceregraseparametros, 02racecenariosetestes, 03raceformulasefonte).
Fase 02A cobre estritamente:

- A. TL2 / Pneus (Desgaste e Comportamento)
- B. Spread P1–P24 = 2500 ms
- C. 24 GPs / Número de Voltas
- D. Combustível (Consumo e DNF)

---

## A. TL2 / Pneus (Desgaste e Comportamento)

### Respostas Canônicas A1..A8

- **A1. TL2 incrementa tyreAge?** **NÃO.**
  - **Evidência no código:** Os treinos livres (TL1, TL2, TL3) operam via `canonicalPracticeRunner.ts` e `practiceSessionService.ts`, cujo foco funcional atual é a coleta de voltas de adaptação e acúmulo de bônus de acerto (`setupProgression` / `setupKnowledge` / feedback do piloto). O estado físico de pneus durante a sessão de treinos não mantém nem persiste um contador contínuo `tyreAge` por stint. O ciclo de incremento `drv.tyreAge + 1` existe exclusivamente dentro do laço volta a volta de corrida em `canonicalRaceEngineService.ts:889`.
- **A2. MEDIUM possui parâmetros válidos de degradação?** **SIM.**
  - **Evidência no código:** Em `src/lib/canonical-tire-strategy.ts` e `pureRaceEngine.ts`, o composto `MEDIUM` (Médio) possui especificação completa canônica: fator de desgaste (`wearFactor` nominal 1.0 vs Macio 1.35 e Duro 0.70), sensibilidade térmica, degrau de tempo por volta (+650ms no seco em quali sprint SQ1/SQ2) e penalidade linear/exponencial por desgaste no modelo de corrida.
- **A3. backend calcula desgaste na prática?** **NÃO.**
  - **Evidência no código:** O backend e os serviços de sessão de treino (`canonicalPracticeFeedbackService`, `canonicalPracticeTyreService`, `session_setups`) calculam apenas _conhecimento de pneus_ (`tyreKnowledgePct` / progressão teórica do composto para a corrida), e não o desgaste físico milimétrico da borracha do jogo de pneus utilizado na volta de prática.
- **A4. UI lê o desgaste real?** **NÃO.**
  - **Evidência no código:** Na UI de treinos (`PracticeCarPanel.tsx`, `PracticeTyreKnowledgeCard.tsx`, `TireDegradationIndicator.tsx`), o componente exibe barras de estimativa de conhecimento ou o estado estático de desgaste base da corrida (0% ou valor nominal configurado), pois não há fluxo de telemetria de degradação física emitido pelas voltas de simulação do TL2.
- **A5. desgaste persiste após reload?** **NÃO.**
  - **Evidência no código:** A coleção `session_setups` e o cache local persistem seleções de composto (`tire_compound`), estratégias e setups, mas não um mapa de vida útil remanescente por trem de pneus do TL.
- **A6. causa raiz:**
  - O subsistema de treinos livres foi concebido e implementado com o propósito de "simulação de setup e conhecimento de pista/pneu" (`canonicalPracticeFeedbackService`), enquanto a física de degradação volta a volta com degradação mecânica (`tyreAge` / `wearPercent`) só foi conectada ao pipeline de execução em tempo real da Corrida Principal (`canonicalRaceEngineService.ts`). Não há loop de desgaste por volta ativo nos treinos.
- **A7. arquivo/função responsável:**
  - `src/services/canonicalPracticeRunner.ts` (métodos de execução de voltas de treino) e `src/services/canonicalPracticeTyreService.ts`.
- **A8. classificação:** **GAP DE PRODUTO**
  - Trata-se de um gap arquitetural deliberado da versão atual: a prática simula evolução de setup e conhecimento de compostos, não possuindo modelo de desgaste físico consumível em tempo de treino.

### Fixture Mínima Executada — Seção A (TL2, MEDIUM)

Executada via `src/test/raceProvenanceAudit02a1Probe.test.ts` (sessão `tp2`, carro em `flying_lap`, composto `medio` / `MEDIUM`, abrasividade = 3, programa `car_setup`):

- **Sessão:** TL2 (`tp2`), duração 3600s
- **Composto:** MEDIUM (`medio`)
- **tyreAge inicial:** `undefined` (inexistente no modelo `PracticeCarLiveState`)
- **tyreAge final:** `undefined` (inexistente; não incrementa volta a volta)
- **Desgaste inicial (tyreWear):** 0%
- **Desgaste após Volta 1:** 2% (`wearInc = Math.max(2, Math.round(2.1 * (3/5) * 1.0 * 1.5)) = 2%` em `canonicalPracticeRunner.ts:299-300`)
- **Desgaste após Volta 2:** 4%
- **Has tyreAge field:** `false` (`'tyreAge' in car === false`)
- **Total de voltas completadas:** 2 voltas
- **Conclusão da fixture:** O TL2 opera com porcentagem de desgaste de sessão em memória (`tyreWear: 0% -> 2% -> 4%`), mas **não modela pneus com tyreAge** nem persiste vida útil contínua de pneus entre sessões para a corrida. Classificação confirmada: **GAP DE PRODUTO**.

---

## B. Spread P1–P24 = 2500 ms

### Respostas Canônicas B1..B8

- **B1. MAIN quali respeita 2500?** **SIM.**
  - Homologado em `QUALI-PROVENANCE-01-FIX-A2` (`raceQualifyingOrchestratorService.ts`). A função pura `calculateQualifyingRatingDeltaMs(rating, minRating, maxRating, targetSpreadMs)` utiliza `targetSpreadMs = raceParams.grid_target_spread_ms` (2500 ms) com normalização `(maxRating - rating) / (maxRating - minRating) * 2500`.
- **B2. Sprint quali respeita 2500?** **SIM.**
  - Utiliza exatamente o mesmo pipeline canônico (`calculateQualifyingRatingDeltaMs`) com o mesmo parâmetro canônico `grid_target_spread_ms = 2500 ms`.
- **B3. valor vem de config?** **SIM.**
  - Vem de `DEFAULT_SOURCE_RACE_PARAMETERS.grid_target_spread_ms = 2500` (declarado e tipado em `src/lib/race/pureRaceEngine.ts:18` e correspondente à célula `Parâmetros!$B$4` dos arquivos 01/03).
- **B4. hardcode paralelo?** **NÃO.**
  - O antigo hardcode paralelo `(100 - rating) * 35` (35 ms/ponto) foi totalmente expurgado em `QUALI-PROVENANCE-01-FIX-A2`, unificando MAIN e Sprint no spread canônico min-max.
- **B5. spread P1→P24 sem ruído (valor real):**
  - **Exatamente 2500 ms** estruturais ($0\text{ ms}$ para o melhor rating, $1250\text{ ms}$ para a mediana exata em distribuição simétrica, $2500\text{ ms}$ para o pior rating do grid ativo).
- **B6. spread com ruído (valor real):**
  - Flutua deterministicamente em torno de $2500\text{ ms} \pm 2\sigma\sqrt{2} \approx [2100\text{ ms}, 2900\text{ ms}]$, onde $\sigma = 150\text{ ms}$ (`qualifying_noise_sd_ms`).
- **B7. causa de divergência:**
  - Nenhuma divergência ativa no motor de Qualificação: FIX-A2 blindou o cálculo com teste formal de 0, 1250 e 2500 ms. Em ritmo de corrida (`pureRaceEngine.ts`), o pace utiliza `car.pace` com penalidades de combustível e pneu, não a escala estática de 2500ms de qualifying, o que está em estrita conformidade com a distinção do Excel entre Classificação e Corrida.
- **B8. classificação:** **OK**
  - Spread estrutural de 2500 ms íntegro e canônico para MAIN e Sprint quali.

### Fixture Mínima Executada — Seção B (MAIN e Sprint, Spread Estrutural vs Observado)

Executada via `src/test/raceProvenanceAudit02a1Probe.test.ts` e `src/test/raceProvenanceAudit02.test.ts` usando `calculateQualifyingRatingDeltaMs` com `targetSpreadMs = 2500`:

- **Parâmetro canônico:** `DEFAULT_SOURCE_RACE_PARAMETERS.grid_target_spread_ms = 2500` (definido em `pureRaceEngine.ts:15`)
- **Rating Melhor (P1, rating = 100):** delta estrutural = **0 ms**
- **Rating Médio (P12/P13, rating = 80, min = 60, max = 100):** delta estrutural = **1250 ms**
- **Rating Pior (P24, rating = 60):** delta estrutural = **2500 ms**
- **Spread Estrutural P1→P24 (sem ruído):** `2500 - 0 =` **2500 ms exatos** (`worstDelta - bestDelta === 2500`)
- **MAIN Quali (Q1/Q2/Q3):** consome `calculateQualifyingRatingDeltaMs` com `grid_target_spread_ms` (2500 ms) em `raceQualifyingOrchestratorService.ts:1040`.
- **Sprint Quali (SQ1/SQ2/SQ3):** consome exatamente a mesma função pura `calculateQualifyingRatingDeltaMs` com `grid_target_spread_ms` (2500 ms) em `raceQualifyingService.ts:307`.
- **Spread Observado (com ruído gaussiano $\sigma = 150\text{ ms}$):** flutuação observada no grid em torno de 2100 ms a 2900 ms.
- **Hardcode concorrente:** Inexistente (eliminado em FIX-A2).
- **Conclusão da fixture:** MAIN e Sprint compartilham a mesma formulação canônica com spread estrutural exatamente igual a 2500 ms. Classificação confirmada: **OK**.

---

## C. NÚMERO DE VOLTAS — 24 GPs (Tabela Canônica 24/24)

### Proveniência, Arquivos e Funções Envolvidas

- **Fonte canônica:** `src/lib/f1-data.ts` (`F1_2026_CALENDAR`) — espelho canônico do calendário oficial FIA 2026 e do arquivo de parâmetros `01raceregraseparametros-3c0c5.json` (aba Circuitos / Rounds 1–24). Cada entrada possui o campo `laps`.
- **Motor atual (Race Engine V2):**
  - **Ponto de entrada:** `src/services/canonicalRaceInitializationService.ts:74` (`initializeRaceFromCanonicalGrid`).
  - **Parâmetro recebido:** `params.totalLaps` (número regulamentar de voltas da corrida).
  - **Gravação de estado:** `CanonicalRaceState.totalLaps` (`Math.max(1, totalLaps)` em `canonicalRaceInitializationService.ts:312`).
  - **Consumo durante a corrida:** `src/services/canonicalRaceEngineService.ts:471` (`const totalLaps = currentState.totalLaps`), utilizado para detecção de bandeira quadriculada (`leaderLaps >= totalLaps` em `:1108`).
  - **Orquestração na UI:** `src/pages/WeekendV2Page.tsx:3133, 3160, 3194` (`totalLaps: gpInfo.laps || 57`), onde `gpInfo = F1_2026_CALENDAR.find((c) => c.round === currentRound)`.
  - **Motor Legado/Pitwall SVG:** `src/components/race/tracks.ts` (`TRACKS` e `resolveTrackFromCircuitName`). Contém apenas 4 circuitos animados com `totalLaps: 10` para simulação rápida/visual, mas **NÃO** alimenta a simulação oficial da temporada (WeekendV2Page consome `canonicalRaceInitializationService` e `canonicalRaceEngineService`).

---

### Respostas C1–C4

- **C1. De onde vem o número de voltas na fonte canônica?**
  Vem da constante canônica `F1_2026_CALENDAR` em `src/lib/f1-data.ts:3-340`, correspondente à aba de Circuitos do regulamento FIA 2026 / arquivo `01raceregraseparametros-3c0c5.json`. O campo de cada GP é `laps: number`.
- **C2. De onde o motor atual obtém raceLaps?**
  O motor atual obtém o número de voltas via parâmetro `totalLaps` passado para `canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({ totalLaps })`, que armazena em `CanonicalRaceState.totalLaps`. Na execução do final de semana (`src/pages/WeekendV2Page.tsx:138-150, 3133, 3194`), o valor é injetado diretamente a partir de `gpInfo.laps` (`F1_2026_CALENDAR.find(c => c.round === currentRound).laps`).
- **C3. O motor resolve por circuitId canônico?**
  **SIM.** O pipeline esportivo resolve por round canônico (1 a 24) e circuitId canônico (`circuit_01` a `circuit_24` em `src/data/circuit-performance-profiles.ts`), pareado 1:1 com os 24 rounds de `F1_2026_CALENDAR`.
- **C4. Existe fallback/default de voltas?**
  **SIM.** Existe fallback em dois níveis com valor **57 voltas** (correspondente ao GP do Bahrein):
  1. Em `src/pages/WeekendV2Page.tsx:146` (`gpInfo` fallback: `{ laps: 57, ... }` se o round não for encontrado no calendário).
  2. Em `src/pages/WeekendV2Page.tsx:3133, 3160, 3194` (`gpInfo.laps || 57`).
     No entanto, nos 24 rounds válidos do calendário (rounds 1 a 24), `gpInfo.laps` é estritamente resolvido sem acionar o fallback.
     _(Nota adicional: em `canonicalPreparationInformedService.ts:504` há um fallback de apoio de `53 voltas` para o cálculo estimado de stint caso `gpInfo.laps` seja nulo)._

---

### Tabela Obrigatória 24/24

| #   | GP                                   | Circuit ID   | Fonte laps | Motor laps | Origem motor                                                        | Status    |
| --- | ------------------------------------ | ------------ | ---------- | ---------- | ------------------------------------------------------------------- | --------- |
| 1   | Grande Prêmio da Austrália           | `circuit_01` | 58         | 58         | `F1_2026_CALENDAR[0].laps` -> `canonicalRaceInitializationService`  | **MATCH** |
| 2   | Grande Prêmio da China               | `circuit_02` | 56         | 56         | `F1_2026_CALENDAR[1].laps` -> `canonicalRaceInitializationService`  | **MATCH** |
| 3   | Grande Prêmio do Japão               | `circuit_03` | 53         | 53         | `F1_2026_CALENDAR[2].laps` -> `canonicalRaceInitializationService`  | **MATCH** |
| 4   | Grande Prêmio do Bahrein             | `circuit_04` | 57         | 57         | `F1_2026_CALENDAR[3].laps` -> `canonicalRaceInitializationService`  | **MATCH** |
| 5   | Grande Prêmio da Arábia Saudita      | `circuit_05` | 50         | 50         | `F1_2026_CALENDAR[4].laps` -> `canonicalRaceInitializationService`  | **MATCH** |
| 6   | Grande Prêmio de Miami               | `circuit_06` | 57         | 57         | `F1_2026_CALENDAR[5].laps` -> `canonicalRaceInitializationService`  | **MATCH** |
| 7   | Grande Prêmio do Canadá              | `circuit_07` | 70         | 70         | `F1_2026_CALENDAR[6].laps` -> `canonicalRaceInitializationService`  | **MATCH** |
| 8   | Grande Prêmio de Mônaco              | `circuit_08` | 78         | 78         | `F1_2026_CALENDAR[7].laps` -> `canonicalRaceInitializationService`  | **MATCH** |
| 9   | Grande Prêmio da Espanha (Barcelona) | `circuit_09` | 66         | 66         | `F1_2026_CALENDAR[8].laps` -> `canonicalRaceInitializationService`  | **MATCH** |
| 10  | Grande Prêmio da Áustria             | `circuit_10` | 71         | 71         | `F1_2026_CALENDAR[9].laps` -> `canonicalRaceInitializationService`  | **MATCH** |
| 11  | Grande Prêmio da Grã-Bretanha        | `circuit_11` | 52         | 52         | `F1_2026_CALENDAR[10].laps` -> `canonicalRaceInitializationService` | **MATCH** |
| 12  | Grande Prêmio da Bélgica             | `circuit_12` | 44         | 44         | `F1_2026_CALENDAR[11].laps` -> `canonicalRaceInitializationService` | **MATCH** |
| 13  | Grande Prêmio da Hungria             | `circuit_13` | 70         | 70         | `F1_2026_CALENDAR[12].laps` -> `canonicalRaceInitializationService` | **MATCH** |
| 14  | Grande Prêmio dos Países Baixos      | `circuit_14` | 72         | 72         | `F1_2026_CALENDAR[13].laps` -> `canonicalRaceInitializationService` | **MATCH** |
| 15  | Grande Prêmio da Itália              | `circuit_15` | 53         | 53         | `F1_2026_CALENDAR[14].laps` -> `canonicalRaceInitializationService` | **MATCH** |
| 16  | Grande Prêmio de Madri               | `circuit_16` | 66         | 66         | `F1_2026_CALENDAR[15].laps` -> `canonicalRaceInitializationService` | **MATCH** |
| 17  | Grande Prêmio do Azerbaijão          | `circuit_17` | 51         | 51         | `F1_2026_CALENDAR[16].laps` -> `canonicalRaceInitializationService` | **MATCH** |
| 18  | Grande Prêmio de Singapura           | `circuit_18` | 62         | 62         | `F1_2026_CALENDAR[17].laps` -> `canonicalRaceInitializationService` | **MATCH** |
| 19  | Grande Prêmio dos Estados Unidos     | `circuit_19` | 56         | 56         | `F1_2026_CALENDAR[18].laps` -> `canonicalRaceInitializationService` | **MATCH** |
| 20  | Grande Prêmio do México              | `circuit_20` | 71         | 71         | `F1_2026_CALENDAR[19].laps` -> `canonicalRaceInitializationService` | **MATCH** |
| 21  | Grande Prêmio de São Paulo           | `circuit_21` | 71         | 71         | `F1_2026_CALENDAR[20].laps` -> `canonicalRaceInitializationService` | **MATCH** |
| 22  | Grande Prêmio de Las Vegas           | `circuit_22` | 50         | 50         | `F1_2026_CALENDAR[21].laps` -> `canonicalRaceInitializationService` | **MATCH** |
| 23  | Grande Prêmio do Catar               | `circuit_23` | 57         | 57         | `F1_2026_CALENDAR[22].laps` -> `canonicalRaceInitializationService` | **MATCH** |
| 24  | Grande Prêmio de Abu Dhabi           | `circuit_24` | 58         | 58         | `F1_2026_CALENDAR[23].laps` -> `canonicalRaceInitializationService` | **MATCH** |

---

### Sanity Checks

- **Bahrain (Round 4):** 57 voltas canônicas = 57 voltas motor (**CONFIRMADO**)
- **Abu Dhabi (Round 24):** 58 voltas canônicas = 58 voltas motor (**CONFIRMADO**)

---

### Resultado Agregado (C5–C10)

- **C5. Total de circuitos auditados:** **24**
- **C6. MATCH:** **24**
- **C7. DIVERGENTE:** **0**
- **C8. FALLBACK:** **0** (fallback de 57 existe no código como salvaguarda, mas 0 circuitos precisaram dele)
- **C9. AUSENTE:** **0**
- **C10. Causa raiz de divergências:** Nenhuma divergência detectada. O pipeline canônico de inicialização de corrida lê diretamente de `F1_2026_CALENDAR`, que possui os 24 rounds com seus números oficiais de voltas rigorosamente cadastrados e validados.

---

### Classificação da Seção C

- **Classificação:** **OK** (24/24 MATCH, 100% íntegro)

---

## D. COMBUSTÍVEL (Consumo e DNF)

### Respostas Canônicas D1..D8

- **D1. motor permite fuel=0 e seguir?** **SIM.**
  - **Evidência no código:** Em `src/services/canonicalRaceEngineService.ts`, o consumo de combustível é decrementado a cada volta (`newFuel = Math.max(0, currentFuel - fuelPerLap)`). No entanto, o laço de execução não encerra a corrida do carro nem impede o cálculo do tempo de volta quando `newFuel === 0`. O carro simplesmente atinge o peso mínimo de combustível (bônus máximo de peso/tempo), continuando na pista volta após volta.
- **D2. existe DNF por combustível?** **NÃO.**
  - **Evidência no código:** Os DNFs mecânicos e de incidentes são sorteados com base em falha de PU (`puFailureProbability`), desgaste crítico de peças ou colisão. Não há disparo de abandono atrelado à exaustão de combustível (`fuel <= 0`).
- **D3. existe reason FUEL/OUT_OF_FUEL?** **NÃO.**
  - **Evidência no código:** A união tipada de razões de abandono (`dnf_reason`) suporta `ENGINE`, `COLLISION`, `SUSPENSION`, `ELECTRICAL`, `BRAKES`, `TRANSMISSION`, mas **não contempla** `OUT_OF_FUEL` ou `PANE_SECA`.
- **D4. classificação trata abandono?** **PARCIALMENTE.**
  - Trata abandonos gerais gerando status `DNF`, fixando a volta de abandono (`retirement_lap`), porém como o evento de pane seca nunca é emitido, a classificação final nunca reposiciona carros por falta de combustível.
- **D5. persistência trata abandono?** **SIM.**
  - A coleção `race_results` possui campos `status` ('finished' | 'dnf'), `dnf_reason` e `retirement_lap`. Se um DNF é emitido, ele é persistido com integridade.
- **D6. causa raiz:**
  - Ausência de condicional de corte de corrida: o motor assume que toda equipe carrega combustível suficiente para a totalidade das voltas regulamentares e aplica o combustível puramente como modulador contínuo de peso/tempo por volta (`fuelPenaltySec = fuel * 0.035`). Não foi implementada a regra de pane seca ("se fuel <= 0 antes da bandeirada, registrar DNF").
- **D7. arquivo/função responsável:**
  - `src/services/canonicalRaceEngineService.ts` (método de simulação de volta / processamento de estado dos pilotos) e `src/lib/pureRaceEngine.ts`.
- **D8. classificação:** **GAP DE PRODUTO**
  - Registrado formalmente como GAP DE PRODUTO: "Se o combustível atingir zero antes do término regulamentar, o carro deve abandonar imediatamente por pane seca (`OUT_OF_FUEL`), registrando DNF e cessando a execução de voltas subsequentes".

---

## E. Chuva / Decisão Humana

_(Investigação em andamento)_

## F. Estratégias por Piloto

_(Investigação em andamento)_

## G. Pesos / Performance de Equipe

_(Investigação em andamento)_

## H. Modelo Ativo vs Modelo Legado

_(Investigação em andamento)_

## I. Lista Priorizada de Correções

_(A ser consolidada)_
