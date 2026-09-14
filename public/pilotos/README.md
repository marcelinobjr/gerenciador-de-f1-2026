# Pasta public/pilotos/

Este diretório armazena os pôsteres e fotos locais dos pilotos com nomes canônicos e numeração oficial da F1 / universo MBJ 2026.
O resolvedor de fotos (`src/lib/pilot-posters.ts` e `src/lib/driver-photos.ts`) busca PRIMEIRO nesta pasta pública antes de recorrer a qualquer contingência externa.

## Status do Download do ZIP do Google Drive
- **Arquivo ID:** `172uJ1KMVep63CJckatoM4T5MB13Knj-t`
- **Tentativa de Download:** Realizada conforme especificação (GET na URL com `export=download`, captura dos parâmetros de bypass do virus-scan e requisição a `drive.usercontent.google.com`).
- **Diagnóstico HTTP:**
  - O link público requer autenticação/permissões ativas da conta Google (redireciona para `https://accounts.google.com/v3/signin/...` com título `<title>Google Drive: Sign-in</title>`).
  - O Google Drive retornou a página de Sign-in/Login obrigatório antes de exibir o formulário de aviso de verificação de vírus (`Google Drive - Virus scan warning`).
  - Portanto, os tokens ocultos (`id`, `export`, `confirm`, `uuid`) não são expostos publicamente sem sessão autenticada.
  - Para disponibilizar os arquivos sem restrição de login da Google, o arquivo precisa ser compartilhado como "Qualquer pessoa com o link pode ler" ou hospedado em repositório público/bucket direto.

## Convenção Canônica de Nomenclatura
- `{Número}-{Nome_Sobrenome}.{ext}` (ex.: `3-Max_Verstappen.png`, `16-Charles_Leclerc.png`, `11-Sergio_Pérez.png`, `5-Gabriel_Bortoleto.png`, `77-Walteri_Botas.jpg`, `43-Franco_Colapinto.png`)
- Ou formato por chave/sobrenome: `{sobrenome}.{ext}` (ex.: `verstappen.png`, `bortoleto.png`, `perez.png`, `bottas.jpg`)
- Variações com e sem acento, assim como extensões `.png`, `.jpg` e `.webp`, são automaticamente resolvidas pelo motor.

## Pilotos Titulares F1 2026 (22 pilotos)
1. Max Verstappen (`3-Max_Verstappen.png`)
2. Liam Lawson (`30-Liam_Lawson.png` / `30-Lian_Lawson.png`)
3. Lewis Hamilton (`44-Lewis_Hamilton.png`)
4. Charles Leclerc (`16-Charles_Leclerc.png`)
5. Lando Norris (`4-Lando_Norris.png` / `4-Lando_Noris.png`)
6. Oscar Piastri (`81-Oscar_Piastri.png`)
7. George Russell (`63-George_Russell.png` / `63-George_Russel.png`)
8. Andrea Kimi Antonelli (`12-Kimi_Antonelli.png`)
9. Fernando Alonso (`14-Fernando_Alonso.png`)
10. Lance Stroll (`18-Lance_Stroll.png`)
11. Pierre Gasly (`10-Pierre_Gasly.png`)
12. Jack Doohan (`7-Jack_Doohan.png`)
13. Alexander Albon (`23-Alex_Albon.png`)
14. Carlos Sainz (`55-Carlos_Sainz.png`)
15. Yuki Tsunoda (`22-Yuki_Tsunoda.png`)
16. Isack Hadjar (`6-Isack_Hadjar.png`)
17. Esteban Ocon (`31-Esteban_Ocon.png`)
18. Oliver Bearman (`87-Oliver_Bearman.png` / `87-Olivier_Bearman.png`)
19. Nico Hülkenberg (`27-Nico_Hulkenberg.png`)
20. Gabriel Bortoleto (`5-Gabriel_Bortoleto.png` / asset bundled)
21. Sergio Pérez (`11-Sergio_Pérez.png` / `11-Sergio_Perez.png`)
22. Valtteri Bottas (`77-Valtteri_Bottas.png` / `77-Walteri_Botas.jpg`)

## Pilotos Reservas e Mercado em Destaque
- Franco Colapinto (`43-Franco_Colapinto.png`)
- Felipe Drugovich (`34-Felipe_Drugovich.png`)
- Pietro Fittipaldi (`51-Pietro_Fittipaldi.png`)
- Daniel Ricciardo (`3-Daniel_Ricciardo.png`)
- Arvid Lindblad (`30-Arvid_Lindblad.jpg` / `31-Arvid_Lindblad.png`)
- Gabriel Mini (`9-Gabriel_Mini.png`)
- Nicola Tsolov (`6-Nicola_Tsolov.png`)
- Rafael Câmara (`1-Rafael_Camara.png`)
- Dino Beganovic (`1-Dino_Beganovic.jpg`)
- Colton Herta (`26-Colton_Herta.png`)
