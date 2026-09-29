# SILVERSTONE-RACE-REVIEW-01: Auditoria e Correção do Fluxo de Fim de Semana Sprint

## Identificação

- **Subfase:** SILVERSTONE-RACE-REVIEW-01A (MICRO-PATCH — CORREÇÃO DO FLUXO DE FIM DE SEMANA SPRINT)
- **Data:** 2026-03-31
- **Status:** HOMOLOGADA

---

## 1. Causa Raiz

Na esteira de sessões do fim de semana Sprint:

1. `weekendScheduleConfig.ts` e `weekendProgressionService.ts` apresentavam divergências em relação ao cronograma com TL1 e TL2 antes da Sprint Qualifying (SQ1, SQ2, SQ3) e Corrida Sprint, seguido da Classificação do GP (Q1, Q2, Q3) e GP Principal.
2. `SPRINT_WEEKEND_SCHEDULE` possuía formato legado sem as sessões discriminadas e sem a presença do Treino Livre 2 (TL2).
3. A regra de cálculo de voltas de Sprint estava duplicada ou com fórmula antiga `Math.ceil(100 / circuitLength)` em vez da regra canônica determinística: `sprintLaps = Math.round(mainRaceLaps * 0.30)`.

---

## 2. Sequência de Fim de Semana

### Weekend Normal (Preservado)

`TL1 → TL2 → TL3 → Q1 → Q2 → Q3 → RACE` (7 etapas)

### Weekend Sprint (Canônico Atualizado)

`TL1 → TL2 → SQ1 → SQ2 → SQ3 → SPRINT → Q1 → Q2 → Q3 → RACE` (10 etapas)

- **TL1 e TL2:** Treinos livres executam normalmente, geram evolução de setup e persistem no slot/localStorage.
- **TL3:** NÃO EXISTE no fim de semana Sprint (`NOT_RUN` / ausente do cronograma).
- **SQ1, SQ2, SQ3:** Qualificação da Sprint (eliminatória 24 → 18 → 10 pilotos).
- **SPRINT:** Corrida curta (~30% da distância do GP).
- **Q1, Q2, Q3:** Classificação para o GP principal de domingo, realizada APÓS a corrida Sprint.
- **RACE:** Grande Prêmio de domingo.

---

## 3. Relação Sprint Grid vs GP Grid

- **Sprint Starting Grid (`SPRINT_STARTING_GRID`):** Derivado exclusivamente do resultado de `SQ1`, `SQ2` e `SQ3`.
- **GP Starting Grid (`STARTING_GRID`):** Derivado exclusivamente do resultado de `Q1`, `Q2` e `Q3` do GP.
- **Isolamento Estrito:** A Corrida Sprint NÃO define e NÃO altera a ordem de largada do Grande Prêmio.

---

## 4. Regra de Distância da Sprint (30%)

A quantidade de voltas da Corrida Sprint segue a regra matemática unificada:
$$\text{sprintLaps} = \text{round}(\text{mainRaceLaps} \times 0.30)$$

Exemplos canônicos:

- Silverstone (52 voltas): $52 \times 0.30 = 15.6 \rightarrow \mathbf{16\text{ voltas}}$
- Bahrein / Miami (57 voltas): $57 \times 0.30 = 17.1 \rightarrow \mathbf{17\text{ voltas}}$
- Mônaco (78 voltas): $78 \times 0.30 = 23.4 \rightarrow \mathbf{23\text{ voltas}}$

---

## 5. Arquivos Alterados

1. `src/types/weekend-slot-types.ts`
   - Suporte aos tipos de slot `SQ1`, `SQ2`, `SQ3`, `SPRINT_RACE`, `MAIN_QUALIFYING`, `MAIN_RACE` e extensão de `WeekendSlotNumber`.
2. `src/services/weekendScheduleConfig.ts`
   - Alinhamento da esteira Sprint: `tp1 → tp2 → sq1 → sq2 → sq3 → sprint_race → q1 → q2 → q3 → race`.
   - Regra de desbloqueio: `sq1` liberado após `tp2`; `q1` liberado após `sprint_race`.
3. `src/services/weekendProgressionService.ts`
   - `SPRINT_WEEKEND_SCHEDULE` canônico com 10 etapas completas.
   - Normalização retrocompatível de sessões concluídas (`q3` normaliza `q1`, `q2`, `qualifying`; `sq3` normaliza `sq1`, `sq2`, `sprint_qualifying`).
4. `src/services/canonicalRaceInitializationService.ts`
   - Função canônica `calculateSprintLaps` e `getCanonicalSprintLaps` aplicando determinismo estrito `Math.round(mainRaceLaps * 0.30)`.
5. `src/services/weekendSlotSequenceService.ts`
   - Sequência canônica atualizada com TL1 e TL2 antes das fases de Sprint.
6. `src/test/sprint-weekend-review-01a.test.ts`
   - Suíte de 20 casos de teste `SPRINT-A-01` a `SPRINT-A-20`.
7. `src/test/weekend-progression-01a.test.ts`
   - Atualizado Cenário D para validar TL1 e TL2 no formato Sprint.

---

## 6. Cobertura de Testes (SPRINT-A-01 a SPRINT-A-20)

- **SPRINT-A-01:** Weekend normal permanece TL1→TL2→TL3→Q1→Q2→Q3→Race (PASS)
- **SPRINT-A-02:** Weekend Sprint: TL1→TL2→SQ1→SQ2→SQ3→Sprint→Q1→Q2→Q3→Race (PASS)
- **SPRINT-A-03:** TL3 ausente em Sprint (PASS)
- **SPRINT-A-04:** TL2 presente em Sprint (PASS)
- **SPRINT-A-05:** TL2 completa e libera SQ1 (PASS)
- **SPRINT-A-06:** SQ1 libera SQ2 (PASS)
- **SPRINT-A-07:** SQ2 libera SQ3 (PASS)
- **SPRINT-A-08:** SQ3 libera Sprint (PASS)
- **SPRINT-A-09:** Sprint libera GP Q1 (PASS)
- **SPRINT-A-10:** Sprint result não define GP grid (PASS)
- **SPRINT-A-11:** Sprint grid vem de Sprint Qualifying (PASS)
- **SPRINT-A-12:** GP grid vem de GP Qualifying (PASS)
- **SPRINT-A-13:** `sprintLaps = round(mainRaceLaps * 0.30)` (PASS)
- **SPRINT-A-14:** 52 laps → 16 (PASS)
- **SPRINT-A-15:** 57 laps → 17 (PASS)
- **SPRINT-A-16:** 78 laps → 23 (PASS)
- **SPRINT-A-17:** Sprint sem pit obrigatório (mandatedStops = 0) (PASS)
- **SPRINT-A-18:** Sprint sem regra obrigatória de dois compostos (minimumDryCompounds = 1) (PASS)
- **SPRINT-A-19:** Save/reload preserva slot Sprint correto (PASS)
- **SPRINT-A-20:** Silverstone (Round 11) executa sequência completa de 10 sessões (PASS)

---

## 7. Próxima Etapa

- **SILVERSTONE-RACE-REVIEW-01B:** HUD climático permanente: seco/chuva fraca/chuva forte, intensidade, temperatura somente se existir fonte real, atualização em tempo real (NÃO INICIADO).
