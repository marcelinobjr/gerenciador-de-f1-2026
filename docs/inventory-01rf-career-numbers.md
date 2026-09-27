# INVENTÁRIO DO LOTE DE 18 — PREPARAÇÃO DO 01R-F / CN-RECOVERY-01A (CAREER-NUMBERS-01)

## Declaração Formal de Escopo e Transição Operacional

> **STATUS DO LOTE**: LISTA ORIGINAL DO LOTE DE 18 NÃO FOI RECUPERADA INTEGRALMENTE NO HISTÓRICO LOCAL.
> A lista original do lote de 18 não foi recuperada integralmente. Ela deixou de ser dependência para a continuidade do trabalho. O inventário do estado atual passa a orientar os próximos lotes, sem pretensão de reconstruir a lista original.
> Nenhum piloto fictício ou estimado foi inventado para completar a contagem de 18.
> O presente documento registra o resultado da etapa CN-RECOVERY-01A, confronta a baseline real (`src/data/driverCareerStats2025.ts`) com o estado dos pilotos no HEAD atual e apresenta o novo inventário estrutural de 137 pilotos como referência operacional.

---

## Tabela de Inventário e Confrontação (Pilotos do Lote Original Conhecidos)

| Nome do Piloto                                   | ID Canônico     | Chave na Baseline (`DRIVER_CAREER_STATS_2025`)                                          | Correção Prevista (Largadas) | Valor Atual em Disco | Localização da Evidência                    | Situação Atual                 |
| :----------------------------------------------- | :-------------- | :-------------------------------------------------------------------------------------- | :--------------------------- | :------------------- | :------------------------------------------ | :----------------------------- |
| **Mick Schumacher**                              | `mbj-037`       | `'mbj-037'`, `schumacher`                                                               | 43 GPs                       | `43`                 | `driverCareerStats2025.ts:173`              | **MATERIALIZADO**              |
| **Logan Sargeant**                               | `mbj-038`       | `'mbj-038'`, `sargeant`                                                                 | 36 GPs                       | `36`                 | `driverCareerStats2025.ts:177`              | **MATERIALIZADO**              |
| **Nyck de Vries**                                | `mbj-039`       | `'mbj-039'`, `devries`                                                                  | 11 GPs                       | `11`                 | `driverCareerStats2025.ts:181`              | **MATERIALIZADO**              |
| **Sébastien Bourdais**                           | `mbj-128`       | `'mbj-128'`, `bourdais`, `sebastien_bourdais`, etc.                                     | 27 GPs                       | `27`                 | `driverCareerStats2025.ts:215`              | **MATERIALIZADO**              |
| **Daniil Kvyat**                                 | `mbj-137`       | `'mbj-137'`, `kvyat`, `daniil_kvyat`, `driver_daniil_kvyat`, `drv_daniil_kvyat`         | 110 GPs                      | `110`                | `driverCareerStats2025.ts:208-213`          | **RESOLVIDO / CORRIGIDO**      |
| **Nikita Mazepin**                               | `mbj-136`       | `'mbj-136'`, `mazepin`, `nikita_mazepin`, `driver_nikita_mazepin`, `drv_nikita_mazepin` | 21 GPs                       | `21`                 | `driverCareerStats2025.ts:221-226`          | **RESOLVIDO / CORRIGIDO**      |
| _Registros restantes (12 pilotos do lote de 18)_ | _Descontinuado_ | _Substituído pelo inventário estrutural de 137 pilotos_                                 | _Sob nova governança_        | _N/A_                | _docs/career-numbers-01-current-state.json_ | **SUBSTITUÍDO POR INVENTÁRIO** |

---

## Diagnóstico Detalhado das Situações

1. **MATERIALIZADO (Schumacher, Sargeant, De Vries, Bourdais)**:
   - Apresentam chave primária canônica `'mbj-XXX'` explícita e aliases correspondentes em `src/data/driverCareerStats2025.ts`.
   - O valor de largadas em GPs confere 100% com a correção prevista (43, 36, 11 e 27 respectivamente).
2. **RESOLVIDO / CORRIGIDO (Kvyat, Mazepin - CN-RECOVERY-01A)**:
   - Os valores de carreira estão corretos em disco (`races: 110` para Kvyat e `races: 21` para Mazepin).
   - Constatou-se que o resolvedor consumido pela ficha do piloto (`PilotProfileDialog` via `getDriverCareerStats`) consulta diretamente `getDriverCareerBaseline2025(pilot.id)`. Quando a ficha passava o objeto com ID canônico literal `mbj-136` ou `mbj-137`, o resolvedor não encontrava a chave literal no dicionário `DRIVER_CAREER_STATS_2025`, caindo em fallback sobre propriedades diretas do objeto.
   - Em conformidade com a autorização expressa do Bloco 2, as chaves canônicas `'mbj-136'` e `'mbj-137'` foram adicionadas a `src/data/driverCareerStats2025.ts`, preservando integralmente os valores numéricos históricos e garantindo resolução direta e bijetiva.
3. **SUBSTITUIÇÃO DO LOTE PERDIDO PELO INVENTÁRIO ESTRUTURAL**:
   - A lista original do lote de 18 não foi recuperada integralmente e deixou de ser dependência.
   - O artefato estrutural `docs/career-numbers-01-current-state.json` foi gerado programaticamente para todos os 137 pilotos do catálogo canônico `MBJ_2026_PILOTS`.

---

## Mapeamento de Pendências Reais (Três Eixos Operacionais)

As pendências identificadas não devem ser somadas como pilotos distintos, pois referem-se a dimensões complementares de análise:

### A. Pendências Estruturais (Vínculos, Chaves e Catálogo)

- **11 pilotos com inconsistência estrutural de catálogo**: possuem `f1RacesCompleted > 0` cadastrado diretamente em `src/lib/mbj-drivers-data.ts`, mas não possuem chave canônica nem registro no dicionário `DRIVER_CAREER_STATS_2025`. São eles:
  - `mbj-108` (Paul di Resta): 59 GPs no catálogo MBJ, ausente da baseline 2025.
  - `mbj-113` (Mika Salo): 110 GPs no catálogo MBJ, ausente da baseline 2025.
  - `mbj-114` (Pedro Diniz): 98 GPs no catálogo MBJ, ausente da baseline 2025.
  - `mbj-115` (Ricardo Zonta): 37 GPs no catálogo MBJ, ausente da baseline 2025.
  - `mbj-118` (Antonio Pizzonia): 20 GPs no catálogo MBJ, ausente da baseline 2025.
  - `mbj-121` (Cristiano da Matta): 28 GPs no catálogo MBJ, ausente da baseline 2025.
  - `mbj-122` (Christian Klien): 49 GPs no catálogo MBJ, ausente da baseline 2025.
  - `mbj-130` (Romain Grosjean): 179 GPs no catálogo MBJ, ausente da baseline 2025.
  - `mbj-131` (Marcus Ericsson): 97 GPs no catálogo MBJ, ausente da baseline 2025.
  - `mbj-132` (Takuma Sato): 90 GPs no catálogo MBJ, ausente da baseline 2025.
  - `mbj-133` (Alexander Rossi): 5 GPs no catálogo MBJ, ausente da baseline 2025.
- **99 pilotos com baseline não encontrada (`NAO_ENCONTRADO`)**: resolvem via fallback zero (`MBJ_FALLBACK_ZERO`). A maioria são pilotos de outras categorias (Indy, WEC, F2, F3, F1 Academy) que legitimamente nunca disputaram GPs de F1, mas carecem de registro explícito no dicionário 2025.
- **0 erros de execução (`ERRO`)** e **0 ambiguidades (`AMBIGUO`)**: resolução determinística em 100% dos 137 registros.

### B. Pendências Factuais (Validação Esportiva Externa 2025)

- **137 pilotos com validação factual pendente**: a validação factual externa com corte histórico em 31/12/2025 NÃO foi executada nesta rodada e está expressamente fora do escopo do CN-RECOVERY-01A.
- Será objeto de rodadas factuais subsequentes (lotes de pesquisa documental esportiva).

### C. Pendências de Integração (Composição, Consumo e Persistência)

- O fluxo de composição entre baseline histórica (catálogo/dicionário 2025) e eventos simulados do save (`race_results` e `season_histories`) está validado e funcional em `getDriverCareerStats`.
- Persistência e reload de resultados simulados operam de forma puramente derivada e idempotente, sem duplicar nem descartar baselines históricas.

---

## Estado do CAREER-NUMBERS-01

- O pacote CAREER-NUMBERS-01 **continua NÃO homologado integralmente**.
- A presente entrega encerra a verificação e correção de vínculos (CN-RECOVERY-01A) e materializa o inventário do estado atual (`docs/career-numbers-01-current-state.json`), que passa a balizar os próximos lotes de trabalho.
