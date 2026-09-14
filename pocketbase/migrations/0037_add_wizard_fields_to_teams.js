/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')

    if (!teams.fields.getByName('manager_profile')) {
      teams.fields.add(
        new JSONField({
          name: 'manager_profile',
          required: false,
          maxSize: 1048576, // 1MB para suportar profile com baseAttributes, bônus, links etc.
        }),
      )
    }

    if (!teams.fields.getByName('career_settings')) {
      teams.fields.add(
        new JSONField({
          name: 'career_settings',
          required: false,
          maxSize: 524288,
        }),
      )
    }

    if (!teams.fields.getByName('custom_grid_teams')) {
      teams.fields.add(
        new JSONField({
          name: 'custom_grid_teams',
          required: false,
          maxSize: 1048576, // 1MB para array com 12+ equipes completas
        }),
      )
    }

    if (!teams.fields.getByName('universe_type')) {
      teams.fields.add(
        new TextField({
          name: 'universe_type',
          required: false,
          max: 100,
        }),
      )
    }

    if (!teams.fields.getByName('hero_title')) {
      teams.fields.add(
        new TextField({
          name: 'hero_title',
          required: false,
          max: 100,
        }),
      )
    }

    if (!teams.fields.getByName('hero_tagline')) {
      teams.fields.add(
        new TextField({
          name: 'hero_tagline',
          required: false,
          max: 200,
        }),
      )
    }

    if (!teams.fields.getByName('hero_car_model')) {
      teams.fields.add(
        new TextField({
          name: 'hero_car_model',
          required: false,
          max: 100,
        }),
      )
    }

    app.save(teams)
  },
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')
    const fields = [
      'manager_profile',
      'career_settings',
      'custom_grid_teams',
      'universe_type',
      'hero_title',
      'hero_tagline',
      'hero_car_model',
    ]
    for (const f of fields) {
      if (teams.fields.getByName(f)) {
        teams.fields.removeByName(f)
      }
    }
    app.save(teams)
  },
)
