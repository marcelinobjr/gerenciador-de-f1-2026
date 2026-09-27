# Registro de Proveniência — FIN-SOURCE-01A

## 1. Identificação da Fonte e Entrega

- **Work Item de Referência:** `FIN-EVO-03`
- **Versão Declarada na Fonte (Workbook):** `FIN-EVO-02`
- **Célula de Versão Declarada:** `Guia!C27` ("FIN-EVO-02 | USD milhões | 5 anos / 60 meses")
- **Versão do Pacote / Contrato de Entrega:** `FIN-SOURCE-01-3FILES-1.0.0`
- **Data de Extração / Pacote Declarada:** `2026-09-27`
- **SHA-256 Declarado do XLSX Original:** `d3f6dafcde83e81b75b4c57f670aef48508c1a842980a16a327179ca1c94f56a`
  _(Nota de auditoria: Este hash NÃO foi recalculado de binário XLSX neste repositório; é registrado estritamente como metadado de proveniência declarado na fonte)._
- **Status do Pacote:** `SOURCE_EXTRACTION_NOT_PRODUCTION_HOMOLOGATION`
- **Status da Configuração Econômica:** `DRAFT` (rascunho versionado, inativo para carreiras em produção)
- **Recuperação de Schema JSON FIN-EVO-03:** `false` — Não se trata de restauração do JSON original FIN-EVO-03 nem homologação de produção do jogo.

---

## 2. Inventário dos Arquivos da Fonte Recebidos

Os 3 arquivos JSON recebidos no pacote de entrega foram materializados e verificados:

| Arquivo no Repositório                          | Nome Original do Contrato           | Função no Módulo                                                                                                                |
| :---------------------------------------------- | :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| `src/assets/01finevoparametros-9bcaa.json`      | `01_FIN_EVO_PARAMETROS.json`        | Parâmetros econômicos (regras `Regras!B6:B39`), catálogos de instalações, motores, peças, equipes preliminares e salários base. |
| `src/assets/02finevocenariosetestes-e6c0c.json` | `02_FIN_EVO_CENARIOS_E_TESTES.json` | Cenário e testes de equivalência Audi 2026–2030 (entradas anuais, saídas anuais esperadas da fonte, schemas e verificações).    |
| `src/assets/03finevoformulasefonte-aac56.json`  | `03_FIN_EVO_FORMULAS_E_FONTE.json`  | Grafo de células, fórmulas e dependências do simulador original em 23 abas.                                                     |

### Hashes SHA-256 Reais Calculados dos JSONs

Os valores calculados a partir dos conteúdos presentes no repositório são:

1. **Arquivo 01 (`01finevoparametros-9bcaa.json`):**
   - SHA-256: `b5278c520db7b4613ff1da33b2bf8bfa79fbc3585b4676be36802524458572b8`
   - Escopo: Regras B6:B39, catálogos preliminares, tolerância e notas de fronteira.

2. **Arquivo 02 (`02finevocenariosetestes-e6c0c.json`):**
   - SHA-256: `e06c78e9185a420b9914713da47fc2bcf814a0f443b793139369f447f526317b`
   - Escopo: `annual_inputs`, `annual_source_outputs`, schemas e comparações aritméticas.

3. **Arquivo 03 (`03finevoformulasefonte-aac56.json`):**
   - SHA-256: `7823e25ec2a373d57f921606a267b2ffae29fceba16b1b744bb6aeb47d25d886`
   - Escopo: Fórmulas canônicas das células (`Plano_5_Anos`, `Custos`, `Estruturas_5_Anos`, `Agenda_60_Meses`, `Resultados`, `Fluxo_60_Meses`).

---

## 3. Diretrizes de Interpretação Econômica e Aritmética

1. **Escala Monetária:**
   - 1,00 unidade no modelo = **US$ 1.000.000,00** (US$ 1 milhão).
   - `Regras!B38` = `0.000001` = **US$ 1,00**.
2. **Comparador Estrito de Tolerância:**
   - `ABS(delta) < tolerância` (estritamente menor `<`, e **não** `<=`).
   - Sem arredondamentos prévios nas etapas intermediárias do cálculo.
   - A mesma tolerância numérica (`1e-6`) é usada para somas de pesos/parcelas adimensionais (não monetárias).
3. **Classificações Financeiras Fundamentais:**
   - Aportes do proprietário e desembolsos de empréstimos **NÃO** são receita.
   - Amortizações de empréstimo **NÃO** são despesa operacional.
   - Reserva financeira indicativa **NÃO** é despesa nem é debitada do caixa.
   - Falta de caixa não gera crédito bancário automático.
4. **Referência C0 / Cref:**
   - `C0` / `Cref` é fixo contratual da carteira (Audi = 260) e **não** acompanha o gasto corrente do time.
5. **Universalidade do Grid:**
   - Os 5 anos modelados (2026–2030) referem-se à trajetória de desenvolvimento da **equipe Audi**, e **NÃO** representam custos universais para as 29 equipes do grid.
6. **Pendências de Dimensionamento Registradas na Fonte:**
   - Custos zerados em `Custos!B10` (reservas/bolsas individuais) e `Custos!B42:B46` (reposições extras, danos, atendimento comercial, scouting, luvas/rescisões, outras operações) constam como **não dimensionados** na fonte (`PENDENTE`). Zero não representa homologação de gratuidade.

---

## 4. Lacunas Conhecidas e Escopo Fora desta Entrega

1. **Regra de Rebaixamento Não Definida:**
   - A planilha-fonte não define condições, regras ou limiares de rebaixamento de equipe nem critérios esportivos de descenso. Permanece registrada como lacuna sem bloqueio para a calculadora isolada.
2. **Sem Ativação Automática em Carreiras:**
   - A configuração gerada é classificada como `DRAFT`. Carreiras ativas continuam operando em seus modelos pré-existentes.
3. **Sem Migração de Saves Legados:**
   - Nenhuma tabela de save existente (`teams`, `seasons`, `financial_ledger`) é convertida ou sobrescrita nesta etapa.
