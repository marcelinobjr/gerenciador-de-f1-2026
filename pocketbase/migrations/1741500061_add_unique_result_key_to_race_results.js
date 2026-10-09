/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Garantir que não existam duplicatas de result_key caso já houvesse registros
    app
      .db()
      .newQuery(`
      DELETE FROM race_results WHERE id NOT IN (
        SELECT MIN(id) FROM race_results GROUP BY result_key
      ) AND result_key IS NOT NULL AND result_key != ''
    `)
      .execute()

    // 2. Adicionar índice único em result_key na coleção race_results
    const raceResults = app.findCollectionByNameOrId('race_results')
    raceResults.addIndex(
      'idx_race_results_unique_result_key',
      true,
      'result_key',
      "result_key != ''",
    )
    app.save(raceResults)
  },
  (app) => {
    try {
      const raceResults = app.findCollectionByNameOrId('race_results')
      raceResults.removeIndex('idx_race_results_unique_result_key')
      app.save(raceResults)
    } catch (_) {}
  },
)
