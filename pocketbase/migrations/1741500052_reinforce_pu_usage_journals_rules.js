/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('power_unit_usage_journals')

    // Regras de RLS estritas para power_unit_usage_journals:
    // 1. Escrita (create, update, delete) totalmente fechada ao cliente REST comum (null).
    //    Apenas superuser ou hooks autorizados no servidor podem gravar/alterar marcas.
    // 2. Leitura (list, view) restrita a usuários autenticados.
    //    A consulta refinada por carreira/proprietário é garantida pelo endpoint
    //    GET /backend/v1/pu-usage/journal com verificação do usuário autenticado.
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
      col.listRule = "@request.auth.id != ''"
      col.viewRule = "@request.auth.id != ''"
      col.createRule = null
      col.updateRule = null
      col.deleteRule = null
      app.save(col)
    } catch (_) {}
  },
)
