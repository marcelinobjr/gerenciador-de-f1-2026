migrate(
  (app) => {
    const teamsCol = app.findCollectionByNameOrId('teams')
    const testRec = new Record(teamsCol)
    testRec.set('name', 'Diagnostico Ferrari Teste')
    testRec.set('color', '#E8002D')
    testRec.set('chassis_level', 79)
    testRec.set('aero_level', 79)
    testRec.set('strategy_level', 77)
    testRec.set('budget', 300000000)
    testRec.set('engine_supplier', 'Ferrari')
    testRec.set('strength', 88)
    testRec.set('is_custom', false)
    testRec.set('team_key', 'ferrari')
    testRec.set('user_id', 'jxe5h74yat69x3x')

    try {
      app.save(testRec)
      console.log('[PROBE_CREATE_SUCCESS] Created id: ' + testRec.id)
      // Clean up probe record immediately
      app.delete(testRec)
      console.log('[PROBE_DELETE_SUCCESS] Cleaned up probe record')
    } catch (err) {
      console.log('[PROBE_CREATE_ERROR] Failed with error: ' + err)
    }
  },
  (app) => {},
)
