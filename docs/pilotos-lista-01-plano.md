# Planejamento de Frentes Posteriores — Apex GP Manager

Registro de diretrizes e arquitetura para as próximas etapas de desenvolvimento. Não executar nesta rodada.

---

## 1. CALENDARIO-CIRCUITOS-01
- **Origem dos Assets**: Utilizar imagens da pasta "circuitos" do repositório GitHub do projeto.
- **Associação Canônica**: As imagens devem ser vinculadas estritamente pelo **ID canônico do circuito** (ex.: `monza`, `silverstone`, `interlagos`), e **nunca** pelo índice sequencial da rodada (`roundIndex`), garantindo consistência mesmo em calendários personalizados ou reordenados.
- **Incorporação**: Incorporar localmente ao padrão de assets estáticos do projeto (`public/circuitos/` ou padrão canônico de assets do projeto), evitando dependência de URLs remotas instáveis em runtime.

---

## 2. RETRATOS-GERADOS-01
- **Origem dos Assets**: Utilizar a pasta "pilotos-gerados" do repositório GitHub para retratos de pilotos procedurais/gerados ou sem vínculo direto ao catálogo DRV (`DRV_xxxx`).
- **Resolução Canônica no `resolveDriverPhoto`**:
  - Hierarquia de prioridade obrigatória:
    1. **DRV vinculado** (catálogo real canônico com correspondência comprovada);
    2. **Retrato genérico atribuído** / gerado persistente;
    3. **Atribuição persistente da pasta pilotos-gerados** (chave determinística salva no modelo/save).
  - **Estabilidade Visual**: É estritamente vedado trocar o rosto/retrato a cada renderização. A atribuição de uma face procedural a um piloto gerado deve ser estável e persistente (seed estável ou ID armazenado no registro do piloto).
  - **Tratamento de Exceção**: A ausência de vínculo DRV não constitui erro de carregamento e não deve disparar logs de falha nem quebrar o fluxo visual da aplicação.

---

## 3. ESPECIFICAÇÃO PEÇAS / PU / ADUO
- **Ciclo de Ciclo de Vida**: O ciclo técnico completo de componentes deve seguir as fases canônicas:
  `Projeto` → `Desenvolvimento` → `Fabricação` → `Instalação` → `Avaliação`.
- **Natureza do ADUO (Ajuste de Desempenho / Atualização de Operação)**:
  - O ADUO pertence à **lógica do fabricante da Power Unit (PU)**, e não à equipe cliente/construtora individual.
  - **NÃO** é bônus automático para a equipe pior colocada no campeonato.
- **Pré-requisitos Obrigatórios Antes da Implementação**:
  1. Definir a versão regulamentar de referência (Regulamento FIA 2026);
  2. Estabelecer índice comparável e auditável de desempenho do motor;
  3. Distinguir formalmente a regra técnica real de simplificações de jogabilidade;
  4. Custos, prazos e ganhos técnicos de desenvolvimento de PU e ADUO exigem fonte documental comprovada ou aprovação específica do usuário.
- **Status**: NÃO implementar nesta rodada.

---

## 4. Diagnóstico Técnico: Max Verstappen (Situação Contratual)
- **Sintoma Observado**: Max Verstappen aparecia como "Agente livre" ou com vínculo inconsistente na interface, apesar de ter registro no banco com `team_id` apontando para a McLaren (`76vs00hy9hu24q1`) ou Red Bull no catálogo esportivo.
- **Causa Provável Identificada**:
  - No arquivo `src/lib/canonical-driver-database.ts` (função `getActiveDriverTeamBinding`), a precedência de resolução contratual continha uma trava de legado (`isKnownLegacyGlitch`) cobrindo especificamente o ID de runtime do Verstappen (`de3isw3re1ji2wj`) e Leclerc (`lc6cma46f01dgrj`) quando vinculados à McLaren (`76vs00hy9hu24q1`).
  - Quando um piloto possui registro canônico (`canonicalDriver`) mas não possui o campo `canonical_contract` ativo gravado no banco, a Precedência 2 retornava `canonicalDriver.teamId` (que no master aponta para a Red Bull `red_bull`). No entanto, se o ID do time não casasse com a coleção de `teams` em runtime (onde as equipes usam chaves de banco ou IDs dinâmicos) ou caísse na trava de glitch sem fallback de contrato, o status caía para `free_agent` (Precedência 4).
  - Além disso, na listagem da tabela e nos dados de catálogo, a pretensão salarial de agentes livres e a identificação de salário contratual requerem checagem precisa do `salaryUsd` e do vínculo `teamId`/`teamKey`.
- **Arquivos Suspeitos**:
  - `src/lib/canonical-driver-database.ts` (linhas 1180–1270: `getActiveDriverTeamBinding` e mapeamentos `CANONICAL_DRIVER_IDENTITY_ALIASES`)
  - `src/pages/DriversPage.tsx` (normalização de pilotos em `unifiedDrivers` e colunas da tabela).
