/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const raceResults = app.findCollectionByNameOrId('race_results')

    if (!raceResults.fields.getByName('grid_position')) {
      raceResults.fields.add(
        new NumberField({
          name: 'grid_position',
          min: 1,
          max: 30,
          onlyInt: true,
        }),
      )
    }

    app.save(raceResults)
  },
  (app) => {
    const raceResults = app.findCollectionByNameOrId('race_results')
    if (raceResults.fields.getByName('grid_position')) {
      raceResults.fields.removeByName('grid_position')
    }
    app.save(raceResults)
  },
)
