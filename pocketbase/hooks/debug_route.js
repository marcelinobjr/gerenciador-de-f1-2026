routerAdd('POST', '/backend/v1/debug-hook-test', (e) => {
  console.log('[DEBUG_HOOK_TEST] route reached! auth: ' + (e.auth ? e.auth.id : 'none'))
  const body = e.requestInfo().body || {}

  // Try saving a record via $app.save
  try {
    const col = $app.findCollectionByNameOrId('teams')
    const rec = new Record(col)
    for (const k of Object.keys(body)) {
      rec.set(k, body[k])
    }
    rec.set('user_id', e.auth ? e.auth.id : 'jxe5h74yat69x3x')
    console.log('[DEBUG_HOOK_TEST] calling $app.save...')
    $app.save(rec)
    console.log('[DEBUG_HOOK_TEST] $app.save SUCCESS! id: ' + rec.id)
    $app.delete(rec)
    console.log('[DEBUG_HOOK_TEST] $app.delete SUCCESS')
    return e.json(200, { ok: true, savedId: rec.id })
  } catch (err) {
    console.log('[DEBUG_HOOK_TEST] $app.save FAILED: ' + err + ' data: ' + JSON.stringify(err.data))
    return e.json(400, { ok: false, error: String(err), data: err.data })
  }
})
