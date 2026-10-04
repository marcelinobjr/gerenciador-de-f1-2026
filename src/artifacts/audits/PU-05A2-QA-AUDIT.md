# PU-05A2-P1 QA AUDIT: PERSISTÊNCIA CANÔNICA DA MONTAGEM DE POWER UNITS

**Data/Ciclo:** 2026-04-10 — Fechamento PU-05A2-P1  
**Projeto:** Apex GP Manager (F1 2026)  
**Versão Base / Alvo:** v0.0.911  
**Status de Homologação:** PU-05A2-P1 ENTREGUE (P2 pendente; P3 pendente; C4 não homologado; item #5 não homologado)

---

## 1. ESCOPO DO BLOCO PU-05A2-P1

O bloco **PU-05A2-P1** entrega a infraestrutura de dados e serviços para a **associação e persistência canônica da montagem de Unidades de Potência (Power Units)** para Carro #1 e Carro #2 no contexto de cada Carreira/Save e Equipe do Apex GP Manager.

### Componentes Materializados:

1. `src/services/canonicalPowerUnitAllocationService.ts` (NOVO)
2. `src/test/pu-05a2-canonical-allocation.test.ts` (NOVO)
3. `src/pages/Car.tsx` (CONSUMIDOR ATUALIZADO)
4. `src/pages/InfrastructurePage.tsx` (CONSUMIDOR ATUALIZADO)
5. `src/artifacts/audits/.gitkeep` (CORREÇÃO DE FECHAMENTO — diretório garantido de forma reproduzível)

---

## 2. ARQUITETURA DE DADOS E FONTES DE VERDADE

Para sanar a dispersão e assegurar que nenhuma chave legada ou transitória seja tratada como autoritativa:

- **Fonte Autoritativa Única da Associação:**  
  `teams.car_specifications.power_unit_allocations` persistido no PocketBase (Skip Cloud).  
  Estrutura:

  ```json
  {
    "car1Unit": 1,
    "car2Unit": 2,
    "updatedAt": "2026-04-10T...",
    "careerId": "career_xxx"
  }
  ```

  Este é o registro primário e autoritativo em que a montagem de cada carro (#1 e #2) é fixada no save.

- **Função de `team.engine_history.assignedCar`:**  
  Papel semântico enriquecido e secundário. Ao salvar a alocação, o serviço atualiza cada entrada da PU no inventário (`engine_history`) marcando `assignedCar: 1 | 2` e `status: "instalado"` ou `"reserva"`. Serve para queries ricas de inventário e inferência fallback caso `car_specifications` não esteja preenchido. Não concorre com `car_specifications.power_unit_allocations` como fonte equivalente.

- **Função do Cache (`memoryCache` e `apex_gp_pu_allocation_${careerId}`):**  
  Cache local efêmero e transitório para performance em tela. O cache local é isolado obrigatoriamente por `careerId`. A limpeza do LocalStorage ou do navegador **não** apaga nem corrompe a alocação do save: na ausência de cache, o resolver canônico recupera a alocação diretamente do `team.car_specifications` do save.

- **Desativação de Chaves Globais Antigas:**  
  Chaves globais de navegador (`apex_gp_car1_engine_unit`, `apex_gp_car2_engine_unit`) deixaram de ser autoritativas e não têm o poder de contaminar novos saves ou sobrescrever dados canônicos de carreira (validado no Teste F).

---

## 3. VALIDAÇÃO E REGRAS DE NEGÓCIO

O serviço canônico aplica validação síncrona rigorosa antes de qualquer mutação:

1. **Identificadores Válidos:** `car1Unit` e `car2Unit` devem ser inteiros estritamente positivos.
2. **Sem Conflito / Duplicação:** Carro #1 e Carro #2 não podem utilizar simultaneamente a mesma unidade física (ex.: PU-2 e PU-2 rejeitada).
3. **Existência Física no Inventário:** As unidades alocadas devem existir no `engine_history` da equipe.
4. **Atomicidade e Reversão:** Se o transporte de persistência falhar (ex.: erro de rede/500 no PocketBase), o estado canônico reverte ao anterior e o cache visual não é atualizado (validado no Teste E).

---

## 4. RESULTADOS DA SUÍTE DE TESTES OBRIGATÓRIOS (TESTES A–F)

Executados via Vitest (`pu-05a2-canonical-allocation.test.ts`):

- **TESTE A — DOIS CARROS:** Pass. Alocação simultânea de duas PUs distintas e atualização independente de um único carro.
- **TESTE B — LEITURA E RETOMADA:** Pass. Ambos os consumidores (`Car.tsx` e `InfrastructurePage.tsx`) resolvem o mesmo estado; limpeza de cache preserva integridade.
- **TESTE C — ISOLAMENTO:** Pass. Duas carreiras distintas (Alpha e Beta) têm seus estados rigorosamente isolados sem contaminação mútua.
- **TESTE D — REJEIÇÕES:** Pass. Rejeição com erro descritivo para unidades duplicadas ou inexistentes; estado anterior intacto.
- **TESTE E — FALHA DE GRAVAÇÃO:** Pass. Falha de rede no PocketBase reverte o estado e rejeita alteração visual.
- **TESTE F — CHAVES LEGADAS:** Pass. Chaves antigas globais em `localStorage` são ignoradas em favor da persistência canônica do save.

---

## 5. STATUS DO ENCADINHAMENTO ESPORTIVO

- **PU-05A2-P1:** ENTREGUE e validado.
- **PU-05A2-P2:** PENDENTE (vinculação da PU alocada ao consumo, desgaste e pace da corrida live).
- **PU-05A2-P3:** PENDENTE.
- **C4:** NÃO HOMOLOGADO.
- **Item #5 (Power Unit):** NÃO HOMOLOGADO como um todo até a integração do consumo na corrida.
