# Planejamento das Frentes B, C e D — Apex GP Manager

## Frente B: CALENDARIO-CIRCUITOS-01

- **Objetivo**: Integrar imagens de circuitos a partir da pasta `circuitos` do repositório GitHub do projeto.
- **Regra canônica**: Vínculo estrito por ID canônico do circuito (`circuit_id` / chave canônica), sem adivinhação por nome ou fallback frágil.
- **Escopo**: Manter estrutura existente de circuitos, garantindo resolução determinística de fotos/traçados na UI do calendário e corrida.

## Frente C: RETRATOS-GERADOS-01

- **Objetivo**: Integrar retratos da pasta `pilotos-gerados` do GitHub para pilotos procedurais ou sem identificador DRV via resolvedor canônico `resolveDriverPhoto`.
- **Regra canônica**: Mapeamento determinístico via seed/hash procedural sem quebrar o mapeamento bijetivo canônico existente de pilotos oficiais (DRV_0001 a DRV_0137).
- **Escopo**: Preservar avatares e posters sem fallback cego ou genérico.

## Frente D: ESPECIFICAÇÃO de Peças / PU / ADUO

- **Ciclo de vida**: `Projeto` → `Desenvolvimento` → `Fabricação` → `Instalação` → `Avaliação`.
- **ADUO (Additional Development & Upgrade Opportunities)**:
  - Pertence exclusivamente à lógica do fabricante de PU (Power Unit).
  - **NÃO** é bônus automático para a equipe pior colocada.
  - Pré-requisitos antes da implementação: definir versão regulamentar de referência, índice comparável de desempenho do motor, distinguir regra real de simplificação, documentar períodos, critérios e permissões, desenvolvimento e disponibilidade às equipes clientes, preservando saves iniciados.
  - **Restrições**: Sem coeficientes provisórios arbitrários, sem conversão de diferença de rating em percentual regulamentar, sem aumento instantâneo de potência.
