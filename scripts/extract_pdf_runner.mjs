import fs from 'node:fs'
import path from 'node:path'

async function uploadPdf() {
  const filePath = path.resolve('src/assets/pilotoscorrelacao-1f508.pdf')
  console.log('Reading file:', filePath)
  const buffer = fs.readFileSync(filePath)
  console.log('File size:', buffer.length)

  const formData = new FormData()
  const blob = new Blob([buffer], { type: 'application/pdf' })
  formData.append('arquivo', blob, 'pilotoscorrelacao.pdf')

  const res = await fetch(
    'https://gerenciador-de-f1-2026-4bb0f.shrd00.internal.goskip.dev/backend/v1/custom-parse-pdf',
    {
      method: 'POST',
      body: formData,
    },
  )
  const text = await res.text()
  console.log('Response status:', res.status)
  fs.writeFileSync('extracted_pdf_result.json', text)
  console.log('Saved response to extracted_pdf_result.json')
}

uploadPdf().catch((err) => {
  console.error('Upload error:', err)
})
