migrate(
  (app) => {
    // 1. Locate the player user by email: m.blasques@multi.br.com
    let userRecord
    try {
      userRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'm.blasques@multi.br.com')
    } catch (_) {
      // If user does not exist, nothing to reset — idempotent
      return
    }

    const userId = userRecord.id

    // 2. Find all teams owned by this user
    let userTeams = []
    try {
      userTeams = app.findRecordsByFilter('teams', `user_id = '${userId}'`, '', 100, 0)
    } catch (_) {
      userTeams = []
    }

    if (userTeams.length === 0) {
      return
    }

    // For each team owned by the user, delete child records in the correct dependency order:
    // 1) race_results
    // 2) events
    // 3) drivers (reset team_id or delete team-specific drivers)
    // 4) sponsors
    // 5) parts
    // 6) seasons
    // 7) teams
    for (const team of userTeams) {
      const teamId = team.id

      // 1. Delete race_results linked to this team
      try {
        const raceResults = app.findRecordsByFilter(
          'race_results',
          `team_id = '${teamId}'`,
          '',
          1000,
          0,
        )
        for (const rr of raceResults) {
          app.delete(rr)
        }
      } catch (_) {}

      // Also delete any race_results linked to seasons belonging to this team
      try {
        const seasons = app.findRecordsByFilter('seasons', `team_id = '${teamId}'`, '', 100, 0)
        for (const s of seasons) {
          try {
            const seasonResults = app.findRecordsByFilter(
              'race_results',
              `season_id = '${s.id}'`,
              '',
              1000,
              0,
            )
            for (const sr of seasonResults) {
              app.delete(sr)
            }
          } catch (_) {}
        }
      } catch (_) {}

      // 2. Delete events
      try {
        const events = app.findRecordsByFilter('events', `team_id = '${teamId}'`, '', 1000, 0)
        for (const ev of events) {
          app.delete(ev)
        }
      } catch (_) {}

      // 3. Drivers:
      // Note: In 0002 Bortoleto & Fittipaldi were created with team_id = teamRecord.id.
      // Other drivers might also have team_id = teamId if hired or official.
      // We can either set team_id = null so they return to the market/free pool,
      // or delete drivers that were custom/specific. To be safe and clean:
      // Set team_id to null for drivers attached to this team so they become available in the market.
      try {
        const drivers = app.findRecordsByFilter('drivers', `team_id = '${teamId}'`, '', 100, 0)
        for (const d of drivers) {
          d.set('team_id', null)
          app.save(d)
        }
      } catch (_) {}

      // 4. Delete sponsors
      try {
        const sponsors = app.findRecordsByFilter('sponsors', `team_id = '${teamId}'`, '', 100, 0)
        for (const sp of sponsors) {
          app.delete(sp)
        }
      } catch (_) {}

      // 5. Delete parts
      try {
        const parts = app.findRecordsByFilter('parts', `team_id = '${teamId}'`, '', 100, 0)
        for (const pt of parts) {
          app.delete(pt)
        }
      } catch (_) {}

      // 6. Delete seasons
      try {
        const seasons = app.findRecordsByFilter('seasons', `team_id = '${teamId}'`, '', 100, 0)
        for (const s of seasons) {
          app.delete(s)
        }
      } catch (_) {}

      // 7. Delete the team itself
      try {
        app.delete(team)
      } catch (_) {}
    }
  },
  (app) => {
    // down migration: reset is one-way, no rollback needed
  },
)
