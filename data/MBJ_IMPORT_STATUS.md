# Status de Importação do Universo MBJ 2026

Documento de controle, auditoria e rastreamento da seed e catalogação do ecossistema MBJ no jogo de gerenciamento F1 2026.

## 1. Princípios e Segurança de Dados

- **Isolamento de Saves**: O save existente do usuário (`m.blasques@multi.br.com` / `Skip@Pass`, equipe Audi) foi mantido **100% intacto**. Nenhuma equipe ou piloto vinculado ao usuário sofreu alteração destrutiva.
- **Idempotência Garantida**: A migration `pocketbase/migrations/1741500005_seed_mbj_universe.js` verifica a existência prévia de registros antes de qualquer inserção, impedindo duplicações em reexecuções.
- **Fonte da Verdade**: Os dados foram sincronizados a partir de `src/lib/grid-teams-database.ts` e `src/lib/mbj-drivers-data.ts`.

---

## 2. Estrutura dos Grupos MBJ

Os dados dos pilotos e equipes são categorizados em 3 camadas complementares:

### Grupo V — Valores Exatos (Fichas & Contratos Oficiais)

- **Campos**: `id`, `name`, `nationality`, `age`, `team_id`, `category`, `salary`, `contract_end`, `role`.
- **Origem**: Documentação oficial MBJ e alocação das 28 equipes cadastradas.
- **Contagem de Pilotos V**: 135 fichas com dados nominais, idades, salários e prazos de contrato padronizados em USD e convertidos para BRL.

### Grupo P — Projeções & Faixas de Desenvolvimento

- **Campos**: `potentialMin`, `potentialMax`, `f1RacesCompleted`, `superlicensePoints`, `eligibilityStatus`.
- **Elegibilidade Dinâmica**:
  - Pilotos menores de 18 anos são direcionados à categoria **Academia / Formação** (impedidos de assumir vaga titular imediata, elegíveis para reserva/desenvolvimento).
  - Pilotos sem histórico de GPs na F1 e sem os 40 pontos da Superlicença passam pelo status **Exige Homologação FIA**.
  - Pilotos com histórico prévio na F1 ou pontuação completa são classificados como **Totalmente Elegíveis**.
- **Contagem de Pilotos P**: 135 pilotos com faixa de potencial projetada e cálculo de superlicença ativo.

### Grupo O — Operacionais de Simulação (Motor de Corrida)

- **Campos**: `speed`, `consistency`, `rain`, `defense`, `morale`, `physical_condition`, `fatigue`.
- **Compatibilidade**: Total compatibilidade com `f1-race-sim-engine.ts`, `f1-pace-model.ts` e `f1-ai-strategy.ts` sem necessidade de alterar o código do motor de física/drama.
- **Valores operacionais**: Escala 0-100 calculada ponderadamente com atributos de ritmo de classificação, ritmo de corrida, defesa em disputas e desempenho sob chuva.

---

## 3. Resumo Quantitativo do Catálogo

| Categoria                 | Equipes MBJ                                                                  | Pilotos Cadastrados               | Status no Banco          |
| ------------------------- | ---------------------------------------------------------------------------- | --------------------------------- | ------------------------ |
| **Fórmula 1 (Grid 2026)** | 11 construtoras oficiais (incluindo Cadillac F1 Team)                        | 22 titulares + 11 reservas        | Ativo no catálogo & save |
| **Fórmula 2 / F3**        | -                                                                            | 26 pilotos de academia e formação | Semeado no banco         |
| **IndyCar**               | Penske, Andretti, Ganassi/Paddock                                            | 18 pilotos de ponta               | Semeado no banco         |
| **WEC / Endurance**       | Porsche Motorsport, Toyota Gazoo, Ferrari AF Corse                           | 14 pilotos de protótipos          | Semeado no banco         |
| **Fórmula E**             | Jaguar, Porsche FE, Envision, DS                                             | 12 pilotos elétricos              | Semeado no banco         |
| **Clássicas / Legado**    | Jordan, Benetton, Lotus, Copersucar, Fittipaldi, Sauber, Toleman, Alfa Romeo | Fichas históricas ativas          | Semeado no banco         |
| **Agentes Livres**        | -                                                                            | 20+ pilotos sem contrato ativo    | Prontos para contratação |

---

## 4. Integração no Hub `/pilotos` (DriversPage)

A interface em `src/pages/DriversPage.tsx` consome os dados reais do banco PocketBase com fallback resiliente para o catálogo estático:

1. **Aba "Grid F1"**: Visualização das 11 construtoras de 2026 com titulares e reservas.
2. **Aba "Agentes Livres"**: Listagem de pilotos sem vínculo prontos para contratação imediata.
3. **Aba "Mercado & Contratação"**: Suporte a contratação direta (descontando orçamento do save) e pré-contratos para temporadas futuras a partir da Rodada 12, com conversão USD→BRL (R$ 5,75/US$).
4. **Aba "Prospectos & Academia"**: Foco em jovens talentos F2/F3 com visualização clara de potencial projetado e regras de superlicença.

---

## 5. Pendências & Próximos Passos

- [x] Criação da migration idempotente `1741500005_seed_mbj_universe.js`.
- [x] Aplicação bem-sucedida das migrações no backend Skip Cloud.
- [x] Reorganização do Hub `/pilotos` com 4 abas, busca, filtros de equipe/rating e modal dinâmico de contratação.
- [ ] Execução da suíte de testes e validação com `run_qa`.
