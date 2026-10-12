migrate(
  (app) => {
    // SEASON-END-01A: Normalizar a temporada z36hmcbqa75kt7k (2026)
    // current_round avançou indevidamente para 25 (fantasma); restaurar para 24.
    try {
      const season = app.findFirstRecordByData('seasons', 'id', 'z36hmcbqa75kt7k')
      if (season) {
        if (season.getInt('current_round') > 24) {
          season.set('current_round', 24)
          app.save(season)
        }
      }
    } catch (err) {
      console.warn('Temporada z36hmcbqa75kt7k não encontrada ou erro tolerado:', err)
    }
  },
  (app) => {
    // No revert needed
  },
)
