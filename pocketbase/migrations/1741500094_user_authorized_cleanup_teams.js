migrate(
  (app) => {
    const requestedUserId = 'jxe5h74yat69x3x'
    const teams = app.findRecordsByFilter('teams', `user_id = '${requestedUserId}'`, '', 100, 0)
    for (const team of teams) {
      const teamId = team.id

      // 1. driver_tests
      try {
        const dtests = app.findRecordsByFilter('driver_tests', `team_id = '${teamId}'`, '', 500, 0)
        for (const dt of dtests) {
          app.delete(dt)
        }
      } catch (e) {}

      // 2. race_results
      try {
        const rresults = app.findRecordsByFilter(
          'race_results',
          `team_id = '${teamId}'`,
          '',
          1000,
          0,
        )
        for (const rr of rresults) {
          app.delete(rr)
        }
      } catch (e) {}

      // 3. race_sessions
      try {
        const rsess = app.findRecordsByFilter('race_sessions', `team_id = '${teamId}'`, '', 100, 0)
        for (const rs of rsess) {
          app.delete(rs)
        }
      } catch (e) {}

      // 4. race_reports
      try {
        const rreps = app.findRecordsByFilter('race_reports', `team_id = '${teamId}'`, '', 200, 0)
        for (const r of rreps) {
          app.delete(r)
        }
      } catch (e) {}

      // 5. financial_ledger
      try {
        const ledgers = app.findRecordsByFilter(
          'financial_ledger',
          `team_id = '${teamId}'`,
          '',
          500,
          0,
        )
        for (const fl of ledgers) {
          app.delete(fl)
        }
      } catch (e) {}

      // 6. season_histories
      try {
        const shist = app.findRecordsByFilter(
          'season_histories',
          `team_id = '${teamId}'`,
          '',
          100,
          0,
        )
        for (const sh of shist) {
          app.delete(sh)
        }
      } catch (e) {}

      // 7. season_transitions
      try {
        const strans = app.findRecordsByFilter(
          'season_transitions',
          `team_id = '${teamId}'`,
          '',
          100,
          0,
        )
        for (const st of strans) {
          app.delete(st)
        }
      } catch (e) {}

      // 8. session_setups
      try {
        const ssetups = app.findRecordsByFilter(
          'session_setups',
          `team_id = '${teamId}'`,
          '',
          500,
          0,
        )
        for (const ss of ssetups) {
          app.delete(ss)
        }
      } catch (e) {}

      // 9. events
      try {
        const evts = app.findRecordsByFilter('events', `team_id = '${teamId}'`, '', 500, 0)
        for (const ev of evts) {
          app.delete(ev)
        }
      } catch (e) {}

      // 10. sponsors
      try {
        const sps = app.findRecordsByFilter('sponsors', `team_id = '${teamId}'`, '', 100, 0)
        for (const sp of sps) {
          app.delete(sp)
        }
      } catch (e) {}

      // 11. parts
      try {
        const parts = app.findRecordsByFilter('parts', `team_id = '${teamId}'`, '', 100, 0)
        for (const p of parts) {
          app.delete(p)
        }
      } catch (e) {}

      // 12. drivers
      try {
        const drivers = app.findRecordsByFilter('drivers', `team_id = '${teamId}'`, '', 100, 0)
        for (const d of drivers) {
          app.delete(d)
        }
      } catch (e) {}

      // 13. seasons
      try {
        const seasons = app.findRecordsByFilter('seasons', `team_id = '${teamId}'`, '', 100, 0)
        for (const s of seasons) {
          app.delete(s)
        }
      } catch (e) {}

      // 14. Equipe
      try {
        app.delete(team)
      } catch (e) {}
    }
  },
  (app) => {},
)
