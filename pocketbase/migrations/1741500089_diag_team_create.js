migrate((app) => {
  const teamsCol = app.findCollectionByNameOrId('teams')
  const rec = new Record(teamsCol)
  rec.set('name', 'Audi F1 Team')
  rec.set('color', '#FF2A00')
  rec.set('chassis_level', 50)
  rec.set('aero_level', 50)
  rec.set('strategy_level', 48)
  rec.set('budget', 150000000)
  rec.set('engine_supplier', 'Audi')
  rec.set('strength', 55)
  rec.set('is_custom', false)
  rec.set('team_key', 'audi')
  rec.set('user_id', 'jxe5h74yat69x3x')
  rec.set('technical_attributes', { acceleration: 55.35 })
  rec.set('calculated_overall', 55.08)
  rec.set('balance_delta', 0.08)
  rec.set('component_ratings', { brakes: 54 })

  let saveErr = 'NONE'
  try {
    app.save(rec)
    app.delete(rec)
  } catch (err) {
    saveErr = err ? err.message || String(err) : 'unknown'
  }

  // Check unique indexes in teams
  const indexes = teamsCol.indexes || []

  // Check field min/max/constraints
  const fieldsInfo = {}
  for (let f of teamsCol.fields) {
    fieldsInfo[f.name] = {
      type: f.type,
      required: f.required,
      min: f.min,
      max: f.max,
      values: f.values,
    }
  }

  throw new Error(
    'DIAG_OUTPUT: saveErr=' +
      saveErr +
      ' | indexes=' +
      JSON.stringify(indexes) +
      ' | fields=' +
      JSON.stringify(fieldsInfo),
  )
})
