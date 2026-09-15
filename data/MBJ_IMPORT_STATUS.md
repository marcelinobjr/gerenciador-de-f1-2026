# Auditoria e Status de Importação MBJ 2026

**Última Atualização:** 2026-03-09  
**Status Geral:** ✅ Concluído e Validado  
**Fonte Oficial F1 Academy:** `Banco_F1_Academy_MBJ_2026-a1f69.pdf` (17 pilotas oficiais, 45 campos completos)  
**Fonte Geral MBJ:** Editor Oficial MBJ 2026

---

## 1. Sumário Executivo da Importação F1 Academy MBJ 2026

A categoria F1 Academy foi totalmente atualizada com o banco oficial do editor, substituindo notas provisórias e expandindo o grid para **17 pilotas oficiais fixas**:

- **16 pilotas pré-existentes** atualizadas por upsert (`pil_0030`, `pil_0011`, `pil_0026`, `pil_0059`, `pil_0080`, `pil_0045`, `pil_0007`, `pil_0027`, `pil_0032`, `pil_0050`, `pil_0060`, `pil_0043`, `pil_0020`, `pil_0067`, `pil_0017`, `pil_0039`).
- **1 pilota criada**: Ella Stevens (`pil_0135`, Rodin Motorsport / McLaren Oxagon).
- **Zero impacto** em saves protegidos (save Audi do usuário `m.blasques@multi.br.com` preservado sem alteração).
- **Sem duplicatas**: migração idempotente `1741500008_update_f1_academy_official_mbj_2026.js`.

---

## 2. Conformidade com as Regras Oficiais do Documento

| Regra Documento                 | Descrição da Regra                                                                                              | Status de Implementação                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **R01 (Visibilidade)**          | V pública; P estimada ou faixa; O oculta restrita ao motor.                                                     | ✅ Interface exibe atributos esportivos P e estado por faixas/qualitativo; parâmetros O persistem para o motor sem vazamento. |
| **R02 (Escalas e Ausência)**    | Escala 0–100, clamp após atualização. Sem rótulos globais arbitrários.                                          | ✅ Competências calibradas na escala global MBJ sem reescalar artificialmente para 100.                                       |
| **R03 (Sem Overall)**           | Não armazenar overall nem ordenar mercado por média universal.                                                  | ✅ F1 Academy exibe indicador de faixa/faixa esportiva ("59–57", etc.), sem nota OVR derivada na listagem e no perfil.        |
| **R08 (Adaptação F1)**          | Meta de adaptação 80; taxas rápida (14%), intermediária (8%) e lenta (3,5%).                                    | ✅ Registrado com adaptabilidade, adaptação F1 e etapas estimadas até F1=80.                                                  |
| **R19 (Validação de Cadastro)** | Datas coerentes, 14 tetos de competência, pesos de negociação somando 1, vínculos compatíveis, máximo 4 traços. | ✅ Validado via função `validateF1AcademyOfficialData()`. 100% das 17 pilotas aprovadas nos testes de consistência.           |
| **Dinheiro (USD)**              | JSON e jogo operam em US$ (bolsa anual de desenvolvimento).                                                     | ✅ 100% dolarizado no PocketBase e UI.                                                                                        |
| **Status LIVRE**                | Disponibilidade no mercado F1 mantendo vínculo esportivo na F1 Academy.                                         | ✅ Campo `f1MarketStatus: 'LIVRE'` e distinção clara entre equipe operadora e apoiadora de marca.                             |
| **Coleções Vazias**             | Ausência no cenário (sem patrocinadores financeiros extras inicializados).                                      | ✅ Estrutura limpa sem inventar contratos ou relações privadas fictícias.                                                     |

---

## 3. Grid Oficial F1 Academy MBJ 2026 (17 Pilotas)

| ID         | Nome              | Nascimento | Idade | N°  | Equipe Operadora | Apoiadora Marca  | Vel (P) | Con (P) | Chu (P) | Def (P) | Ref. Anual (US$) | Status F1 |
| ---------- | ----------------- | ---------- | ----- | --- | ---------------- | ---------------- | ------- | ------- | ------- | ------- | ---------------- | --------- |
| `pil_0030` | Nina Gademan      | 2003-08-30 | 22    | 3   | MP Motorsport    | Alpine           | 60      | 58      | 60      | 58      | $150.000         | LIVRE     |
| `pil_0011` | Megan Bruce       | 2004-08-02 | 21    | 4   | Campos Racing    | TAG Heuer        | 52      | 53      | 52      | 52      | $80.000          | LIVRE     |
| `pil_0026` | Emma Felbermayr   | 2007-01-27 | 19    | 5   | Rodin Motorsport | Audi             | 58      | 54      | 53      | 50      | $120.000         | LIVRE     |
| `pil_0059` | Mathilda Paatz    | 2008-08-01 | 17    | 8   | PREMA Racing     | Aston Martin     | 52      | 52      | 49      | 54      | $80.000          | LIVRE     |
| `pil_0080` | Payton Westcott   | 2009-03-20 | 16    | 9   | PREMA Racing     | Mercedes         | 51      | 49      | 45      | 45      | $70.000          | LIVRE     |
| `pil_0045` | Alba Hurup Larsen | 2008-12-12 | 17    | 12  | MP Motorsport    | Ferrari          | 59      | 57      | 55      | 54      | $150.000         | LIVRE     |
| `pil_0007` | Lisa Billard      | 2009-09-12 | 16    | 14  | ART Grand Prix   | Gatorade         | 53      | 50      | 51      | 45      | $80.000          | LIVRE     |
| `pil_0027` | Rafaela Ferreira  | 2005-04-18 | 20    | 18  | Campos Racing    | Racing Bulls     | 55      | 54      | 55      | 51      | $100.000         | LIVRE     |
| `pil_0032` | Natalia Granada   | 2008-03-18 | 17    | 19  | PREMA Racing     | SEPHORA          | 48      | 47      | 46      | 49      | $60.000          | LIVRE     |
| `pil_0050` | Ella Lloyd        | 2005-07-20 | 20    | 20  | Rodin Motorsport | McLaren          | 61      | 60      | 61      | 62      | $180.000         | LIVRE     |
| `pil_0060` | Alisha Palmowski  | 2006-09-21 | 19    | 21  | Campos Racing    | Red Bull Racing  | 64      | 62      | 59      | 65      | $200.000         | LIVRE     |
| `pil_0135` | Ella Stevens      | 2006-09-10 | 19    | 28  | Rodin Motorsport | McLaren Oxagon   | 54      | 50      | 53      | 46      | $80.000          | LIVRE     |
| `pil_0043` | Esmee Kosterman   | 2005-04-16 | 20    | 32  | MP Motorsport    | LEGO             | 51      | 54      | 51      | 49      | $80.000          | LIVRE     |
| `pil_0020` | Ava Dobson        | 2008-06-09 | 17    | 55  | Hitech           | American Express | 51      | 50      | 51      | 49      | $70.000          | LIVRE     |
| `pil_0067` | Rachel Robertson  | 2007-07-28 | 18    | 56  | Hitech           | PUMA             | 54      | 52      | 61      | 53      | $90.000          | LIVRE     |
| `pil_0017` | Kaylee Countryman | 2010-01-03 | 16    | 91  | ART Grand Prix   | Haas             | 48      | 48      | 44      | 44      | $60.000          | LIVRE     |
| `pil_0039` | Jade Jacquet      | 2009-12-01 | 16    | 95  | ART Grand Prix   | Williams         | 49      | 48      | 47      | 48      | $60.000          | LIVRE     |

---

## 4. Estrutura dos 45 Campos do Documento

1. **Identidade (1–8):** `id`, `nome`, `nacionalidades`, `nascimento` (calculado em 2026-03-01), `origem` (ACADEMY), `status` (LIVRE), `numero_preferido`, `modo_carreira` (CONTEMPORANEO).
2. **Performance P (9–19):** `velocidade`, `classificacao`, `ritmo_corrida`, `consistencia`, `largada`, `ultrapassagem`, `defesa`, `chuva`, `gestao_pneus`, `gestao_energia`, `feedback`.
3. **Mental P (20–22):** `pressao`, `concentracao`, `resiliencia`.
4. **Personalidade P/O (23–27):** `aggressividade`, `ambicao`, `lealdade`, `profissionalismo`, `temperamento` (O - oculto).
5. **Relações P (28):** `relacoes` (inicializadas vazias por ausência de cenário).
6. **Comercial V/P (29–31):** `reputacao`, `popularidade` (global/local), `acordos_comerciais` (vazios).
7. **Contrato P/O (32–33):** `contratos` (LIVRE no mercado F1), `preferencias` (6 pesos somando 1.0, salário mínimo).
8. **Evolução O (34–37):** `tetos` (14 competências), `aprendizagem`, `curva_carreira` (início de declínio, perdas anuais, horizonte aposentadoria), `adaptabilidade`.
9. **Estado Atual P (38–42):** `moral` (65), `confianca` (50), `condicao_fisica` (100), `estresse` (20), `adaptacao` (F1, carro 0, equipe 0).
10. **Histórico V/P (43–44):** `biografia` (3–5 linhas, fatos comprovados por fontes), `historico` de resultados.
11. **Traços P (45):** `tracos` (TR09 e TR10 com status editorial "Não revelado").

---

## 5. Mapeamento no Banco de Dados (PocketBase)

No banco de dados do PocketBase (`drivers`), foram sincronizadas as colunas padrão do schema existente:

- `name`, `nationality`, `age`, `speed`, `consistency`, `rain`, `defense`, `salary`, `contract_end`, `category: 'f1_academy'`, `morale`, `physical_condition`.
- Dados expandidos (45 campos, tetos, perdas anuais, pesos negociais, biografias oficiais e traços) são fornecidos pelo módulo TypeScript unificado `src/lib/f1-academy-official-data.ts` que enriquece os objetos no runtime da aplicação e na interface sem risco de degradação estrutural.
