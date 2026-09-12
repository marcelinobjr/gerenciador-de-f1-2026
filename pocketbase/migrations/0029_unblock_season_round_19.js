migrate(
  (app) => {
    try {
      const season = app.findFirstRecordByData('seasons', 'id', '7y4eszmcjyb2dad')
      season.set('current_round', 19)
      season.set('last_processed_round', 18)
      app.save(season)
    } catch (err) {
      console.log('Migration 0029 error or season not found:', err)
    }
  },
  (app) => {
    try {
      const season = app.findFirstRecordByData('seasons', 'id', '7y4eszmcjyb2dad')
      season.set('current_round', 18)
      season.set('last_processed_round', 17)
      app.save(season)
    } catch (err) {
      console.log('Migration 0029 rollback error:', err)
    }
  },
)
