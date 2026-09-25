migrate(
  (app) => {
    // Backfill idempotente para Mariana Fagundes (qm6xcgc5mstulg3)
    // Garantir generatedPortraitProfileId = "Piloto_13"
    // Priorizar busca por ID canônico qm6xcgc5mstulg3, com fallback por nome
    let driverRecord = null
    try {
      driverRecord = app.findFirstRecordByData('drivers', 'id', 'qm6xcgc5mstulg3')
    } catch (_) {
      try {
        driverRecord = app.findFirstRecordByData('drivers', 'name', 'Mariana Fagundes')
      } catch (_) {
        // Nenhum registro encontrado, nada a migrar
        return
      }
    }

    if (!driverRecord) return

    let procData = {}
    try {
      const raw = driverRecord.get('procedural_data')
      if (typeof raw === 'string' && raw.trim()) {
        procData = JSON.parse(raw)
      } else if (raw && typeof raw === 'object') {
        procData = raw
      }
    } catch (_) {
      procData = {}
    }

    const existingProfileId =
      procData.generatedPortraitProfileId || procData.visualIdentity?.generatedPortraitProfileId

    // Idempotente: se já estiver exatamente "Piloto_13", não precisa atualizar
    if (existingProfileId === 'Piloto_13') {
      return
    }

    procData.generatedPortraitProfileId = 'Piloto_13'
    if (procData.visualIdentity) {
      procData.visualIdentity.generatedPortraitProfileId = 'Piloto_13'
      procData.visualIdentity.portraitAssetId = 'GEN_13'
    }

    driverRecord.set('procedural_data', procData)
    app.save(driverRecord)
  },
  (app) => {
    // Reversão não-destrutiva (down)
  },
)
