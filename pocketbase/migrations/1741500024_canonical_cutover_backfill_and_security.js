migrate(
  (app) => {
    // ------------------------------------------------------------------------
    // PARTE 1: SEGURANÇA SERVER-SIDE
    // ------------------------------------------------------------------------
    const teamsCol = app.findCollectionByNameOrId('teams')
    teamsCol.listRule = "@request.auth.id != ''"
    teamsCol.viewRule = "@request.auth.id != ''"
    teamsCol.createRule = "@request.auth.id != ''"
    teamsCol.updateRule =
      "@request.auth.id != '' && (user_id = @request.auth.id || user_id = '' || @request.auth.role = 'admin')"
    app.save(teamsCol)

    const ledgerCol = app.findCollectionByNameOrId('financial_ledger')
    ledgerCol.listRule = "@request.auth.id != '' && team_id.user_id = @request.auth.id"
    ledgerCol.viewRule = "@request.auth.id != '' && team_id.user_id = @request.auth.id"
    ledgerCol.createRule = "@request.auth.id != '' && team_id.user_id = @request.auth.id"
    ledgerCol.updateRule = null
    ledgerCol.deleteRule = null

    // Garantir que cost_cap_impact e metadata permitam valor 0 e não falhem validação
    const costCapField = ledgerCol.fields.getByName('cost_cap_impact')
    if (costCapField) {
      costCapField.required = false
    }
    app.save(ledgerCol)

    // ------------------------------------------------------------------------
    // PARTE 2: CUTOVER DO LEDGER LEGADO
    // ------------------------------------------------------------------------
    const teams = app.findRecordsByFilter('teams', '1 = 1', '', 100, 0)
    for (const t of teams) {
      const teamId = t.id
      const currentBudget = Number(t.get('budget')) || 0
      const idempotencyKey = `opening_balance_${teamId}`

      let existingRecord = null
      try {
        existingRecord = app.findFirstRecordByData(
          'financial_ledger',
          'idempotency_key',
          idempotencyKey,
        )
      } catch (_) {
        existingRecord = null
      }

      if (!existingRecord && currentBudget > 0) {
        const openingRec = new Record(ledgerCol)
        openingRec.set('team_id', teamId)
        openingRec.set('season_year', 2026)
        openingRec.set('round', 1)
        openingRec.set('type', 'opening_balance')
        openingRec.set('category', 'ownerFunding')
        openingRec.set('subcategory', 'legacy_opening_balance')
        openingRec.set('direction', 'inflow')
        openingRec.set('amount', currentBudget)
        openingRec.set('cash_impact', currentBudget)
        openingRec.set('cost_cap_impact', 0)
        openingRec.set('cost_cap_classification', 'excluded')
        // No PocketBase JS, 0 para number field requerido às vezes avalia como vazio/falsy se não passado como número explícito ou se a validação esperar não zero
        // Mas se required: true para number, 0 pode ser bloqueado se required rejeitar zero no PocketBase Go.
        openingRec.set('source_system', 'legacy_cutover')
        openingRec.set('source_entity_id', teamId)
        openingRec.set('idempotency_key', idempotencyKey)
        openingRec.set(
          'description',
          'Saldo inicial migrado de save legado anterior ao Ledger canônico',
        )
        openingRec.set('status', 'effective')
        openingRec.set('effective_date', new Date().toISOString())
        app.save(openingRec)
      }
    }

    // ------------------------------------------------------------------------
    // PARTE 3: BACKFILL TÉCNICO DETERMINÍSTICO (NÃO altera performance)
    // ------------------------------------------------------------------------
    const OFFICIAL_PROFILES = {
      mercedes: {
        macro: 100,
        supplier: 'Mercedes',
        comps: {
          frontWing: 99,
          rearWing: 100,
          floor: 100,
          diffuser: 99,
          sidepods: 98,
          chassis: 99,
          suspension: 99,
          brakes: 98,
        },
      },
      ferrari: {
        macro: 91,
        supplier: 'Ferrari',
        comps: {
          frontWing: 91,
          rearWing: 92,
          floor: 90,
          diffuser: 91,
          sidepods: 89,
          chassis: 92,
          suspension: 90,
          brakes: 92,
        },
      },
      mclaren: {
        macro: 88,
        supplier: 'Mercedes',
        comps: {
          frontWing: 89,
          rearWing: 87,
          floor: 88,
          diffuser: 88,
          sidepods: 87,
          chassis: 88,
          suspension: 87,
          brakes: 87,
        },
      },
      redbull: {
        macro: 84,
        supplier: 'Ford',
        comps: {
          frontWing: 86,
          rearWing: 84,
          floor: 85,
          diffuser: 85,
          sidepods: 83,
          chassis: 84,
          suspension: 83,
          brakes: 83,
        },
      },
      racingbulls: {
        macro: 63,
        supplier: 'Ford',
        comps: {
          frontWing: 64,
          rearWing: 63,
          floor: 63,
          diffuser: 62,
          sidepods: 63,
          chassis: 64,
          suspension: 63,
          brakes: 62,
        },
      },
      alpine: {
        macro: 61,
        supplier: 'Mercedes',
        comps: {
          frontWing: 62,
          rearWing: 60,
          floor: 61,
          diffuser: 61,
          sidepods: 62,
          chassis: 60,
          suspension: 61,
          brakes: 60,
        },
      },
      audi: {
        macro: 52,
        supplier: 'Audi',
        comps: {
          frontWing: 53,
          rearWing: 52,
          floor: 52,
          diffuser: 51,
          sidepods: 52,
          chassis: 53,
          suspension: 52,
          brakes: 51,
        },
      },
      haas: {
        macro: 48,
        supplier: 'Ferrari',
        comps: {
          frontWing: 49,
          rearWing: 48,
          floor: 47,
          diffuser: 48,
          sidepods: 48,
          chassis: 49,
          suspension: 47,
          brakes: 48,
        },
      },
      williams: {
        macro: 42,
        supplier: 'Mercedes',
        comps: {
          frontWing: 43,
          rearWing: 42,
          floor: 41,
          diffuser: 42,
          sidepods: 43,
          chassis: 41,
          suspension: 42,
          brakes: 42,
        },
      },
      astonmartin: {
        macro: 37,
        supplier: 'Honda',
        comps: {
          frontWing: 38,
          rearWing: 37,
          floor: 37,
          diffuser: 36,
          sidepods: 38,
          chassis: 37,
          suspension: 36,
          brakes: 37,
        },
      },
      andretti: {
        macro: 35,
        supplier: 'Honda',
        comps: {
          frontWing: 36,
          rearWing: 35,
          floor: 35,
          diffuser: 34,
          sidepods: 36,
          chassis: 35,
          suspension: 34,
          brakes: 35,
        },
      },
      cadillac: {
        macro: 30,
        supplier: 'Ferrari',
        comps: {
          frontWing: 31,
          rearWing: 30,
          floor: 30,
          diffuser: 29,
          sidepods: 30,
          chassis: 31,
          suspension: 30,
          brakes: 29,
        },
      },
    }

    const COMP_WEIGHTS = {
      downforceLowSpeed: {
        frontWing: 0.25,
        rearWing: 0.15,
        floor: 0.35,
        diffuser: 0.15,
        sidepods: 0.05,
        chassis: 0.05,
      },
      downforceHighSpeed: {
        frontWing: 0.3,
        rearWing: 0.3,
        floor: 0.25,
        diffuser: 0.1,
        sidepods: 0.05,
      },
      dragEfficiency: { rearWing: 0.3, sidepods: 0.25, floor: 0.2, frontWing: 0.15, diffuser: 0.1 },
      brakingPerformance: { brakes: 0.5, suspension: 0.25, frontWing: 0.15, chassis: 0.1 },
      mechanicalGrip: { suspension: 0.45, chassis: 0.35, brakes: 0.2 },
      tyreManagement: { suspension: 0.4, chassis: 0.3, floor: 0.15, brakes: 0.15 },
      cooling: { sidepods: 0.6, floor: 0.2, chassis: 0.2 },
      energyHarvesting: { brakes: 0.5, sidepods: 0.25, chassis: 0.25 },
      energyDeployment: { chassis: 0.4, sidepods: 0.3, suspension: 0.3 },
      rideHeightSensitivity: { floor: 0.45, diffuser: 0.3, suspension: 0.25 },
      topSpeed: { rearWing: 0.3, sidepods: 0.25, floor: 0.2, frontWing: 0.15, diffuser: 0.1 },
      acceleration: { chassis: 0.35, suspension: 0.35, brakes: 0.15, sidepods: 0.15 },
      reliability: { chassis: 0.35, suspension: 0.25, sidepods: 0.2, brakes: 0.2 },
    }

    const ATTR_WEIGHTS = {
      downforceHighSpeed: 0.12,
      downforceLowSpeed: 0.12,
      mechanicalGrip: 0.12,
      dragEfficiency: 0.1,
      brakingPerformance: 0.08,
      tyreManagement: 0.08,
      topSpeed: 0.08,
      acceleration: 0.08,
      reliability: 0.08,
      cooling: 0.05,
      energyDeployment: 0.04,
      rideHeightSensitivity: 0.05,
    }

    for (const t of teams) {
      const existingAttrs = t.get('technical_attributes')
      const existingComps = t.get('component_ratings')
      const existingOverall = Number(t.get('calculated_overall')) || 0

      // Só backfill se estiver vazio/nulo
      if (!existingAttrs || !existingComps || existingOverall <= 0) {
        let teamKey = (t.get('team_key') || '').toString()
        if (!teamKey) {
          const nameLower = (t.get('name') || '').toString().toLowerCase()
          for (const k of Object.keys(OFFICIAL_PROFILES)) {
            if (nameLower.includes(k)) {
              teamKey = k
              break
            }
          }
        }
        if (!teamKey) teamKey = 'audi'

        const profile = OFFICIAL_PROFILES[teamKey] || OFFICIAL_PROFILES.audi
        const comps = profile.comps

        // Calcular os 12 atributos
        const attrs = {}
        for (const [attrId, influence] of Object.entries(COMP_WEIGHTS)) {
          let weightedSum = 0
          let totalWeight = 0
          for (const [compKey, w] of Object.entries(influence)) {
            const r = comps[compKey] || 50
            weightedSum += r * w
            totalWeight += w
          }
          attrs[attrId] = Number((weightedSum / totalWeight).toFixed(2))
        }

        // Calcular overall
        let overall = 0
        for (const [attrId, weight] of Object.entries(ATTR_WEIGHTS)) {
          overall += (attrs[attrId] || 50) * weight
        }
        const calculatedOverall = Number(overall.toFixed(2))
        const balanceDelta = Number((calculatedOverall - profile.macro).toFixed(2))

        t.set('component_ratings', comps)
        t.set('technical_attributes', attrs)
        t.set('calculated_overall', calculatedOverall)
        t.set('balance_delta', balanceDelta)
        if (!t.get('team_key')) {
          t.set('team_key', teamKey)
        }
        app.save(t)
      }
    }
  },
  (app) => {
    // Reversão
    try {
      const teamsCol = app.findCollectionByNameOrId('teams')
      teamsCol.updateRule = "@request.auth.id != ''"
      app.save(teamsCol)

      const ledgerCol = app.findCollectionByNameOrId('financial_ledger')
      ledgerCol.listRule = ''
      ledgerCol.viewRule = ''
      ledgerCol.createRule = ''
      ledgerCol.updateRule = ''
      ledgerCol.deleteRule = ''
      app.save(ledgerCol)
    } catch (_) {}
  },
)
