import { describe, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'

function downloadFile(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(destPath)
    https
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          file.close()
          try {
            fs.unlinkSync(destPath)
          } catch {}
          downloadFile(res.headers.location, destPath).then(resolve)
          return
        }
        if (res.statusCode !== 200) {
          file.close()
          try {
            fs.unlinkSync(destPath)
          } catch {}
          resolve(false)
          return
        }
        res.pipe(file)
        file.on('finish', () => {
          file.close(() => {
            const stat = fs.statSync(destPath)
            if (stat.size < 1000) {
              // Might be html or empty error
              const head = fs.readFileSync(destPath, 'utf8').slice(0, 50)
              if (head.includes('<!DOCTYPE') || head.includes('<html')) {
                try {
                  fs.unlinkSync(destPath)
                } catch {}
                resolve(false)
                return
              }
            }
            resolve(true)
          })
        })
      })
      .on('error', () => {
        file.close()
        try {
          fs.unlinkSync(destPath)
        } catch {}
        resolve(false)
      })
  })
}

describe('download-assets-test', () => {
  it('downloads single test file', async () => {
    const testDir = path.resolve(process.cwd(), 'public/test-dir')
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true })
    const dest = path.join(testDir, 'ferrari.png')
    const ok = await downloadFile(
      'https://www.dropbox.com/scl/fo/ro5v23ii5qqb8q79eoq1c/AIzc-ON2kz8-VpQLZ1bQRow/5-Gabriel_Bortoleto.png?rlkey=tfr62lrgs1tahapuduonocp99&dl=1',
      dest,
    )
    console.log('Download bortoleto result:', ok, fs.existsSync(dest) ? fs.statSync(dest).size : 0)
  }, 30000)
})
