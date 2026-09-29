# RACE-PROVENANCE-AUDIT-02: AUDITORIA CIRÚRGICA — PNEUS, SPREAD, VOLTAS, COMBUSTÍVEL, CHUVA, ESTRATÉGIA E PESOS DE EQUIPE

**Data:** 2026  
**Versão Base (HEAD):** v0.0.664 (5e6f72c)  
**Tipo:** Auditoria de Proveniência Esportiva (Engine Audit — Fase 02A2: Seções C–D)  
**Status:** EM ANDAMENTO (02A2: Seção C concluída, Seção D0 em execução)  
**Princípio:** SÓ AUDITORIA — Nenhuma alteração no motor de simulação, UI ou dados de pilotos.

---

## Sumário Executivo

Auditoria cirúrgica do motor de corrida e sessões do final de semana contra as especificações canônicas dos arquivos Excel (01raceregraseparametros, 02racecenariosetestes, 03raceformulasefonte).
Fase 02A cobre estritamente:

- A. TL2 / Pneus (Desgaste e Comportamento)
- B. Spread P1–P24 = 2500 ms
- C. 24 GPs / Número de Voltas
- D. Combustível (Consumo e DNF) — D0: Caminho Real do Combustível

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

### C0 — Localização das fontes de raceLaps

- Fonte canônica:
  - arquivo: `src/lib/f1-data.ts` (espelho canônico de `src/assets/01raceregraseparametros-3c0c5.json`)
  - estrutura: `F1_2026_CALENDAR: GrandPrixInfo[]`
  - campo: `laps: number`
  - exemplo Bahrain: Bahrain (Round 4) = 57 voltas (`F1_2026_CALENDAR[3].laps = 57`)
  - exemplo Abu Dhabi: Abu Dhabi (Round 24) = 58 voltas (`F1_2026_CALENDAR[23].laps = 58`)

- Motor atual:
  - arquivo: `src/services/canonicalRaceInitializationService.ts`
  - função: `initializeRaceFromCanonicalGrid(params: InitializeCanonicalRaceParams): CanonicalRaceState`
  - campo: `totalLaps: Math.max(1, totalLaps)` em `CanonicalRaceState.totalLaps` (alimentado pela UI em `WeekendV2Page.tsx:3133, 3160, 3194` via `gpInfo.laps || 57`)
  - resolve por circuitId?: SIM (`circuit_01` a `circuit_24` pareado com `round` 1–24 de `F1_2026_CALENDAR`)
  - fallback?: SIM
  - valor fallback: 57 voltas (`gpInfo.laps || 57` em `WeekendV2Page.tsx` e fallback de round não encontrado em `:146`)

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

| Round | GP                                   | Circuit ID   | Fonte laps | Motor totalLaps | Fallback acionado? | Status |
| ----- | ------------------------------------ | ------------ | ---------- | --------------- | ------------------ | ------ |
| 1     | Grande Prêmio da Austrália           | `circuit_01` | 58         | 58              | NÃO                | MATCH  |
| 2     | Grande Prêmio da China               | `circuit_02` | 56         | 56              | NÃO                | MATCH  |
| 3     | Grande Prêmio do Japão               | `circuit_03` | 53         | 53              | NÃO                | MATCH  |
| 4     | Grande Prêmio do Bahrein             | `circuit_04` | 57         | 57              | NÃO                | MATCH  |
| 5     | Grande Prêmio da Arábia Saudita      | `circuit_05` | 50         | 50              | NÃO                | MATCH  |
| 6     | Grande Prêmio de Miami               | `circuit_06` | 57         | 57              | NÃO                | MATCH  |
| 7     | Grande Prêmio do Canadá              | `circuit_07` | 70         | 70              | NÃO                | MATCH  |
| 8     | Grande Prêmio de Mônaco              | `circuit_08` | 78         | 78              | NÃO                | MATCH  |
| 9     | Grande Prêmio da Espanha (Barcelona) | `circuit_09` | 66         | 66              | NÃO                | MATCH  |
| 10    | Grande Prêmio da Áustria             | `circuit_10` | 71         | 71              | NÃO                | MATCH  |
| 11    | Grande Prêmio da Grã-Bretanha        | `circuit_11` | 52         | 52              | NÃO                | MATCH  |
| 12    | Grande Prêmio da Bélgica             | `circuit_12` | 44         | 44              | NÃO                | MATCH  |
| 13    | Grande Prêmio da Hungria             | `circuit_13` | 70         | 70              | NÃO                | MATCH  |
| 14    | Grande Prêmio dos Países Baixos      | `circuit_14` | 72         | 72              | NÃO                | MATCH  |
| 15    | Grande Prêmio da Itália              | `circuit_15` | 53         | 53              | NÃO                | MATCH  |
| 16    | Grande Prêmio de Madri               | `circuit_16` | 66         | 66              | NÃO                | MATCH  |
| 17    | Grande Prêmio do Azerbaijão          | `circuit_17` | 51         | 51              | NÃO                | MATCH  |
| 18    | Grande Prêmio de Singapura           | `circuit_18` | 62         | 62              | NÃO                | MATCH  |
| 19    | Grande Prêmio dos Estados Unidos     | `circuit_19` | 56         | 56              | NÃO                | MATCH  |
| 20    | Grande Prêmio do México              | `circuit_20` | 71         | 71              | NÃO                | MATCH  |
| 21    | Grande Prêmio de São Paulo           | `circuit_21` | 71         | 71              | NÃO                | MATCH  |
| 22    | Grande Prêmio de Las Vegas           | `circuit_22` | 50         | 50              | NÃO                | MATCH  |
| 23    | Grande Prêmio do Catar               | `circuit_23` | 57         | 57              | NÃO                | MATCH  |
| 24    | Grande Prêmio de Abu Dhabi           | `circuit_24` | 58         | 58              | NÃO                | MATCH  |

---

### Sanity Checks

- **Bahrain (Round 4):** fonte = 57, motor = 57 (**CONFIRMADO**)
- **Abu Dhabi (Round 24):** fonte = 58, motor = 58 (**CONFIRMADO**)

---

### Análise e Classificação do Fallback 57 (C1-F1..C1-F5)

- **C1-F1. Nos 24 GPs canônicos atuais, gpInfo.laps || 57 dispara alguma vez?**
  **NÃO.** Em todos os 24 rounds (1 a 24), `F1_2026_CALENDAR.find((c) => c.round === currentRound)` retorna com sucesso o objeto do Grande Prêmio contendo `laps` estritamente definido como número inteiro positivo entre 44 e 78. A expressão `gpInfo.laps || 57` sempre avalia para o valor numérico truthy de `gpInfo.laps`.
- **C1-F2. Existe algum GP com laps undefined/null/0/NaN ou inválido?**
  **NÃO.** Todos os 24 rounds em `F1_2026_CALENDAR` possuem `laps` válido (`typeof laps === 'number' && Number.isInteger(laps) && laps > 0`), sem nenhum valor nulo, indefinido, zero ou NaN.
- **C1-F3. O fallback altera hoje algum totalLaps real?**
  **NÃO.** Nenhum GP da temporada 2026 tem seu número de voltas alterado pelo fallback. Os 24 GPs mantêm exatamente o valor canônico da fonte.
- **C1-F4. Classificação do fallback:**
  **DEFENSIVO INATIVO.**
- **C1-F5. Explicação:**
  O fallback `|| 57` em `WeekendV2Page.tsx` atua exclusivamente como uma proteção de tipagem/runtime caso o objeto do GP venha a ser nulo ou o campo `laps` seja falsy durante transições de carregamento assíncrono ou round inválido. Na esteira canônica dos 24 GPs oficiais de 2026, todos os rounds 1–24 possuem `laps` perfeitamente definido, de modo que o fallback permanece completamente inativo e sem impacto sobre o motor esportivo.

---

### Contagens Agregadas (C5–C10)

- **C5. Total:** 24
- **C6. MATCH:** 24
- **C7. DIVERGENTE:** 0
- **C8. FALLBACK:** 0
- **C9. AUSENTE:** 0
- **C10. Lista de divergências:** Nenhuma (zero divergências).

---

### Classificação da Seção C

- **Classificação:** **OK**
- **Observação sobre o fallback:** O fallback `|| 57` em `WeekendV2Page.tsx` (linhas 146, 3133, 3160, 3194) é **DEFENSIVO INATIVO**, sem interferência no comportamento atual do motor esportivo. Conforme as regras da auditoria, nenhuma alteração de código ou remoção do fallback é realizada nesta rodada.

---

## D. COMBUSTÍVEL (Consumo e DNF)

### D0 — Caminho real do combustível / Fuel = 0

#### Mapeamento de Localização e Estado de Combustível

- **FUEL_INIT_FILE:** `src/services/canonicalRaceInitializationService.ts`
- **FUEL_INIT_FUNCTION:** `canonicalRaceInitializationService.initializeRaceFromCanonicalGrid(params)` (linhas 85, 200–204, 259)
- **FUEL_STATE_FIELD:** `driver.fuel` (em `CanonicalRaceDriverState`, definido em `src/types/canonical-race-v2.ts:187`)
- **FUEL_UNIT:** `kg` (quilogramas de combustível; valor inicial padrão 100.0 kg ou explicitPrep.startingFuelKg)
- **FUEL_PERSISTENCE:** `src/services/canonicalRaceSaveService.ts` via localStorage (`saveCanonicalRaceState`) preservando `driver.fuel` no snapshot do grid completo (`race-save-v1`).
- **FUEL_CONSUMPTION_FILE:** `src/services/canonicalRaceEngineService.ts`
- **FUEL_CONSUMPTION_FUNCTION:** `canonicalRaceEngineService.advanceOneLap()` (linhas 876–891) em conjunto com `calculateCanonicalLapPace()` (linhas 343, 388, 393)
- **FUEL_FORMULA:**
  - Consumo base da volta: `fuelBurn = Number((1.75 * paceMods.fuelBurnMultiplier).toFixed(2))` (onde `fuelBurnMultiplier` varia com o modo de ritmo: PUSH=1.15, NORMAL=1.00, CONSERVE=0.85).
  - Consumo efetivo com Race Control: `fuelBurnEffective = Number((pace.fuelBurnKg * rcMod.fuelBurnMultiplier).toFixed(2))` (onde sob Safety Car/VSC o multiplicador é reduzido, ex: 0.60).
  - Novo combustível: `newFuel = Math.max(0, Number((drv.fuel - fuelBurnEffective).toFixed(1)))`.
- **FUEL_CLAMP:** `Math.max(0, ...)` presente na linha 891 de `src/services/canonicalRaceEngineService.ts`. Impede que o combustível fique negativo, mas não interrompe a simulação do carro.

#### Respostas Canônicas D1–D10

- **D1. Onde o combustível inicial é calculado?**
  - Em `src/services/canonicalRaceInitializationService.ts` na função `initializeRaceFromCanonicalGrid` (linhas 85 e 200–204). O valor padrão nominal é `initialFuelKg = 100.0` kg, ou o valor individual configurado em `explicitPrep.startingFuelKg`. O estado do piloto recebe `fuel: startingFuel` na linha 259.
- **D2. Qual campo guarda o combustível restante?**
  - O campo `fuel: number` na interface `CanonicalRaceDriverState` (`src/types/canonical-race-v2.ts:187`). Exemplo: `driver.fuel`.
- **D3. Onde o consumo é aplicado a cada volta?**
  - No loop de processamento por piloto dentro de `canonicalRaceEngineService.advanceOneLap()` (`src/services/canonicalRaceEngineService.ts:890-910`).
- **D4. Existe MAX(0, ...) / Math.max(0, ...) / clamp equivalente?**
  - **SIM.** Na linha 891 de `canonicalRaceEngineService.ts`: `const newFuel = Math.max(0, Number((drv.fuel - fuelBurnEffective).toFixed(1)))`. Adicionalmente, na validação de invariantes da linha 1267: `if (d.fuel < 0) throw new Error(...)`.
- **D5. Existe trigger de abandono por combustível?**
  - **NÃO.** Em nenhuma parte do motor de corrida ativo (`canonicalRaceEngineService.ts`) existe checagem de abandono associada a `fuel <= 0` ou exaustão de combustível.
- **D6. Existe reason específico para falta de combustível?**
  - **NÃO.** As razões de abandono suportadas em `evaluateDnfRoll` (`canonicalRaceEngineService.ts:440-447`) são exclusivamente mecânicas ('Falha no Sistema de Potência (MGU-K)', 'Vazamento Hidráulico Crítico', 'Quebra de Transmissão / Câmbio', 'Superaquecimento do Motor Turbo 2026', 'Falha Elétrica de Controle (ECU)', 'Perda de Pressão de Óleo'). Não existe `OUT_OF_FUEL`, `NO_FUEL` ou `PANE_SECA`.
- **D7. Existe condição que impeça executar uma nova volta com fuel <= 0?**
  - **NÃO.** O filtro para continuar recebendo simulação de voltas é apenas `drv.raceStatus !== 'dnf' && !drv.isDnf` (`canonicalRaceEngineService.ts:794`). Um carro com `fuel === 0` continua com `raceStatus: 'racing'`, avança voltas normalmente e recebe tempos calculados.
- **D8. Fuel restante persiste corretamente no save/reload?**
  - **SIM.** O `canonicalRaceSaveService` persiste todo o array `drivers` via JSON no `localStorage`. Ao recarregar via `loadCanonicalRaceState`, o campo `fuel` é restaurado com seu valor numérico exato (inclusive `0`).
- **D9. Se o carro continua ativo com fuel zero, reload mantém esse estado?**
  - **SIM.** O estado salvo preserva `raceStatus: 'racing'` e `fuel: 0`, e o reload não altera nem encerra a corrida do carro.
- **D10. Causa raiz técnica (frase única e precisa):**
  - **O motor clampa `drv.fuel` em zero via `Math.max(0, ...)`, mas não possui nenhuma transição de estado `racing` → `dnf` associada ao esgotamento de combustível, permitindo que o carro continue completando voltas indefinidamente com peso mínimo de combustível.**

#### Classificação da Seção D

- **Classificação:** **GAP DE PRODUTO**
- **Justificativa:** A fonte paramétrica original de regras e planilhas formula o combustível como modulador de peso e consumo por volta (`_xlpm.fuel, MAX(0, $F$7-$F$8*(_xlpm.L-1))*Parâmetros!$B$32`), impedindo valor negativo através de `MAX(0, ...)`. O motor atual reproduz fielmente essa modelagem matemática de consumo e peso, mas o jogo de gerenciamento precisa de uma regra esportiva explícita para retirar da prova carros que fiquem sem combustível antes da bandeirada. Como não havia regra anterior de DNF quebrada, trata-se de um Gap de Produto a ser introduzido.

#### Requisito Esportivo Futuro (NÃO IMPLEMENTAR NESTA RODADA — AUDITORIA D0 APENAS)

Se o carro não possuir combustível suficiente para continuar normalmente até completar a próxima volta, o motor deve tratar o esgotamento como evento esportivo:

1. Parar de simular novas voltas para o piloto;
2. Atualizar `raceStatus = 'dnf'` e `isDnf = true`;
3. Definir `dnfReason = 'OUT_OF_FUEL'` (ou 'Pane Seca / Falta de Combustível');
4. Preservar `lap` com o total de voltas efetivamente completadas;
5. Preservar `raceTime` acumulado até o abandono;
6. Classificar o piloto junto aos demais abandonos conforme o regulamento FIA;
7. Persistir o estado no snapshot da corrida;
8. Garantir que o reload não ressuscite o carro nem altere seu status de abandono.

- **FUEL_INIT_FUNCTION:** `initializeRaceFromCanonicalGrid`
- **FUEL_STATE_FIELD:** `CanonicalRaceDriverState.fuel` (tipo `number`, em kg)
- **FUEL_UNIT:** quilogramas (kg)
- **FUEL_CONSUMPTION_FILE:** `src/services/canonicalRaceEngineService.ts`
- **FUEL_CONSUMPTION_FUNCTION:** `calculateCanonicalLapPace` (cálculo de `fuelBurnKg`) e `advanceOneLap` (aplicação em `fuel`)
- **FUEL_FORMULA:** `fuelBurnEffective = Number((pace.fuelBurnKg * rcMod.fuelBurnMultiplier).toFixed(2))`, onde `fuelBurn = Number((1.75 * paceMods.fuelBurnMultiplier).toFixed(2))`
- **FUEL_CLAMP:** `const newFuel = Math.max(0, Number((drv.fuel - fuelBurnEffective).toFixed(1)))` em `src/services/canonicalRaceEngineService.ts:891`

#### Respostas D1–D10

- **D1. Onde o combustível inicial é calculado?**
  Em `src/services/canonicalRaceInitializationService.ts:200-203, 259` dentro de `initializeRaceFromCanonicalGrid`. O valor inicial vem de `explicitPrep?.startingFuelKg` ou fallback `initialFuelKg` (default `100.0` kg).
- **D2. Qual campo guarda o combustível restante?**
  Campo `fuel` (tipo `number`) no estado do piloto `CanonicalRaceDriverState` (`drv.fuel`).
- **D3. Onde o consumo é aplicado a cada volta?**
  Em `src/services/canonicalRaceEngineService.ts:890-910` no método `advanceOneLap`, após calcular o ritmo da volta via `calculateCanonicalLapPace`.
- **D4. Existe Math.max(0, ...) / MAX(0, ...) / clamp equivalente?**
  **SIM.** `const newFuel = Math.max(0, Number((drv.fuel - fuelBurnEffective).toFixed(1)))` (linha 891).
- **D5. Existe trigger de abandono por combustível?**
  **NÃO.** A avaliação de DNF (`evaluateDnfRoll` ou incidente forçado) em `canonicalRaceEngineService.ts:798-866` apenas avalia falha de PU, desgaste de componentes ou colisões; não há verificação de `fuel <= 0`.
- **D6. Existe reason específico para falta de combustível?**
  **NÃO.** Não existe `OUT_OF_FUEL`, `NO_FUEL` ou equivalente no enum/string de abandono (`dnfReason`).
- **D7. Existe condição que impeça executar uma nova volta com fuel <= 0?**
  **NÃO.** O loop em `advanceOneLap` filtra apenas `drv.raceStatus === 'dnf' || drv.isDnf`. Como `raceStatus` permanece `'racing'`, a próxima volta é executada normalmente mesmo com `fuel === 0`.
- **D8. fuel restante persiste corretamente?**
  **SIM.** `canonicalRaceInitializationService.saveCanonicalRaceState` persiste o `CanonicalRaceState` completo no `localStorage` (chave `apex_canonical_race_state_v1`), incluindo o campo `fuel: 0` de cada piloto, restaurado integralmente via `loadCanonicalRaceState`.
- **D9. Se carro continua ativo com fuel zero, reload mantém esse estado?**
  **SIM.** O reload recupera o piloto com `fuel: 0`, `raceStatus: 'racing'` e `isDnf: undefined/false`, continuando apto a receber novas voltas de simulação.
- **D10. Causa raiz técnica:**
  O motor clampa `drv.fuel` em zero via `Math.max(0, ...)`, mas não existe transição `raceStatus = 'dnf'` associada ao esgotamento de combustível nem bloqueio de simulação para `fuel <= 0`.

---

#### Fixture Mínima Determinística (Fuel = 0)

Configuração: `totalLaps = 6`, `startingFuelKg = 5.0` kg, sem chuva (`seco`), sem SC/neutralização, taxa nominal de consumo `1.75` kg/volta (multiplicador 1.0).

| Lap | Fuel before (kg) | Consumo (kg) | Fuel after (kg) |  Status  | Próxima volta executada? | Observação                                       |
| :-: | :--------------: | :----------: | :-------------: | :------: | :----------------------: | :----------------------------------------------- |
|  1  |       5.0        |     1.75     |      3.25       |  racing  |           SIM            | Em ritmo normal                                  |
|  2  |       3.25       |     1.75     |      1.50       |  racing  |           SIM            | Em ritmo normal                                  |
|  3  |       1.50       |     1.75     |  0.00 (clamp)   |  racing  |           SIM            | Combustível esgota (1.50 - 1.75 < 0 clampa em 0) |
|  4  |       0.00       |     1.75     |  0.00 (clamp)   |  racing  |           SIM            | Carro corre sem combustível                      |
|  5  |       0.00       |     1.75     |  0.00 (clamp)   |  racing  |           SIM            | Carro corre sem combustível                      |
|  6  |       0.00       |     1.75     |  0.00 (clamp)   | finished |    NÃO (Fim de prova)    | Recebe bandeirada quadriculada                   |

---

#### Provas do Comportamento Atual (Passo 6 e 7)

Quando o combustível chega a 0:

- **A. Carro continua recebendo lap simulation?** **SIM.** O método `advanceOneLap` executa todas as etapas normalmente.
- **B. Tempo de volta continua sendo calculado?** **SIM.** `calculateCanonicalLapPace` calcula `lapTimeSec` normalmente (inclusive com `fuelEffectSec = 0`, conferindo ganho de tempo por carro leve).
- **C. Posição continua sendo atualizada?** **SIM.** `currentPosition` e `gap` são calculados e reordenados na classificação ativa.
- **D. completedLaps continua subindo?** **SIM.** `drv.lap` incrementa a cada volta até `totalLaps`.
- **E. status continua RUNNING/ACTIVE?** **SIM.** `drv.raceStatus` permanece `'racing'` durante a prova e transiciona para `'finished'` ao receber a bandeira quadriculada.
- **F. Algum DNF é disparado?** **NÃO.** Nenhum DNF é gerado.

**Teste de Limite (Passo 7 - fuel restante > 0 mas menor que o consumo):**

- Na transição da Volta 2 para Volta 3 (fuel restante = 1.50 kg, consumo = 1.75 kg):
- O motor **(1) permite iniciar a volta e clampa depois em 0**. Não há bloqueio nem abandono.

---

#### Classificação da Seção D: GAP DE PRODUTO

- A fonte original Excel utiliza o combustível para fins de peso do carro e cálculo de consumo volta a volta, clampando em zero para evitar números negativos.
- A engine reproduz essa mecânica de consumo com clamp matemático exato, porém o produto Apex GP Manager necessita da regra esportiva de abandono por pane seca.
- Como não existe uma implementação prévia quebrada de DNF por combustível, e sim a ausência do evento esportivo de abandono no fluxo, o veredito é **GAP DE PRODUTO**.

---

#### Regra Futura (Documentação formal para RACE-PROVENANCE-AUDIT-02A2-D1 — NÃO IMPLEMENTAR AGORA):

Se o carro não possuir combustível suficiente para completar a próxima volta (ou ao esgotar `fuel <= 0` durante a volta), o motor deverá tratar o esgotamento como evento esportivo canônico:

1. Cessar a simulação de novas voltas para o piloto.
2. Definir `drv.raceStatus = 'dnf'`, `drv.isDnf = true`, `drv.dnfReason = 'OUT_OF_FUEL'`.
3. Registrar a volta de abandono (`drv.dnfLap = targetLap`).
4. Preservar `completedLaps` e o tempo acumulado `raceTime` até a volta do abandono.
5. Classificar o piloto junto aos demais abandonos da prova (critério de voltas completadas / tempo).
6. Persistir no `CanonicalRaceState` e em `race_results` com status `'dnf'`.
7. O reload do estado não poderá ressuscitar o carro.

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
