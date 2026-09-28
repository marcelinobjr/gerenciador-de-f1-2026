# QUALI-PROVENANCE-01-FIX-A3B-CLOSE: Relatório de Homologação

**Data/Rodada:** QUALI-PROVENANCE-01-FIX-A3B-CLOSE  
**Status de Homologação:** QUALI-PROVENANCE-01-FIX-A3B HOMOLOGADA  
**Versão Base:** v0.0.637 / commit `fa08bb2` (checkpoint v0.0.642 `b97f0b4`)  
**Engenharia/Domínio:** Apex GP Manager (Qualifying Provenance & Single-Attempt Canon)

---

## A. HEAD

- **Versão:** v0.0.642 (após checkpoint inicial)
- **Commit Base:** `fa08bb2` (v0.0.637) / `b97f0b4` (v0.0.642)
- **Working Tree:** Limpa e verificada em cada transição.

---

## B. ATTEMPTS (Auditoria Cirúrgica do Caminho de Tentativas)

1. **Onde nasce `effectiveAttemptsPerPhase`:**
   - No método `executeQualifyingPhase` da classe `RaceQualifyingOrchestratorService` (`src/services/raceQualifyingOrchestratorService.ts`, linha 1027):
     ```typescript
     const effectiveAttemptsPerPhase = attemptsPerPhase ?? 1
     ```
2. **Default real:**
   - É estritamente `1` via coalescência nula `?? 1`. Se `attemptsPerPhase` for omitido ou `undefined`, exatamente 1 tentativa é executada.
3. **Quais callers podem fornecer override:**
   - A interface `ExecuteQualifyingPhaseParams` e `ExecuteQ1Params` expõem o campo opcional `attemptsPerPhase?: number`.
   - Callers internos do orchestrator:
     - `executeQ1`: repassa `params.attemptsPerPhase` (opcional).
     - `executeQ2`, `executeQ3`: não expõem parâmetro de tentativas (repassam omitido `undefined`).
     - `executeSprintQualifyingSQ1`, `executeSprintQualifyingSQ2`, `executeSprintQualifyingSQ3`: não expõem parâmetro de tentativas (repassam omitido `undefined`).
     - `executeFullQualifying`: repassa `params.attemptsPerPhase` (opcional).
4. **Config ativa com valor 2?**
   - **NÃO.** `DEFAULT_SOURCE_RACE_PARAMETERS` (`src/lib/race/pureRaceEngine.ts`) não define e nem possui campo `attemptsPerPhase` ou `effectiveAttemptsPerPhase`.
5. **Caller MAIN fornece 2?**
   - **NÃO.** Nem `CanonicalQualifyingView.tsx`, nem a página de final de semana, nem os fluxos canônicos de UI passam `attemptsPerPhase: 2`. Todos operam no default estrito de 1 tentativa.
6. **Caller Sprint fornece 2?**
   - **NÃO.** SQ1, SQ2 e SQ3 chamam `executeQualifyingPhase` sem passar `attemptsPerPhase`, caindo em `undefined ?? 1` = 1.
7. **Loop ativo de duas tentativas?**
   - **NÃO.** O loop `for (let attNum = 1; attNum <= effectiveAttemptsPerPhase; attNum++)` executa exatamente para `attNum = 1` quando `effectiveAttemptsPerPhase = 1`.
8. **Seleção ativa de melhor de duas?**
   - **NÃO.** Embora o acumulador `if (attemptTimeMs < bestTimeMs)` esteja presente para generalização algorítmica, com `effectiveAttemptsPerPhase = 1` há estritamente 1 draw e nenhuma seleção entre múltiplos tempos ocorre.
9. **Código legado relacionado não executado?**
   - `raceQualifyingService.ts` (legado) possui métodos `executeQ1`, `executeQ2`, `executeQ3` que criam `lapAttempts[phase] = [att1]`, executando estritamente uma única tentativa por fase (`runAttempt(state, driver, phase, 1)`). Não há loop ou best-of-two no legado.

---

## C. BASELINE REAL

- **Q1:** 1 tentativa por participante (24 pilotos = 24 tentativas).
- **Q2:** 1 tentativa por classificado (18 pilotos = 18 tentativas).
- **Q3:** 1 tentativa por finalista (10 pilotos = 10 tentativas).
- **SQ1:** 1 tentativa por participante (24 pilotos = 24 tentativas).
- **SQ2:** 1 tentativa por classificado (18 pilotos = 18 tentativas).
- **SQ3:** 1 tentativa por finalista (10 pilotos = 10 tentativas).
- **Baseline unificada:** O regulamento desportivo e o código em produção já usavam estritamente 1 tentativa por fase (`effectiveAttemptsPerPhase ?? 1`). A rodada A3B formaliza e blinda essa baseline contra regressões.

---

## D. BEST-OF-TWO (Mapeamento e Classificação de Ocorrências)

| Ocorrência / Símbolo                                                  | Localização                                           | Classificação         | Status / Descrição                                                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| `attemptsPerPhase?: number`                                           | `ExecuteQ1Params` / `ExecuteQualifyingPhaseParams`    | CONFIG-SUPPORT        | Suporte tipado para parametrização opcional. Omitido na produção.                             |
| `effectiveAttemptsPerPhase = attemptsPerPhase ?? 1`                   | `RaceQualifyingOrchestratorService:1027`              | ACTIVE (CANONICAL)    | Coalesce canônico. Avalia sempre para 1 na ausência de override.                              |
| `for (let attNum = 1; attNum <= effectiveAttemptsPerPhase; attNum++)` | `RaceQualifyingOrchestratorService:1063`              | ACTIVE (CANONICAL)    | Loop de tentativas. Com default=1, itera exatamente 1 vez (`attNum = 1`).                     |
| `if (attemptTimeMs < bestTimeMs) bestTimeMs = attemptTimeMs`          | `RaceQualifyingOrchestratorService:1120`              | ACTIVE (CANONICAL)    | Atribuição do único tempo da tentativa ao piloto. Sem segundo draw concorrente.               |
| `driver.lapAttempts.Q1 = [att1]`                                      | `raceQualifyingService.ts:434`                        | LEGACY-DEAD / STANDBY | Serviço legado. Também executa estritamente 1 tentativa (`att1`).                             |
| `driver.lapAttempts.Q2 = [att1]`                                      | `raceQualifyingService.ts:489`                        | LEGACY-DEAD / STANDBY | Serviço legado. Estritamente 1 tentativa.                                                     |
| `driver.lapAttempts.Q3 = [att1]`                                      | `raceQualifyingService.ts:544`                        | LEGACY-DEAD / STANDBY | Serviço legado. Estritamente 1 tentativa.                                                     |
| `attemptsPerPhase: 2` (teste de estresse de override)                 | `quali-provenance-01-fix-a3b.test.ts:442`             | TEST ONLY             | Prova de que a arquitetura suportaria override se configurado, mas a fonte oficial não o faz. |
| `attemptsPerPhase: 1`                                                 | `quali-provenance-01-fix-a2.test.ts` / `a3a1.test.ts` | TEST ONLY             | Fixtures explícitas comprovando que a baseline nominal é 1.                                   |

Nenhum código ativo seleciona o melhor de duas voltas na produção canônica.

---

## E. DRAW COUNT

- **MAIN Qualifying (24 → 18 → 10):**
  - Q1: 24 tentativas
  - Q2: 18 tentativas
  - Q3: 10 tentativas
  - **Total de tentativas esportivas:** 52
- **Sprint Qualifying (24 → 18 → 10):**
  - SQ1: 24 tentativas
  - SQ2: 18 tentativas
  - SQ3: 10 tentativas
  - **Total de tentativas esportivas:** 52
- **Contagem de Draws:** Cada tentativa realiza exatamente 1 amostragem de ruído normal box-muller (`getStandardNormal`). Draws auxiliares de inicialização de sessão não afetam a contagem unívoca de 52 voltas qualificatórias por evento.

---

## F. TESTES (A3B-01..12 e Regressões Provenance)

### Tabela de Verificação A3B-01 a A3B-12 (`src/test/quali-provenance-01-fix-a3b.test.ts`):

| Teste      | Descrição Canônica                                           | PASS / FAIL | Evidência de Execução                                                                      |
| ---------- | ------------------------------------------------------------ | :---------: | ------------------------------------------------------------------------------------------ |
| **A3B-01** | Q1 — cada participante executa exatamente 1 tentativa        |  **PASS**   | 24 pilotos em Q1; cada um com `attempts.length === 1` e `attemptNumber === 1`.             |
| **A3B-02** | Q2 — cada classificado executa exatamente 1 tentativa        |  **PASS**   | 18 classificados em Q2; cada um com `attempts.length === 1`.                               |
| **A3B-03** | Q3 — cada finalista executa exatamente 1 tentativa           |  **PASS**   | 10 finalistas em Q3; cada um com `attempts.length === 1`.                                  |
| **A3B-04** | SQ1 — 1 tentativa por participante                           |  **PASS**   | 24 pilotos em SQ1; cada um com `attempts.length === 1` e `attemptNumber === 1`.            |
| **A3B-05** | SQ2 — 1 tentativa por classificado                           |  **PASS**   | 18 classificados em SQ2; cada um com `attempts.length === 1`.                              |
| **A3B-06** | SQ3 — 1 tentativa por finalista                              |  **PASS**   | 10 finalistas em SQ3; cada um com `attempts.length === 1`.                                 |
| **A3B-07** | DRAW COUNT MAIN — fixture 24→18→10 = 52 tentativas           |  **PASS**   | 24 (Q1) + 18 (Q2) + 10 (Q3) = 52 tentativas no total do qualifying principal.              |
| **A3B-08** | DRAW COUNT SPRINT — 24+18+10 = 52 tentativas                 |  **PASS**   | 24 (SQ1) + 18 (SQ2) + 10 (SQ3) = 52 tentativas no total do sprint shootout.                |
| **A3B-09** | SEM BEST-OF-TWO — único draw determina o tempo da fase       |  **PASS**   | O `bestTimeMs` do resultado é rigorosamente idêntico ao `timeMs` de `attempts[0]`.         |
| **A3B-10** | DEFAULT CANÔNICO — sem override explícito, opera com 1       |  **PASS**   | Chamada com `attemptsPerPhase: undefined` produz estritamente 1 tentativa por piloto.      |
| **A3B-11** | OVERRIDE NÃO ATIVO — parâmetros fonte não impõem >1          |  **PASS**   | `DEFAULT_SOURCE_RACE_PARAMETERS.attemptsPerPhase` é `undefined`; fonte não impõe >1.       |
| **A3B-12** | RELOAD/IDEMPOTÊNCIA — reabrir sessão não cria nova tentativa |  **PASS**   | Reexecução sobre chave já persistida retorna o estado idêntico com 1 tentativa por piloto. |

**Resultado A3B:** 12/12 PASS.

### Regressões de Provenance:

- **QFIX-A1 (`src/test/quali-provenance-01-fix-a1.test.ts`):** 6/6 PASS (min-max rating delta, spread 2500ms).
- **QFIX-A2 (`src/test/quali-provenance-01-fix-a2.test.ts`):** 10/10 PASS (MAIN e SPRINT conectados ao núcleo canônico).
- **QFIX-A3A1 (`src/test/quali-provenance-01-fix-a3a1.test.ts`):** 10/10 PASS (chuva +8% apenas em baseQualiMs).
- **QFIX-A3A2 (`src/test/quali-provenance-01-fix-a3a2.test.ts`):** 12/12 PASS (sigma wet ×1.5 isolado no ruído estocástico).
- **Total de testes da trilha QUALI-PROVENANCE:** 50/50 PASS.

---

## G. BIT-STABILITY

- **MAIN Seco:** Idêntico ao fix A3A2 (mesmos tempos de volta, ordem do grid e deltas de P1 a P24).
- **MAIN Molhado:** Idêntico ao fix A3A2 (fator base 1.08 + sigma wet 225ms preservados sem derivação de seed).
- **Sprint Seco:** Idêntico ao fix A3A2.
- **Sprint Molhado:** Idêntico ao fix A3A2.
- **Conclusão:** 100% bit-stable. Como nenhuma linha de código esportivo ou gerador de números aleatórios foi alterada nesta rodada, a reprodutibilidade determinística bit-a-bit é mantida com exatidão estrita.

---

## H. QA DE FECHAMENTO

- **Setup & Dependências:** Limpo e atualizado.
- **Oxlint (Análise Estática):** 0 erros.
- **TypeScript Typecheck (`tsc`):** 0 erros.
- **Vite Build:** Build de produção bem-sucedido.
- **Suíte Global de Testes:** 1.825/1.825 testes PASS (em 79 arquivos de teste).
- **Preview & Rotas:**
  - Aplicação inicia normalmente sem erros no console.
  - Rotas auditadas: `/corrida` (WeekendV2Page / CanonicalQualifyingView), `/pilotos` (DriversPage), `/standings`, `/team`.
  - Grid MAIN e Sprint abrem com integridade formal e estrutural.

---

## I. ESTADO FINAL

- **Houve mudança de código esportivo?** **NÃO.** A produção já operava canonicamente com 1 tentativa por fase (`effectiveAttemptsPerPhase ?? 1`). A rodada foi estritamente de comprovação formal, auditoria cirúrgica e homologação.
- **Arquivos alterados nesta rodada:**
  - `src/artifacts/audits/QUALI-PROVENANCE-01-FIX-A3B-CLOSE.md` (criado e preenchido com a homologação A–I).
- **Versão:** v0.0.642 (ou subsequente ao commit de homologação).
- **Working tree:** Limpa.
- **Veredito:** **QUALI-PROVENANCE-01-FIX-A3B HOMOLOGADA com sucesso.**
- **Próxima etapa (NÃO INICIADA):** QUALI-BALANCE-AUDIT-02.
