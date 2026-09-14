onRecordCreateRequest((e) => {
  console.log('[DEBUG_TEAMS_HOOK] onRecordCreateRequest fired for teams')
  try {
    const auth = e.auth
    console.log('[DEBUG_TEAMS_HOOK] auth id: ' + (auth ? auth.id : 'NO_AUTH'))
    const info = e.requestInfo()
    console.log(
      '[DEBUG_TEAMS_HOOK] body keys: ' +
        (info && info.body ? JSON.stringify(Object.keys(info.body)) : 'NO_BODY'),
    )
  } catch (err) {
    console.log('[DEBUG_TEAMS_HOOK] err inspecting request: ' + err)
  }

  try {
    e.next()
    console.log('[DEBUG_TEAMS_HOOK] onRecordCreateRequest SUCCESS')
  } catch (err) {
    console.log('[DEBUG_TEAMS_HOOK] onRecordCreateRequest FAILED: ' + err)
    if (err && err.data) {
      console.log('[DEBUG_TEAMS_HOOK] request err.data: ' + JSON.stringify(err.data))
    }
    if (err && err.message) {
      console.log('[DEBUG_TEAMS_HOOK] request err.message: ' + err.message)
    }
    throw err
  }
}, 'teams')

onRecordCreate((e) => {
  console.log('[DEBUG_TEAMS_HOOK] onRecordCreate fired for: ' + e.collection.name)
  try {
    e.next()
    console.log('[DEBUG_TEAMS_HOOK] onRecordCreate SUCCESS, id: ' + e.record.id)
  } catch (err) {
    console.log('[DEBUG_TEAMS_HOOK] onRecordCreate FAILED: ' + err)
    if (err && err.data) {
      console.log('[DEBUG_TEAMS_HOOK] create err.data: ' + JSON.stringify(err.data))
    }
    throw err
  }
}, 'teams')

onRecordValidate((e) => {
  console.log('[DEBUG_TEAMS_HOOK] onRecordValidate fired for: ' + e.collection.name)
  try {
    e.next()
    console.log('[DEBUG_TEAMS_HOOK] onRecordValidate SUCCESS')
  } catch (err) {
    console.log('[DEBUG_TEAMS_HOOK] onRecordValidate FAILED: ' + err)
    if (err && err.data) {
      console.log('[DEBUG_TEAMS_HOOK] validate err.data: ' + JSON.stringify(err.data))
    }
    throw err
  }
}, 'teams')
