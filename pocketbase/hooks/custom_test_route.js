routerAdd(
  'POST',
  '/api/custom-create-team-test',
  (e) => {
    const info = e.requestInfo()
    const data = info.body || {}
    const collection = $app.findCollectionByNameOrId('teams')
    const record = new Record(collection)

    for (const k of Object.keys(data)) {
      record.set(k, data[k])
    }

    try {
      $app.save(record)
      const id = record.id
      $app.delete(record)
      return e.json(200, { ok: true, id: id })
    } catch (err) {
      return e.json(400, { ok: false, error: err.toString(), message: err.message, data: err.data })
    }
  },
  $apis.requireAuth(),
)
