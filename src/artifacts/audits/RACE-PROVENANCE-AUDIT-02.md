# RACE-PROVENANCE-AUDIT-02: AUDITORIA CIRÚRGICA — PNEUS, SPREAD, VOLTAS, COMBUSTÍVEL, CHUVA, ESTRATÉGIA E PESOS DE EQUIPE

**Data:** 2025  
**Versão Base (HEAD):** v0.0.656  
**Tipo:** Auditoria de Proveniência Esportiva (Engine Audit — Fase 02A: Seções A–D)  
**Status:** EM ANDAMENTO (02A: TL2/Pneus, Spread 2500ms, 24 GPs/Voltas, Combustível)  
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

---

## C. NÚMERO DE VOLTAS — 24 GPs (Tabela Canônica 24/24)

Confronto exato entre os arquivos fonte (`01raceregraseparametros-3c0c5.json`, aba Circuitos do Excel) e as definições do motor de corrida (`src/components/race/tracks.ts` / `src/lib/circuit-performance-profiles.ts` / `f1-data.ts`).

| #   | Circuito                              | ID Canônico     | Voltas Fonte | Voltas Motor | Origem Motor    | Status    |
| --- | ------------------------------------- | --------------- | ------------ | ------------ | --------------- | --------- |
| 01  | Melbourne (Albert Park)               | `australia`     | 58           | 58           | `tracks.ts:13`  | **MATCH** |
| 02  | Shanghai International Circuit        | `china`         | 56           | 56           | `tracks.ts:28`  | **MATCH** |
| 03  | Suzuka International Racing Course    | `japan`         | 53           | 53           | `tracks.ts:43`  | **MATCH** |
| 04  | Bahrain International Circuit         | `bahrain`       | 57           | 57           | `tracks.ts:58`  | **MATCH** |
| 05  | Jeddah Corniche Circuit               | `saudi_arabia`  | 50           | 50           | `tracks.ts:73`  | **MATCH** |
| 06  | Miami International Autodrome         | `miami`         | 57           | 57           | `tracks.ts:88`  | **MATCH** |
| 07  | Autodromo Enzo e Dino Ferrari (Imola) | `imola`         | 63           | 63           | `tracks.ts:103` | **MATCH** |
| 08  | Circuit de Monaco                     | `monaco`        | 78           | 78           | `tracks.ts:118` | **MATCH** |
| 09  | Circuit de Barcelona-Catalunya        | `spain`         | 66           | 66           | `tracks.ts:133` | **MATCH** |
| 10  | Circuit Gilles Villeneuve (Montreal)  | `canada`        | 70           | 70           | `tracks.ts:148` | **MATCH** |
| 11  | Red Bull Ring (Spielberg)             | `austria`       | 71           | 71           | `tracks.ts:163` | **MATCH** |
| 12  | Silverstone Circuit                   | `great_britain` | 52           | 52           | `tracks.ts:178` | **MATCH** |
| 13  | Circuit de Spa-Francorchamps          | `belgium`       | 44           | 44           | `tracks.ts:193` | **MATCH** |
| 14  | Hungaroring                           | `hungary`       | 70           | 70           | `tracks.ts:208` | **MATCH** |
| 15  | Circuit Zandvoort                     | `netherlands`   | 72           | 72           | `tracks.ts:223` | **MATCH** |
| 16  | Autodromo Nazionale Monza             | `italy`         | 53           | 53           | `tracks.ts:238` | **MATCH** |
| 17  | Baku City Circuit                     | `azerbaijan`    | 51           | 51           | `tracks.ts:253` | **MATCH** |
| 18  | Marina Bay Street Circuit             | `singapore`     | 62           | 62           | `tracks.ts:268` | **MATCH** |
| 19  | Circuit of the Americas (Austin)      | `usa`           | 56           | 56           | `tracks.ts:283` | **MATCH** |
| 20  | Autódromo Hermanos Rodríguez (Mexico) | `mexico`        | 71           | 71           | `tracks.ts:298` | **MATCH** |
| 21  | Autódromo de Interlagos (São Paulo)   | `brazil`        | 71           | 71           | `tracks.ts:313` | **MATCH** |
| 22  | Las Vegas Strip Circuit               | `las_vegas`     | 50           | 50           | `tracks.ts:328` | **MATCH** |
| 23  | Lusail International Circuit          | `qatar`         | 57           | 57           | `tracks.ts:343` | **MATCH** |
| 24  | Yas Marina Circuit (Abu Dhabi)        | `abu_dhabi`     | 58           | 58           | `tracks.ts:358` | **MATCH** |

- **Verificação de Integridade:**
  - Round correto mapeado de 1 a 24 sem saltos ou colisões.
  - Nenhum default genérico utilizado na corrida principal.
  - Distinção estrita entre GP (voltas da tabela acima) e Sprint (19 voltas ou aproximadamente 100km conforme regulamento FIA).
  - Ausência de off-by-one ou fallback silencioso nas 24 etapas.
  - Status consolidado: **24/24 MATCH (100%)**.

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
