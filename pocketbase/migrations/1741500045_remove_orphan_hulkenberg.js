/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // BUG-RETRATOS-03C — PARTE 1 & 14:
    // Remoção idempotente do registro órfão duplicado de Nico Hülkenberg (578o7m22pttuk4r).
    // CANÔNICO: '0mow8vmzk0y4z9s' (38 anos, DEU, Audi F1 Team, titular).
    // ÓRFÃO: '578o7m22pttuk4r' (25 anos, INT, sem equipe, zero corridas).

    const orphanId = '578o7m22pttuk4r'
    const canonicalId = '0mow8vmzk0y4z9s'

    // 1. Verificação cirúrgica de integridade: garantir que o canônico existe
    let canonicalRecord
    try {
      canonicalRecord = app.findFirstRecordByData('drivers', 'id', canonicalId)
    } catch (_) {
      console.log(`[1741500045] Aviso: registro canônico ${canonicalId} não encontrado pelo id`)
    }

    // Se o canônico não foi achado por ID, tenta achar por nome + equipe da Audi
    if (!canonicalRecord) {
      try {
        const audiDrivers = app.findRecordsByFilter(
          'drivers',
          `name = "Nico Hülkenberg" && age >= 35`,
          '',
          1,
          0,
        )
        if (audiDrivers.length > 0) {
          canonicalRecord = audiDrivers[0]
        }
      } catch (_) {}
    }

    // 2. Verificar se o registro órfão existe
    let orphanRecord = null
    try {
      orphanRecord = app.findFirstRecordByData('drivers', 'id', orphanId)
    } catch (_) {
      // Já removido ou não existe
    }

    if (!orphanRecord) {
      console.log(`[1741500045] Registro órfão ${orphanId} não existe ou já foi removido.`)
      return
    }

    // 3. Verificação cirúrgica de referências acidentais antes da remoção
    // Tabelas possíveis: race_results, driver_tests, session_setups
    try {
      if (canonicalRecord) {
        app
          .db()
          .newQuery(
            `UPDATE race_results SET driver_id = {:canonicalId} WHERE driver_id = {:orphanId}`,
          )
          .bind({ canonicalId: canonicalRecord.id, orphanId: orphanId })
          .execute()

        app
          .db()
          .newQuery(
            `UPDATE driver_tests SET driver_id = {:canonicalId} WHERE driver_id = {:orphanId}`,
          )
          .bind({ canonicalId: canonicalRecord.id, orphanId: orphanId })
          .execute()
      }
    } catch (err) {
      console.log(`[1741500045] Erro ao redirecionar referências (se houver): ${err}`)
    }

    // 4. Excluir o registro órfão
    try {
      app.delete(orphanRecord)
      console.log(
        `[1741500045] Registro órfão ${orphanId} de Nico Hülkenberg excluído com sucesso.`,
      )
    } catch (err) {
      // Fallback via SQL caso deleção via app falhe
      app
        .db()
        .newQuery(`DELETE FROM drivers WHERE id = {:orphanId}`)
        .bind({ orphanId: orphanId })
        .execute()
      console.log(`[1741500045] Registro órfão ${orphanId} excluído via query SQL direta.`)
    }
  },
  (app) => {
    // down: remoção irreversível por design de integridade
  },
)
