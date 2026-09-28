# STANDINGS-PROVENANCE-AUDIT.md
**Auditoria de Proveniência Matemática do Motor de Classificação (Standings)**  
*Apex GP Manager — v0.0.615 Checkpoint*  
*Data de Execução:* 2026-03-30  
*Escopo:* Análise comparativa e rastreabilidade matemática das regras de classificação de Pilotos e Construtores contra as fontes oficiais canônicas do projeto (Excel `Apex GP Manager - Simulacao de Corrida.xlsx`, regulamentos FIA e implementações em código).

---

## 1. Contexto e Objetivos

O presente documento audita a proveniência matemática do motor de classificação de campeonato implementado em `src/services/standingsService.ts`, `src/lib/f1-standings-calculator.ts` e no caminho canônico `src/services/canonicalChampionshipService.ts`, confrontando-os com:
1. **Planilha Oficial da Fonte:** `Apex GP Manager - Simulacao de Corrida.xlsx` (extraída e materializada em `src/assets/01raceregraseparametros-3c0c5.json`, `src/assets/03raceformulasefonte-0d9bf.json`).
2. **Regulamento Esportivo Oficial da FIA:** Tabela de pontuação de Grande Prêmio (Top 10), critérios oficiais de desempate por *countback* esportivo e agregação de construtores.
3. **Consumidores do Sistema:** `src/hooks/use-unified-season.ts`, `Standings.tsx` e fluxos de carreira persistida.

---

## 2. Auditoria Regra por Regra

---

### R1. Pontuação FIA por Posição (25-18-15-12-10-8-6-4-2-1) e Comportamento de Persistência

#### 2.1 Descrição da Regra e Fontes
* **Fonte Original da Planilha:**
  * Aba `Parâmetros`, intervalo `E4:F13` (Tabela `points_gp`):
    * P1 = 25 pts, P2 = 18 pts, P3 = 15 pts, P4 = 12 pts, P5 = 10 pts, P6 = 8 pts, P7 = 6 pts, P8 = 4 pts, P9 = 2 pts, P10 = 1 pt.
    * Conforme `01raceregraseparametros-3c0c5.json` (linhas 1016–1087 e regra `R18`, linha 1651):
      > *"Pontos GP 25/18/15/12/10/8/6/4/2/1 somente Terminou. Melhor volta e informativa, sem ponto extra."*
    * Aba `Leia-me`, linha 24 (`C24`): *"25-18-15-12-10-8-6-4-2-1 (regulamento atual, sem ponto de volta mais rápida)."*
  * Aba `Parâmetros`, intervalo `E61:F68` (Tabela `points_sprint`):
    * P1 = 8 pts, P2 = 7 pts, P3 = 6 pts, P4 = 5 pts, P5 = 4 pts, P6 = 3 pts, P7 = 2 pts, P8 = 1 pt (regra `R19`).
* **Implementação no Código:**
  * `src/lib/f1-standings-calculator.ts`:
    * Constante `FIA_POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]` (linhas 12–22).
    * Função `getFiaPointsForPosition(position: number): number`.
  * `src/services/standingsService.ts`:
    * Função `calculatePointsForResults(result: Pick<RaceResultModel, 'position' | 'points'>): number`:
      ```typescript
      if (typeof result.points === 'number' && result.points > 0) {
        return result.points
      }
      return getFiaPointsForPosition(result.position)
      ```

#### 2.2 Análise de Riscos e Achados
1. **Comportamento Híbrido de `calculatePointsForResults`:**
   * Quando `result.points > 0` está gravado no registro persistido, o cálculo descarta `getFiaPointsForPosition(result.position)` e assume cegamente o valor persistido.
   * **Risco de Incoerência / Posição vs. Pontos:** Se um registro de `race_results` registrar um piloto em P1 com `result.points = 8` (por exemplo, originado de uma pontuação de Sprint ou cálculo anômalo de terceiros), o motor computa 8 pontos em vez de 25.
   * **ACHADO — Bug Conhecido do Formato Sprint:**
     * Conforme registrado na memória do projeto: *"pontos sprint não acumulam na temporada"*.
     * Na planilha de origem, a aba `Resultado do Fim de Semana` (`R7:AI30`, regra `R20`) faz explicitamente:
       $$\text{Pontos Totais Piloto} = \text{Pontos Sprint} + \text{Pontos GP}$$
     * No entanto, o `race_results` persistido em banco de dados armazena o resultado principal do GP. Como os pontos de corrida curta (Sprint) não possuem canal de agregação persistido nem fluxo de consolidação somado ao GP na coleção oficial de resultados da temporada, os pontos conquistados na Sprint (8 a 1 pt) são descartados da tabela anual.
     * *(Nota: Este achado é puramente documentado nesta auditoria, sem alteração de código de produção nesta rodada).*

---

### R2. Desempates (Critérios de Ordenação e Countback)

#### 2.1 Descrição da Regra
* **Regulamento Oficial da FIA (Artigo 7.2 / Countback Esportivo):**
  1. Maior número de pontos somados.
  2. Maior número de primeiros lugares (vitórias / P1).
  3. Maior número de segundos lugares (P2).
  4. Maior número de terceiros lugares (P3), e assim sucessivamente até a menor posição registrada na temporada (P4, P5, ..., P24).
  5. Se persistir empate absoluto após todos os resultados, a FIA estabelece decisão por comitê/critério de autoridade esportiva regulamentar. **Em nenhuma circunstância o regulamento da FIA adota ordem alfabética de nomes.**
* **Implementação Legada / `standingsService.ts` (linhas 414–420):**
  ```typescript
  // Ordenação de pilotos: Pontos DESC > Vitórias DESC > Pódios DESC > Melhor Posição ASC > Nome ASC
  const sortedDrivers = Object.values(dMap).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.podiums !== a.podiums) return b.podiums - a.podiums
    if (a.bestPosition !== b.bestPosition) return a.bestPosition - b.bestPosition
    return a.name.localeCompare(b.name)
  })
  ```
* **Implementação Canônica / `canonicalChampionshipService.ts` (linhas 141–166, 600–608):**
  ```typescript
  export function compareCountback(
    aPoints: number,
    aCounts: Record<number, number>,
    bPoints: number,
    bCounts: Record<number, number>,
    fallbackTieBreaker?: (a: any, b: any) => number,
  ): number {
    if (bPoints !== aPoints) return bPoints - aPoints
    for (let pos = 1; pos <= 24; pos++) {
      const cA = aCounts[pos] || 0
      const cB = bCounts[pos] || 0
      if (cB !== cA) return cB - cA
    }
    if (fallbackTieBreaker) return fallbackTieBreaker(aPoints, bPoints)
    return 0
  }
  ```

#### 2.2 Divergências Identificadas
1. **Divergência de Granularidade no Legado:**
   * `standingsService.ts` salta diretamente de Vitórias (P1) para Pódios (soma de P1+P2+P3) e depois para `bestPosition`.
   * **Exemplo de Falha Esportiva:** Se o Piloto A tem dois 2º lugares e zero 3º lugares (2 pódios), e o Piloto B tem um 2º lugar e um 3º lugar (2 pódios), ambos têm 0 vitórias e 2 pódios e `bestPosition = 2`. O `standingsService.ts` pula para `localeCompare(a.name, b.name)`, ignorando que o Piloto A possui dois P2s contra um P2 do Piloto B.
2. **Uso de Ordem Alfabética (`localeCompare`):**
   * Tanto `standingsService.ts` quanto o fallback terminal de `canonicalChampionshipService.ts` recorrem a `localeCompare`.
   * Embora o fallback terminal seja aceitável para garantir determinismo na UI quando há empate geométrico absoluto (idêntica distribuição em todas as posições 1..24), o caminho legado em `standingsService.ts` utiliza o nome prematuramente antes de checar as frequências de P2, P3, P4, etc.

---

### R3. Agregação de Construtores

#### 2.1 Descrição da Regra e Mecânica
* **Regra Esportiva Original:**
  * O Campeonato Mundial de Construtores é a soma estrita dos pontos conquistados pelos carros/inscrições de cada equipe em cada GP oficial disputado.
* **Implementação em `standingsService.ts`:**
  * Linhas 422–510 (Equipes de IA) e 512–551 (Equipe do Jogador):
    1. **Soma Inicial:** Agrega pontos e posições dos dois pilotos designados na simulação da IA (`${aiTeam.id}_d1` e `${aiTeam.id}_d2`).
    2. **Busca Resiliente (`normalizeTeamKeyOrName`):**
       ```typescript
       const normalizeTeamKeyOrName = (str: string): string =>
         str.toLowerCase().replace(/^ai_/, '').replace(/f1|team|racing|scuderia|motorsport/g, '').replace(/[^a-z0-9]/g, '').trim()
       ```
    3. **Dedução de Pontos FIA (Teto de Gastos):**
       ```typescript
       const fiaDeduction = team?.constructors_points_deduction || 0
       const netPlayerTeamPts = Math.max(0, playerTeamPts - fiaDeduction)
       ```

#### 2.2 Riscos de Dupla Contagem e Rastreabilidade
1. **Risco Crítico no Loop de Agregação da IA em `standingsService.ts`:**
   * O código executa três etapas sucessivas para equipes de IA:
     * **Etapa 1:** Soma `d1` e `d2` diretamente de `dMap`.
     * **Etapa 2:** Procura em `matchedDrivers` outros pilotos em `dMap` que não tenham as chaves `_d1`/`_d2` mas cujo nome de equipe case.
     * **Etapa 3:** Itera sobre `filteredResults`. Se houver um registro de corrida cujo `res.team_id` casa com a equipe, mas o piloto `res.driver_id` **não** está presente em `dMap`, soma `pts += p`.
   * **Veredito:** Esta cascata foi desenhada para tolerar disparidades de schema legado (quando pilotos do PocketBase têm IDs alfanuméricos como `abc123xyz` que não casavam com `ai_ferrari_d1`). Contudo, se a base contiver resultados órfãos ou inconsistência de chave, há risco marginal de agregação excedente.
2. **Dedução do Teto de Gastos (`constructors_points_deduction`):**
   * Fórmula: $\text{netPlayerTeamPts} = \max(0, \text{playerTeamPts} - \text{fiaDeduction})$.
   * Essa penalidade é aplicada exclusivamente à equipe do jogador na camada de visualização/serviço, sem equivalente no Excel original de simulação de voltas, originando-se do subsistema econômico do jogo (FIN-EVO).

---

### R4. Caminho Canônico vs. Legado

#### 2.1 Dualidade de Execução no Projeto
O projeto possui dois caminhos de apuração de classificação:
1. **Caminho Canônico (`canonicalChampionshipService.ts`):**
   * Princípio: *“RACE_RESULT DIZ QUANTOS PONTOS CADA PILOTO E CADA EQUIPE GANHARAM NAQUELA PROVA. CAMPEONATO APENAS RESPONDE: QUANTO CADA UM ACUMULOU ATÉ AGORA.”*
   * Utiliza `pointsAwarded` diretamente dos snapshots imutáveis com validação de checksum criptográfico (`verifyResultIntegrity`).
   * Desempate via `compareCountback` posicional completo (1 a 24).
   * Persiste e consome snapshots estruturados `championship_{careerId}_{season}_r{round}`.
2. **Caminho Legado / Simulado (`standingsService.ts` + `simulateAiGridFiaStandings`):**
   * Chamado quando `canonicalResults.length === 0` ou para grids de início de temporada/IA sem persistência.
   * Executa `simulateAiGridFiaStandings` em `src/lib/f1-standings-calculator.ts` (linhas 65–197) utilizando cálculo sintético baseado em `calculateCombinedPace`, gerando scores e atribuindo 25-18-15... deterministicamente para rodadas passadas.
   * `useUnifiedSeason.ts` (linhas 159–167) consome `standingsService.calculateStandings`. Por sua vez, `calculateStandings` tenta primeiro o `canonicalChampionshipService` (linhas 143–219); se houver corridas oficiais gravadas, delega integralmente ao canônico. Se não houver, cai no fallback legado simulado.

#### 2.2 Comparação de Fórmulas e Divergências
* Quando há histórico oficial persistido, o resultado do campeonato deriva dos fatos esportivos oficiais.
* Todavia, se cair no fallback de `standingsService.ts`, os critérios de desempate divergem: o canônico faz countback de 1 a 24, enquanto o fallback usa apenas vitórias, pódios e `bestPosition`.

---

### R5. `getTeamMorale`: Rastreabilidade e Proveniência da Fórmula

#### 2.1 Análise da Fórmula Atual
Em `src/services/standingsService.ts` (linhas 95–115):
```typescript
export function getTeamMorale(params: GetTeamMoraleParams): number {
  const { teamPoints, constructorRank, parts = [], managerMoraleBonus = 0 } = params
  const avgParts =
    parts.length > 0 ? parts.reduce((acc, p) => acc + (p.level || 5), 0) / parts.length : 5

  let calcMorale = Math.round(50 + (avgParts - 5) * 4 + Math.min(25, teamPoints / 3))
  if (constructorRank <= 3) {
    calcMorale += 10
  } else if (constructorRank <= 6) {
    calcMorale += 5
  }

  // Modificador de moral do Team Principal (peopleManagement: -4% a +8%)
  const clampedBonus = Math.max(-0.04, Math.min(0.08, managerMoraleBonus))
  if (clampedBonus !== 0) {
    calcMorale = Math.round(calcMorale * (1 + clampedBonus))
  }

  return Math.max(10, Math.min(100, calcMorale))
}
```

#### 2.2 Decomposição Matemática
1. **Base:** $50$ (ponto médio da moral neutra).
2. **Impacto das Peças Técnicas:** $(\overline{\text{parts}} - 5) \times 4$. Como as peças variam tipicamente de nível 1 a 10, esse termo varia de $-16$ a $+20$.
3. **Impacto de Pontos do Construtor:** $\min(25, \lfloor \text{teamPoints} / 3 \rfloor)$. Saturação em 25 pontos adicionais ao atingir 75 pontos na temporada.
4. **Bônus de Posição no Campeonato de Construtores:**
   * $+10$ se $\text{constructorRank} \le 3$.
   * $+5$ se $4 \le \text{constructorRank} \le 6$.
5. **Modificador de Gestão do Chefe de Equipe (*Manager/People Management*):**
   * Multiplicador $(1 + \text{clampedBonus})$, onde $\text{clampedBonus} \in [-0.04, +0.08]$.
6. **Clamp Regulamentar:** Limites estritos $[10, 100]$.

#### 2.3 Rastreamento contra a Planilha de Origem
* **Na Planilha Excel (`Apex GP Manager - Simulacao de Corrida.xlsx`):**
  * A planilha possui o conceito de **Moral do Piloto** como atributo estático em `Pilotos!V` (valor base 65) e parâmetros de influência na volta (`Parâmetros!B6` = 0,05 no piloto efetivo, e `Parâmetros!B25` = 0,04 no ritmo de corrida: `(Moral - 80) * 0,04`).
  * No entanto, a fórmula composta de **Moral da Equipe** (`getTeamMorale`) agregando média de peças (`parts.level`), terço dos pontos de construtores e bônus de ranking **NÃO EXISTE** nas abas de corrida da planilha original (`Voltas`, `Corrida` ou `Parâmetros`).
* **Origem Real no Projeto:**
  * É uma regra de jogabilidade de gerenciamento (*management loop*), introduzida na camada da aplicação Apex GP Manager para retroalimentar a satisfação da fábrica e requisitos de patrocinadores (`minTeamMorale` em `src/lib/f1-data.ts`), combinando progresso técnico e esportivo.

---

## 3. Tabela Final de Veredito por Regra Matemática

| ID | Regra / Sub-rotina | Fonte Declarada / Arquivo | Fórmula Reconstruída | Veredito | Evidência / Observações |
|---|---|---|---|---|---|
| **R1.1** | Pontos de GP (Top 10) | Planilha Excel `Parâmetros!E4:F13`; `f1-standings-calculator.ts:12` | $[25, 18, 15, 12, 10, 8, 6, 4, 2, 1]$ para P1..P10; 0 para demais | **IDÊNTICA** | Reproduz com 100% de exatidão o regulamento FIA e a tabela da planilha. |
| **R1.2** | Pontos de Volta Mais Rápida | Planilha `Leia-me!C24`; `01race...json:R18` | Sem bônus de melhor volta ($+0$) | **IDÊNTICA** | Tanto o Excel quanto o código omitem bônus de melhor volta. |
| **R1.3** | Pontos de Sprint | Planilha `Parâmetros!E61:F68`; `01race...json:R19` | $8, 7, 6, 5, 4, 3, 2, 1$ para P1..P8 na Sprint | **DIVERGENTE** (Achado) | A tabela existe na fonte, mas o motor de standings de temporada não acumula os pontos de Sprint nos totais anuais de `race_results`. |
| **R2.1** | Desempate Canônico (*Countback*) | FIA Sporting Regs Art. 7.2; `canonicalChampionshipService.ts:141` | Pontos DESC $\to$ Frequência de P1..P24 DESC $\to$ Fallback determinístico | **EQUIVALENTE** | Rastreia a regra FIA com precisão computacional até P24. |
| **R2.2** | Desempate Legado | `standingsService.ts:414` | Pontos DESC $\to$ Vitórias DESC $\to$ Pódios DESC $\to$ Melhor Posição ASC $\to$ Nome ASC | **DIVERGENTE** | Omite contagem individual de P2/P3/P4 e insere `Nome ASC` (`localeCompare`), inexistente no regulamento FIA. |
| **R3.1** | Agregação de Construtores | FIA Sporting Regs; `canonicalChampionshipService.ts:585` | $\sum \text{pointsAwarded}$ das inscrições da equipe na prova | **IDÊNTICA** | Somatório exato das inscrições por equipe. |
| **R3.2** | Dedução Teto de Gastos | Sistema Econômico FIN-EVO; `standingsService.ts:538` | $\max(0, \text{playerTeamPts} - \text{fiaDeduction})$ | **EQUIVALENTE** | Regra de jogo deliberada para governança financeira esportiva. |
| **R4** | Resolução Canônica vs. Legado | `standingsService.ts:150`; `canonicalChampionshipService.ts:744` | Se houver `eligibleOfficialRaceResults`, usa snapshot canônico; senão simula IA | **EQUIVALENTE** | Garante que dados oficiais prevaleçam sempre que existirem. |
| **R5** | Moral da Equipe (`getTeamMorale`) | `standingsService.ts:95` | $\text{clamp}(10, 100, \text{round}[(50 + (\overline{P}-5)\times 4 + \min(25, \lfloor\text{Pts}/3\rfloor) + \text{RankBonus})\times(1+\text{Bonus Manager})])$ | **NÃO RASTREÁVEL** (Design Interno) | Não existe na planilha Excel de simulação de corridas. É um modelo de gestão interno do jogo para progressão de carreira. |

---

## 4. Conclusão e Recomendações

1. **Pontos de Sprint:** Manter o achado documentado; no futuro desenvolvimento da Fase 01C/01C2, projetar a consolidação segura dos pontos de Sprint na tabela de classificação sem quebrar a integridade dos snapshots canônicos existentes.
2. **Harmonização do Desempate:** Para qualquer refatoração futura, recomenda-se unificar o critério de ordenação de `standingsService.ts` com o `compareCountback` do `canonicalChampionshipService.ts`, eliminando a dependência do desempate prematuro por nome alfabético.
3. **Preservação:** Nenhuma linha de produção foi alterada durante esta auditoria, preservando a estabilidade e a versão dos serviços em produção.
