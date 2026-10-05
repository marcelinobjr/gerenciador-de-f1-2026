/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('power_unit_usage_journals')

    // Regras de RLS:
    // Apenas leitura autenticada; escrita (criação, alteração, remoção) bloqueada para clientes REST normais
    // (createRule, updateRule, deleteRule = null), garantindo que apenas superuser ou o hook transacional
    // no servidor possa gravar/modificar marcas autoritativas de uso de PU.
    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = null
    col.updateRule = null
    col.deleteRule = null

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('power_unit_usage_journals')
      col.listRule = ''
      col.viewRule = ''
      col.createRule = ''
      col.updateRule = ''
      col.deleteRule = ''
      app.save(col)
    } catch (_) {}
  },
)
