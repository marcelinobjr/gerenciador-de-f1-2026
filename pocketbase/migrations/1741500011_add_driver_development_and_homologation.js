migrate(
  (app) => {
    // 1. Adicionar campos aditivos na coleção 'teams' para dados agregados de academia e desenvolvimento
    try {
      const teamsCol = app.findCollectionByNameOrId('teams')
      if (!teamsCol.fields.getByName('academy_development_data')) {
        teamsCol.fields.add(
          new JSONField({
            name: 'academy_development_data',
            required: false,
          }),
        )
        app.save(teamsCol)
      }
    } catch (err) {
      console.log('Erro ao atualizar teams com academy_development_data:', err)
    }

    // 2. Adicionar campos aditivos na coleção 'drivers'
    try {
      const driversCol = app.findCollectionByNameOrId('drivers')
      let driversModified = false

      if (!driversCol.fields.getByName('license_status')) {
        driversCol.fields.add(
          new SelectField({
            name: 'license_status',
            values: ['nivel_c', 'nivel_b', 'nivel_a'],
            maxSelect: 1,
            required: false,
          }),
        )
        driversModified = true
      }

      if (!driversCol.fields.getByName('is_academy')) {
        driversCol.fields.add(
          new BoolField({
            name: 'is_academy',
            required: false,
          }),
        )
        driversModified = true
      }

      if (!driversCol.fields.getByName('is_test_driver')) {
        driversCol.fields.add(
          new BoolField({
            name: 'is_test_driver',
            required: false,
          }),
        )
        driversModified = true
      }

      if (!driversCol.fields.getByName('technical_feedback')) {
        driversCol.fields.add(
          new NumberField({
            name: 'technical_feedback',
            min: 0,
            max: 100,
            required: false,
          }),
        )
        driversModified = true
      }

      if (!driversCol.fields.getByName('seat_security')) {
        driversCol.fields.add(
          new NumberField({
            name: 'seat_security',
            min: 0,
            max: 100,
            required: false,
          }),
        )
        driversModified = true
      }

      if (driversModified) {
        app.save(driversCol)
      }

      // Preencher valores padrão retrocompatíveis para não alterar o save da Audi
      // Pilotos titulares recebem license_status='nivel_a' (Super Licença) e seat_security=80
      // Demais recebem license_status='nivel_b' ou 'nivel_c' conforme categoria
      app
        .db()
        .newQuery(`
      UPDATE drivers
      SET license_status = 'nivel_a', seat_security = 80
      WHERE (role = 'titular' OR (team_id IS NOT NULL AND team_id != ''))
        AND (license_status IS NULL OR license_status = '')
    `)
        .execute()

      app
        .db()
        .newQuery(`
      UPDATE drivers
      SET license_status = 'nivel_b'
      WHERE role = 'reserva'
        AND (license_status IS NULL OR license_status = '')
    `)
        .execute()

      app
        .db()
        .newQuery(`
      UPDATE drivers
      SET license_status = 'nivel_c'
      WHERE license_status IS NULL OR license_status = ''
    `)
        .execute()

      app
        .db()
        .newQuery(`
      UPDATE drivers
      SET technical_feedback = 70
      WHERE technical_feedback IS NULL OR technical_feedback = 0
    `)
        .execute()
    } catch (err) {
      console.log('Erro ao atualizar drivers com campos de licença:', err)
    }

    // 3. Criar coleção driver_tests para registro auditado de testes privados
    try {
      app.findCollectionByNameOrId('driver_tests')
    } catch (_) {
      try {
        const teamsCol = app.findCollectionByNameOrId('teams')
        const driversCol = app.findCollectionByNameOrId('drivers')

        const driverTestsCol = new Collection({
          name: 'driver_tests',
          type: 'base',
          listRule: "@request.auth.id != ''",
          viewRule: "@request.auth.id != ''",
          createRule: "@request.auth.id != ''",
          updateRule: "@request.auth.id != ''",
          deleteRule: "@request.auth.id != ''",
          fields: [
            {
              name: 'team_id',
              type: 'relation',
              collectionId: teamsCol.id,
              maxSelect: 1,
              required: true,
            },
            {
              name: 'driver_id',
              type: 'relation',
              collectionId: driversCol.id,
              maxSelect: 1,
              required: true,
            },
            {
              name: 'test_type',
              type: 'select',
              values: [
                'desenvolvimento',
                'avaliacao',
                'homologacao',
                'preparacao',
                'rookie_test',
                'comparativo',
              ],
              maxSelect: 1,
              required: true,
            },
            { name: 'circuit', type: 'text', required: true },
            { name: 'date', type: 'text', required: true },
            { name: 'km', type: 'number', required: true },
            { name: 'cost', type: 'number', required: true },
            { name: 'is_valid_homologation', type: 'bool', required: false },
            { name: 'score_pace', type: 'number', required: false },
            { name: 'score_consistency', type: 'number', required: false },
            { name: 'score_car_control', type: 'number', required: false },
            { name: 'score_technical_feedback', type: 'number', required: false },
            { name: 'score_discipline_safety', type: 'number', required: false },
            { name: 'final_score', type: 'number', required: false },
            { name: 'best_lap_time', type: 'text', required: false },
            {
              name: 'second_driver_id',
              type: 'relation',
              collectionId: driversCol.id,
              maxSelect: 1,
              required: false,
            },
            { name: 'details', type: 'json', required: false },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: [
            'CREATE INDEX idx_driver_tests_team ON driver_tests (team_id)',
            'CREATE INDEX idx_driver_tests_driver ON driver_tests (driver_id)',
          ],
        })
        app.save(driverTestsCol)
      } catch (createErr) {
        console.log('Erro ao criar collection driver_tests:', createErr)
      }
    }
  },
  (app) => {
    try {
      const driverTestsCol = app.findCollectionByNameOrId('driver_tests')
      app.delete(driverTestsCol)
    } catch (_) {}
  },
)
