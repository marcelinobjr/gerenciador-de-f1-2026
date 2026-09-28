# AUDITORIA E HOMOLOGAÇÃO CANÔNICA DE TENTATIVAS DO QUALIFYING
## QUALI-PROVENANCE-01-FIX-A3B-CLOSE (FECHAMENTO FORMAL)

**Status:** HOMOLOGADA  
**Data:** 2025-05-18  
**Baseline Canônica:** 1 tentativa por participante por fase (`Q1=1`, `Q2=1`, `Q3=1`, `SQ1=1`, `SQ2=1`, `SQ3=1`)  

---

### A. Origem de `effectiveAttemptsPerPhase`
- **Arquivo / Linha:** `src/services/raceQualifyingOrchestratorService.ts`, linha 1027:
  ```ts
  const effectiveAttemptsPerPhase = attemptsPerPhase ?? 1
  ```
- **Contexto:** Definido dentro do método unificado `executeQualifyingPhase()`. A variável governa o loop:
  ```ts
  for (let attNum = 1; attNum <= effectiveAttemptsPerPhase; attNum++) { ... }
  ```

---

### B. Default Real
- **Valor Real:** `1` (estritamente 1 tentativa por participante por fase).
- **Prova:** Quando `attemptsPerPhase` é omitido (`undefined`), a expressão de coalescência nula `?? 1` avalia deterministicamente para `1`. Não há fallback esportivo para 2 ou mais tentativas.

---

### C. Callers que podem fornecer Override
- As interfaces públicas `ExecuteQualifyingPhaseParams` e `ExecuteQ1Params` expõem o campo opcional:
  ```ts
  attemptsPerPhase?: number
  ```
- Métodos que o repassam:
  - `executeQ1(params: ExecuteQ1Params)`
  - `executeQualifyingPhase(params: ExecuteQualifyingPhaseParams)`
  - `executePhase(params: ExecuteQualifyingPhaseParams)`

---

### D. Existência de Configuração Ativa com Valor 2
- **Diagnóstico:** NÃO EXISTE.
- Nem `DEFAULT_SOURCE_RACE_PARAMETERS`, nem os JSONs versionados (`01raceregraseparametros-3c0c5.json`, etc.) contêm chave `attemptsPerPhase` ou valor `2`.

---

### E. Existência de Caller MAIN Fornecendo 2
- **Diagnóstico:** NÃO EXISTE.
- Todos os callers em componentes de UI (`CanonicalQualifyingView.tsx`, `QualifyingPhaseView.tsx`, etc.) e fluxos do jogo não fornecem o parâmetro, operando no default `1`.

---

### F. Existência de Caller Sprint Fornecendo 2
- **Diagnóstico:** NÃO EXISTE.
- Os métodos `executeSQ1`, `executeSQ2` e `executeSQ3` omitem `attemptsPerPhase`, operando no default `1`.

---

### G. Existência de Loop Ativo de Duas Tentativas
- **Diagnóstico:** NÃO EXISTE em produção / baseline canônica.
- O loop de tentativas `for (let attNum = 1; attNum <= effectiveAttemptsPerPhase; attNum++)` itera exatamente 1 vez com o default `1`.

---

### H. Existência de Seleção Ativa de Melhor de Duas ("Best-of-Two")
- **Diagnóstico:** NÃO EXISTE seleção ativa de melhor de duas.
- A variável `bestTimeMs` recebe unicamente o tempo da tentativa 1 (`attNum = 1`). Apenas se um override explícito for fornecido em teste (`attemptsPerPhase = 2`), a condição `if (attemptTimeMs < bestTimeMs)` seleciona a melhor entre as duas.

---

### I. Código Legado Relacionado que NÃO é Executado
- O serviço `RaceQualifyingService` em `src/services/raceQualifyingService.ts` contém métodos legados de qualify (`executeQ1`, `executeQ2`, `executeQ3`), cada um também gerando 1 tentativa (`driver.lapAttempts.Q1 = [att1]`).
- O orquestrador oficial unificado de fim de semana (`raceQualifyingOrchestratorService.ts`) é o caminho canônico do jogo.
- Ambos os serviços concordam rigorosamente com a baseline canônica de 1 tentativa.

---

### J. Classificação das Ocorrências Encontradas
| Conceito / Termo | Ocorrência / Arquivo | Classificação | Status / Efeito |
|---|---|---|---|
| `attemptsPerPhase` | `raceQualifyingOrchestratorService.ts:299, 323, 688, 1027` | ACTIVE (OPCIONAL) | Interface/suporte arquitetural para override |
| `effectiveAttemptsPerPhase` | `raceQualifyingOrchestratorService.ts:1027, 1063` | ACTIVE | Coalesce canônico `?? 1` |
| `for (attNum = 1..effective)` | `raceQualifyingOrchestratorService.ts:1063` | ACTIVE | Executa exatamente 1 iteração |
| `Math.min(bestTimeMs, ...)` | `raceQualifyingService.ts:492, 547` | LEGACY | Mantém melhor tempo entre fases no serviço legado |
| `bestTimeMs = attemptTimeMs` | `raceQualifyingOrchestratorService.ts:1120` | ACTIVE | Armazena tempo da tentativa única |
| `bestAttemptMs` | UI Sprint tests (`race-sprint-quali-ui-squi-c.test.tsx`) | TEST | Mock de UI |

---

### K. Draw Counts Canônicos
- **MAIN Qualifying (24 -> 18 -> 10):**
  - Q1: 24 participantes × 1 tentativa = 24 tentativas
  - Q2: 18 classificados × 1 tentativa = 18 tentativas
  - Q3: 10 finalistas × 1 tentativa = 10 tentativas
  - **Total MAIN:** 52 tentativas
- **Sprint Qualifying (24 -> 18 -> 10):**
  - SQ1: 24 participantes × 1 tentativa = 24 tentativas
  - SQ2: 18 classificados × 1 tentativa = 18 tentativas
  - SQ3: 10 finalistas × 1 tentativa = 10 tentativas
  - **Total Sprint:** 52 tentativas

---

### L. Veredito de Homologação
- A baseline canônica do jogo opera estritamente com **1 tentativa por participante por fase**.
- Nenhuma alteração esportiva no motor de qualificação é necessária ou foi introduzida.
- Homologação: **APROVADA (12/12 PASS na suíte A3B)**.
