migrate(
  (app) => {
    // Backfill idempotente e merge no driver Mariana Fagundes (qm6xcgc5mstulg3)
    // Garantir procedural_data.generatedPortraitProfileId = "Piloto_13"
    // e procedural_data.visualIdentity.portraitAssetId = "GEN_13"
    // sem tocar nas demais propriedades de procedural_data.
    var driverRecord = null
    try {
      driverRecord = app.findFirstRecordByData('drivers', 'id', 'qm6xcgc5mstulg3')
    } catch (e1) {
      try {
        driverRecord = app.findFirstRecordByData('drivers', 'name', 'Mariana Fagundes')
      } catch (e2) {
        return
      }
    }

    if (!driverRecord) return

    var procData = {}
    try {
      var raw = driverRecord.get('procedural_data')
      if (typeof raw === 'string' && raw.trim()) {
        procData = JSON.parse(raw)
      } else if (raw && typeof raw === 'object') {
        procData = JSON.parse(JSON.stringify(raw))
      }
    } catch (e3) {
      procData = {}
    }

    procData.generatedPortraitProfileId = 'Piloto_13'
    if (!procData.visualIdentity || typeof procData.visualIdentity !== 'object') {
      procData.visualIdentity = {
        visualIdentityId: 'fictional_pilot_13',
        portraitAssetId: 'GEN_13',
        generatedPortraitProfileId: 'Piloto_13',
        gender: 'female',
        stylePromptSeed: 13,
      }
    } else {
      procData.visualIdentity.portraitAssetId = 'GEN_13'
      if (!procData.visualIdentity.generatedPortraitProfileId) {
        procData.visualIdentity.generatedPortraitProfileId = 'Piloto_13'
      }
    }

    driverRecord.set('procedural_data', procData)
    app.save(driverRecord)

    // Também executar raw SQL direto via SQLite para garantir persistência mesmo se app.save tiver quirks com campo json vazio
    try {
      var serialized = JSON.stringify(procData)
      app
        .db()
        .newQuery('UPDATE drivers SET procedural_data = {:json} WHERE id = {:id}')
        .bind({ json: serialized, id: driverRecord.id })
        .execute()
    } catch (e4) {
      // Ignorar se newQuery falhar
    }
  },
  (app) => {
    // Reversão não-destrutiva (down)
  },
)
