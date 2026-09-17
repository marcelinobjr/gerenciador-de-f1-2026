import { describe, it } from 'vitest'

describe('Diagnostic Google Drive download methods', () => {
  it('diagnoses download of files from Google Drive folders', async () => {
    // Test 1: lh3 direct fetch with and without =s0
    const testLh3 =
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPJAkKAu1YBoTjrouFXjeCIkCPq5LCoHAfWJoJC9ArUpAEm94e5sBTYnuu4ej3pfDEtNwtIHVIAQJjwIm_mHg9FNVjURFhP32-kylNO=s0'
    let t1Status = 0
    let t1Bytes = 0
    let t1ContentType = ''
    try {
      const res = await fetch(testLh3, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })
      t1Status = res.status
      t1ContentType = res.headers.get('content-type') || ''
      if (res.ok) {
        const buf = await res.arrayBuffer()
        t1Bytes = buf.byteLength
      }
    } catch (e: any) {
      t1Status = -1
    }
    throw new Error(`DEBUG_RESULT: status=${t1Status}, type=${t1ContentType}, bytes=${t1Bytes}`)

    // Test 2: embeddedfolderview on Carro_Vista_Lateral (1fyThTdC6asFV6zNijkXuZbtrgbHcr-BL)
    try {
      const folderRes = await fetch(
        'https://drive.google.com/embeddedfolderview?id=1fyThTdC6asFV6zNijkXuZbtrgbHcr-BL#list',
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        },
      )
      console.log('TEST 2 - embeddedfolderview status:', folderRes.status)
      const html = await folderRes.text()
      console.log('TEST 2 - html len:', html.length)
      // Check if html contains filenames or lh3 or drive links
      const hasAudi = html.includes('Audi_VL.jpg')
      console.log('TEST 2 - contains Audi_VL.jpg:', hasAudi)
      const matches =
        html.match(/https:\/\/lh3\.googleusercontent\.com\/drive-storage\/[a-zA-Z0-9_-]+/g) || []
      console.log('TEST 2 - lh3 matches count:', matches.length)
      if (matches.length > 0) {
        console.log('TEST 2 - first match:', matches[0])
      }
      // Check file IDs in HTML (e.g. drive.google.com/file/d/ or similar)
      const fileIdMatches = html.match(/\/file\/d\/([a-zA-Z0-9_-]+)/g) || []
      console.log('TEST 2 - fileId matches count:', fileIdMatches.length)
      if (fileIdMatches.length > 0) {
        console.log('TEST 2 - first fileId match:', fileIdMatches[0])
      }
    } catch (e: any) {
      console.log('TEST 2 error:', e.message)
    }

    // Test 3: normal folder view HTML of Carro_Vista_Lateral (1fyThTdC6asFV6zNijkXuZbtrgbHcr-BL)
    try {
      const normalRes = await fetch(
        'https://drive.google.com/drive/folders/1fyThTdC6asFV6zNijkXuZbtrgbHcr-BL?usp=sharing',
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        },
      )
      console.log('TEST 3 - normal folder status:', normalRes.status)
      const normalHtml = await normalRes.text()
      console.log('TEST 3 - normal html len:', normalHtml.length)
      // Check for file IDs or download links or lh3
      const lh3InNormal =
        normalHtml.match(/https:\/\/lh3\.googleusercontent\.com\/drive-storage\/[a-zA-Z0-9_-]+/g) ||
        []
      console.log('TEST 3 - lh3 in normal folder count:', lh3InNormal.length)
      // Check for Audi_VL in normalHtml
      const audiPos = normalHtml.indexOf('Audi_VL.jpg')
      console.log('TEST 3 - Audi_VL pos in normal:', audiPos)
      if (audiPos !== -1) {
        console.log(
          'TEST 3 - snippet around Audi_VL:',
          normalHtml.substring(Math.max(0, audiPos - 200), audiPos + 200),
        )
      }
    } catch (e: any) {
      console.log('TEST 3 error:', e.message)
    }
  })
})
