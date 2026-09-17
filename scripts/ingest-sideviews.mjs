import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'

const FOLDER_ID = '1fyThTdC6asFV6zNijkXuZbtrgbHcr-BL'
const TARGET_DIR = path.resolve(process.cwd(), 'public/assets/teams/sideviews')

// Lista extraída diretamente do HTML embutido da pasta do Google Drive:
const FILES = [
  { name: 'Alfa_Romeo_VL.jpg', id: '16oMjndfj5xYaCjmJJQH9Qr4wi08UJCgM' },
  { name: 'Alfa_Tauri_VL.jpg', id: '125mz7XOmVvyUuMJdErJkoOaUALp4i9nU' },
  { name: 'Alpine_VL.jpg', id: '1FSa8Spjz5P75jWqw5nUHgv8f5lInWniC' },
  { name: 'Andretti_VL.jpg', id: '1NCfrPxFDzrDnx8Wr_O_z9JEdvVbtGews' },
  { name: 'Aston_Martin_VL.jpg', id: '1_RSg5PIMU288W7suUDP3dBE_GPVm_d3F' },
  { name: 'Audi_VL.jpg', id: '1zbTdTGLcsalAd-BxiatuO9k6ZOrRpY6e' },
  { name: 'Benetton_VL.jpg', id: '1eauXLCV65FbUTGVidlTTNnZ4PfL8o_1z' },
  { name: 'BYD_VL.jpg', id: '1NL_qSVEDRY4cae0G-Ir79iBfinTALHT1' },
  { name: 'Cadilac_VL.jpg', id: '1Hizua7n31YV4rQBxHbJ-BePWKVSVTjI_' },
  { name: 'Carro lateral.jpeg', id: '1QkfWAEdVU2u2_S2nnU6ImumGCrehxZZx' },
  { name: 'Copersucar_VL.jpg', id: '1Wo1Aic7uK-fi5hLooLYLt2PP_taR659K' },
  { name: 'Ferrari_VL.jpg', id: '1KtaTpp9X7JeA1Rn0TLdmMVFoGIkMzqZt' },
  { name: 'Fittipaldi_VL.jpg', id: '1m2nT_9JgTCTXIzAbFLj52eglVrbz9nqr' },
  { name: 'Haas_VL.jpg', id: '1wSk-ZxBbfNcMneQOg7KwSieBRx7KeDtF' },
  { name: 'Honda_VL.jpg', id: '18MB7C4CMM6sS-Y7oOH26YNDME1ScIDrx' },
  { name: 'Jordan_VL.jpg', id: '1gvrlBXOKn_PV11ryivz25-isJp-ohkVR' },
  { name: 'Lamborguini_VL.jpg', id: '1YDt5gi4Z2GiD0D8ZBgglaL2DcvYo5DlH' },
  { name: 'Lotus_VL.jpg', id: '1jNphsr5CS-h7O6CZgqHbExGBWzniMa1i' },
  { name: 'MCLaren_VL.jpg', id: '1bvqltjXF7IQcOqfO1uQUUunIJuVkknuV' },
  { name: 'Mercedes_VL.jpg', id: '1zG4H7o6-2N6GWTs9ExJqTdGHBmw-1F-M' },
  { name: 'Penske_VL.jpg', id: '1bFLWtldf2GMaeonzhSXilL30KqDhuY6I' },
  { name: 'Porshe_VL.jpg', id: '1BEkOdwAR9Kd7wKf77Ad2WkjbudMhh9L_' },
  { name: 'REd_Bull_VL.jpg', id: '1hRaA2hu6HRbCmMC8w0xwWJts6X91D2Er' },
  { name: 'Renaut_VL.jpg', id: '1UbQHDI0Uf_iu6ujjKw_kDQLeFy4R1nh1' },
  { name: 'Sauber_VL.jpg', id: '1ka-3e80SejHFjh0avjPt6SlfygeLivJ0' },
  { name: 'Toleman_VL.jpg', id: '1eMBJkgPSkwqiYIhK_-ZHNp4Au1UrYREb' },
  { name: 'Toyota_VL.jpg', id: '1Juhn53H-oNFMll1V_TJZP8UKUOT7ZsUe' },
  { name: 'VCarb_VL.jpg', id: '1autjA5TA29rZZU_voGBAtWplaYevyWRj' },
  { name: 'Williams_VL.jpg', id: '1CIxxvSN7rS6YdiK154BZm0Zl_9VIbhNJ' },
]

async function downloadBuffer(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } },
        (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            if (maxRedirects <= 0) {
              reject(new Error(`Muitos redirecionamentos em ${url}`))
              return
            }
            return resolve(downloadBuffer(res.headers.location, maxRedirects - 1))
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP status ${res.statusCode} para ${url}`))
            return
          }
          const chunks = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', reject)
        },
      )
      .on('error', reject)
  })
}

async function fetchFile(file) {
  const urls = [
    `https://lh3.googleusercontent.com/d/${file.id}=s0`,
    `https://drive.google.com/thumbnail?id=${file.id}&sz=w2000`,
    `https://drive.usercontent.google.com/download?id=${file.id}&export=download&authuser=0`,
  ]

  let lastError = null
  for (const url of urls) {
    try {
      const buf = await downloadBuffer(url)
      if (buf.length > 1000) {
        return buf
      }
      lastError = new Error(`Buffer curto de ${url} (${buf.length} bytes)`)
    } catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error(`Falha ao baixar ${file.name}`)
}

export async function runIngestion() {
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true })
  }

  const result = {
    total: FILES.length,
    baixados: 0,
    falhas: [],
    bytes: 0,
  }

  for (const file of FILES) {
    const targetPath = path.join(TARGET_DIR, file.name)
    try {
      const buf = await fetchFile(file)
      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath)
        if (stat.size === buf.length) {
          result.baixados++
          result.bytes += buf.length
          continue
        }
      }
      fs.writeFileSync(targetPath, buf)
      result.baixados++
      result.bytes += buf.length
    } catch (err) {
      result.falhas.push({ filename: file.name, erro: String(err?.message || err) })
    }
  }

  console.log(JSON.stringify(result, null, 2))
  return result
}

// Executar se chamado diretamente
if (process.argv[1] && process.argv[1].endsWith('ingest-sideviews.mjs')) {
  runIngestion()
}
