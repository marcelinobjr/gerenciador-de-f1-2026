/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('canonical_career_driver_stats_receipts')
    if (!col) return

    // Bloquear criação, atualização e exclusão direta por clientes comuns
    // PocketBase: null = bloqueado (apenas superuser / código de hooks server-side)
    // listRule e viewRule continuam permitidos para leitura/consulta (@request.auth.id != '')
    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = null
    col.updateRule = null
    col.deleteRule = null

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('canonical_career_driver_stats_receipts')
      if (!col) return
      col.listRule = ''
      col.viewRule = ''
      col.createRule = ''
      col.updateRule = ''
      col.deleteRule = ''
      app.save(col)
    } catch (_) {}
  },
)
