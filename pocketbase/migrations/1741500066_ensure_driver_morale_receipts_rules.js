/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('canonical_driver_morale_receipts')
      col.listRule = '@request.auth.id != ""'
      col.viewRule = '@request.auth.id != ""'
      app.save(col)
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('canonical_driver_morale_receipts')
      col.listRule = ''
      col.viewRule = ''
      app.save(col)
    } catch (_) {}
  },
)
