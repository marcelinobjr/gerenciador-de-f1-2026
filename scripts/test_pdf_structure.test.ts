import { describe, it } from 'vitest'
import fs from 'fs'

describe('Inspect PDF and look for pdfjs or parser', () => {
  it('checks available libraries and streams in pdf', async () => {
    const fichaBuf = fs.readFileSync('src/assets/bancopilotosmbj2026-39678.pdf')
    const fichaStr = fichaBuf.toString('latin1')

    // Look for streams or uncompressed text
    const textPieces: string[] = []
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
    let match: RegExpExecArray | null
    let count = 0
    while ((match = streamRegex.exec(fichaStr)) !== null) {
      count++
    }

    // Check if pdfjs-dist or other modules are importable
    let pdfjsAvailable = false
    try {
      // @ts-ignore
      await import('pdfjs-dist')
      pdfjsAvailable = true
    } catch (e) {
      pdfjsAvailable = false
    }

    fs.writeFileSync(
      'scripts/debug_output.json',
      JSON.stringify(
        {
          streamCount: count,
          pdfjsAvailable,
          sampleFichaSnippet: fichaStr.slice(0, 1000),
        },
        null,
        2,
      ),
    )
  })
})
