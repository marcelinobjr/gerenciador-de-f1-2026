import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const pdfPath = path.resolve(process.cwd(), 'src/assets/posterespilotosmbj2026-13ddc.pdf')
const pdfBuf = fs.readFileSync(pdfPath)
console.log('PDF total bytes:', pdfBuf.length)

// Let's find all FlateDecode streams or JPEG streams
let jpgCount = 0
let idx = 0
const outDir = path.resolve(process.cwd(), 'public/pilotos')
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

// Find JPEG markers: 0xFF, 0xD8, 0xFF (SOI) to 0xFF, 0xD9 (EOI)
const jpegImages = []
let searchPos = 0
while (searchPos < pdfBuf.length - 4) {
  if (
    pdfBuf[searchPos] === 0xff &&
    pdfBuf[searchPos + 1] === 0xd8 &&
    pdfBuf[searchPos + 2] === 0xff
  ) {
    // found SOI
    let endPos = searchPos + 3
    while (endPos < pdfBuf.length - 1) {
      if (pdfBuf[endPos] === 0xff && pdfBuf[endPos + 1] === 0xd9) {
        // found EOI
        const imgBuf = pdfBuf.subarray(searchPos, endPos + 2)
        if (imgBuf.length > 5000) {
          jpegImages.push({ start: searchPos, end: endPos + 2, length: imgBuf.length, buf: imgBuf })
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
if (jpegImages.length > 0) {
  console.log(
    'First jpeg size:',
    jpegImages[0].length,
    'Last jpeg size:',
    jpegImages[jpegImages.length - 1].length,
  )
}
