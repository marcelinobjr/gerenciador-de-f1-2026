/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Enriquecer collection 'sponsors' com campos canônicos da Implementação 5B (apenas aditivo)
    const sponsorsCol = app.findCollectionByNameOrId('sponsors')

    if (!sponsorsCol.fields.getByName('sponsor_key')) {
      sponsorsCol.fields.add(new TextField({ name: 'sponsor_key', required: false }))
    }
    if (!sponsorsCol.fields.getByName('sector')) {
      sponsorsCol.fields.add(new TextField({ name: 'sector', required: false }))
    }
    if (!sponsorsCol.fields.getByName('country')) {
      sponsorsCol.fields.add(new TextField({ name: 'country', required: false }))
    }
    if (!sponsorsCol.fields.getByName('fixed_annual_value')) {
      sponsorsCol.fields.add(new NumberField({ name: 'fixed_annual_value', required: false }))
    }
    if (!sponsorsCol.fields.getByName('contract_start_year')) {
      sponsorsCol.fields.add(new NumberField({ name: 'contract_start_year', required: false }))
    }
    if (!sponsorsCol.fields.getByName('contract_end_year')) {
      sponsorsCol.fields.add(new NumberField({ name: 'contract_end_year', required: false }))
    }
    if (!sponsorsCol.fields.getByName('satisfaction')) {
      sponsorsCol.fields.add(
        new NumberField({ name: 'satisfaction', required: false, min: 0, max: 100 }),
      )
    }
    if (!sponsorsCol.fields.getByName('renewal_interest')) {
      sponsorsCol.fields.add(
        new NumberField({ name: 'renewal_interest', required: false, min: 0, max: 100 }),
      )
    }
    if (!sponsorsCol.fields.getByName('is_title_sponsor')) {
      sponsorsCol.fields.add(new BoolField({ name: 'is_title_sponsor', required: false }))
    }
    if (!sponsorsCol.fields.getByName('title_name_suffix')) {
      sponsorsCol.fields.add(new TextField({ name: 'title_name_suffix', required: false }))
    }
    if (!sponsorsCol.fields.getByName('exclusivity_sector')) {
      sponsorsCol.fields.add(new TextField({ name: 'exclusivity_sector', required: false }))
    }
    if (!sponsorsCol.fields.getByName('partnership_type')) {
      sponsorsCol.fields.add(new TextField({ name: 'partnership_type', required: false }))
    }
    if (!sponsorsCol.fields.getByName('package_slots')) {
      sponsorsCol.fields.add(new JSONField({ name: 'package_slots', required: false }))
    }
    if (!sponsorsCol.fields.getByName('bonuses')) {
      sponsorsCol.fields.add(new JSONField({ name: 'bonuses', required: false }))
    }
    if (!sponsorsCol.fields.getByName('objectives')) {
      sponsorsCol.fields.add(new JSONField({ name: 'objectives', required: false }))
    }
    if (!sponsorsCol.fields.getByName('clauses')) {
      sponsorsCol.fields.add(new JSONField({ name: 'clauses', required: false }))
    }
    if (!sponsorsCol.fields.getByName('negotiation_history')) {
      sponsorsCol.fields.add(new JSONField({ name: 'negotiation_history', required: false }))
    }
    if (!sponsorsCol.fields.getByName('contract_id')) {
      sponsorsCol.fields.add(new TextField({ name: 'contract_id', required: false }))
    }

    app.save(sponsorsCol)

    // 2. Adicionar campo aditivo em teams para propostas ativas e mercado de negociações em curso
    const teamsCol = app.findCollectionByNameOrId('teams')
    if (!teamsCol.fields.getByName('commercial_proposals')) {
      teamsCol.fields.add(new JSONField({ name: 'commercial_proposals', required: false }))
    }
    if (!teamsCol.fields.getByName('active_negotiations')) {
      teamsCol.fields.add(new JSONField({ name: 'active_negotiations', required: false }))
    }
    if (!teamsCol.fields.getByName('commercial_history')) {
      teamsCol.fields.add(new JSONField({ name: 'commercial_history', required: false }))
    }
    app.save(teamsCol)
  },
  (app) => {
    // Reversão defensiva sem deletar dados estruturais antigos
  },
)
