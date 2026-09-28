# QUALI-PROVENANCE-AUDIT.md

**APEX GP MANAGER — QUALI-PROVENANCE-AUDIT-01-STRICT**
Data: Março de 2026
Objeto: Auditoria documental e de equivalência do motor de Qualificação (Q1/Q2/Q3 e SQ1/SQ2/SQ3).
Regra estrita: NÃO alterar código de produção, testes existentes ou parâmetros de calibração.

---

## 1. Pergunta Única a Responder

> **O motor matemático atualmente usado para Q1, Q2, Q3, SQ1, SQ2, SQ3 é derivado das fórmulas do Excel fonte, ou contém lógica esportiva criada pelo agente?**

### Resposta Direta e Sintética:

**PARCIALMENTE derivado do Excel, com uma divergência esportiva central inventada no cálculo de `basePaceMs` que afeta a escala de tempos e a ordenação dos carros.**

1. **Equações que são tradução direta da fonte:**
   - Cálculo de nota de classificação do piloto (`(speed + qualifying) / 2`).
   - Piloto efetivo (`qualifying_note * formFactor * moraleFactor * wetFactor`).
   - Rating ponderado carro/piloto (`(1 - driver_weight) * car + driver_weight * effective_driver`).
   - Tentativa de volta no Q1/Q2/Q3 (`base_pace_ms - bonus_ms + Z * sigma`).
   - Ajuste de pneus na Quali Sprint (+650 ms no Médio para SQ1 e SQ2 no seco; 0 ms no SQ3; 0 ms na chuva).
   - Acúmulo de bônus de acerto do TL1/TL2/TL3 (`(setup / 100) * 0.25 * 1000 ms`).
   - Cortes canônicos (24 inscritos → 18 no Q2/SQ2 → 10 no Q3/SQ3).
   - Composição de resultado global mantendo precedência estrita de fase (Q3 para P1-P10, Q2 para P11-P18, Q1 para P19-P24).

2. **Lógica esportiva inventada / Divergência Crítica fora da fonte:**
   - **Fórmula de Ritmo Base (`basePaceMs`):**
     - **Fórmula do Excel (`Classificação!L7`):**
       $$L7 = \text{Corrida}!\$F\$12 \times 1000 \times \text{IF}(\text{chuva}, 1 + \text{Parâmetros}!\$B\$11, 1) + \frac{\max(\text{rating}) - \text{rating}}{\max(\text{rating}) - \min(\text{rating})} \times \text{Parâmetros}!\$B\$4$$
       Onde $\text{Parâmetros}!\$B\$4 = 2.500\text{ ms}$ (spread alvo do grid inteiro de 24 carros), e a normalização é relativa ao grid ativo: $(\max - \text{rating}) / (\max - \min)$.
     - **Código de Produção (`raceQualifyingOrchestratorService.ts:986-987` e `raceQualifyingService.ts:276-277`):**
       ```typescript
       const ratingGap = (100 - Math.min(100, Math.max(0, rating))) * 35 // 35ms por ponto de rating
       const basePaceMs = trackRecordMs + ratingGap
       ```
       O código **não normaliza** por $(\max - \text{rating}) / (\max - \min)$, **não utiliza** o parâmetro da fonte `grid_target_spread_ms = 2500` ($\text{Parâmetros}!\$B\$4$), **não multiplica** por $(1 + \text{fatorChuva})$ na base de tempo em `L7`, e inventou o coeficiente fixo `35 ms/ponto` (gerando um spread teórico de até $3.500\text{ ms}$ em 100 pontos de rating absoluto).
   - **Tentativas por fase:**
     - O Excel sorteia apenas **1 tentativa** por fase (`Classificação!M7` para Q1, `O7` para Q2, `Q7` para Q3).
     - O código executa **2 tentativas oficiais** por fase (`attNum = 1..2`) e escolhe o menor tempo (`bestTimeMs = Math.min(...)`), reduzindo o desvio padrão efetivo da sessão.

---

## 2. Rastreabilidade das Fontes Excel

### 2.1 JSONs Fonte Auditados

- `src/assets/01raceregraseparametros-3c0c5.json` (Regras R03, R04, R05, R06, constantes e catálogo de fórmulas).
- `src/assets/02racecenariosetestes-f3097.json` (Cenários `qualifying_gp_internal`, `qualifying_sprint_internal`, vetores de teste `RF01`, `RF02`, `RF10`, `RF11`, `RF12`).
- `src/assets/03raceformulasefonte-0d9bf.json` (Cópia literal das fórmulas extraídas da planilha original).

### 2.2 Mapeamento Específico das Células Classificação!L7..T7 e Qualificação Sprint

| Célula Excel             | Fórmula Literal no Excel Fonte                                                                                                                                               | Papel no Modelo                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Classificação!L7`       | `=Corrida!$F$12*1000*IF(Corrida!$C$6="Sim",1+Parâmetros!$B$11,1)+(MAX(Corrida!$H$14:$H$37)-Corrida!H14)/(MAX(Corrida!$H$14:$H$37)-MIN(Corrida!$H$14:$H$37))*Parâmetros!$B$4` | Ritmo quali base individual (ms): Recorde corrigido por chuva + normalização min-max do rating escalada pelo spread alvo ($B$4 = 2.500 ms). |
| `Classificação!M7`       | `=L7-V7+NORMINV(RAND(),0,$H$3)`                                                                                                                                              | Tentativa Q1: Ritmo base ($L7$) menos bônus de acerto TL ($V7$) mais ruído gaussiano (média 0, $\sigma = \$H\$3 = 150\text{ ms}$).          |
| `Classificação!N7`       | `=RANK(M7,$M$7:$M$30,1)+COUNTIF($M$7:M7,M7)-1`                                                                                                                               | Posição no Q1: Ordenação crescente por tempo (menor tempo = 1º), com desempate por linha/inscrição via `COUNTIF`.                           |
| `Classificação!O7`       | `=IF(N7<=$E$3,L7-V7+NORMINV(RAND(),0,$H$3),"")`                                                                                                                              | Tentativa Q2: Se classificado ($N7 \le \$E\$3 = 18$), novo sorteio gaussiano sobre a base menos bônus; senão vazio (`""`).                  |
| `Classificação!P7`       | `=IF(O7="","",RANK(O7,$O$7:$O$30,1))`                                                                                                                                        | Posição no Q2: `RANK` dos sobreviventes de Q2.                                                                                              |
| `Classificação!Q7`       | `=IF(AND(P7<>"",P7<=$E$4),L7-V7+NORMINV(RAND(),0,$H$3),"")`                                                                                                                  | Tentativa Q3: Se classificado ($P7 \le \$E\$4 = 10$), novo sorteio gaussiano sobre a base menos bônus; senão vazio (`""`).                  |
| `Classificação!R7`       | `=IF(Q7="","",RANK(Q7,$Q$7:$Q$30,1))`                                                                                                                                        | Posição no Q3: `RANK` dos 10 finalistas (P1..P10).                                                                                          |
| `Classificação!S7`       | `=IF(R7<>"",R7,IF(P7<>"",P7,N7))`                                                                                                                                            | Posição Final da Classificação: Cascata de fases (se disputou Q3 usa $R7$, se parou no Q2 usa $P7$, se parou no Q1 usa $N7$).               |
| `Classificação!T7`       | `=IF(R7<>"",Q7,IF(P7<>"",O7,M7))`                                                                                                                                            | Tempo Final da Classificação: Tempo da última fase disputada ($Q7$ se Q3, $O7$ se Q2, $M7$ se Q1).                                          |
| `Classificação!V7`       | `='Treinos Livres'!BL7`                                                                                                                                                      | Bônus de acerto de TL em ms: `BI7/100 * Parâmetros!$B$56 * 1000` (máx 250 ms para acerto 100).                                              |
| `Qualificação Sprint!M7` | `=L7-V7+NORMINV(RAND(),0,$H$3)+IF(Corrida!$C$6="Sim",0,(_xlfn.XLOOKUP(Parâmetros!$B$63,Parâmetros!$E$23:$E$27,Parâmetros!$F$23:$F$27)-Parâmetros!$F$23)*1000)`               | Tentativa SQ1: No seco adiciona delta do composto Médio (+650 ms); na chuva 0 ms.                                                           |
| `Qualificação Sprint!O7` | `=IF(N7<=$E$3,L7-V7+NORMINV(RAND(),0,$H$3)+IF(Corrida!$C$6="Sim",0,650),"")`                                                                                                 | Tentativa SQ2: Médio no seco (+650 ms), chuva 0 ms.                                                                                         |
| `Qualificação Sprint!Q7` | `=IF(AND(P7<>"",P7<=$E$4),L7-V7+NORMINV(RAND(),0,$H$3),"")`                                                                                                                  | Tentativa SQ3: Pneu Macio (+0 ms).                                                                                                          |

---

## 3. Matriz Obrigatória de Confronto (28 Itens)

Colunas: `Item` | `Excel` | `Código atual` | `Status` | `Observação`

| #   | Item                                   | Excel (Fórmula / Regra)                                              | Código Atual (Função / Linha)                                                    | Status                    | Observação                                                                                                                                                                                            |
| --- | -------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Nota de classificação do piloto        | `(speed + qualifying) / 2` (`Pilotos Inscritos!I4`)                  | `pureRaceEngine.ts:93` (`calculateEffectiveQualifyingDriver`)                    | **EXATO**                 | Média aritmética de velocidade e quali.                                                                                                                                                               |
| 2   | Velocidade + Classificação             | Entradas brutas 0-100 do piloto                                      | `pureRaceEngine.ts:78-93`, `raceQualifyingOrchestratorService.ts:77-78`          | **EXATO**                 | Parâmetros diretos consumidos.                                                                                                                                                                        |
| 3   | Peso carro/piloto                      | `(1 - driver_weight) * car + driver_weight * driver` (`Corrida!H14`) | `pureRaceEngine.ts:109-117` (`calculateTrackQualifyingRating`)                   | **EXATO**                 | Média ponderada linear idêntica à célula `Corrida!H14`.                                                                                                                                               |
| 4   | Forma                                  | `1 + B5 * (form - 50) / 50` ($B$5 = 0.10)                            | `pureRaceEngine.ts:94`                                                           | **EXATO**                 | Multiplicador de forma idêntico ao Excel.                                                                                                                                                             |
| 5   | Moral                                  | `1 + B6 * (morale - 50) / 50` ($B$6 = 0.05)                          | `pureRaceEngine.ts:95`                                                           | **EXATO**                 | Multiplicador de moral idêntico ao Excel.                                                                                                                                                             |
| 6   | Chuva                                  | `wet ? 1 + B7 * (wet_skill - 50) / 50 : 1` ($B$7 = 0.08)             | `pureRaceEngine.ts:96-98`                                                        | **EXATO**                 | Multiplicador de habilidade na chuva idêntico ao Excel.                                                                                                                                               |
| 7   | Base de tempo da quali                 | `Corrida!$F$12 * 1000 * IF(chuva, 1 + B11, 1)`                       | `raceQualifyingOrchestratorService.ts:987` (`trackRecordMs + ratingGap`)         | **DIVERGENTE**            | Código não aplica `1 + light_rain_time_fraction` (+8%) no `trackRecordMs` em pista molhada.                                                                                                           |
| 8   | Fator sobre recorde                    | `recorde * (1 + B17)` ($B$17 = -0.015)                               | Passado via `trackRecordMs` (ex: 80.000 ms)                                      | **ADAPTAÇÃO DOCUMENTADA** | O orquestrador recebe `trackRecordMs` já calculado para o GP.                                                                                                                                         |
| 9   | Normalização maxRating/minRating       | `(MAX(ratings) - rating) / (MAX(ratings) - MIN(ratings)) * B4`       | `raceQualifyingOrchestratorService.ts:986`: `(100 - rating) * 35`                | **DIVERGENTE**            | **INVENÇÃO ESPORTIVA**: Excel usa normalização relativa ao grid com `B4 = 2500 ms`. O código usa rating absoluto com `35 ms/ponto`.                                                                   |
| 10  | Ruído normal                           | `NORMINV(RAND(), 0, sigma)`                                          | `Mulberry32 + Box-Muller` (`raceQualifyingOrchestratorService.ts:348-357, 1004`) | **EQUIVALENTE**           | Substituição legítima de `RAND()` por PRNG determinístico Mulberry32 + Box-Muller.                                                                                                                    |
| 11  | Sigma                                  | `Parâmetros!$B$9 = 150 ms`                                           | `pureRaceEngine.ts:20` (`qualifying_noise_sd_ms = 150`)                          | **EXATO**                 | Valor canônico 150 ms preservado.                                                                                                                                                                     |
| 12  | Multiplicador de ruído na chuva        | `Parâmetros!$B$10 = 1.5`                                             | `pureRaceEngine.ts:21` (`wet_noise_multiplier = 1.5`)                            | **FORA DA FONTE**         | O parâmetro existe em `pureRaceEngine.ts`, mas o orquestrador `raceQualifyingOrchestratorService.ts:1020, 1036` passa `sigma_ms: raceParams.qualifying_noise_sd_ms` sem multiplicar por 1.5 na chuva. |
| 13  | Bônus de setup                         | `BI7/100 * 0.25 * 1000` (`Treinos Livres!BL7`)                       | `pureRaceEngine.ts:265, 291`                                                     | **EXATO**                 | Aplicado exatamente uma vez por tentativa: `(setup / 100) * 0.25 * 1000 ms`.                                                                                                                          |
| 14  | Tentativa Q1                           | `L7 - V7 + NORMINV(RAND(), 0, 150)` (1 tentativa)                    | `pureRaceEngine.ts:266` / `raceQualifyingOrchestratorService.ts:998`             | **DIVERGENTE**            | A matemática de cada tentativa é exata, porém o código gera **2 tentativas** e pega o `min(att1, att2)`.                                                                                              |
| 15  | Ranking Q1                             | `RANK(M7, $M$7:$M$30, 1) + COUNTIF($M$7:M7, M7) - 1`                 | `raceQualifyingOrchestratorService.ts:1084-1089`                                 | **EQUIVALENTE**           | Menor tempo vence; desempate determinístico por `driverId`.                                                                                                                                           |
| 16  | Corte Q1→Q2                            | `N7 <= $E$3` ($E$3 = 18 classificados, 6 eliminados)                 | `raceQualifyingOrchestratorService.ts:480` (`resolveCutoffRules`)                | **EXATO**                 | Exatamente 18 avançam e 6 eliminados fixados em P19-P24.                                                                                                                                              |
| 17  | Tentativa Q2                           | `IF(N7<=18, L7 - V7 + NORMINV, "")` (1 tentativa)                    | `raceQualifyingOrchestratorService.ts:512-519`                                   | **EQUIVALENTE**           | Executa apenas classificados do Q1; gera 2 tentativas e seleciona o melhor.                                                                                                                           |
| 18  | Ranking Q2                             | `RANK(O7, $O$7:$O$30, 1)`                                            | `raceQualifyingOrchestratorService.ts:1084-1094`                                 | **ADAPTAÇÃO DOCUMENTADA** | Ordena tempos do Q2 e aplica desempate determinístico único (evita empate do RANK).                                                                                                                   |
| 19  | Corte Q2→Q3                            | `P7 <= $E$4` ($E$4 = 10 classificados, 8 eliminados)                 | `raceQualifyingOrchestratorService.ts:472` (`resolveCutoffRules`)                | **EXATO**                 | Top 10 avança; 8 eliminados fixados em P11-P18.                                                                                                                                                       |
| 20  | Tentativa Q3                           | `IF(P7<=10, L7 - V7 + NORMINV, "")` (1 tentativa)                    | `raceQualifyingOrchestratorService.ts:526-533`                                   | **EQUIVALENTE**           | Executa apenas os 10 finalistas do Q2.                                                                                                                                                                |
| 21  | Ranking Q3                             | `RANK(Q7, $Q$7:$Q$30, 1)`                                            | `raceQualifyingOrchestratorService.ts:1084-1094`                                 | **ADAPTAÇÃO DOCUMENTADA** | Atribui P1..P10 sem empates.                                                                                                                                                                          |
| 22  | QUALIFYING_RESULT                      | `Classificação!S7:T7` (P1-P10 de Q3, P11-P18 de Q2, P19-P24 de Q1)   | `raceQualifyingOrchestratorService.ts:1951-2183` (`buildGlobalQualifyingResult`) | **EXATO**                 | Bijeção estrita, preserva precedência de fase sem reordenação por tempos de fases anteriores.                                                                                                         |
| 23  | SQ1                                    | 24 carros → 18 passam, pneus Médios no seco (+650 ms)                | `raceQualifyingOrchestratorService.ts:541, 1010-1028`                            | **EXATO**                 | Corte 18/6 e pneu Médio no seco.                                                                                                                                                                      |
| 24  | SQ2                                    | 18 carros → 10 passam, pneus Médios no seco (+650 ms)                | `raceQualifyingOrchestratorService.ts:557, 1010-1028`                            | **EXATO**                 | Herança estrita de SQ1, corte 10/8 e pneu Médio no seco.                                                                                                                                              |
| 25  | SQ3                                    | 10 carros → P1..P10, pneus Macios (+0 ms)                            | `raceQualifyingOrchestratorService.ts:573, 1010-1028`                            | **EXATO**                 | Herança estrita de SQ2, sem delta (+0 ms) no seco.                                                                                                                                                    |
| 26  | +650 ms do Médio                       | `Parâmetros!$B$63` (`XLOOKUP("Médio") - XLOOKUP("Macio") = 650 ms`)  | `pureRaceEngine.ts:292` / `defaultMediumDelta = 650`                             | **EXATO**                 | Exatamente 650 ms aplicado em SQ1 e SQ2.                                                                                                                                                              |
| 27  | Comportamento na chuva da Quali Sprint | `IF(Corrida!$C$6="Sim", 0, delta)`                                   | `pureRaceEngine.ts:294`: `inputs.dry ? (is_sq3 ? 0 : 650) : 0`                   | **EXATO**                 | Na chuva, o delta de composto do Médio é zerado.                                                                                                                                                      |
| 28  | Desempates                             | Q1: `RANK + COUNTIF - 1`. Q2/Q3: `RANK` simples sem 2º critério      | `raceQualifyingOrchestratorService.ts:1084-1089`: `a.bestTimeMs - b.bestTimeMs   |                           | a.driverId.localeCompare(b.driverId)`                                                                                                                                                                 | **ADAPTAÇÃO DOCUMENTADA** | Tratamento determinístico que resolve a lacuna de empate duplicado do Excel em Q2/Q3. |

---

## 4. Análise de Invenções Esportivas e Desvios

### 4.1 Invenção Esportiva Principal: Fórmula de `basePaceMs` (Ritmo Base de Qualificação)

- **Localização:**
  - `src/services/raceQualifyingOrchestratorService.ts`, linhas 986–987:
    ```typescript
    const ratingGap = (100 - Math.min(100, Math.max(0, rating))) * 35
    const basePaceMs = trackRecordMs + ratingGap
    ```
  - `src/services/raceQualifyingService.ts`, linhas 276–277:
    ```typescript
    const ratingGap = (100 - Math.min(100, Math.max(0, rating))) * 35 // 35ms por ponto de rating
    const basePaceMs = trackRecordMs + ratingGap
    ```
- **Fórmula Real no Excel (`Classificação!L7`):**
  ```excel
  =Corrida!$F$12*1000*IF(Corrida!$C$6="Sim",1+Parâmetros!$B$11,1)+(MAX(Corrida!$H$14:$H$37)-Corrida!H14)/(MAX(Corrida!$H$14:$H$37)-MIN(Corrida!$H$14:$H$37))*Parâmetros!$B$4
  ```
- **Confronto Matemático:**
  1. **Dispersão por rating:**
     - No Excel, o carro mais rápido do grid tem $(\max - \text{rating}) = 0$, logo seu ritmo base é exatamente o tempo do recorde da pole (`Corrida!$F$12 * 1000`). O carro mais lento do grid tem $(\max - \text{rating}) / (\max - \min) = 1$, recebendo exatamente $+2.500\text{ ms}$ (`Parâmetros!$B$4`). O spread do grid é garantido e calibrado em $2.500\text{ ms}$ entre o primeiro e o último carro.
     - No código, usa-se $(100 - \text{rating}) \times 35$. Se o melhor carro do grid tiver rating 92, ele recebe $+280\text{ ms}$. Se o pior tiver rating 72, ele recebe $+980\text{ ms}$. O spread real fica em $700\text{ ms}$, em vez de $2.500\text{ ms}$!
  2. **Impacto Esportivo:**
     - A dispersão entre os carros fica artificialmente comprimida ($700\text{ ms}$ vs $2.500\text{ ms}$). Com o ruído gaussiano $\sigma = 150\text{ ms}$, uma compressão do grid faz com que o sorteio aleatório tenha uma influência desproporcionalmente maior sobre as posições do que os atributos reais de carro e piloto.
     - Isso é **capaz de alterar substancialmente a ordem dos carros no grid**.
  3. **Origem do coeficiente `35`:**
     - Não existe em nenhuma célula do Excel de parâmetros (`Parâmetros!A1:F70`). É um número mágico arbitrário (hardcode) inserido pelo desenvolvedor.

### 4.2 Omissão do Fator de Chuva no Tempo Base (`light_rain_time_fraction`)

- **Excel (`Classificação!L7`):**
  - Multiplica a base por `IF(Corrida!$C$6="Sim", 1 + Parâmetros!$B$11, 1)` onde $B$11 é `light_rain_time_fraction = 0.08` (+8% no tempo de volta na chuva).
- **Código:**
  - O código não escala `trackRecordMs` pelo fator de chuva na quali. Embora passe `wet` para `calculateEffectiveQualifyingDriver`, o tempo base absoluto não sobe 8% na chuva.

### 4.3 Omissão do Multiplicador de Ruído na Chuva (`wet_noise_multiplier`)

- **Excel (`Classificação!H3` e `Voltas!M13`):**
  - Parâmetro $B$10 (`wet_noise_multiplier = 1.5`) aumenta a variabilidade/ruído na chuva.
- **Código:**
  - No Q1/Q2/Q3 e SQ1/SQ2/SQ3, o orquestrador passa `sigma_ms = raceParams.qualifying_noise_sd_ms` (150 ms fixo), sem aplicar o multiplicador de 1.5 na chuva.

### 4.4 Duas Tentativas de Volta vs Uma Tentativa

- **Excel:**
  - O Excel possui apenas uma coluna de tempo por fase ($M$ para Q1, $O$ para Q2, $Q$ para Q3). Cada F9 gera uma única volta por fase.
- **Código:**
  - O código executa um loop de `attNum = 1..2`, calculando duas voltas por fase e adotando o `bestTimeMs = Math.min(...)`.
  - Essa é uma decisão de gameplay/software (simular as duas saídas de box da F1 real), mas estatisticamente o mínimo de duas variáveis normais independentes $\min(Z_1, Z_2)$ desloca a média para baixo em $\approx -0.56\sigma$ (cerca de $-84\text{ ms}$) e reduz a variância.

---

## 5. Teste de Equivalência com Vetores RACE-SOURCE-01A

Os testes existentes em `src/test/race-first-wave-vectors.test.ts` foram executados e confrontados com os valores esperados dos arquivos 01 e 02:

| Vetor    | Função Testada                               | Input Controlado                                     | Valor Esperado (Fonte)   | Valor Obtido no Código   | Veredito         |
| -------- | -------------------------------------------- | ---------------------------------------------------- | ------------------------ | ------------------------ | ---------------- |
| **RF01** | `calculateEffectiveQualifyingDriver`         | speed=93, q=95, form=50, morale=65, wet=false        | note=94.0, eff=95.41     | note=94.0, eff=95.41     | **PASS (EXATO)** |
| **RF02** | `calculateTrackQualifyingRating`             | car=90, eff=95.41, weight=0.35                       | rating=91.8935           | rating=91.8935           | **PASS (EXATO)** |
| **RF07** | `calculateWeekendSetupProgression`           | TL1/2/3 completas, draws=0.5                         | bonus_ms=225.56875       | bonus_ms=225.56875       | **PASS (EXATO)** |
| **RF10** | `calculateQualifyingAttemptTime`             | base=85790.545, setup=90.2275, z=0, sigma=150        | time_ms=85564.97625      | time_ms=85564.97625      | **PASS (EXATO)** |
| **RF11** | `calculateSprintQualifyingAttemptTime` (SQ1) | dry=true, base=85790.545, setup=32.81, z=0           | delta=650, time=86358.52 | delta=650, time=86358.52 | **PASS (EXATO)** |
| **RF12** | `calculateSprintQualifyingAttemptTime` (SQ3) | dry=true, base=85790.545, setup=32.81, z=0, sq3=true | delta=0, time=85708.52   | delta=0, time=85708.52   | **PASS (EXATO)** |

### Observação Crítica sobre o Vetor RF10:

O vetor RF10 passa com equivalência exata de $10^{-8}$ porque ele testa **apenas** a equação da tentativa isolada:
$$\text{time\_ms} = \text{base\_pace\_ms} - \text{bonus\_ms} + Z \times \sigma$$
Onde o `base_pace_ms` foi fornecido pronto como input ($85.790,545\text{ ms}$). Ou seja, a função pura `calculateQualifyingAttemptTime` em `pureRaceEngine.ts` é **100% fiel ao Excel**. O desvio e a invenção ocorrem **antes**, na montagem do `basePaceMs` pelo orquestrador.

---

## 6. Desempates: Excel vs Código

- **No Excel:**
  - **Q1 (`Classificação!N7`):** Usa `=RANK(M7,$M$7:$M$30,1)+COUNTIF($M$7:M7,M7)-1`. Desempata por tempo e, em caso de empate, pela ordem em que a linha aparece na planilha (inscrição).
  - **Q2 / Q3 (`Classificação!P7`, `R7`):** Usa `=RANK(...)` puro, sem o segundo termo `COUNTIF`. Se dois pilotos empatassem ao milésimo, o Excel atribuiria a mesma posição para ambos (ex.: dois P5, sem P6), o que é incompleto/indefinido para formação de grid.
- **No Código:**
  - `results.sort((a, b) => a.bestTimeMs - b.bestTimeMs || a.driverId.localeCompare(b.driverId))`
  - **Classificação:** **ADAPTAÇÃO DOCUMENTADA**. Trata-se de uma garantia determinística de unicidade e estabilidade exigida para produção de software. Não altera o mérito esportivo do desempate por tempo.

---

## 7. Respostas Finais Obrigatórias

### A. MAIN qualifying vem do Excel?

**PARCIALMENTE.** A lógica de piloto efetivo, rating, acerto dos treinos livres, bônus de tempo, ruído gaussiano, regras de corte (24→18→10) e formação do grid respeitando as fases vêm estritamente do Excel. No entanto, o cálculo do ritmo base de classificação (`basePaceMs`) foi substituído por uma fórmula ad-hoc não constante do Excel, e são realizadas 2 tentativas de volta por fase em vez de 1.

### B. Sprint qualifying vem do Excel?

**PARCIALMENTE.** Segue exatamente o mesmo motor da Qualificação Principal, incluindo a regra específica do Excel para pneus (+650 ms para Médios no seco em SQ1/SQ2, 0 ms em SQ3, e 0 ms na chuva), mas compartilha a mesma divergência na formação de `basePaceMs` e nas 2 tentativas por fase.

### C. Quais fórmulas são tradução direta?

1. Nota de classificação: `qualifying_note = (speed + qualifying) / 2`.
2. Piloto efetivo com forma, moral e chuva: `effective_driver = note * formFactor * moraleFactor * wetFactor`.
3. Rating de classificação pista/piloto: `rating = (1 - driver_weight) * car + driver_weight * effective_driver`.
4. Bônus de acerto de quali: `bonus_ms = (setup / 100) * 0.25 * 1000`.
5. Equação da volta: `time_ms = base_pace_ms - bonus_ms + Z * sigma`.
6. Delta do pneu Médio na Sprint Shootout: $+650\text{ ms}$ em SQ1 e SQ2 no seco, $+0\text{ ms}$ em SQ3 e no molhado.
7. Composição do grid por cortes (Q3: P1-10, Q2: P11-18, Q1: P19-24).

### D. Quais partes são adaptações de software?

1. Seed determinístico Mulberry32 + Box-Muller substituindo o `RAND()` volátil do Excel.
2. Desempate determinístico por `driverId` para garantir grid contínuo de 1 a 24 sem posições repetidas.
3. Persistência e cache em `session_setups` (PocketBase e `localStorage`) com idempotência.
4. Isolamento rigoroso de namespaces entre GP (`apex_q1_...`) e Sprint (`apex_sprint_sq1_...`).
5. Proteção de fluxo (verificação de conclusão de TL3 para Q1 e slot 2 para SQ1).

### E. Existe fórmula esportiva inventada?

**SIM.** A fórmula:
$$\text{ratingGap} = (100 - \text{rating}) \times 35$$
$$\text{basePaceMs} = \text{trackRecordMs} + \text{ratingGap}$$
Não tem respaldo no Excel. É uma criação esportiva do desenvolvedor que ignora a normalização min-max do grid e o spread alvo $B$4 (2.500 ms).

### F. Existe divergência capaz de mudar a ordem dos carros?

**SIM.** Ao adotar uma taxa fixa de $35\text{ ms/ponto}$ em vez de normalizar pelo spread de $2.500\text{ ms}$ entre o melhor e o pior rating do grid, o delta entre equipes de ponta e equipes do fundo do pelotão é reduzido a menos de um terço do valor planejado no Excel, aumentando artificialmente o impacto do sorteio aleatório sobre os atributos dos pilotos e distorcendo a probabilidade de classificação para Q2 e Q3.

### G. Existe hardcode sem origem rastreável?

**SIM.** O multiplicador `35` em:

- `src/services/raceQualifyingOrchestratorService.ts:986`
- `src/services/raceQualifyingService.ts:276`

### H. Qual seria a correção necessária, se houver?

_(NÃO APLICADA NESTA AUDITORIA CONFORME REGRA ESTRITA DE NÃO ALTERAR PRODUÇÃO)_
Quando autorizada uma refatoração de calibração:

1. Obter os ratings de todos os inscritos da sessão e calcular $\max(\text{ratings})$ e $\min(\text{ratings})$ (com guarda para $\max = \min$).
2. Implementar a fórmula canônica de `Classificação!L7`:
   $$\text{basePaceMs} = \text{trackRecordMs} \times (\text{wet} ? 1 + \text{params.light\_rain\_time\_fraction} : 1) + \frac{\max - \text{rating}}{\max - \min} \times \text{params.grid\_target\_spread\_ms}$$
3. Aplicar o `wet_noise_multiplier = 1.5` ao `sigma_ms` quando a sessão for molhada.
4. Definir formalmente se a F1 do jogo deve ter 1 tentativa oficial (como no Excel) ou manter as 2 tentativas como regra de produto documentada.
