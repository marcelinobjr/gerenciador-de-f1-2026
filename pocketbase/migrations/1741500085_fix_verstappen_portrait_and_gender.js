migrate((app) => {
  try {
    const verstappen = app.findFirstRecordByData('drivers', 'name', 'Max Verstappen')
    if (verstappen) {
      let procData = {}
      try {
        const raw = verstappen.get('procedural_data')
        procData = typeof raw === 'string' ? JSON.parse(raw) : (raw || {})
      } catch {
        procData = {}
      }
      procData.visualIdentity = {
        gender: 'male',
        portraitAssetId: 'DRV_0022',
        generatedPortraitProfileId: null
      }
      procData.generatedPortraitProfileId = null

      verstappen.set('procedural_data', procData)
      verstappen.set('origin_type', 'real')
      verstappen.set('license_status', 'nivel_a')
      verstappen.set('homologation_status', 'elegivel')
      verstappen.set('superlicense_points', 40)
      app.save(verstappen)
    }
  } catch (err) {
    console.log('Error updating Verstappen record in migration:', err)
  }
}, (app) => {
  // rollback not required for data fix
})
