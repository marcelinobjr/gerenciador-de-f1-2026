# Pasta public/pilotos/ e Status Canônico das Fotos de Pilotos

Este diretório armazena os retratos e pôsteres canônicos dos pilotos reais da base F1 / MBJ 2026.

## Status Atual dos Arquivos em Disco (v0.0.357 / FW-FOTOS-01)

- **Total de Pilotos Reais Canônicos:** 134 arquivos (`DRV_0001.jpg` a `DRV_0134.jpg`) presentes em disco em `public/pilotos/`.
- **Formato:** Todos os 134 arquivos estão com extensão normalizada `.jpg` em caixa minúscula.
- **Origem dos Dados:** Commit remoto `a6ef497` ("Add files via upload"), sincronizado no repositório.
- **Independência de CDN:** As fotos agora residem **100% em disco local**, sem qualquer dependência externa de pastas compartilhadas ou URLs transitórias do Google Drive/Dropbox.

---

## Mapeamento Canônico dos Pilotos (Amostras de Referência)

O resolvedor central do projeto (`src/lib/driver-photo-resolver.ts`) opera estritamente via `driverId -> assetId -> /pilotos/DRV_XXXX.jpg`:

| Asset ID | Piloto Canônico | ID MBJ | Arquivo em Disco | Status |
|---|---|---|---|---|
| `DRV_0001` | Max Verstappen | `mbj-001` | `/pilotos/DRV_0001.jpg` | Presente |
| `DRV_0005` | Lando Norris | `mbj-005` | `/pilotos/DRV_0005.jpg` | Presente |
| `DRV_0012` | Gabriel Bortoleto | `mbj-020` | `/pilotos/DRV_0012.jpg` | Presente |
| `DRV_0015` | Carlos Sainz Jr. | `mbj-014` | `/pilotos/DRV_0015.jpg` | Presente |
| `DRV_0021` | Valtteri Bottas | `mbj-022` | `/pilotos/DRV_0021.jpg` | Presente |
| `DRV_0036` | Mick Schumacher | `mbj-037` | `/pilotos/DRV_0036.jpg` | Presente |
| `DRV_0065` | Arvid Lindblad | `mbj-066` | `/pilotos/DRV_0065.jpg` | Presente |
| `DRV_0068` | Nico Hülkenberg | `mbj-019` | `/pilotos/DRV_0068.jpg` | Presente |
| `DRV_0104` | Fionn McLaughlin | `mbj-104` | `/pilotos/DRV_0104.jpg` | Presente |
| `DRV_0134` | Helio Castroneves / Rossi | `mbj-134` | `/pilotos/DRV_0134.jpg` | Presente |

---

## Perfis Procedurais / Gerados (Newgens)

- **Diretório Alvo:** `public/pilotos-gerados/`
- **Arquivos esperados:** `Piloto_01.jpg` ... `Piloto_13.jpg`
- **Status:** Cópias dos 13 arquivos semente `Piloto_01.jpg` a `Piloto_13.jpg` adicionadas a `public/pilotos-gerados/` (mantendo-os também em `public/pilotos/` para compatibilidade), cobrindo os 13 perfis canônicos catalogados em `src/lib/generated-driver-profiles.ts`:
  - **Femininos:** `Piloto_03`, `04`, `05`, `07`, `09`, `11`, `13`
  - **Masculinos:** `Piloto_01`, `02`, `06`, `08`, `10`, `12`
- **Fallback Gracioso:** Caso qualquer arquivo falte ou não carregue em tempo de execução, o componente `DriverPhotoAvatar` cai de forma graciosa no display de iniciais sobre fundo na cor oficial da equipe sem quebra de UI.
