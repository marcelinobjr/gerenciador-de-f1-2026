# INVENTÁRIO DO LOTE DE 18 — PREPARAÇÃO DO 01R-F (CAREER-NUMBERS-01)

## Declaração Formal de Escopo e Recuperação

> **STATUS DO LOTE**: LISTA ORIGINAL DO LOTE DE 18 NÃO RECUPERADA INTEGRALMENTE NO HISTÓRICO LOCAL.
> Apenas os registros documentados e comprováveis em disco são listados. Nenhum piloto fictício ou estimado foi inventado para completar a contagem de 18.
> O presente documento prepara a rodada 01R-F e confronta a baseline real (`src/data/driverCareerStats2025.ts`) com o estado dos pilotos no HEAD atual.

---

## Tabela de Inventário e Confrontação

| Nome do Piloto                                   | ID Canônico     | Chave na Baseline (`DRIVER_CAREER_STATS_2025`)                                                           | Correção Prevista (Largadas) | Valor Atual em Disco | Localização da Evidência           | Situação Atual                |
| :----------------------------------------------- | :-------------- | :------------------------------------------------------------------------------------------------------- | :--------------------------- | :------------------- | :--------------------------------- | :---------------------------- |
| **Mick Schumacher**                              | `mbj-037`       | `'mbj-037'`, `schumacher`                                                                                | 43 GPs                       | `43`                 | `driverCareerStats2025.ts:173`     | **MATERIALIZADO**             |
| **Logan Sargeant**                               | `mbj-038`       | `'mbj-038'`, `sargeant`                                                                                  | 36 GPs                       | `36`                 | `driverCareerStats2025.ts:177`     | **MATERIALIZADO**             |
| **Nyck de Vries**                                | `mbj-039`       | `'mbj-039'`, `devries`                                                                                   | 11 GPs                       | `11`                 | `driverCareerStats2025.ts:181`     | **MATERIALIZADO**             |
| **Sébastien Bourdais**                           | `mbj-128`       | `'mbj-128'`, `bourdais`, `sebastien_bourdais`, etc.                                                      | 27 GPs                       | `27`                 | `driverCareerStats2025.ts:215`     | **MATERIALIZADO**             |
| **Daniil Kvyat**                                 | `mbj-137`       | `kvyat`, `daniil_kvyat`, `driver_daniil_kvyat`, `drv_daniil_kvyat` _(ausente chave `'mbj-137'`)_         | 110 GPs                      | `110` (via aliases)  | `driverCareerStats2025.ts:209-212` | **DIVERGÊNCIA**               |
| **Nikita Mazepin**                               | `mbj-136`       | `mazepin`, `nikita_mazepin`, `driver_nikita_mazepin`, `drv_nikita_mazepin` _(ausente chave `'mbj-136'`)_ | 21 GPs                       | `21` (via aliases)   | `driverCareerStats2025.ts:222-225` | **DIVERGÊNCIA**               |
| _Registros restantes (12 pilotos do lote de 18)_ | _A identificar_ | _Não mapeados_                                                                                           | _Não especificado_           | _N/A_                | _Registros históricos do projeto_  | **PENDENTE / NÃO RECUPERADO** |

---

## Diagnóstico Detalhado das Situações

1. **MATERIALIZADO (Schumacher, Sargeant, De Vries, Bourdais)**:
   - Apresentam chave primária canônica `'mbj-XXX'` explícita e aliases correspondentes em `src/data/driverCareerStats2025.ts`.
   - O valor de largadas em GPs confere 100% com a correção prevista (43, 36, 11 e 27 respectivamente).
2. **DIVERGÊNCIA (Kvyat, Mazepin)**:
   - Os valores de carreira estão corretos em disco (`races: 110` para Kvyat e `races: 21` para Mazepin).
   - No entanto, o mapeamento no dicionário `DRIVER_CAREER_STATS_2025` contém apenas aliases baseados em strings de nome (`kvyat`, `daniil_kvyat`, etc.), **sem** a chave ID canônica `'mbj-137'` e `'mbj-136'`.
   - _Nota de Governança_: Nesta rodada, `src/data/driverCareerStats2025.ts` é estritamente PROIBIDO de ser alterado. Portanto, essa divergência foi mapeada e classificada formalmente, ficando para a execução do 01R-F subsequente.
3. **PENDENTE / NÃO RECUPERADO (Demais 12 registros)**:
   - A especificação original da rodada não forneceu a lista completa nominal dos 18 registros do CAREER-NUMBERS-01.
   - Conforme regra de integridade: a lista original NÃO foi presumida nem inventada.
   - Fica registrado o marco para recuperação no fechamento integral do CAREER-NUMBERS-01.

---

## Estado do CAREER-NUMBERS-01

- O pacote CAREER-NUMBERS-01 **continua NÃO homologado integralmente**.
- A presente entrega encerra a correção de proveniência documental (IMPORT-DRIVERS-135-137A) e consolida a preparação do 01R-F sem violar o congelamento de `src/data/driverCareerStats2025.ts`.
