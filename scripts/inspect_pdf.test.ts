import { describe, it } from 'vitest'
import fs from 'fs'

describe('Inspect PDFs and environment', () => {
  it('checks pdf and downloads', async () => {
    const posterExists = fs.existsSync('src/assets/posterespilotosmbj2026-13ddc.pdf')
    console.log('Poster PDF exists:', posterExists)
    if (posterExists) {
      const stat = fs.statSync('src/assets/posterespilotosmbj2026-13ddc.pdf')
      console.log('Poster PDF size:', stat.size)
    }

    const fichaUrl =
      'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/27918979-068c-4c35-80ed-e16c255f350b/bancopilotosmbj2026-39678.pdf'
    try {
      const res = await fetch(fichaUrl)
      console.log('Ficha Mestre fetch status:', res.status, res.headers.get('content-type'))
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        console.log('Ficha Mestre downloaded bytes:', buf.length)
        fs.mkdirSync('src/assets', { recursive: true })
        fs.writeFileSync('src/assets/bancopilotosmbj2026-39678.pdf', buf)
        console.log('Saved Ficha Mestre to src/assets/bancopilotosmbj2026-39678.pdf')
      }
    } catch (e) {
      console.error('Fetch error:', e)
    }
  })
})
