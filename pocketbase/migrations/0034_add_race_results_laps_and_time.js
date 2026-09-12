migrate(
  (app) => {
    const raceResults = app.findCollectionByNameOrId('race_results')

    if (!raceResults.fields.getByName('laps_completed')) {
      raceResults.fields.add(
        new NumberField({
          name: 'laps_completed',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('accumulated_time_sec')) {
      raceResults.fields.add(
        new NumberField({
          name: 'accumulated_time_sec',
          required: false,
        }),
      )
    }

    app.save(raceResults)
  },
  (app) => {
    const raceResults = app.findCollectionByNameOrId('race_results')
    const fieldLaps = raceResults.fields.getByName('laps_completed')
    if (fieldLaps) {
      raceResults.fields.removeById(fieldLaps.id)
    }
    const fieldTime = raceResults.fields.getByName('accumulated_time_sec')
    if (fieldTime) {
      raceResults.fields.removeById(fieldTime.id)
    }
    app.save(raceResults)
  },
)
