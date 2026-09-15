migrate(
  (app) => {
    const teamsCol = app.findCollectionByNameOrId('teams')

    if (!teamsCol.fields.getByName('technical_organization')) {
      teamsCol.fields.add(
        new JSONField({
          name: 'technical_organization',
          required: false,
        }),
      )
    }

    if (!teamsCol.fields.getByName('staff_contracts')) {
      teamsCol.fields.add(
        new JSONField({
          name: 'staff_contracts',
          required: false,
        }),
      )
    }

    if (!teamsCol.fields.getByName('organizational_knowledge')) {
      teamsCol.fields.add(
        new JSONField({
          name: 'organizational_knowledge',
          required: false,
        }),
      )
    }

    app.save(teamsCol)

    const seasonsCol = app.findCollectionByNameOrId('seasons')
    if (!seasonsCol.fields.getByName('staff_market_pool')) {
      seasonsCol.fields.add(
        new JSONField({
          name: 'staff_market_pool',
          required: false,
        }),
      )
    }
    if (!seasonsCol.fields.getByName('staff_market_news')) {
      seasonsCol.fields.add(
        new JSONField({
          name: 'staff_market_news',
          required: false,
        }),
      )
    }
    app.save(seasonsCol)
  },
  (app) => {
    try {
      const teamsCol = app.findCollectionByNameOrId('teams')
      teamsCol.fields.removeByName('technical_organization')
      teamsCol.fields.removeByName('staff_contracts')
      teamsCol.fields.removeByName('organizational_knowledge')
      app.save(teamsCol)

      const seasonsCol = app.findCollectionByNameOrId('seasons')
      seasonsCol.fields.removeByName('staff_market_pool')
      seasonsCol.fields.removeByName('staff_market_news')
      app.save(seasonsCol)
    } catch (_) {}
  },
)
