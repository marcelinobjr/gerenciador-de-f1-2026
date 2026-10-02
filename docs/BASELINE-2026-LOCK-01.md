# BASELINE-2026-LOCK-01

## Contrato Esportivo Inicial — Temporada 2026

### 1. Finalidade e Escopo

A baseline representa o estado estrutural INICIAL das equipes na temporada 2026.
NÃO representa resultado garantido, grid garantido, posição final, vencedor, cap de performance ou teto de evolução. A carreira pode divergir da baseline.

### 2. Tabela de Targets Canônicos (12 Equipes)

| Posição | Equipe       | Target Estrutural |
| ------- | ------------ | ----------------- |
| P1      | Mercedes     | 100               |
| P2      | Ferrari      | 98                |
| P3      | McLaren      | 96                |
| P4      | Red Bull     | 94                |
| P5      | Racing Bulls | 87                |
| P6      | Alpine       | 87                |
| P7      | Audi         | 86                |
| P8      | Haas         | 75                |
| P9      | Williams     | 70                |
| P10     | Aston Martin | 60                |
| P11     | Cadillac     | 50                |
| P12     | Andretti     | 45                |

### 3. Grupos Competitivos

- **TOP 4:** Mercedes, Ferrari, McLaren, Red Bull
- **INTERMEDIÁRIO ALTO:** Racing Bulls, Alpine, Audi
- **TRANSIÇÃO:** Haas, Williams
- **FUNDO:** Aston Martin, Cadillac, Andretti

_Nota:_ Os grupos são estritamente referências estruturais de início de temporada, NÃO cages de resultado.

### 4. Fórmulas Estruturais Exatas

- **Technical** = Parts 50% + Effective PU 30% + Reliability 10% + Condition 10%
- **Driver** = Attributes 80% + Morale 10% + Adaptation 10%
- **Team** = Infrastructure 80% + Team Morale 20%
- **Structural Strength** = Technical 60% + Driver 25% + Team 15%

### 5. Contrato de TrackFit

- **Neutral:** 75.0
- **Scale:** 0.08
- **Clamp Normal:** ±2.0
- **Clamp Especializado:** ±2.5
- **Aplicação:** 1 única aplicação.
  Pode gerar inversões locais em traçados específicos, mas NÃO altera o target estrutural da equipe.

### 6. Contrato de Setup Efficiency

- **Neutral:** 80
- **Modifier:** `(efficiency − 80) × 0.05`
- **Aplicação:** 1 única aplicação integrada no pace da qualificação. Altera pace de volta, NÃO a baseline estrutural.

### 7. Contrato de Qualifying RNG

- **Sigma:** 0.45 determinístico
- **PRNG:** Mulberry32
- **Distribuição:** Box-Muller com seed determinística
  RNG não serve para calibrar artificialmente a hierarquia.

### 8. Tradução para Pace (Benchmark WCA Homologado)

Resultado específico do benchmark WCA homologado (NÃO é constante universal):

- Taxa empírica: ~0,082 s por ponto de structural rating.
- **Mercedes (100) → Andretti (45):** 55 pts ≈ 4,510 s/volta
- **Audi (86) → Haas (75):** 11 pts ≈ 0,902 s/volta
- **Williams (70) → Aston Martin (60):** 10 pts ≈ 0,820 s/volta

### 9. BASELINE INICIAL ≠ ESTADO ATUAL DA CARREIRA

Após o início da carreira, todos os componentes dinâmicos entram em operação:

- Componentes do carro, PU, reliability e condition mudam conforme desgaste e fabricação;
- Infraestrutura e staff evoluem com investimentos e orçamentos;
- Pilotos ganham/perdem moral, adaptação e atributos;
- Eficiência de setup varia corrida a corrida;
- Projetos de desenvolvimento e P&D alteram o ranking ao longo das temporadas.
  Mercedes não precisa continuar 100; Andretti não precisa continuar 45. Equipes podem acertar o projeto, errar o projeto, sofrer problemas de confiabilidade, evoluir melhor ou pior e mudar totalmente de patamar entre temporadas; a baseline não congela isso.

### 10. Pilotos

Piloto é uma camada separada da base do carro. Valores e atributos são geridos pelos modelos canônicos de pilotos e não alteram a fundação técnica das fabricantes.

### 11. Matriz de Pistas e Perfis WCA

Os oito perfis de traçado avaliados pelo sistema (slow, medium, fast, power-sensitive, downforce-sensitive, traction, braking, mixed) permitem diferenciações contextuais:

- Williams pode superar Haas em traçados altamente favoráveis a velocidade/downforce específico;
- Cadillac pode superar Aston Martin em certos traçados de tração/frenagem;
- Os clusters permanecem coerentes no agregado de 24 etapas.

### 12. Seção ANTI-HARDCODE (Proibições Absolutas)

É terminantemente proibido no código de simulação:

- `if (teamName === X) { bonus }`
- `if (teamName === X) { penalty }`
- Position caps artificiais
- Winner caps
- Forced hierarchy
- Rubber banding por equipe
- Resultados pré-definidos
- Alteração dinâmica da baseline para preservar classificação desejada.

### 13. Seção ANTI-DRIFT (Proteção do Contrato CP4)

A suíte CP4 e suítes correlatas protegem:

1. Targets exatos das 12 equipes;
2. Pesos Technical (50/30/10/10), Driver (80/10/10), Team (80/20) e Structural (60/25/15);
3. TrackFit neutral (75.0), scale (0.08), clamps (±2.0 / ±2.5) e aplicação única;
4. Setup neutral (80), coeficiente (0.05) e aplicação única;
5. RNG sigma (0.45) e ausência de aplicações duplicadas.
   **Regra de Ouro:** Qualquer mudança intencional futura deve quebrar o contrato primeiro; NUNCA atualizar `expected` silenciosamente.

### 14. Tabela de Homologações

- **CP2:** 8/8 PASS
- **CP3A:** 9/9 PASS
- **SETUP-EFFICIENCY-QUALI-01A:** 8/8 PASS
- **CALIBRATION-WCA-01R:** 27/27 PASS
- **CP4:** 32/32 PASS
- **TrackFit:** PASS
- **Structural:** PASS
- **Qualifying:** PASS
- **Balance Audit:** PASS

### 15. Destaque WCA e CP4

- A BASELINE JÁ ESTAVA CORRETA; BEFORE = TARGET, delta 0.00 para as 12 equipes.
- Nenhum nerf aplicado; nenhum rating de produção alterado; nenhum modifier por teamName criado.
- CP4 travou o contrato técnico, não recalibrou a baseline. PRODUCTION CHANGED: NO. Base homologada v0.0.817, commit 8d3a38a.

### 16. Protocolo de Alteração Futura (11 Passos)

1. Abrir tarefa específica e numerada;
2. Medir BEFORE com dados de benchmark;
3. Justificar tecnicamente a necessidade da mudança;
4. Alterar os dados-fonte canônicos;
5. Medir AFTER sob as mesmas condições;
6. Medir impacto em pace por volta;
7. Testar comportamento da matriz TrackFit;
8. Separar isoladamente o efeito de pilotos vs carro;
9. Atualizar formalmente este contrato;
10. Atualizar os testes automatizados correspondentes (CP4 / WCA);
11. Registrar nova versão homologada.
    _NUNCA alterar expected primeiro._

### 17. O que NÃO Justifica Recalibração

Resultados isolados de corrida não justificam mexer na baseline:

- Williams superar Audi num GP específico;
- Andretti pontuar em corrida caótica com chuva ou abandonos;
- Aston Martin alcançar o Q3;
- Cadillac superar a Haas;
- Red Bull conquistar uma pole position;
- McLaren vencer a Mercedes.

### 18. Fontes Canônicas no Código

- **BASELINE_2026_V1_TEAMS:** `src/services/baseline2026V1Teams.ts` (ou `src/data/` / `src/services/`)
- **Structural Strength:** `src/services/structuralStrengthService.ts`
- **TrackFit:** `src/services/trackFitService.ts`
- **SetupEfficiency:** `src/services/setupEfficiencyService.ts`
- **Qualifying RNG:** `src/services/raceQualifyingOrchestratorService.ts`
- **CP2 Test Suite:** `src/__tests__/baseline-2026-lock-01-cp2.test.ts`
- **CP3A Test Suite:** `src/__tests__/baseline-2026-lock-01-cp3a.test.ts`
- **SetupEfficiency Tests:** `src/__tests__/setup-efficiency-quali-01a.test.ts`
- **CALIBRATION-WCA-01R Test Suite:** `src/__tests__/calibration-wca-01r.test.ts`
- **CP4 Test Suite:** `src/__tests__/baseline-2026-lock-cp4.test.ts`
- **Balance Audit:** `src/artifacts/audits/balanceAuditArtifact.ts`

### 19. Status do Contrato

**BASELINE-2026-LOCK-01 STATUS: LOCKED**

- Initial Targets: **LOCKED**
- Structural Formula: **LOCKED**
- TrackFit Contract: **LOCKED**
- SetupEfficiency Contract: **LOCKED**
- Qualifying RNG Contract: **LOCKED**
- Career Evolution: **DYNAMIC**
- Race Results: **EMERGENT**

---

> **Regra de Ouro:** "BASELINE É O PONTO DE PARTIDA, NÃO O RESULTADO. O JOGO PRODUZ A HISTÓRIA; NÃO REPRODUZ UMA CLASSIFICAÇÃO PRÉ-DEFINIDA."
