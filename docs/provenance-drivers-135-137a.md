# NOTA DE AUDITORIA E PROVENIÊNCIA DOCUMENTAL: IMPORT-DRIVERS-135-137A

## 1. Contexto e Sequência Histórica Honesta

1. **Importação Anterior (v0.0.558 / commit b731367)**:
   A importação de pilotos incluiu Nikita Mazepin (`mbj-136`), Daniil Kvyat (`mbj-137`) e a atualização in place de Sébastien Bourdais (`mbj-128`).
   Naquela rodada inicial, foi relatado o uso indevido da numeração visível na arte gráfica dos retratos como justificativa/origem para preenchimento de campos de cadastro.
2. **Revisão e Decisão**:
   A arte gráfica (retratos em JPG/WEBP) **nunca** deve alimentar campos cadastrais de dados desportivos ou contratuais (`preferredNumber`, número de inscrição ativo na temporada, equipe, contrato, nacionalidade, estatísticas ou atributos de desempenho).
   O "25" visível na arte de Bourdais (`DRV_0137.jpg`) **não** autoriza preenchimento do seu `preferredNumber`.
   Para Mazepin e Kvyat, os valores numéricos `9` e `26` foram mantidos após **validação independente por fontes primárias documentais da Fórmula 1**, e não pela arte.
   Para Sébastien Bourdais (`mbj-128`), o campo `preferredNumber` é estritamente mantido como `null` / `undefined`.
3. **Nova Referência de Origem**:
   A proveniência oficial dos números preferidos passa a ser unicamente a documentação primária oficial abaixo descrita.

---

## 2. Distinção Obrigatória: FATO DOCUMENTADO vs. DECISÃO DO JOGO

- **FATO DOCUMENTADO**: O piloto escolheu e utilizou oficialmente o número na Fórmula 1 durante sua carreira histórica, conforme evidenciado em comunicados e registros oficiais da FIA e equipes de F1.
- **DECISÃO DO JOGO**: O Apex GP Manager adota esse número como a preferência inicial cadastral (`preferredNumber`) do piloto em seu perfil base (2026).
- **RESTRIÇÕES RIGOROSAS**:
  - NÃO afirma inscrição ativa em temporada nem atribui número de inscrição no save.
  - NÃO garante disponibilidade nem reserva automática global do número no campeonato.
  - NÃO confere propriedade exclusiva ao piloto sobre o numeral.
  - NÃO altera o resolvedor de números ativos de corrida (`getDriverActiveNumber`).

---

## 3. Matriz de Proveniência dos Pilotos

### Nikita Mazepin

- **ID Canônico**: `mbj-136`
- **Nome**: Nikita Mazepin
- **Campo Auditado**: `preferredNumber`
- **Valor no Cadastro**: `9`
- **Retrato Canônico**: `DRV_0135.jpg` (resolvido via `resolveDriverPhoto`)
- **Fonte Primária Documental**:
  - _Título_: "São Paulo Grand Prix: Race Recap"
  - _Autor / Entidade_: Haas F1 Team
  - _Data_: 14/11/2021
  - _URL_: `https://www.haasf1team.com/news/sao-paulo-grand-prix-race-recap`
- **Evidência Específica**:
  O comunicado oficial de corrida da Haas F1 Team identifica formalmente: _"Nikita Mazepin, Driver No. 9, Uralkali Haas F1 Team"_.
- **Distinção**:
  - _Fato Documentado_: Mazepin correu na temporada 2021 de F1 com o número fixo #9 pela Haas.
  - _Decisão do Jogo_: Adotado como `preferredNumber = 9` em seu cadastro canônico inicial de piloto livre/mercado.

---

### Daniil Kvyat

- **ID Canônico**: `mbj-137`
- **Nome**: Daniil Kvyat
- **Campo Auditado**: `preferredNumber`
- **Valor no Cadastro**: `26`
- **Retrato Canônico**: `DRV_0136.jpg` (resolvido via `resolveDriverPhoto`)
- **Fonte Primária Documental**:
  - _Título_: "What's in a number? The truth behind the drivers' new digits"
  - _Autor / Entidade_: Formula 1 (Formula One Digital Media Limited)
  - _Data_: 12/03/2014
  - _URL_: `https://www.formula1.com/en/latest/article/whats-in-a-number-the-truth-behind-the-drivers-new-digits.u5yr5QdYKqwu0vZnMSiLJ.u5yr5QdYKqwu0vZnMSiLJ`
- **Evidência Específica**:
  A seção _"Daniil Kvyat - 26"_ documenta explicitamente a seleção oficial do numeral permanente #26 pelo piloto para sua carreira na F1.
- **Distinção**:
  - _Fato Documentado_: Kvyat selecionou e utilizou o #26 desde a introdução dos números permanentes na F1 em 2014 pela Toro Rosso, Red Bull e AlphaTauri.
  - _Decisão do Jogo_: Adotado como `preferredNumber = 26` em seu cadastro canônico inicial de piloto livre/mercado.

---

### Sébastien Bourdais

- **ID Canônico**: `mbj-128` (cadastro pré-existente mantido in place, sem duplicação)
- **Nome**: Sébastien Bourdais
- **Campo Auditado**: `preferredNumber`
- **Valor no Cadastro**: `null` (representado como `undefined` em JavaScript)
- **Retrato Canônico**: `DRV_0137.jpg` (resolvido via `resolveDriverPhoto`)
- **Evidência Específica**:
  Não há preferência permanente validada para este campo nesta entrega. O piloto competiu na F1 em 2008–2009 antes do sistema de números permanentes de piloto (introduzido em 2014), usando a numeração atribuída pelo campeonato de construtores (#14 em 2008, #11 em 2009 pela Scuderia Toro Rosso). O numeral "25" visível na arte gráfica do portrait (`DRV_0137.jpg`) é um elemento artístico de protótipo/WEC e NÃO constitui fonte documental para atribuição na F1.
- **Distinção**:
  - _Fato Documentado_: Nenhuma escolha de número de piloto permanente sob o regulamento moderno foi realizada pelo piloto.
  - _Decisão do Jogo_: `preferredNumber` mantido nulo (`null`/`undefined`), preservando todas as suas estatísticas de carreira (27 GPs) e integridade de cadastro intactas.
