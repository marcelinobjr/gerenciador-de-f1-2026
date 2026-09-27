# Checkpoint da Microentrega RACE-TL-01A

**Status**: Apuração e persistência do acerto do TL1 implementadas e testadas  
**Data**: 2026-09-27  
**Work Item**: RACE-TL-01A  
**Pacote de Origem**: RACE-SOURCE-01 (1.0.0)  
**Configuração Versionada Vinculada**: `RACE-SOURCE-01A-DRAFT-1.0.0` (DRAFT, inativa em `race_versioned_configs`)

---

## 1. Resumo Executivo da Entrega

A microentrega **RACE-TL-01A** cumpriu rigorosamente seu objetivo único:

1. Conectar as entradas do treino livre (TL1) à função pura oficial de ganho de acerto (`calculatePracticeSetupGain` e `applySetupCap` em `src/lib/race/pureRaceEngine.ts`).
2. Resolver os parâmetros da sessão de TL1 (24 voltas planejadas, ganho máximo 40, tempo offset 1.5s, probabilidade de pneu macio 0.3) a partir da configuração versionada vinculada, sem valores arbitrários hardcoded.
3. Gravar o resultado canonicamente com identificador estável determinístico na coleção PocketBase `session_setups` (dentro de `driver_strategies.practiceSetupApplications`) e no cache local resiliente (`localStorage`).
4. Garantir que a leitura do resultado após descarte do estado em memória e reload reconstrua o mesmo estado com exatidão matemática (< 1e-4) e idempotência estrita.
5. Manter integridade regulamentar: zero modificações em atributos permanentes de pilotos/carros, sem marcação indevida de conclusão de GP e sem avanço prematuro para Q1/SQ1.

---

## 2. Arquivos Materializados e Alterados

- **`src/services/racePracticeSetupService.ts`** _(Novo)_:
  - Implementa a classe e serviço singleton `racePracticeSetupService`.
  - Operação canônica: `processAndPersistTL1Setup(inputs: PracticeSetupApplicationInputs): Promise<PracticeSetupProcessResult>`.
  - Método de leitura: `loadPersistedApplication(...)`.
  - Resolução de regras: `resolvePracticeSessionRules(...)`.
  - Gerador de chave determinística: `buildPracticeSetupFactKey(...)` no padrão `tl_setup_${careerId}_${seasonId}_r${round}_${session}_${teamId}_c${carIndex}`.
- **`src/test/race-tl-01a-focused-proofs.test.ts`** _(Novo)_:
  - Suíte de testes exercitando as 4 provas focadas (A01 a A04).
- **`docs/race-tl-01a-checkpoint.md`** _(Este documento)_:
  - Registro de proveniência, resultados esperados vs. obtidos, e pendências para RACE-TL-01B.

---

## 3. Estrutura Canônica de Persistência

A gravação foi realizada reutilizando a coleção já existente no banco de dados PocketBase:

- **Coleção**: `session_setups` (base)
  - `team_id`: identificador da carreira (`careerId`)
  - `season_id`: identificador da temporada (`seasonId`)
  - `round`: rodada do fim de semana
  - `session`: `'tp1'`
  - `driver_strategies`: objeto JSON contendo o mapa `practiceSetupApplications[applicationKey]`
  - `notes`: cópia de segurança em texto serializado
- **Idempotência**:
  - Chave determinística: `tl_setup_${careerId}_${seasonId}_r${round}_TL1_${teamId}_c${carIndex}`
  - Primeira execução: grava e retorna `isAlreadyCompleted: false`.
  - Repetição idêntica: retorna o registro persistido com `isAlreadyCompleted: true`.
  - Tentativa conflitante: lança `Error('Conflito de aplicação...')`.

---

## 4. Configuração e Tabela Utilizada

- **Versão**: `RACE-SOURCE-01A-DRAFT-1.0.0`
- **Coleção PocketBase**: `race_versioned_configs`
- **Tabela de Sessões**: `tables.practices` (espelho do `practice_sessions` do JSON 01)
  - Linha TL1:
    - `laps`: 24
    - `max_setup_gain`: 40
    - `time_offset_sec`: 1.5
    - `soft_tyre_prob`: 0.3
- **Parâmetros de Bônus**:
  - `max_setup_qualifying_bonus_seconds`: 0.25 s (100 de acerto = 0.250 s de bônus no quali)
  - `max_setup_race_bonus_seconds_per_lap`: 0.15 s/volta (100 de acerto = 0.150 s/volta no ritmo de corrida)

---

## 5. Resultados das Provas Focadas (A01–A04)

| Prova     | Cenário de Teste                                                                                                            | Esperado                                                                                       | Obtido                                                                | Status       |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------ |
| **A01**   | **Cálculo e Gravação**<br>TL1, acerto 0, 24 voltas compl., 24 planejadas, max ganho 40, consistência 93, sorteio 0.5 (RF04) | Ganho 32.81<br>Acerto 32.81<br>1 aplicação persistida em `session_setups`                      | Ganho: 32.8100<br>Acerto: 32.8100<br>1 registro em `session_setups`   | **APROVADO** |
| **A02**   | **Repetição sem Duplicação**<br>Mesma chamada submetida novamente                                                           | Mesmo resultado (32.81), `isAlreadyCompleted: true`, zero novos registros, zero novos sorteios | Acerto 32.81 mantido, `isAlreadyCompleted: true`, 1 registro no banco | **APROVADO** |
| **A03**   | **Reload**<br>Descarte do estado em memória, recriação da instância de serviço, leitura da persistência                     | Mesmo participante, versão de config, ganho e acerto (32.81), sem duplicação                   | Dados reidratados com exatidão, acerto 32.81, zero duplicação         | **APROVADO** |
| **A04-1** | **Isolamento**<br>Diferentes carreiras ou rodadas                                                                           | Chaves independentes, dados isolados, sem vazamento entre carreiras/rodadas                    | Chaves `career_alpha`, `career_beta` e `round 2` separadas            | **APROVADO** |
| **A04-2** | **Erro Explícito**<br>Configuração vazia ou inexistente                                                                     | `RaceConfigLoadError` lançado antes de qualquer gravação, zero registros salvos                | Exceção explícita lançada, 0 registros gravados                       | **APROVADO** |
| **A04-3** | **Conflito Explícito**<br>Tentativa de sobrescrita com parâmetros divergentes                                               | Erro com mensagem "Conflito de aplicação..." sem sobrescrever silenciosamente                  | Erro disparado, dados protegidos                                      | **APROVADO** |

---

## 6. Regressões e Vetores de Equivalência Preservados

- Todos os 15 vetores da primeira onda (RF01..RF12, RF21, RF22, RF28) em `src/test/race-first-wave-vectors.test.ts` permanecem aprovados.
- Testes de loader versionado (`src/test/race-loader.test.ts`) continuam íntegros.
- Nenhuma alteração foi realizada em carreiras normais ou no motor de corrida ativo.

---

## 7. Pendências Exatas para RACE-TL-01B

A microentrega RACE-TL-01A cumpriu exclusivamente seu escopo focado. Ficam formalmente registradas as pendências para as próximas etapas (RACE-TL-01B e seguintes):

1. **Integração de TL2 e TL3**:
   - Acumulação sequencial do acerto de TL1 para TL2 (26 voltas planejadas, max ganho 40) e TL3 (18 voltas planejadas, max ganho 30) em formato normal.
   - Aplicação da regra de teto máximo (100) na soma cumulativa do fim de semana (RF07: TL1 32.81 → TL2 65.62 → TL3 90.2275).
2. **Formato Sprint (R01/RF08)**:
   - Bloqueio definitivo de TL2 e TL3 em fins de semana Sprint (apenas TL1 contribui com acerto, com próximo passo SQ1).
3. **Escalação e Substituição por Reservas (Rookie FP1)**:
   - Política de concessão do bônus de acerto gerado pelo reserva no TL1 para o chassi do carro (Carro 1 ou Carro 2) para usufruto do titular nas sessões seguintes.
4. **Interface e Apresentação visual**:
   - Exibição do acerto apurado nos cards de cockpit e preparação de TL.
