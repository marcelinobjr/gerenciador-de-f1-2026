/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // FASE 3D: Integração do Modelo Técnico do Carro
    // 100% ADITIVA, SEM ALTERAR NENHUM VALOR DE SAVES EXISTENTES.
    // Save Audi de m.blasques@multi.br.com permanece intacto.

    const teamsCol = app.findCollectionByNameOrId('teams')
    const partsCol = app.findCollectionByNameOrId('parts')

    // 1. Novos campos técnicos em teams
    // - technical_attributes (json): 12 atributos técnicos calculados
    // - calculated_overall (number): rating calculado a partir dos 12 atributos
    // - balance_delta (number): delta calculado vs macro
    // - car_specifications (json): especificações técnicas / gerações (Gen 1, Gen 2...)
    if (!teamsCol.fields.getByName('technical_attributes')) {
      teamsCol.fields.add(new JSONField({ name: 'technical_attributes' }))
    }
    if (!teamsCol.fields.getByName('calculated_overall')) {
      teamsCol.fields.add(new NumberField({ name: 'calculated_overall' }))
    }
    if (!teamsCol.fields.getByName('balance_delta')) {
      teamsCol.fields.add(new NumberField({ name: 'balance_delta' }))
    }
    if (!teamsCol.fields.getByName('car_specifications')) {
      teamsCol.fields.add(new JSONField({ name: 'car_specifications' }))
    }

    app.save(teamsCol)

    // 2. Novos campos de Unidade Física / Especificação em parts
    // - component_id (text): frontWing, rearWing, floor, diffuser, sidepods, chassis, suspension, brakes
    // - spec_generation (number): Geração do projeto (ex: 1, 2)
    // - car_assignment (select): car1 | car2 | stock
    // - mileage_km (number): quilometragem percorrida
    // - wear_percentage (number): desgaste físico de corrida (0-100)
    // - damage_percentage (number): dano estrutural (0-100)
    if (!partsCol.fields.getByName('component_id')) {
      partsCol.fields.add(new TextField({ name: 'component_id' }))
    }
    if (!partsCol.fields.getByName('spec_generation')) {
      partsCol.fields.add(new NumberField({ name: 'spec_generation', onlyInt: true }))
    }
    if (!partsCol.fields.getByName('car_assignment')) {
      partsCol.fields.add(
        new SelectField({
          name: 'car_assignment',
          values: ['car1', 'car2', 'stock'],
          maxSelect: 1,
        }),
      )
    }
    if (!partsCol.fields.getByName('mileage_km')) {
      partsCol.fields.add(new NumberField({ name: 'mileage_km' }))
    }
    if (!partsCol.fields.getByName('wear_percentage')) {
      partsCol.fields.add(new NumberField({ name: 'wear_percentage' }))
    }
    if (!partsCol.fields.getByName('damage_percentage')) {
      partsCol.fields.add(new NumberField({ name: 'damage_percentage' }))
    }

    app.save(partsCol)
  },
  (app) => {
    // Reversão segura
    const teamsCol = app.findCollectionByNameOrId('teams')
    const partsCol = app.findCollectionByNameOrId('parts')

    if (teamsCol.fields.getByName('technical_attributes')) {
      teamsCol.fields.removeByName('technical_attributes')
    }
    if (teamsCol.fields.getByName('calculated_overall')) {
      teamsCol.fields.removeByName('calculated_overall')
    }
    if (teamsCol.fields.getByName('balance_delta')) {
      teamsCol.fields.removeByName('balance_delta')
    }
    if (teamsCol.fields.getByName('car_specifications')) {
      teamsCol.fields.removeByName('car_specifications')
    }
    app.save(teamsCol)

    if (partsCol.fields.getByName('component_id')) {
      partsCol.fields.removeByName('component_id')
    }
    if (partsCol.fields.getByName('spec_generation')) {
      partsCol.fields.removeByName('spec_generation')
    }
    if (partsCol.fields.getByName('car_assignment')) {
      partsCol.fields.removeByName('car_assignment')
    }
    if (partsCol.fields.getByName('mileage_km')) {
      partsCol.fields.removeByName('mileage_km')
    }
    if (partsCol.fields.getByName('wear_percentage')) {
      partsCol.fields.removeByName('wear_percentage')
    }
    if (partsCol.fields.getByName('damage_percentage')) {
      partsCol.fields.removeByName('damage_percentage')
    }
    app.save(partsCol)
  },
)
