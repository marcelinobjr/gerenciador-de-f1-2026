# CHECKPOINT DA ENTREGA: RACE-TL-01B

**Data:** 10/03/2025  
**Versão:** v0.0.570  
**Status da Entrega:** "Progressão e apuração de acerto dos TLs integradas ao fluxo normal/sprint e à interface de teste"  
**Objetivo Concluído:** Extensão do serviço de apuração canônica de treinos livres para TL1, TL2 e TL3, sequenciamento estrito nos formatos Normal (TL1 → TL2 → TL3 → Q1) e Sprint (apenas TL1 → SQ1), proteção contra reexecução/regressão histórica, persistência canônica e conexão mínima aos controles e painéis de interface.

---

## 1. Arquivos Alterados e Criados

1. **`src/services/racePracticeSetupService.ts`**:
   - Generalização de `processAndPersistTL1Setup` para `processAndPersistPracticeSetup(session: 'TL1'|'TL2'|'TL3', inputs)`.
   - Compatibilidade retroativa garantida: `processAndPersistTL1Setup` mantido delegando para a nova rotina.
   - Bloqueio estrito no serviço para formato Sprint: rejeita chamadas de TL2 e TL3 quando `isSprint === true`.
   - Validação da ordem regulamentar cronológica no formato normal: TL2 exige TL1 concluído para a vaga do carro; TL3 exige TL2 concluído.
   - Implementação de `getCarAccumulatedSetup(...)` para consultar o acerto atual do carro e o próximo passo sem rebaixamento histórico ao consultar snapshots passados.
   - Idempotência estrita, persistência canônica atômica em `session_setups` (coleção PocketBase com espelho em `localStorage`).

2. **`src/services/racePracticeService.ts`**:
   - Adicionada verificação no orquestrador para garantir ordem estrita cronológica (TL2 após TL1, TL3 após TL2) em fins de semana normais.

3. **`src/services/canonicalPracticeIntegrationAdapter.ts`**:
   - Integração atômica entre o adapter e o `racePracticeSetupService`.
   - Adicionado método auxiliar `persistSessionCarSetup` para persistência canônica a partir de eventos da interface.

4. **`src/components/race/SessionCarPreparationPanel.tsx`**:
   - Conexão do painel de cockpit/garagem do monoposto à persistência canônica via `racePracticeSetupService.getCarAccumulatedSetup`.
   - Exibição de badge com acerto acumulado canônico e bônus em ms (Quali) e s/volta (Corrida).

5. **`src/components/race/PracticeCarCockpitCard.tsx`**:
   - Exibição do acerto canônico acumulado por carro/vaga na interface de cockpit ao vivo.

6. **`src/components/race/PracticePreparationView.tsx`**:
   - Exibição no cabeçalho do acerto canônico de ambos os monopostos e indicação clara de formato Sprint (apenas TL1).

7. **`src/pages/WeekendV2Page.tsx`**:
   - Conexão nas rotinas de avanço contínuo e `simulateRemaining` para persistir o acerto canônico nas carreiras habilitadas via `CanonicalPracticeIntegrationAdapter.persistSessionCarSetup`.

8. **`src/test/race-tl-01b-focused-proofs.test.ts`**:
   - Bateria de testes focados B01–B07 cobrindo todos os critérios de aceite exigidos pela especificação.

---

## 2. Configuração Utilizada

- **Versão:** `RACE-SOURCE-01A-DRAFT-1.0.0`
- **Valores das Sessões de Treino (Tables.practices / Tables.practice_sessions):**
  - **TL1:** 24 voltas planejadas, ganho máx. 40.
  - **TL2:** 26 voltas planejadas, ganho máx. 40.
  - **TL3:** 18 voltas planejadas, ganho máx. 30.
- **Parâmetros de Bônus:**
  - `max_setup_qualifying_bonus_seconds = 0.25` s (250 ms)
  - `max_setup_race_bonus_seconds_per_lap = 0.15` s/volta

---

## 3. Política de Piloto Reserva Documentada

- O acerto técnico acumulado está vinculado ao **monoposto / vaga do carro** (`${teamId}_car${carIndex}`), e **NÃO** como atributo pessoal do piloto ou contrato.
- Quando um piloto novato/reserva disputa o TL1 pelo Carro 1, o acerto apurado permanece gravado no chassi daquele carro.
- Ao retornar o piloto titular no TL2 (ou TL3/Quali), ele herda integralmente o acerto conquistado pelo reserva no TL1.
- Não há duplicação de carros, não há alteração nos contratos de piloto e não é permitida segunda aplicação na mesma sessão/vaga trocando o piloto após a conclusão.

---

## 4. Origem dos Cálculos de Tempo de Treino e Estado Atual

- **Cálculo de Acerto e Bônus:** 100% canônico e versionado através de `pureRaceEngine.ts`, `racePracticeSetupService.ts` e `racePracticeService.ts`.
- **Tempos de Volta e Melhores Voltas:** Originários dos modelos de simulação em pista existentes (`CanonicalPracticeV2Runner`), sem alegações de equivalência integral às fórmulas finais de qualificação/corrida nesta rodada.

---

## 5. Provas Focadas de Aceite (B01–B07)

- **B01 (NORMAL / RF07):** Aprovado. TL1 (32.81) → TL2 (65.62) → TL3 (90.2275). Bônus quali final: 225.56875 ms. Bônus corrida: 0.13534125 s/volta. Pronto para Q1.
- **B02 (SPRINT / RF08):** Aprovado. TL1 (32.81), pronto para SQ1. Rejeição explícita de TL2 e TL3 com erro controlado.
- **B03 (ORDEM E REPETIÇÃO):** Aprovado. TL3 sem TL2 rejeitado. Idempotência em repetições. Consulta histórica a TL1 mantém acerto atual de 90.2275.
- **B04 (RELOAD E RECUPERAÇÃO):** Aprovado. Descarte de memória cache e recarga a partir do storage canônico idêntico à execução contínua.
- **B05 (LIMITES E ISOLAMENTO):** Aprovado. Teto de 100% de acerto e isolamento total entre rodadas e carreiras.
- **B06 (RESERVA E POLÍTICA):** Aprovado. Reserva no TL1 do Carro 1 acumula acerto para o titular utilizar no TL2.
- **B07 (REGRESSÃO DE ATIVAÇÃO):** Aprovado. Carreira não versionada retorna null e preserva fluxo legado intacto.

---

## 6. Prova Visual

- A conexão foi realizada diretamente nos componentes visuais (`SessionCarPreparationPanel`, `PracticeCarCockpitCard`, `PracticePreparationView`). Em ambiente sem navegador interativo (headless CI), a validação visual em tela fica documentada como pendente de inspeção humana no preview.

---

## 7. Pendências para a Próxima Etapa (RACE-QUALI-01)

1. Conexão do bônus de qualifying apurado (`qualifyingBonusSeconds`) à apuração dos tempos dos setores Q1, Q2 e Q3.
2. Integração do consumo de pneus do parque fechado entre o fim dos treinos livres e o início da classificação.
3. Não iniciar RACE-QUALI-01 automaticamente nesta rodada.
