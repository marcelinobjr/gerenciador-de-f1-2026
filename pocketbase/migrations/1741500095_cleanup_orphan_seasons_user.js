migrate(
  (app) => {
    // Limpar temporadas ou registros órfãos residuais da equipe 475a684zt1btgev
    try {
      const seasons = app.findRecordsByFilter('seasons', "team_id = '475a684zt1btgev'", '', 100, 0)
      for (const s of seasons) {
        try {
          const results = app.findRecordsByFilter(
            'race_results',
            `season_id = '${s.id}'`,
            '',
            1000,
            0,
          )
          for (const r of results) {
            app.delete(r)
          }
        } catch (e) {}
        try {
          const setups = app.findRecordsByFilter(
            'session_setups',
            `season_id = '${s.id}'`,
            '',
            1000,
            0,
          )
          for (const st of setups) {
            app.delete(st)
          }
        } catch (e) {}
        try {
          const reports = app.findRecordsByFilter(
            'race_reports',
            `season_id = '${s.id}'`,
            '',
            1000,
            0,
          )
          for (const rp of reports) {
            app.delete(rp)
          }
        } catch (e) {}
        try {
          const rsess = app.findRecordsByFilter(
            'race_sessions',
            `season_id = '${s.id}'`,
            '',
            1000,
            0,
          )
          for (const rs of rsess) {
            app.delete(rs)
          }
        } catch (e) {}
        app.delete(s)
      }
    } catch (e) {}
  },
  (app) => {},
)
