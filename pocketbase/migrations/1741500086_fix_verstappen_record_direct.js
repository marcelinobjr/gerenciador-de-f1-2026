migrate(
  (app) => {
    try {
      const record = app.findFirstRecordByData('drivers', 'id', 'de3isw3re1ji2wj')
      if (record) {
        let procData = {}
        try {
          const raw = record.get('procedural_data')
          procData = typeof raw === 'string' ? JSON.parse(raw) : raw || {}
        } catch (e) {
          procData = {}
        }
        procData.visualIdentity = {
          gender: 'male',
          portraitAssetId: 'DRV_0022',
          generatedPortraitProfileId: null,
        }
        procData.generatedPortraitProfileId = null
        record.set('procedural_data', JSON.stringify(procData))
        record.set('origin_type', 'real')
        record.set('license_status', 'nivel_a')
        record.set('homologation_status', 'elegivel')
        record.set('superlicense_points', 40)
        app.save(record)
      }

      // Também executar via SQL direto no SQLite para garantir 100% de persistência
      app
        .db()
        .newQuery(`
      UPDATE drivers 
      SET origin_type = 'real',
          license_status = 'nivel_a',
          homologation_status = 'elegivel',
          superlicense_points = 40,
          procedural_data = '{"academyOriginTeamId":null,"careerStatus":"professional","driverId":"de3isw3re1ji2wj","generatedPortraitProfileId":null,"visualIdentity":{"gender":"male","portraitAssetId":"DRV_0022","generatedPortraitProfileId":null}}'
      WHERE id = 'de3isw3re1ji2wj' OR name = 'Max Verstappen'
    `)
        .execute()
    } catch (err) {
      console.log('Error in 1741500086_fix_verstappen_record_direct:', err)
    }
  },
  (app) => {},
)
