# AUDITORIA E HOMOLOGAÇÃO BASELINE-2026-LOCK-01

**Projeto:** APEX GP Manager  
**Versão:** v0.0.707+ (BASELINE-2026-LOCK-01)  
**Status:** HOMOLOGADA  
**Data:** 2026-03-31  
**Módulos Centrais:**

- `src/data/baseline-2026-v1.ts`
- `src/services/structuralStrengthService.ts`
- `src/services/canonicalPaceIntegrationService.ts`
- `src/services/canonicalQualifyingRunner.ts`
- `src/__tests__/baseline-2026-lock-01.test.ts`

---

## 1. BASELINE-2026-V1 DEFINITIVA (12 Equipes da Temporada 2026)

Hierarquia estrutural canônica imutável no início da temporada (01/01/2026):

| Posição Estrutural | Equipe                | Key           | Score (0–100) | Spread vs P1 (pts) | Spread Teórico (~0.080s/pt) |
| ------------------ | --------------------- | ------------- | ------------- | ------------------ | --------------------------- |
| P1                 | Mercedes-AMG Petronas | `mercedes`    | **100**       | 0.0                | Líder (Ref)                 |
| P2                 | McLaren F1 Team       | `mclaren`     | **98**        | -2.0               | +0.160 s                    |
| P3                 | Scuderia Ferrari      | `ferrari`     | **96**        | -4.0               | +0.320 s                    |
| P4                 | Red Bull Racing       | `redbull`     | **94**        | -6.0               | +0.480 s                    |
| P5                 | Visa Cash App RB      | `racingbulls` | **90**        | -10.0              | +0.800 s                    |
| P6                 | Alpine F1 Team        | `alpine`      | **87**        | -13.0              | +1.040 s                    |
| P7                 | Audi F1 Team          | `audi`        | **84**        | -16.0              | +1.280 s                    |
| P8                 | Haas F1 Team          | `haas`        | **81**        | -19.0              | +1.520 s                    |
| P9                 | Williams Racing       | `williams`    | **79**        | -21.0              | +1.680 s                    |
| P10                | Aston Martin Aramco   | `astonmartin` | **75**        | -25.0              | +2.000 s                    |
| P11                | Cadillac F1 Team      | `cadillac`    | **72**        | -28.0              | +2.240 s                    |
| P12                | Andretti Global       | `andretti`    | **69**        | -31.0              | +2.480 s                    |

**Delta Estrutural:** 100 - 69 = **31 pontos**.  
**Spread Base Teórico:** $31 \times 0.080\text{ s} = \mathbf{2.480\text{ s}}$ (antes de modificadores de pista, setup, pilotos, clima e RNG).

---

## 2. RECALIBRAÇÃO DE MODIFICADORES

### 2.1 TrackFit (Pista)

- **Antes (v0.0.706):**  
  Scale = 0.22, clamp [-6.5, +6.5].  
  Resultado em Silverstone: Cadillac +5.850 pts, Alpine +4.950 pts, Top teams penalizadas em até -3.740 pts.  
  Problema: Gap de TrackFit chegava a 9.59 pts (~0.78s), quebrando tiers inteiros e jogando Alpine para disputa direta de P1 e Cadillac para encostar no Top 8.
- **Depois (BASELINE-2026-LOCK-01):**  
  Scale = 0.08, clamp [-2.5, +2.5].  
  Faixa típica: -2.0 a +2.0 pts; teto fisiológico de ±2.5 pts.  
  Efeito esportivo: Favorece pacotes específicos em pistas específicas sem apagar tiers nem transformar Cadillac/Andretti em candidatas ao Top 3 por pista pura.

### 2.2 RNG (Estocasticidade da Sessão)

- **Antes (v0.0.706):**  
  Multiplicador 12.0, gerando até ±1.800 pts (~±0.15s).  
  Invertia tiers vizinhos inteiros aleatoriamente em condições normais.
- **Depois (BASELINE-2026-LOCK-01):**  
  Multiplicador 6.0 com clamp rígido em [-1.0, +1.0] pt (~±0.08s).  
  Permite disputa acirrada entre companheiros e equipes do mesmo tier sem inversão de tiers distantes.

### 2.3 Setup no Runner de Qualificação

- **Antes (v0.0.706):**  
  `canonicalQualifyingRunner.ts` não transmitia `setupEfficiency`, forçando default neutro 80 (0.0 pts) para jogador e IA.
- **Depois (BASELINE-2026-LOCK-01):**  
  `canonicalQualifyingRunner.ts` transmite a eficiência real do acerto de TL (`car.setup.efficiency` / `car.setup.setupEfficiency`), conferindo a vantagem esportiva justa de até +1.0 pt (+0.08s) para setup 100%.

---

## 3. TESTES CONTROLADOS E COMPARAÇÃO DE RANKINGS

### Ranking 1: Força Estrutural Pura

1. Mercedes (100)
2. McLaren (98)
3. Ferrari (96)
4. Red Bull (94)
5. Racing Bulls (90)
6. Alpine (87)
7. Audi (84)
8. Haas (81)
9. Williams (79)
10. Aston Martin (75)
11. Cadillac (72)
12. Andretti (69)

### Ranking 2: Qualificação Neutra (Pista Neutra, Setup 80, Pilotos Idênticos, RNG 0)

Ordem preservada rigorosamente:

1. Mercedes > 2. McLaren > 3. Ferrari > 4. Red Bull > 5. Racing Bulls > 6. Alpine > 7. Audi > 8. Haas > 9. Williams > 10. Aston Martin > 11. Cadillac > 12. Andretti.

### Ranking 3: Silverstone Normal Completo (TrackFit + Setup + Pilotos Reais + RNG)

- Top 4 é estritamente composto por Mercedes, McLaren, Ferrari e Red Bull.
- Racing Bulls, Alpine e Audi disputam a zona de Q3 (P5 a P8).
- Haas e Williams no meio (P8 a P10).
- Aston Martin, Cadillac e Andretti disputam o fundo (P10 a P12).
- Cadillac não entra no Top 3 em circunstância normal (máximo ~P10 em volta perfeita).

### Ranking 4: Cenário Caótico (Chuva Variável + Erros Estratégicos)

- Com chuva torrencial, se equipes de ponta errarem estratégia de pneus (composto macio seco recebendo penalidade de +8.5s), zebras como Haas/Cadillac com pneus extremos e pilotos de chuva avançam substancialmente.
- Nenhuma barreira artificial ("if team == Mercedes") impede zebras em cenários extremos.

---

## 4. RESULTADO DA SUÍTE DE TESTES BL26-01..14

Todos os 14 testes canônicos foram executados e aprovados:

| Teste       | Descrição                                                   | Status   |
| ----------- | ----------------------------------------------------------- | -------- |
| **BL26-01** | Baseline exata 12 equipes                                   | **PASS** |
| **BL26-02** | Ordem estrutural correta (100 a 69)                         | **PASS** |
| **BL26-03** | Mercedes = 100                                              | **PASS** |
| **BL26-04** | Andretti = 69                                               | **PASS** |
| **BL26-05** | Spread estrutural ~2.48s                                    | **PASS** |
| **BL26-06** | TrackFit limitado (-2.0 a +2.0 / máx ±2.5)                  | **PASS** |
| **BL26-07** | TrackFit não joga Cadillac top 3 sozinho                    | **PASS** |
| **BL26-08** | TrackFit não joga Andretti top 3 sozinho                    | **PASS** |
| **BL26-09** | RNG não quebra tiers sozinho (clamp [-1.0, +1.0])           | **PASS** |
| **BL26-10** | Setup não quebra tiers sozinho (+1.0 pt máx)                | **PASS** |
| **BL26-11** | Qualificação neutra respeita ordem exatamente               | **PASS** |
| **BL26-12** | Companheiros permanecem em faixa plausível (~0.05-0.35s)    | **PASS** |
| **BL26-13** | Silverstone normal plausível (Top 4 dominado por favoritas) | **PASS** |
| **BL26-14** | Cenário caótico permite zebras (estratégia climática)       | **PASS** |

---

## 5. CONCLUSÃO DE HOMOLOGAÇÃO

A BASELINE-2026-V1 foi materializada como fonte canônica definitiva para a temporada 2026. A hierarquia inicial está protegida por regras físicas de calibragem (TrackFit, RNG, Setup) sem nenhum mecanismo artificial de tier fixo. A integridade do motor esportivo foi 100% preservada.
