import { describe, it } from 'vitest'
import fs from 'fs'
import path from 'path'

const FOLDERS = [
  { id: '1XdTHER8FxlD7RoqE_aodxR8cOzIILoVf', name: 'Pasta 1' },
  { id: '1yYCmMiVj148m6FZphNqSIwnr9tD3tW4Y', name: 'Pasta 2' },
  { id: '1C5YPJWK_SSafxd_d30MskEZsdxopmVOY', name: 'Pasta 3' },
  { id: '1OOq_nfbBoI46Ve1p0SLcMnIaA8ICJJzU', name: 'Pasta 4' },
]

interface ImageEntry {
  filename: string
  url: string
  folder: string
}

describe('Download Pilotos Photos', () => {
  it('downloads all images from 4 Google Drive folders to public/pilotos/', async () => {
    const targetDir = path.resolve(process.cwd(), 'public/pilotos')
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const logFile = path.resolve(process.cwd(), 'scripts/download_log.txt')
    fs.writeFileSync(logFile, `Iniciando teste download: ${new Date().toISOString()}\n`)

    const imagesToDownload: ImageEntry[] = []

    for (const folder of FOLDERS) {
      console.log(`Buscando lista de arquivos na ${folder.name} (${folder.id})...`)
      const folderUrl = `https://drive.google.com/embeddedfolderview?id=${folder.id}#list`
      const res = await fetch(folderUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })
      const html = await res.text()

      // Regex para capturar pares de (img src lh3, nome do arquivo)
      // No HTML do embeddedfolderview:
      // <img src="(https://lh3.googleusercontent.com/drive-storage/[^"]+)" ... />
      // seguido em alguma div/span ou link pelo nome do arquivo, ex: >05-Gabriel_Bortoleto.jpg< ou similar
      // Vamos tentar capturar tanto via padrão regex amplo quanto específico

      // Padrão 1: blocos de itens
      // Procurar todos os links lh3
      const lh3Regex = /https:\/\/lh3\.googleusercontent\.com\/drive-storage\/[a-zA-Z0-9_-]+/g
      const lh3Matches = html.match(lh3Regex) || []
      fs.appendFileSync(
        logFile,
        `Pasta ${folder.name}: status=${res.status}, htmlLen=${html.length}, lh3Matches=${lh3Matches.length}\n`,
      )

      // Vamos associar cada imagem com o nome do arquivo próximo
      // No HTML da página, temos normalmente:
      // src="(https://lh3.googleusercontent.com/drive-storage/[^"=]+)(=[^"]+)?" ... <div class="flip-entry-title ...">FILENAME.ext</div> ou similar
      // Vamos inspecionar trechos em torno de cada lh3 URL:
      let searchIdx = 0
      for (const lh3Url of lh3Matches) {
        const pos = html.indexOf(lh3Url, searchIdx)
        if (pos === -1) continue
        searchIdx = pos + lh3Url.length

        // Olhar 1000 caracteres à frente para achar o nome do arquivo .jpg / .png
        const sliceAfter = html.slice(pos, pos + 1200)
        const fileMatch = sliceAfter.match(/([0-9a-zA-ZÀ-ÿ_.-]+\.(?:jpg|jpeg|png|webp))/i)

        if (fileMatch) {
          const filename = fileMatch[1]
          // s0 para resolução original / alta resolução
          const fullResUrl = `${lh3Url}=s0`
          imagesToDownload.push({
            filename,
            url: fullResUrl,
            folder: folder.name,
          })
        }
      }
    }

    console.log(`Total de imagens mapeadas: ${imagesToDownload.length}`)

    // Deduplicar por filename
    const uniqueImages = new Map<string, ImageEntry>()
    for (const img of imagesToDownload) {
      if (!uniqueImages.has(img.filename)) {
        uniqueImages.set(img.filename, img)
      }
    }

    console.log(`Total de imagens únicas para download: ${uniqueImages.size}`)

    const results = {
      success: [] as string[],
      failed: [] as { filename: string; reason: string }[],
    }

    // Baixar em lotes concorrentes de 5
    const queue = Array.from(uniqueImages.values())
    const concurrency = 6

    async function worker() {
      while (queue.length > 0) {
        const item = queue.shift()
        if (!item) break
        const filePath = path.join(targetDir, item.filename)

        // Se já existe e tem tamanho > 5KB, pular
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath)
          if (stats.size > 5000) {
            results.success.push(item.filename)
            continue
          }
        }

        try {
          const imgRes = await fetch(item.url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          })
          if (!imgRes.ok) {
            results.failed.push({
              filename: item.filename,
              reason: `HTTP ${imgRes.status} ${imgRes.statusText}`,
            })
            continue
          }
          const buffer = await imgRes.arrayBuffer()
          if (buffer.byteLength < 500) {
            // Pode ser resposta vazia ou erro
            results.failed.push({
              filename: item.filename,
              reason: `Buffer muito pequeno (${buffer.byteLength} bytes)`,
            })
            continue
          }
          fs.writeFileSync(filePath, Buffer.from(buffer))
          results.success.push(item.filename)
          console.log(`Baixado: ${item.filename} (${(buffer.byteLength / 1024).toFixed(1)} KB)`)
        } catch (err: any) {
          results.failed.push({
            filename: item.filename,
            reason: err?.message || String(err),
          })
        }
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker())
    await Promise.all(workers)

    fs.appendFileSync(
      logFile,
      `Finalizado: total=${imagesToDownload.length}, unicos=${uniqueImages.size}, sucesso=${results.success.length}, falha=${results.failed.length}\n`,
    )

    // Gravar README atualizado em public/pilotos/README.md
    const readmeContent = `# Pasta public/pilotos/

Este diretório armazena as fotos e pôsteres oficiais dos pilotos do ecossistema F1 2026 e do Universo MBJ.
Todas as imagens foram baixadas diretamente da infraestrutura pública de CDN do Google Drive via visualização embarcada.

- Total de arquivos salvos: ${results.success.length}
- Total de falhas: ${results.failed.length}

${results.failed.length > 0 ? `### Arquivos que falharam:\n${results.failed.map((f) => `- ${f.filename}: ${f.reason}`).join('\n')}` : '### Status: 100% dos arquivos disponíveis foram baixados com sucesso.'}

### Lista de Arquivos Salvos:
${results.success
  .sort()
  .map((f) => `- \`${f}\``)
  .join('\n')}
`
    fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf-8')
  }, 120000)
})
