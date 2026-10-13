migrate(
  (app) => {
    // (1) Restaurar Nico Hülkenberg (id 0mow8vmzk0y4z9s) na Audi (475a684zt1btgev)
    try {
      const hulkenberg = app.findFirstRecordByData('drivers', 'id', '0mow8vmzk0y4z9s')
      if (hulkenberg) {
        hulkenberg.set('team_id', '475a684zt1btgev')
        hulkenberg.set('role', 'titular')
        hulkenberg.set('category', 'f1')
        hulkenberg.set('career_status', 'f1_driver')
        hulkenberg.set('reserve_team_id', '')
        hulkenberg.set('next_team_id', '')
        hulkenberg.set('future_contract', null)
        app.save(hulkenberg)
      }
    } catch (err) {
      console.log('Erro ao restaurar Nico Hülkenberg:', err)
    }

    // (2) Remover da classificação/banco o registro fantasma 'Toyota Gazoo Racing F1' (jsxe8t2ks3kt322)
    try {
      const toyota = app.findFirstRecordByData('teams', 'id', 'jsxe8t2ks3kt322')
      if (toyota) {
        app.delete(toyota)
      }
    } catch (err) {
      // Se não encontrar por id, tentar por name ou team_key
      try {
        const toyotaByName = app.findFirstRecordByData('teams', 'name', 'Toyota Gazoo Racing F1')
        if (toyotaByName) {
          app.delete(toyotaByName)
        }
      } catch (e) {
        console.log('Toyota Gazoo Racing F1 já não existe ou foi removida.')
      }
    }
  },
  (app) => {
    // down migration
  },
)
