migrate(
  (app) => {
    // Criação da coleção canônica financial_ledger
    // Armazena transações financeiras imutáveis com idempotência, cost cap e rastreabilidade de origem.
    const teamsCol = app.findCollectionByNameOrId('teams')

    const ledgerCollection = new Collection({
      name: 'financial_ledger',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'team_id',
          type: 'relation',
          required: true,
          collectionId: teamsCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'season_year', type: 'number', required: true },
        { name: 'round', type: 'number', required: false },
        { name: 'date_display', type: 'text', required: false },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['revenue', 'expense', 'commitment', 'reversal', 'adjustment', 'opening_balance'],
          maxSelect: 1,
        },
        {
          name: 'category',
          type: 'select',
          required: true,
          values: [
            'prizeMoney',
            'sponsorship',
            'commercial',
            'driverRelated',
            'ownerFunding',
            'otherRevenue',
            'development',
            'manufacturing',
            'repairs',
            'infrastructureCapex',
            'infrastructureOpex',
            'driverSalaries',
            'staff',
            'academy',
            'scouting',
            'testing',
            'raceOperations',
            'penalties',
            'otherExpense',
          ],
          maxSelect: 1,
        },
        { name: 'subcategory', type: 'text', required: false },
        {
          name: 'direction',
          type: 'select',
          required: true,
          values: ['inflow', 'outflow', 'neutral'],
          maxSelect: 1,
        },
        { name: 'amount', type: 'number', required: true },
        { name: 'cash_impact', type: 'number', required: true },
        { name: 'cost_cap_impact', type: 'number', required: true },
        {
          name: 'cost_cap_classification',
          type: 'select',
          required: true,
          values: ['included', 'excluded', 'partial', 'pending'],
          maxSelect: 1,
        },
        { name: 'source_system', type: 'text', required: true },
        { name: 'source_entity_id', type: 'text', required: false },
        { name: 'idempotency_key', type: 'text', required: true },
        { name: 'description', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['committed', 'effective', 'reversed', 'cancelled'],
          maxSelect: 1,
        },
        { name: 'effective_date', type: 'text', required: false },
        { name: 'metadata', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_financial_ledger_idempotency ON financial_ledger (idempotency_key)',
        'CREATE INDEX idx_financial_ledger_team_season ON financial_ledger (team_id, season_year, round)',
      ],
    })
    app.save(ledgerCollection)

    // Campos adicionais e opcionais na collection teams para cache/orçamento/compromissos agregados
    const col = app.findCollectionByNameOrId('teams')
    if (!col.fields.getByName('budget_allocations')) {
      col.fields.add(new JSONField({ name: 'budget_allocations' }))
    }
    if (!col.fields.getByName('financial_commitments')) {
      col.fields.add(new JSONField({ name: 'financial_commitments' }))
    }
    if (!col.fields.getByName('opening_balances')) {
      col.fields.add(new JSONField({ name: 'opening_balances' }))
    }
    app.save(col)
  },
  (app) => {
    try {
      const ledger = app.findCollectionByNameOrId('financial_ledger')
      app.delete(ledger)
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('teams')
      const f1 = col.fields.getByName('budget_allocations')
      if (f1) col.fields.remove(f1)
      const f2 = col.fields.getByName('financial_commitments')
      if (f2) col.fields.remove(f2)
      const f3 = col.fields.getByName('opening_balances')
      if (f3) col.fields.remove(f3)
      app.save(col)
    } catch (_) {}
  },
)
