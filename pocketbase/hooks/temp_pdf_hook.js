/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/backend/v1/upload-pdf-doc', (e) => {
  const files = e.findUploadedFiles('file')
  if (!files || files.length === 0) {
    return e.json(400, { error: 'no file' })
  }
  const file = files[0]
  try {
    const res = $documents.toMarkdown({ file: file })
    const collection = $app.findCollectionByNameOrId('mbj_temp')
    const rec = new Record(collection)
    rec.set('tag', 'pdf_markdown_result')
    rec.set('content', res.markdown || '')
    $app.save(rec)
    return e.json(200, { ok: true, length: (res.markdown || '').length, recId: rec.id })
  } catch (err) {
    return e.json(500, { error: String(err) })
  }
})
