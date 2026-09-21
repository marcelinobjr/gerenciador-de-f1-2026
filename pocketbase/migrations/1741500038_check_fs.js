migrate((app) => {
  // Let's test if $filesystem or $os exists
  const info = {
    hasFilesystem: typeof $filesystem !== 'undefined',
    hasOs: typeof $os !== 'undefined',
    hasApp: typeof app !== 'undefined',
  }
  const col = app.findCollectionByNameOrId('mbj_temp')
  const rec = new Record(col)
  rec.set('content', 'FS_CHECK: ' + JSON.stringify(info))
  app.save(rec)
})
