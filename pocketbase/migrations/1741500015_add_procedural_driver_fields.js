migrate(
  (app) => {
    const drivers = app.findCollectionByNameOrId('drivers')

    // origin_type: 'real' ou 'procedural'
    if (!drivers.fields.getByName('origin_type')) {
      drivers.fields.add(
        new SelectField({
          name: 'origin_type',
          values: ['real', 'procedural'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // true_potential: número oculto (60-99), estritamente interno
    if (!drivers.fields.getByName('true_potential')) {
      drivers.fields.add(
        new NumberField({
          name: 'true_potential',
          min: 50,
          max: 99,
          required: false,
        }),
      )
    }

    // perceived_potential: potencial estimado
    if (!drivers.fields.getByName('perceived_potential')) {
      drivers.fields.add(
        new NumberField({
          name: 'perceived_potential',
          min: 50,
          max: 99,
          required: false,
        }),
      )
    }

    // evaluation_confidence: confiança na avaliação (0 a 100)
    if (!drivers.fields.getByName('evaluation_confidence')) {
      drivers.fields.add(
        new NumberField({
          name: 'evaluation_confidence',
          min: 0,
          max: 100,
          required: false,
        }),
      )
    }

    // academy_origin_team_id: equipe que descobriu ou formou originalmente
    if (!drivers.fields.getByName('academy_origin_team_id')) {
      drivers.fields.add(
        new TextField({
          name: 'academy_origin_team_id',
          required: false,
        }),
      )
    }

    // career_status: prospect, academy, test_driver, reserve, f1_driver, free_agent, retired
    if (!drivers.fields.getByName('career_status')) {
      drivers.fields.add(
        new SelectField({
          name: 'career_status',
          values: [
            'prospect',
            'academy',
            'test_driver',
            'reserve',
            'f1_driver',
            'free_agent',
            'retired',
          ],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // procedural_data: metadados de personalidade, estilo de pilotagem, visualIdentity, histórico e carreira
    if (!drivers.fields.getByName('procedural_data')) {
      drivers.fields.add(
        new JSONField({
          name: 'procedural_data',
          required: false,
        }),
      )
    }

    app.save(drivers)
  },
  (app) => {
    const drivers = app.findCollectionByNameOrId('drivers')
    const fieldsToRemove = [
      'origin_type',
      'true_potential',
      'perceived_potential',
      'evaluation_confidence',
      'academy_origin_team_id',
      'career_status',
      'procedural_data',
    ]
    for (const name of fieldsToRemove) {
      const f = drivers.fields.getByName(name)
      if (f) drivers.fields.remove(f)
    }
    app.save(drivers)
  },
)
