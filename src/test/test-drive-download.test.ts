import { describe, it } from 'vitest'

describe('Test download methods', () => {
  it('tests download of an asset from Google Drive', async () => {
    // Vamos testar se conseguimos obter uma imagem
    // Da pasta Carro_Vista_Lateral: Audi_VL.jpg ou da pasta Pilotos: 05-Gabriel_Bortoleto.jpg
    const testLh3 =
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPJAkKAu1YBoTjrouFXjeCIkCPq5LCoHAfWJoJC9ArUpAEm94e5sBTYnuu4ej3pfDEtNwtIHVIAQJjwIm_mHg9FNVjURFhP32-kylNO=s0'
    const res = await fetch(testLh3, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    console.log('LH3 fetch status:', res.status, res.headers.get('content-type'))
    const buf = await res.arrayBuffer()
    console.log('LH3 fetch bytes:', buf.byteLength)

    // Agora vamos testar a pasta Carro_Vista_Lateral no embeddedfolderview
    const folderRes = await fetch(
      'https://drive.google.com/embeddedfolderview?id=1fyThTdC6asFV6zNijkXuZbtrgbHcr-BL#list',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      },
    )
    console.log('Folder fetch status:', folderRes.status)
    const html = await folderRes.text()
    console.log('Folder html length:', html.length)
    const matches =
      html.match(/https:\/\/lh3\.googleusercontent\.com\/drive-storage\/[a-zA-Z0-9_-]+/g) || []
    console.log('Folder lh3 matches count:', matches.length)
    if (matches.length > 0) {
      console.log('First lh3 match:', matches[0])
    }
  })
})
