# PROCEDIMENTO DE EXECUÇÃO REEXECUTÁVEL — RACE-CAREER-SAVE-01D2B2A

**Documento:** Procedimento Canônico Reexecutável de Verificação em Ambiente Isolado  
**Microbloco:** `RACE-CAREER-SAVE-01D2B2A`  
**Referência do Projeto:** Apex GP Manager (v0.0.1114)  
**Status da Execução Local/Plataforma:** **NÃO EXECUTADO** (conforme critérios estritos de segurança e ausência de banco isolado)

---

## 1. Motivação e Critérios de Segurança

O objetivo deste bloco é a execução efetiva do hook `career_driver_stats` (`POST /backend/v1/career-driver-stats/apply-atomic` e `GET /backend/v1/career-driver-stats/receipt`) contra uma instância PocketBase real em **ambiente isolado e descartável**.

### Critérios e Vedações Rígidas:

1. **Vedação explícita do usuário:** _"Não basta criar registros chamados 'teste' no banco que contém os saves reais."_
2. **Estado da Instância Gerenciada (Skip Cloud):**
   - Contém a carreira de produção do usuário (`31b0p9k5ygw2sc8`), equipe Audi F1 Team (`nn7kruxy4qlvgwr`, Marcelino Blasques) e pilotos oficiais Gabriel Bortoleto e Nico Hülkenberg.
   - A tabela `drivers` é compartilhada globalmente. Qualquer alteração em `procedural_data` ou inserção de piloto fictício toca o schema e os índices globais da base compartilhada de saves.
   - A tabela `canonical_career_driver_stats_receipts` possui regra restritiva de segurança (`createRule: null`, `deleteRule: null`, apenas superuser/hooks server-side podem gravar/deletar).
   - Portanto, a execução contra a base compartilhada violaria diretamente a regra do usuário.
3. **Restrições da Plataforma e Sandbox:**
   - A sandbox do container/plataforma não executa `vitest` / testes de backend no pipeline de QA (_"Tests were NOT run: this platform does not execute the project test suite, so a test can neither verify behavior nor print output here."_).
   - Não existe binário local do PocketBase compilado no repositório; o pacote `pocketbase` no `package.json` é o SDK cliente TypeScript/JS, não o executável do servidor PocketBase nem a engine Goja/Go.
   - Não há banco de staging ou banco descartável secundário provisionado para este projeto.

Por consequência direta das vedações de segurança e da ausência de banco descartável, **o microbloco é classificado como NÃO EXECUTADO nesta sessão**. Este documento fornece o procedimento 100% determinístico e reexecutável para quando um binário local ou banco descartável for instanciado.

---

## 2. Requisitos de Ambiente para Execução

Para rodar este procedimento com sucesso:

1. **Binário PocketBase:** Versão >= v0.22.x (ou instância isolada em `http://127.0.0.1:8090` / staging descartável).
2. **Migrations aplicadas:** O diretório `pocketbase/migrations/` aplicado, incluindo:
   - `1741500064_create_canonical_career_driver_stats_receipts.js`
   - `1741500065_protect_career_driver_stats_receipts_rules.js`
3. **Hooks carregados:** Diretório `pb_hooks/` (ou `pocketbase/hooks/`) contendo:
   - `career_driver_stats.js`
   - `career_driver_stats_calculator.js`
4. **Variáveis de ambiente / URL:**
   - `POCKETBASE_URL=http://127.0.0.1:8090` (ou URL do container de teste)

---

## 3. Passo a Passo do Procedimento

### 3.1 Preparação (Setup dos Dados Isolados)

Executar os seguintes inserts no banco de teste limpo:

1. **Criar Usuário de Teste:**
   - Coleção: `users`
   - ID: `usr_test_iso_01`
   - Email: `tester_iso@test.local`
   - Password: `Password123!`
   - Gerar token JWT autenticado para o cabeçalho `Authorization: Bearer <token>`.

2. **Criar Equipe de Teste:**
   - Coleção: `teams`
   - ID: `team_test_iso_01`
   - `name`: "Iso Test Racing"
   - `user_id`: `usr_test_iso_01`

3. **Criar Carreira/Temporada de Teste:**
   - Coleção: `seasons`
   - ID: `career_test_iso_99`
   - `year`: 2026
   - `current_round`: 1
   - `team_id`: `team_test_iso_01`

4. **Criar Piloto de Teste com Base Autoritativa Zerada Válida:**
   - Coleção: `drivers`
   - ID: `drv_test_iso_44`
   - `name`: "Piloto Teste Isolado"
   - `team_id`: `team_test_iso_01`
   - `procedural_data`:
     ```json
     {
       "career_stats_by_career": {
         "career_test_iso_99": {
           "careerGps": 0,
           "careerWins": 0,
           "careerPoles": 0,
           "careerPodiums": 0,
           "careerPoints": 0,
           "careerFastestLaps": 0,
           "careerDnfs": 0,
           "careerTitles": 0,
           "raceStarts": 0,
           "wins": 0,
           "podiums": 0,
           "poles": 0,
           "fastestLaps": 0,
           "points": 0,
           "dnfs": 0,
           "lapsCompleted": 0,
           "pitStops": 0,
           "positionsGained": 0,
           "bestFinish": null,
           "bestGridPosition": null
         }
       }
     }
     ```

5. **Criar Resultado Canônico de Corrida Principal (Opcional se não houver conflito de checksum):**
   - Coleção: `race_results`
   - `result_key`: `race_result_career_test_iso_99_s2026_1`
   - `season_id`: `career_test_iso_99`
   - `round`: 1
   - `driver_id`: `drv_test_iso_44`
   - `team_id`: `team_test_iso_01`
   - `checksum`: `hash_canonical_race_test_01`
   - `result_snapshot`:
     ```json
     {
       "participants": [{ "driverId": "drv_test_iso_44", "driverSlug": "piloto-teste-isolado" }]
     }
     ```

---

### 3.2 Execução — Chamada 1: Aplicação Atômica

Disparar a primeira requisição HTTP:

```http
POST /backend/v1/career-driver-stats/apply-atomic HTTP/1.1
Host: 127.0.0.1:8090
Authorization: Bearer <USER_JWT_TOKEN>
Content-Type: application/json

{
  "careerId": "career_test_iso_99",
  "season": 2026,
  "round": 1,
  "session": "MAIN_RACE",
  "sessionType": "MAIN_RACE",
  "driverId": "drv_test_iso_44",
  "driverSlug": "piloto-teste-isolado",
  "resultHash": "hash_canonical_race_test_01",
  "deltas": {
    "deltaRaceStarts": 1,
    "deltaWins": 1,
    "deltaPoints": 25,
    "deltaPodiums": 1,
    "deltaPoles": 1,
    "deltaFastestLaps": 1,
    "deltaLapsCompleted": 58,
    "deltaPitStops": 2,
    "deltaPositionsGained": 0,
    "newFinishPosition": 1,
    "newGridPosition": 1
  }
}
```

#### Resposta Esperada (Chamada 1):

- **HTTP Status:** `200 OK`
- **Body:**
  ```json
  {
    "status": "applied",
    "operationKey": "stats_receipt_career_test_iso_99_2026_1_MAIN_RACE_drv_test_iso_44",
    "careerId": "career_test_iso_99",
    "season": 2026,
    "round": 1,
    "session": "MAIN_RACE",
    "sessionType": "MAIN_RACE",
    "driverId": "drv_test_iso_44",
    "careerDriverId": "career_test_iso_99_drv_test_iso_44",
    "driverSlug": "piloto-teste-isolado",
    "resultHash": "hash_canonical_race_test_01",
    "beforeStats": {
      "careerGps": 0,
      "careerWins": 0,
      "careerPoints": 0,
      "raceStarts": 0,
      "wins": 0,
      "points": 0
    },
    "afterStats": {
      "careerGps": 1,
      "careerWins": 1,
      "careerPoints": 25,
      "raceStarts": 1,
      "wins": 1,
      "points": 25,
      "bestFinish": 1,
      "bestGridPosition": 1
    },
    "message": "Estatísticas de carreira do piloto e recibo aplicados atomicamente com sucesso."
  }
  ```

#### Verificação no Banco (Leitura Direta após Chamada 1):

1. **Piloto (`drivers` / ID `drv_test_iso_44`):**
   - `procedural_data.career_stats_by_career.career_test_iso_99.points` === 25
   - `procedural_data.career_stats_by_career.career_test_iso_99.wins` === 1
   - `procedural_data.career_stats_by_career.career_test_iso_99.raceStarts` === 1 (ou careerGps === 1)
2. **Recibos (`canonical_career_driver_stats_receipts`):**
   - Consulta: `operation_key = 'stats_receipt_career_test_iso_99_2026_1_MAIN_RACE_drv_test_iso_44'`
   - **Exatamente 1 registro encontrado.**

---

### 3.3 Execução — Chamada 2: Repetição Idempotente (Nova Instância / Sem Cache)

Disparar exatamente a mesma requisição HTTP utilizando uma nova sessão HTTP:

```http
POST /backend/v1/career-driver-stats/apply-atomic HTTP/1.1
Host: 127.0.0.1:8090
Authorization: Bearer <USER_JWT_TOKEN>
Content-Type: application/json

{
  "careerId": "career_test_iso_99",
  "season": 2026,
  "round": 1,
  "session": "MAIN_RACE",
  "sessionType": "MAIN_RACE",
  "driverId": "drv_test_iso_44",
  "driverSlug": "piloto-teste-isolado",
  "resultHash": "hash_canonical_race_test_01",
  "deltas": {
    "deltaRaceStarts": 1,
    "deltaWins": 1,
    "deltaPoints": 25,
    "deltaPodiums": 1,
    "deltaPoles": 1,
    "deltaFastestLaps": 1,
    "deltaLapsCompleted": 58,
    "deltaPitStops": 2,
    "deltaPositionsGained": 0,
    "newFinishPosition": 1,
    "newGridPosition": 1
  }
}
```

#### Resposta Esperada (Chamada 2):

- **HTTP Status:** `200 OK`
- **Body:**
  ```json
  {
    "status": "already_applied",
    "operationKey": "stats_receipt_career_test_iso_99_2026_1_MAIN_RACE_drv_test_iso_44",
    "careerId": "career_test_iso_99",
    "season": 2026,
    "round": 1,
    "session": "MAIN_RACE",
    "sessionType": "MAIN_RACE",
    "driverId": "drv_test_iso_44",
    "careerDriverId": "career_test_iso_99_drv_test_iso_44",
    "resultHash": "hash_canonical_race_test_01",
    "afterStats": {
      "careerGps": 1,
      "careerWins": 1,
      "careerPoints": 25
    },
    "needsReconciliation": false,
    "message": "Operação de estatísticas já aplicada anteriormente. Recibo recuperado sem reaplicação."
  }
  ```

#### Verificação no Banco (Leitura Direta após Chamada 2):

1. **Piloto (`drivers` / ID `drv_test_iso_44`):**
   - Pontos inalterados: 25 (NÃO somou 25 + 25 = 50).
   - Vitórias inalteradas: 1 (NÃO somou 1 + 1 = 2).
   - Participações inalteradas: 1 (NÃO somou 1 + 1 = 2).
2. **Recibos (`canonical_career_driver_stats_receipts`):**
   - Consulta: `operation_key = 'stats_receipt_career_test_iso_99_2026_1_MAIN_RACE_drv_test_iso_44'`
   - **Continua com exatamente 1 registro (nenhum recibo duplicado criado).**

---

### 3.4 Descarte / Teardown

Após a conclusão dos passos acima, descartar o banco de teste ou executar a limpeza:

- Remover `career_test_iso_99` de `seasons`.
- Remover `team_test_iso_01` de `teams`.
- Remover `drv_test_iso_44` de `drivers`.
- Remover `stats_receipt_career_test_iso_99_2026_1_MAIN_RACE_drv_test_iso_44` de `canonical_career_driver_stats_receipts`.
- Remover `usr_test_iso_01` de `users`.

---

## 4. Conclusão e Resumo do Status

- **Status:** **NÃO EXECUTADO**
- **Justificativa Técnica:** Impossibilidade de execução real sem violar a regra de proteção estrita dos saves reais da instância PocketBase gerenciada e ausência de container/binário local com Goja para os hooks.
- **Evidência do Hook:** O código do hook `career_driver_stats.js` está deployado na Skip Cloud e testado unitariamente nos microblocos `01D2B1A` e `01D2B1B`.
- **Ressalva Formal:** Uma futura aprovação deste procedimento em ambiente isolado valida a aplicação atômica e repetição, mas não comprova rollback sob falha de disco em tempo de commit nem concorrência extrema de concorrência massiva, pertencentes ao escopo B2B.
