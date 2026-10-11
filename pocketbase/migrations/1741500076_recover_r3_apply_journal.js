migrate(
  (app) => {
    // BUG-APPLY-JOURNAL-STALL-01A:
    // Recuperar journal smiy6m9c00omz9n (R3 Japão) travado em FAILED/APPLYING
    // e race_results da R3 qli7zpa82npp8z6 com application_status = PENDING -> COMPLETE

    // 1. Atualizar journal canonical_career_apply_journals
    try {
      const journalRecord = app.findRecordById('canonical_career_apply_journals', 'smiy6m9c00omz9n')
      if (journalRecord) {
        // Obter snapshot do race_results para ler todos os driver_ids participantes
        let allDriverIds = []
        try {
          const rr = app.findRecordById('race_results', 'qli7zpa82npp8z6')
          if (rr) {
            const snapshotRaw = rr.getString('result_snapshot')
            if (snapshotRaw) {
              const parsed = JSON.parse(snapshotRaw)
              if (Array.isArray(parsed.entries)) {
                allDriverIds = parsed.entries.map((e) => e.driverId).filter(Boolean)
              }
            }
          }
        } catch (eSnap) {
          console.log('Could not parse result_snapshot:', eSnap)
        }

        if (allDriverIds.length === 0) {
          // Fallback para lista dos 24 pilotos de 2026
          allDriverIds = [
            'synyhb7yruf04vr',
            'ferrari_d1',
            'jwj3wcbmpjlszi9',
            'mercedes_d2',
            'lc6cma46f01dgrj',
            'ferrari_d2',
            '08ky0121nm2tcab',
            'mclaren_d1',
            '6nmvvldn9o2mkcv',
            'redbull_d2',
            'xagmevl0yqn6cif',
            'alpine_d2',
            '35lxhr9dv2q7k09',
            'redbull_d1',
            'g6r2jv5rwf3ubsz',
            'mercedes_d1',
            '0qpvuwihmw3zx8c',
            'mclaren_d2',
            'racingbulls_d1',
            'racingbulls_d2',
            'alpine_d1',
            '9uazqw522oc9p4m',
            'williams_d1',
            'andretti_d2',
          ]
        }

        journalRecord.set('status', 'COMPLETE')
        journalRecord.set('applied_driver_ids', JSON.stringify(allDriverIds))
        journalRecord.set('total_entries', 24)
        journalRecord.set('last_error', '')
        journalRecord.set('completed_at', new Date().toISOString())
        app.save(journalRecord)
      }
    } catch (errJournal) {
      console.log('Error updating journal smiy6m9c00omz9n:', errJournal)
    }

    // 2. Atualizar race_results da R3 (qli7zpa82npp8z6) para application_status = 'COMPLETE'
    try {
      const rrRecord = app.findRecordById('race_results', 'qli7zpa82npp8z6')
      if (rrRecord) {
        rrRecord.set('application_status', 'COMPLETE')
        app.save(rrRecord)
      }
    } catch (errRr) {
      console.log('Error updating race_results qli7zpa82npp8z6:', errRr)
    }
  },
  (app) => {
    // Revert opcional
  },
)
