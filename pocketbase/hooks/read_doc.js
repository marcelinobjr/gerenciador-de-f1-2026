routerAdd('POST', '/backend/v1/read-doc', (e) => {
  const files = e.findUploadedFiles('arquivo')
  if (!files || files.length === 0) {
    return e.json(400, { error: 'no file' })
  }
  try {
    const { markdown, truncated } = $documents.toMarkdown({ file: files[0] })
    return e.json(200, { markdown: markdown, truncated: truncated })
  } catch (err) {
    return e.json(500, { error: String(err), status: err.status || 500 })
  }
})
