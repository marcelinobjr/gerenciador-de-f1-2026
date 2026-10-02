# BASELINE-2026-LOCK-01

## Contrato Esportivo Inicial — Temporada 2026

### 1. Finalidade

Este documento estabelece e trava o Contrato Esportivo Inicial da Temporada 2026 no APEX GP Manager.
A baseline 2026 representa rigorosamente o **estado estrutural inicial das equipes** no momento de abertura da temporada.
Ela **NÃO representa**:

- Resultado garantido de corrida ou qualificação;
- Grid de largada garantido;
- Posição final pré-determinada no campeonato;
- Vencedor definido;
- Cap artificial de performance;
- Teto de evolução ou limitação de desenvolvimento.

A partir do início da carreira, o universo da simulação é livre para divergir dinamicamente da baseline através das decisões de gestão, pesquisa, evolução de componentes, confiabilidade, pilotos, estratégias e condições de pista.

---

### 2. Targets Canônicos (12 Equipes)

| Posição | Equipe       | Índice estrutural inicial |
| :-----: | :----------- | :-----------------------: |
|   P1    | Mercedes     |            100            |
|   P2    | Ferrari      |            98             |
|   P3    | McLaren      |            96             |
|   P4    | Red Bull     |            94             |
|   P5    | Racing Bulls |            87             |
|   P6    | Alpine       |            87             |
|   P7    | Audi         |            86             |
|   P8    | Haas         |            75             |
|   P9    | Williams     |            70             |
|   P10   | Aston Martin |            60             |
|   P11   | Cadillac     |            50             |
|   P12   | Andretti     |            45             |

---

### 3. Grupos Esportivos de Referência

- **TOP 4:** Mercedes (100), Ferrari (98), McLaren (96), Red Bull (94)
- **INTERMEDIÁRIO ALTO:** Racing Bulls (87), Alpine (87), Audi (86)
- **TRANSIÇÃO:** Haas (75), Williams (70)
- **FUNDO:** Aston Martin (60), Cadillac (50), Andretti (45)

_Nota arquitetural:_ Esses grupos são estritamente referências de potencial estrutural inicial, e **não cages de resultado** ou limites forçados por script.

---

### 4. Fórmulas Canônicas do Sistema Estrutural

As fórmulas matemáticas homologadas operam de forma puramente determinística e sem hardcodes:

```text
Technical = Parts 50% + Effective PU 30% + Reliability 10% + Condition 10%
Driver = Attributes 80% + Morale 10% + Adaptation 10%
Team = Infrastructure 80% + Team Morale 20%
Structural = Technical 60% + Driver 25% + Team 15%
```

---

### 5. Contrato de TrackFit (Afinidade com Pistas)

- **Neutral Reference:** 75.0
- **Scale:** 0.08
- **Normal Clamp:** ±2.0
- **Specialized Clamp:** ±2.5
- **Application Count:** 1 (aplicação estritamente única, sem duplicação legada)

_Comportamento esportivo:_ O TrackFit reflete como as características do carro (top speed, downforce, aceleração) casam com as exigências específicas de cada traçado. Ele pode gerar inversões locais de ritmo entre equipes vizinhas (ex.: Williams superando Haas em traçados favoráveis), mas **não altera o target estrutural intrínseco da baseline**.

---

### 6. Contrato de Setup Efficiency

- **Neutral Reference:** 80.0
- **Modifier Formula:** `(efficiency - 80) × 0.05`
- **Application Count:** 1 (aplicação estritamente única na composição de pace)

_Comportamento esportivo:_ A eficiência de acerto mecânico/aerodinâmico obtida durante o fim de semana altera o pace momentâneo da sessão (±1.0 ponto para eficiências entre 60% e 100%), mas **não altera a baseline estrutural da equipe**.

---

### 7. Contrato de Qualifying RNG

- **Sigma:** 0.45
- **PRNG:** Mulberry32 determinístico via seed
- **Distribuição:** Box-Muller (Gaussiana)
- **Clamp:** [-1.0, +1.0]

_Comportamento esportivo:_ O RNG modela a variabilidade natural da execução humana e microclima da volta rápida. O RNG **não serve para calibrar artificialmente a hierarquia de equipes**, mantendo média zero e dispersão controlada.

---

### 8. Tradução Observada para Pace (Benchmark WCA)

No benchmark homologado WCA (Calibration WCA-01R), a escala de equivalência observada no tempo de volta é de **aproximadamente 0,082 s por ponto estrutural**.

Exemplos homologados no benchmark:

- **Mercedes (100) → Andretti (45):** 55 pontos estruturais de delta correspondendo a aproximadamente **4,510 s/volta**.
- **Audi (86) → Haas (75):** 11 pontos estruturais correspondendo a aproximadamente **0,902 s**.
- **Williams (70) → Aston Martin (60):** 10 pontos estruturais correspondendo a aproximadamente **0,820 s**.

_Ressalva importante:_ Este valor (0,082 s/pt) reflete a tradução observada no benchmark canônico sob condições padronizadas; **não deve ser interpretado como constante física universal invariável**, pois cada pista e formato de sessão possui comprimentos de volta e dinâmicas próprias.

---

### 9. BASELINE INICIAL ≠ ESTADO ATUAL DA CARREIRA

O estado inicial estabelecido em 2026 é apenas o ponto de partida. Conforme a carreira avança, todas as variáveis estruturais e dinâmicas evoluem:

1. **Componentes e Peças:** Podem ser projetados, atualizados e manufaturados;
2. **Unidade de Potência (PU):** Efetividade e integração podem mudar por desenvolvimento ou trocas de fornecedor;
3. **Reliability & Condition:** Confiabilidade e desgaste variam a cada fim de semana e ciclo de manutenção;
4. **Infraestrutura:** Instalações (fábrica, túnel de vento, simulador) podem ser expandidas;
5. **Pilotos:** Contratações, evolução de atributos, adaptação e moral;
6. **Setup & Operações:** Eficiência operacional da equipe e engenheiros;
7. **Resultados e Dinâmica Intertemporadas:** Equipes podem crescer, estagnar ou decair.

Portanto, **a Mercedes não é obrigada a continuar em 100**, e **a Andretti não é obrigada a permanecer em 45**. A convergência inicial não é um congelamento perene.

---

### 10. Princípio de Projeto: Sucesso e Fracasso Emergentes

O jogo baseia-se em princípios de simulação sistêmica:

- Equipes podem acertar plenamente o conceito de projeto de um carro novo;
- Equipes podem falhar gravemente na correlação aerodinâmica ou fiabilidade do projeto;
- Problemas crônicos de confiabilidade podem arruinar temporadas inteiras de equipes fortes;
- Equipes do fundo do grid podem investir assertivamente e saltar de patamar entre temporadas;
- A baseline 2026 não congela nem impede nenhum desses comportamentos.

---

### 11. Camada de Pilotos (Desacoplamento Arquitetural)

Conforme homologado no benchmark WCA e no CP4, a camada de **Piloto é estritamente separada** da Força Estrutural do construtor:

- O cálculo da Força Estrutural da equipe (`structuralStrengthService`) mede o potencial do conjunto chassi/PU/infraestrutura e da base do time;
- Pilotos excepcionais (comprovado nos testes canônicos com pilotos de topo como Verstappen 98/95/90 e Alonso 88 em ritmo de corrida) elevam o pace de volta e o resultado na pista através do modificador de evento/sessão (`driverEventModifier`), **sem alterar em nada o índice estrutural base da equipe**.

---

### 12. Matriz de Circuitos e Perfis de Pista

Os oito perfis canônicos do sistema de performance (`slow`, `medium`, `fast`, `power-sensitive`, `downforce-sensitive`, `traction`, `braking`, `mixed`):

- Permitem que carros com pontos fortes específicos se sobressaiam em locais específicos;
- Exemplos homologados: Williams (forte em velocidade de reta) pode superar a Haas em Monza ou circuitos sensíveis a potência; Cadillac pode superar Aston Martin em traçados favoráveis de tração;
- No agregado do campeonato, os clusters de competitividade permanecem coerentes e fiéis ao equilíbrio estrutural.

---

### 13. Anti-Hardcode: Diretrizes Proibitivas

É **TERMINANTEMENTE PROIBIDO** no código de simulação e de regras:

1. `if (teamName === 'X') { paceBonus() }` — qualquer bônus ou penalidade nominal;
2. `position cap` — travas artificiais de posição máxima ou mínima para qualquer equipe;
3. `winner cap` — restrição sobre quem pode ou não vencer uma sessão;
4. `forced hierarchy` — ordenação forçada do grid fora do modelo físico de pace;
5. `rubber banding` — compensação artificial de ritmo baseada em nome ou posição da equipe;
6. `resultado pré-definido` — geração de resultados roteirizados;
7. `baseline alterada dinamicamente` — manipulação em tempo real dos índices base para forçar classificação desejada.

---

### 14. Anti-Drift e Proteção Contratual (CP4)

A suíte de testes de regressão **CP4 (baseline-2026-lock-cp4.test.ts)** protege contra drift silencioso:

- Targets das 12/12 equipes;
- Pesos exatos de Technical (50/30/10/10);
- Pesos exatos de Driver (80/10/10);
- Pesos exatos de Team (80/20);
- Pesos exatos de Final Structural (60/25/15);
- TrackFit neutral (75.0), scale (0.08), clamps (±2.0 / ±2.5) e aplicação única (1x);
- Setup neutral (80.0), coefficient (0.05) e aplicação única (1x);
- RNG sigma (0.45), determinismo e clamp;
- Detecção e bloqueio de aplicações duplicadas de qualquer camada.

**Regra de Ouro Contratual:** Qualquer alteração intencional futura deve **quebrar o contrato primeiro**. É expressamente proibido alterar os valores `expected` nos testes silenciosamente apenas para fazê-los voltar ao verde.

---

### 15. Tabela de Homologações Comprovadas

| Pacote                         | Resultado  | Papel                                                                            |
| :----------------------------- | :--------: | :------------------------------------------------------------------------------- |
| **CP2**                        |  8/8 PASS  | Âncora 2026 sem double-count, exclusão de V0 do runtime ativo, Audi homologada   |
| **CP3A**                       |  9/9 PASS  | Clamps de TrackFit (±2.0 / ±2.5), RNG quali Mulberry32 determinístico sigma 0.45 |
| **SETUP-EFFICIENCY-QUALI-01A** |  8/8 PASS  | Integração neutra 80, coeficiente 0.05, aplicação única de setup                 |
| **CALIBRATION-WCA-01R**        | 27/27 PASS | Prova estrita da baseline 2026, convergência delta 0.00 em 12 equipes            |
| **CP4**                        | 32/32 PASS | Lock técnico completo do contrato esportivo 2026 e travas anti-drift             |
| **TrackFit**                   |    PASS    | Modificador centrado em 75 com escala linear e clamp bilateral                   |
| **Structural**                 |    PASS    | Decomposição paramétrica e ponderação multi-fatorial 60/25/15                    |
| **Qualifying**                 |    PASS    | Integração canônica de tempo de volta e consistência de pace                     |
| **Balance Audit**              |    PASS    | Auditoria completa de dados sem hardcodes nominais de construtores               |

---

### 16. Conclusão do WCA: A Baseline Já Estava Correta

Durante a rodada de calibração WCA-01R ficou formalmente comprovado:

- **A BASELINE JÁ ESTAVA CORRETA.**
- Benchmark BEFORE = TARGET, com **delta 0.00** para todas as 12 equipes.
- Nenhum nerf foi necessário.
- Nenhum rating de produção precisou ser alterado.
- Nenhum modificador condicional por nome de equipe foi criado.

---

### 17. Travamento Técnico CP4

- O CP4 travou o contrato técnico de ponta a ponta.
- Não houve necessidade de recalibrar a baseline.
- **PRODUCTION CHANGED:** NO.
- **Versão homologada:** v0.0.817, commit `8d3a38a`.

---

### 18. Protocolo Canônico para Alterações Futuras

Caso um ajuste futuro de balanceamento seja deliberadamente necessário, o seguinte protocolo rigoroso em 11 etapas deve ser seguido:

1. Abrir tarefa específica dedicada à alteração;
2. Medir o baseline BEFORE em suíte padronizada;
3. Apresentar justificativa técnica documental clara;
4. Alterar os dados-fonte canônicos necessários;
5. Medir o baseline AFTER comparativo;
6. Medir o impacto real em tempo de volta e pace;
7. Testar os efeitos na matriz de TrackFit;
8. Separar e isolar os efeitos de atributos de pilotos;
9. Atualizar formalmente o contrato documental;
10. Atualizar as suítes de teste de lock contratual;
11. Registrar nova versão homologada e commit específico.

_NUNCA alterar os valores esperados nos testes antes de cumprir o ciclo de auditoria._

---

### 19. O Que Não Justifica Recalibração de Baseline

Resultados isolados e pontuais ocorridos durante a simulação da carreira **NÃO justificam** recalibrar a baseline de produção:

- Williams superar Audi em um GP específico com características favoráveis;
- Andretti pontuar em corrida caótica ou com chuva;
- Aston Martin avançar para o Q3 por acerto perfeito de setup ou volta mágica de Alonso;
- Cadillac superar a Haas em um traçado específico de baixa exigência aerodinâmica;
- Red Bull conquistar uma pole position diante da Ferrari e Mercedes;
- McLaren vencer a Mercedes em prova de gestão de desgaste de pneus.

Tais acontecimentos são dinâmicas naturais e saudáveis da simulação esportiva.

---

### 20. Fontes Canônicas no Código

Os caminhos reais dos artefatos canônicos no repositório são:

- **BASELINE_2026_V1_TEAMS:** `src/data/baseline-2026-v1.ts`
- **Structural Strength:** `src/services/structuralStrengthService.ts`
- **TrackFit:** `src/services/canonicalPaceIntegrationService.ts`
- **SetupEfficiency:** `src/services/canonicalPaceIntegrationService.ts`
- **Qualifying RNG:** `src/services/canonicalPaceIntegrationService.ts`
- **CP2 Test Suite:** `src/__tests__/baseline-2026-lock-01-cp2.test.ts`
- **CP3A Test Suite:** `src/__tests__/baseline-2026-lock-01-cp3a.test.ts`
- **SetupEfficiency Test Suite:** `src/__tests__/setup-efficiency-quali-01a.test.ts`
- **CALIBRATION-WCA-01R Test Suite:** `src/__tests__/calibration-wca-01r.test.ts`
- **CP4 Test Suite:** `src/__tests__/baseline-2026-lock-cp4.test.ts`
- **Balance Audit:** `src/artifacts/audits/balanceAuditArtifact.ts` e `src/artifacts/audits/balanceAuditPost02cArtifact.ts`

---

### 21. Status Final do Contrato

```text
BASELINE-2026-LOCK-01 STATUS: LOCKED
- Initial Targets: LOCKED
- Structural Formula: LOCKED
- TrackFit Contract: LOCKED
- SetupEfficiency Contract: LOCKED
- Qualifying RNG Contract: LOCKED
- Career Evolution: DYNAMIC
- Race Results: EMERGENT
```

---

### 22. Regra de Ouro

> **"BASELINE É O PONTO DE PARTIDA, NÃO O RESULTADO. O JOGO PRODUZ A HISTÓRIA; NÃO REPRODUZ UMA CLASSIFICAÇÃO PRÉ-DEFINIDA."**
