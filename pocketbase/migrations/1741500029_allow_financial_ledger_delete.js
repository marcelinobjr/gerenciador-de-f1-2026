migrate(
  (app) => {
    // Permitir deleção em financial_ledger pelo dono da equipe da carreira
    const ledgerCol = app.findCollectionByNameOrId('financial_ledger')
    ledgerCol.deleteRule = "@request.auth.id != '' && team_id.user_id = @request.auth.id"
    app.save(ledgerCol)
  },
  (app) => {
    try {
      const ledgerCol = app.findCollectionByNameOrId('financial_ledger')
      ledgerCol.deleteRule = null
      app.save(ledgerCol)
    } catch (_) {}
  },
)
