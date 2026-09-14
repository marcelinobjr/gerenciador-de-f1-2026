routerAdd('GET', '/backend/v1/custom-download-mbj-data', (e) => {
  try {
    const res = $http.send({
      url: 'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/27918979-068c-4c35-80ed-e16c255f350b/bancopilotosmbj2026-39678.pdf',
      method: 'GET',
      timeout: 60,
    })

    const rawStr = res.raw ? res.raw.toString() : ''
    const titleRegex = /\/Title \(([^)]+)\)/g
    const titles = []
    let m
    while ((m = titleRegex.exec(rawStr)) !== null) {
      titles.push(m[1])
    }

    const pilMatches = []
    const pilRegex = /pil_\w+/g
    while ((m = pilRegex.exec(rawStr)) !== null) {
      if (pilMatches.length < 30) {
        pilMatches.push(m[0])
      }
    }

    // Check $documents
    let docMarkdown = ''
    let docErr = null
    try {
      const docRes = $documents.toMarkdown({
        file: {
          name: 'banco.pdf',
          bytes: res.raw,
        },
      })
      docMarkdown = docRes.markdown || ''
    } catch (e2) {
      docErr = String(e2)
    }

    return e.json(200, {
      status: res.statusCode,
      len: res.raw ? res.raw.length : 0,
      titlesCount: titles.length,
      sampleTitles: titles.slice(0, 10),
      pilMatchesCount: pilMatches.length,
      samplePil: pilMatches.slice(0, 10),
      docErr,
      docMarkdownLen: docMarkdown.length,
      docMarkdownSample: docMarkdown.slice(0, 500),
    })
  } catch (err) {
    return e.json(500, { error: String(err) })
  }
})
