routerAdd('GET', '/backend/v1/custom-health-check', (e) => {
  return e.json(200, { status: 'ok' })
})
