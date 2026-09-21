/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const raceResults = app.findCollectionByNameOrId('race_results')

    if (!raceResults.fields.getByName('career_id')) {
      raceResults.fields.add(
        new TextField({
          name: 'career_id',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('event_id')) {
      raceResults.fields.add(
        new TextField({
          name: 'event_id',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('circuit_id')) {
      raceResults.fields.add(
        new TextField({
          name: 'circuit_id',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('official_race_result_id')) {
      raceResults.fields.add(
        new TextField({
          name: 'official_race_result_id',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('checksum')) {
      raceResults.fields.add(
        new TextField({
          name: 'checksum',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('winner_driver_id')) {
      raceResults.fields.add(
        new TextField({
          name: 'winner_driver_id',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('pole_driver_id')) {
      raceResults.fields.add(
        new TextField({
          name: 'pole_driver_id',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('fastest_lap_driver_id')) {
      raceResults.fields.add(
        new TextField({
          name: 'fastest_lap_driver_id',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('officialized_at')) {
      raceResults.fields.add(
        new TextField({
          name: 'officialized_at',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('car_id')) {
      raceResults.fields.add(
        new TextField({
          name: 'car_id',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('status')) {
      raceResults.fields.add(
        new TextField({
          name: 'status',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('dnf_reason')) {
      raceResults.fields.add(
        new TextField({
          name: 'dnf_reason',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('retirement_lap')) {
      raceResults.fields.add(
        new NumberField({
          name: 'retirement_lap',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('gap_to_winner')) {
      raceResults.fields.add(
        new TextField({
          name: 'gap_to_winner',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('best_lap')) {
      raceResults.fields.add(
        new TextField({
          name: 'best_lap',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('best_lap_number')) {
      raceResults.fields.add(
        new NumberField({
          name: 'best_lap_number',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('pit_stops')) {
      raceResults.fields.add(
        new NumberField({
          name: 'pit_stops',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('positions_gained')) {
      raceResults.fields.add(
        new NumberField({
          name: 'positions_gained',
          required: false,
        }),
      )
    }

    if (!raceResults.fields.getByName('result_snapshot')) {
      raceResults.fields.add(
        new JSONField({
          name: 'result_snapshot',
          required: false,
        }),
      )
    }

    app.save(raceResults)
  },
  (app) => {
    // Reversão segura
  },
)
