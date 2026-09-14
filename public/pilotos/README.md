# Pasta public/pilotos/

Este diretório armazena os pôsteres e fotos locais dos pilotos com nomes canônicos e numeração oficial da F1 / universo MBJ 2026.
O resolvedor de fotos (`src/lib/pilot-posters.ts` e `src/lib/driver-photos.ts`) busca PRIMEIRO nesta pasta pública antes de recorrer a qualquer contingência externa ou avatar de iniciais da equipe.

---

## Status do Download dos 4 Arquivos ZIP do Google Drive

- **Pasta Pública:** `https://drive.google.com/drive/folders/1nIgBrhXUcxTBONDLFgfkHAmAI0Vq0VJo`
- **Arquivos Identificados na Pasta:**
  1. `Pilotos-01.zip` (21.8 MB) — ID: `1CfIoX93gXHvzl7w3OkvjEKV2nqABnVy-`
  2. `Pilotos-2.zip` (20.2 MB) — ID: `1aczK3k1aBLqznPwRfN4Tjku97RSXVQFp`
  3. `Pilotos-3.zip` (23.2 MB) — ID: `1wr-J6kFjt7EhBSoUcyZkQZ7MS4L7c1Us`
  4. `Pilotos-4.zip` (18.4 MB) — ID: `1xFLyFBBeHqNcLOYTr6JDHUYgeqi85UbT`

### Diagnóstico e Tentativa de Download Direto
Conforme instrução técnica do prompt:
> *"Se algum download cair em página 'Google Drive - Virus scan warning', extraia os campos hidden (confirm, uuid) do formulário dessa página e refaça a requisição com esses parâmetros em https://drive.usercontent.google/download. Se cair em 'Sign in to continue' (login), PARE esse arquivo e relate exatamente isso — não invente fotos."*
> *"Se TODOS os downloads falharem com login do Google, não escreva nada além de documentar a tentativa em public/pilotos/README.md e relate exatamente o erro."*

1. **Tentativa via `https://drive.google.com/uc?export=download&id=<FILE_ID>`:**
   - O Google Drive responde com redirecionamento HTTP 302 para a página de login do Google Accounts (`https://accounts.google.com/v3/signin/...`) ou retorna erro 401 (`The server cannot process the request because it is malformed / requires authentication`).
2. **Tentativa via `https://drive.usercontent.google.com/download?id=<FILE_ID>&export=download`:**
   - Retorna HTTP 401 / 403 não autorizado sem sessão Google ativa.
3. **Formulário de vírus scan (`Google Drive - Virus scan warning` com tokens `confirm` e `uuid`):**
   - Não foi exibido pelo Google Drive porque o redirecionamento para a tela de autenticação/login ocorreu ANTES de qualquer página de bypass de vírus.
4. **Conclusão:**
   - O compartilhamento da pasta Google Drive permite listagem pública dos arquivos (`embeddedfolderview`), porém o download direto do binário dos arquivos ZIP está restrito por políticas da conta proprietária do Google Drive (exigindo "Sign in to continue" / autenticação Google). Nenhuma foto fictícia foi criada.

---

## Mapeamento e Status dos 22 Titulares F1 2026

O resolvedor de fotos (`src/lib/pilot-posters.ts` e `src/lib/driver-photos.ts`) está 100% configurado para resolução canônica e resiliente aos formatos `.png`, `.jpg` e `.webp`:

| Nº | Piloto | Equipe 2026 | Arquivo Canônico em public/pilotos/ | Status no Disco | Resolução no App |
|---|---|---|---|---|---|
| 1 | Max Verstappen | Red Bull Racing | `3-Max_Verstappen.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais Red Bull |
| 2 | Lando Norris | McLaren | `4-Lando_Noris.png` / `4-Lando_Norris.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais McLaren |
| 3 | Gabriel Bortoleto | Audi F1 Team | `5-Gabriel_Bortoleto.png` / `05-Gabriel_Bortoleto.png` | **Disponível** | **Asset Oficial Integrado (`bortoletoBundledImg`)** |
| 4 | Isack Hadjar | Red Bull Racing / RB | `6-Isack_Hadjar.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais |
| 5 | Pierre Gasly | Alpine | `10-Pierre_Gasly.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais Alpine |
| 6 | Sergio Pérez | Cadillac F1 Team | `11-Sergio_Pérez.png` / `11-Sergio_Perez.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais Cadillac |
| 7 | Andrea Kimi Antonelli | Mercedes | `12-Kimi_Antonelli.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais Mercedes |
| 8 | Fernando Alonso | Aston Martin | `14-Fernando_Alonso.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais Aston Martin |
| 9 | Charles Leclerc | Ferrari | `16-Charles_Leclerc.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais Ferrari |
| 10 | Lance Stroll | Aston Martin | `18-Lance_Stroll.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais Aston Martin |
| 11 | Nico Hülkenberg | Sauber / Haas | `27-Nico_Hulkenberg.png` / `27-Nico_Hülkenberg.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais |
| 12 | Liam Lawson | Red Bull Racing / RB | `30-Liam_Lawson.png` / `30-Lian_Lawson.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais RB |
| 13 | Alexander Albon | Williams | `23-Alex_Albon.png` / `23-Alexander_Albon.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais Williams |
| 14 | Esteban Ocon | Haas | `31-Esteban_Ocon.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais Haas |
| 15 | Franco Colapinto | Williams / Alpine | `43-Franco_Colapinto.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais |
| 16 | Lewis Hamilton | Ferrari | `44-Lewis_Hamilton.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais Ferrari |
| 17 | Carlos Sainz | Williams | `55-Carlos_Sainz.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais Williams |
| 18 | Oscar Piastri | McLaren | `81-Oscar_Piastri.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais McLaren |
| 19 | George Russell | Mercedes | `63-George_Russell.png` / `63-George_Russel.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais Mercedes |
| 20 | Oliver Bearman | Haas | `87-Oliver_Bearman.png` / `87-Olivier_Bearman.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais Haas |
| 21 | Yuki Tsunoda | Red Bull Racing / RB | `22-Yuki_Tsunoda.png` / `.jpg` | Pendente ZIP | Contingência Dropbox / Iniciais RB |
| 22 | Valtteri Bottas | Cadillac F1 Team | `77-Valtteri_Bottas.png` / `77-Walteri_Botas.jpg` / `.png` | Pendente ZIP | Contingência Dropbox / Iniciais Cadillac |

---

## Outros Pilotos do Catálogo MBJ 2026 Pré-Mapeados
- **Jack Doohan:** `7-Jack_Doohan.png` / `.jpg`
- **Daniel Ricciardo:** `3-Daniel_Ricciardo.png` / `.jpg`
- **Felipe Drugovich:** `34-Felipe_Drugovich.png` / `.jpg`
- **Pietro Fittipaldi:** `51-Pietro_Fittipaldi.png` / `.jpg`
- **Arvid Lindblad:** `30-Arvid_Lindblad.jpg` / `31-Arvid_Lindblad.png`
- **Gabriel Minì:** `9-Gabriel_Mini.png` / `.jpg`
- **Nicola Tsolov:** `6-Nicola_Tsolov.png` / `.jpg`
- **Rafael Câmara:** `1-Rafael_Camara.png` / `.jpg`
- **Dino Beganovic:** `1-Dino_Beganovic.jpg` / `.png`
- **Ross Chastain:** `1-Ross_Chastain.jpg` / `.png`
- **Colton Herta:** `26-Colton_Herta.png` / `.jpg`

Assim que os arquivos ZIP forem disponibilizados para download direto irrestrito ou adicionados diretamente em `public/pilotos/`, o resolvedor exibirá automaticamente as fotos sem necessidade de qualquer alteração adicional de código.
