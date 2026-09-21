routerAdd('POST', '/backend/v1/custom-parse-pdf', (e) => {
  let res = {}
  try {
    const files = e.findUploadedFiles('arquivo')
    if (!files || files.length === 0) {
      return e.json(400, { error: 'Nenhum arquivo enviado' })
    }
    const { markdown, truncated } = $documents.toMarkdown({ file: files[0] })
    res.markdown = markdown
    res.truncated = truncated
    res.length = markdown.length

    // Save into mbj_temp record for easy querying or inspection
    const col = $app.findCollectionByNameOrId('mbj_temp')
    const rec = new Record(col)
    rec.set('content', markdown)
    $app.save(rec)
    res.savedId = rec.id
  } catch (err) {
    res.error = err.message
    res.status = err.status
  }
  return e.json(200, res)
})
