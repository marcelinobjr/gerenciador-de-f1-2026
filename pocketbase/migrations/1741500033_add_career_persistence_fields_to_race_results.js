/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const raceResults = app.findCollectionByNameOrId('race_results')

    if (!raceResults.fields.getByName('application_status')) {
      raceResults.fields.add(
        new TextField({
          name: 'application_status',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('result_key')) {
      raceResults.fields.add(
        new TextField({
          name: 'result_key',
          required: false,
        }),
      )
    }

    app.save(raceResults)
  },
  (app) => {
    // Reversão defensiva
  },
)
