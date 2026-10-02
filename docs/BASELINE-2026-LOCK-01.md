# BASELINE-2026-LOCK-01

## Contrato Esportivo Inicial — Temporada 2026

### 1. Finalidade e Escopo

A baseline representa o estado estrutural INICIAL das equipes na abertura da temporada 2026.
NÃO representa resultado garantido, grid garantido, posição final, vencedor, cap de performance ou teto de evolução. A carreira pode divergir da baseline.

> **Regra de Ouro:**
> "BASELINE É O PONTO DE PARTIDA, NÃO O RESULTADO. O JOGO DEVE PRODUZIR A HISTÓRIA, NÃO REPRODUZIR UMA CLASSIFICAÇÃO PRÉ-DEFINIDA."

---

### 2. Targets 2026 (Tabela Exata)

| Posição | Equipe       | Índice |
| ------- | ------------ | -----: |
| P1      | Mercedes     |    100 |
| P2      | Ferrari      |     98 |
| P3      | McLaren      |     96 |
| P4      | Red Bull     |     94 |
| P5      | Racing Bulls |     87 |
| P6      | Alpine       |     87 |
| P7      | Audi         |     86 |
| P8      | Haas         |     75 |
| P9      | Williams     |     70 |
| P10     | Aston Martin |     60 |
| P11     | Cadillac     |     50 |
| P12     | Andretti     |     45 |

---

### 3. Grupos Competitivos

- **TOP 4:** Mercedes, Ferrari, McLaren, Red Bull
- **INTERMEDIÁRIO ALTO:** Racing Bulls, Alpine, Audi
- **TRANSIÇÃO:** Haas, Williams
- **FUNDO:** Aston Martin, Cadillac, Andretti

_Nota fundamental:_ Esta distribuição é estritamente uma referência estrutural inicial, **NÃO** um resultado garantido ou blindagem contra disputas de pista.

---

### 4. Structural Strength (Fórmulas e Pesos)

- **Technical:** Parts 50%, Effective PU 30%, Reliability 10%, Condition 10%
- **Driver:** Attributes 80%, Morale 10%, Adaptation 10%
- **Team:** Infrastructure 80%, Team Morale 20%
- **Final Structural:** Technical 60%, Driver 25%, Team 15%

---

### 5. Contrato de TrackFit

- **neutral:** 75.0
- **scale:** 0.08
- **normal clamp:** ±2.0
- **specialized clamp:** ±2.5
- **application count:** 1

O TrackFit modela a afinidade aerodinâmica/mecânica entre as características do carro e o perfil do circuito. É aplicado exatamente uma vez no pipeline de pace, sem duplicações e sem alterar a baseline estrutural intrínseca da equipe.

---

### 6. Contrato de Setup Efficiency

- **neutral:** 80
- **modifier:** `(efficiency - 80) × 0.05`
- **application count:** 1

A eficiência de acerto (setup) obtida nos treinos livres modula o pace da qualificação em torno do valor neutro 80 (gerando 0.000 de impacto com 80%, +1.000 pt com 100%, -1.500 pt com 50%). É aplicada exatamente uma vez no pace de qualificação e não contamina a baseline estrutural do carro.

---

### 7. Contrato de Qualifying RNG

- **sigma:** 0.45
- **PRNG:** Mulberry32
- **normal generation:** Box-Muller
- **seed:** determinística (reprodutível bit a bit)
- **clamp:** ±1.0 pt

O ruído estocástico de qualificação é puramente determinístico sob a mesma seed, centrado em zero com desvio-padrão de 0.45 pt. Não atua como mecanismo de correção ou equalização artificial da hierarquia esportiva.

---

### 8. WCA (CALIBRATION-WCA-01R)

- **Resultado:** 27/27 PASS.
- **Conclusão essencial:** **A BASELINE JÁ ESTAVA CORRETA.**
- **BEFORE = TARGET:** Delta de 0.00 em todas as 12 equipes homologadas.
- **Intervenção:** Nenhum nerf foi necessário. Nenhum arquivo de produção precisou ser alterado.

---

### 9. Pace Translation (Benchmark Homologado)

Valores observados no benchmark homologado:

- **Taxa empírica:** aprox. 0,082 s por ponto estrutural.
- **Mercedes (100) → Andretti (45):** 55 pts, aprox. 4,510 s/volta
- **Audi (86) → Haas (75):** 11 pts, aprox. 0,902 s
- **Williams (70) → Aston Martin (60):** 10 pts, aprox. 0,820 s

_Aviso explícito:_ Esta correlação de pace em segundos **NÃO** é uma constante universal por circuito; trata-se da tradução observada no benchmark homologado para condições de referência.

---

### 10. Travamento de Contrato CP4

- **Suíte:** `BASELINE-2026-LOCK-01 — CP4`: 32/32 PASS.
- **Versão de referência:** v0.0.817.
- **Commit:** `8d3a38a`.
- **PRODUCTION CHANGED:** NO.
- **Papel do CP4:** CP4 travou o contrato formalmente como barreira de segurança; CP4 **NÃO** recalibrou a baseline.

---

### 11. Regressões e Homologações

- **CP2:** 8/8 PASS
- **CP3A:** 9/9 PASS
- **SETUP-EFFICIENCY-QUALI-01A:** 8/8 PASS
- **CALIBRATION-WCA-01R:** 27/27 PASS
- **CP4:** 32/32 PASS
- **TrackFit:** PASS
- **Structural:** PASS
- **Qualifying:** PASS
- **Balance Audit:** PASS

---

### 12. Baseline × Carreira (Diferenciação Estrita)

**BASELINE ≠ ESTADO ATUAL DA CARREIRA.**

A baseline é o estado no dia 1 da temporada 2026. Após o início da carreira, todos os vetores de evolução e desgaste operam continuamente:

- Componentes do carro (desenvolvimento de chassis, aerodinâmica, suspensão, freios);
- Unidade de Potência (Power Unit), confiabilidade (reliability) e condição de desgaste (condition);
- Infraestrutura da fábrica e simulador;
- Pilotos (atributos, morale, adaptação ao time);
- Eficiência de setup corrida a corrida;
- Orçamento, teto de gastos e investimentos;
- Performance relativa entre rivais e temporadas futuras.

**Mercedes não precisa permanecer 100.**
**Andretti não precisa permanecer 45.**

O jogo permite pleno desenvolvimento, ultrapassagens na hierarquia técnica, decadência de equipes grandes e ascensão de equipes menores.

---

### 13. Inversões Permitidas

A hierarquia da baseline não engessa posições de grid ou chegadas de corrida. Inversões são perfeitamente legítimas e esperadas como resultado emergente de corrida.

**Exemplos legítimos:**

- McLaren > Ferrari
- Red Bull > McLaren
- Audi > Alpine
- Williams > Haas
- Aston Martin > Williams
- Cadillac > Aston Martin
- Andretti > Cadillac

**Causas válidas para inversões:**
TrackFit favorável ao pacote técnico, talento do piloto, setup eficiente, escolha acertada de pneus, clima/chuva, estratégia de pit stop, falhas mecânicas/confiabilidade, incidentes de pista, RNG determinístico de sessão e desenvolvimento técnico ao longo da temporada.

---

### 14. Seção ANTI-HARDCODE (Proibições Absolutas)

É terminantemente **PROIBIDO** no código de simulação:

- Bônus por `teamName` (`if (teamName === 'mercedes') { ... }`);
- Penalidade por `teamName` (`if (teamName === 'andretti') { ... }`);
- Position cap (travar artificialmente o grid máximo de uma equipe);
- Winner cap (impedir vitória de equipe fora do Top 4);
- Forced hierarchy (forçar artificialmente que P1 vença P2);
- Rubber banding por equipe (equalização forçada para manter disputas artificiais);
- Resultado pré-definido;
- Alterar baseline dinamicamente durante a simulação para preservar classificação desejada.

---

### 15. Seção ANTI-DRIFT (Proteção Contratual)

O teste canônico CP4 (`src/__tests__/baseline-2026-lock-cp4.test.ts`) atua como guardião rigoroso contra a alteração silenciosa ("silent drift") de:

1. Targets das 12 equipes (12/12 invariantes);
2. Technical weights (Parts 50%, PU 30%, Rel 10%, Cond 10%);
3. Driver weights (Attributes 80%, Morale 10%, Adaptation 10%);
4. Team weights (Infrastructure 80%, Team Morale 20%);
5. Structural weights (Technical 60%, Driver 25%, Team 15%);
6. TrackFit neutral reference (75.0);
7. TrackFit scale (0.08);
8. TrackFit clamps (normal ±2.0, specialized ±2.5);
9. TrackFit duplicate application (estritamente 1x);
10. Setup neutral reference (80);
11. Setup coefficient (0.05);
12. Setup duplicate application (estritamente 1x);
13. RNG sigma (0.45 determinístico com Box-Muller).

---

### 16. Protocolo Obrigatório de Alteração Futura (11 Passos)

Se em qualquer momento futuro for necessário reajustar a baseline ou algum de seus componentes:

1. Abrir tarefa específica e numerada;
2. Medir o estado `BEFORE` com suíte de benchmark homologada;
3. Justificar tecnicamente e documentalmente o motivo da alteração;
4. Alterar os dados-fonte canônicos;
5. Medir o estado `AFTER` sob condições idênticas;
6. Medir o impacto real no pace (s/volta);
7. Validar o comportamento da matriz TrackFit nos traçados de teste;
8. Separar isoladamente o efeito de pilotos vs atributos do carro;
9. Atualizar formalmente este contrato (`BASELINE-2026-LOCK-01.md`);
10. Atualizar os testes automatizados canônicos (CP4, WCA, CP2, CP3A);
11. Registrar e documentar a nova versão do projeto.

**É terminantemente PROIBIDO simplesmente mudar `expected` em testes para fazê-los passar silenciosamente.**

---

### 17. Fontes Canônicas no Repositório (Paths Reais)

Todos os paths listados abaixo existem fisicamente no repositório e foram verificados:

- **BASELINE_2026_V1_TEAMS:** `src/data/baseline-2026-v1.ts` (e contrato em `src/data/baseline-2026-lock-contract.ts`)
- **Structural Strength:** `src/services/structuralStrengthService.ts`
- **TrackFit:** `src/services/canonicalPaceIntegrationService.ts`
- **setupEfficiency:** `src/services/canonicalPaceIntegrationService.ts` (e execução em `src/services/canonicalQualifyingRunner.ts`)
- **Qualifying RNG:** `src/services/canonicalPaceIntegrationService.ts` (funções `createMulberry32`, `sampleGaussianRng`, clamps)
- **CP2 Test Suite:** `src/__tests__/baseline-2026-lock-01-cp2.test.ts`
- **CP3A Test Suite:** `src/__tests__/baseline-2026-lock-01-cp3a.test.ts`
- **SetupEfficiency Suite:** `src/__tests__/setup-efficiency-quali-01a.test.ts` (e regressão `src/__tests__/setup-efficiency-quali-01.test.ts`)
- **CALIBRATION-WCA-01R Test Suite:** `src/__tests__/calibration-wca-01r.test.ts`
- **CP4 Test Suite:** `src/__tests__/baseline-2026-lock-cp4.test.ts`
- **Balance Audit:** `src/services/balanceAuditService.ts` (artefatos em `src/artifacts/audits/balanceAuditArtifact.ts`)

---

### 18. Status do Contrato

**BASELINE-2026-LOCK-01 — STATUS: LOCKED**

- Initial Targets: **LOCKED**
- Structural Formula: **LOCKED**
- TrackFit: **LOCKED**
- SetupEfficiency: **LOCKED**
- Qualifying RNG: **LOCKED**
- Career Evolution: **DYNAMIC**
- Race Results: **EMERGENT**
