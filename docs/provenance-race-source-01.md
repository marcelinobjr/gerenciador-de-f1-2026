# Proveniência e Hashes — Insumos RACE-SOURCE-01 (v1.0.0)

**Data de Registro:** 2026-09-27  
**Work Item:** RACE-SOURCE-01 — Rodada Única: RACE-SOURCE-01A  
**Pacote de Origem:** `RACE-SOURCE-01-3FILES` (versão 1.0.0)  
**Fonte Original Declarada:** `APEX GP MANAGER — Simulador de Corrida (v1)`  
**Arquivo XLSX de Origem Declarado:** `Apex GP Manager - Simulacao de Corrida.xlsx`  
**Hash de Origem Informado (metadata.source_sha256):** `0d02e79794f6defabfa3385d2854a4fc0bed7e5a17495c008075185d71f289a2`  
_(Nota: O XLSX original NÃO foi anexado e NÃO foi recalculado no Skip Cloud. O hash acima é estritamente a proveniência recebida no metadado do pacote)._

---

## 1. Arquivos Materializados e Hashes SHA-256 Efetivos

Os três arquivos JSON contendo a totalidade textual, paramétrica, de cenários, fórmulas e inventário de células da planilha original foram salvos em diretório persistente do projeto (`src/assets/`):

| Insumo | Caminho no Projeto                              | Papel                                                        | SHA-256 Calculado no Skip                                          | Tamanho (Bytes) |
| ------ | ----------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ | --------------- |
| **01** | `src/assets/01raceregraseparametros-3c0c5.json` | Regras, Parâmetros, Tabelas e Findings D01-D16               | `15e9e24a41300938f29cefdca68480db80c05988548bb2268798e4d35e1286ae` | 137.954         |
| **02** | `src/assets/02racecenariosetestes-f3097.json`   | Cenário Salvo, Matrizes e 28 Vetores Controlados (RF01–RF28) | `d03e2c3495d43cae2c7a6e12e1ec73da28469c4a8ee93478b87d46ffb8e4e69b` | 895.968         |
| **03** | `src/assets/03raceformulasefonte-0d9bf.json`    | 16 abas, 19.188 células, 13.822 fórmulas reconstruíveis      | `c8ca31853db5185d6b46efee5dffbf3bf7d12f1cf5ecbe3a525b682390f7082c` | 2.502.830       |

---

## 2. Invariantes de Preservação e Isolamento

1. **Arquivos Inalterados:** Os três arquivos recebidos foram preservados verbatim em `src/assets/`.
2. **Motor Ativo Intacto:** O motor esportivo ativo de corrida (`src/lib/f1-pace-model.ts`, `src/lib/f1-race-sim-engine.ts`, `src/services/canonicalRaceEngineService.ts`, etc.) NÃO foi substituído nem alterado em produção.
3. **Ledger Financeiro e FIN-EVO Preservados:** As entregas anteriores (`FIN-SOURCE-01A` e `01B`, `teamReplacementService`, coleções financeiras e deduplicação) permanecem 100% intactas e operacionais.
4. **Isolamento de Configuração DRAFT:** A configuração versionada é registrada como `status: "DRAFT"` e `is_active: false`, sem afetar carreiras reais.
