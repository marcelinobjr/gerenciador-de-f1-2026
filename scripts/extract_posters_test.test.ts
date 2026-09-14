import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Run extract', () => {
  it('extracts JPEGs from poster PDF', () => {
    fs.writeFileSync('public/test_marker.txt', 'hello from vitest')
    const pdfPath = path.resolve(process.cwd(), 'src/assets/posterespilotosmbj2026-13ddc.pdf')
    const pdfBuf = fs.readFileSync(pdfPath)
    console.log('PDF total bytes:', pdfBuf.length)

    const jpegImages: { index: number; length: number; buf: Buffer }[] = []
    let searchPos = 0
    while (searchPos < pdfBuf.length - 4) {
      if (
        pdfBuf[searchPos] === 0xff &&
        pdfBuf[searchPos + 1] === 0xd8 &&
        pdfBuf[searchPos + 2] === 0xff
      ) {
        let endPos = searchPos + 3
        while (endPos < pdfBuf.length - 1) {
          if (pdfBuf[endPos] === 0xff && pdfBuf[endPos + 1] === 0xd9) {
            const imgBuf = pdfBuf.subarray(searchPos, endPos + 2)
            if (imgBuf.length > 5000) {
              jpegImages.push({
                index: jpegImages.length,
                length: imgBuf.length,
                buf: Buffer.from(imgBuf),
              })
            }
            searchPos = endPos + 2
            break
          }
          endPos++
        }
      }
      searchPos++
    }

    console.log('Extracted raw JPEG count:', jpegImages.length)
    const outDir = path.resolve(process.cwd(), 'public/pilotos')
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }
    jpegImages.forEach((img, i) => {
      fs.writeFileSync(path.join(outDir, `poster_${String(i + 1).padStart(3, '0')}.jpg`), img.buf)
    })
    console.log('Saved 134 posters to public/pilotos/')
    expect(jpegImages.length).toBe(134)
  })
})
