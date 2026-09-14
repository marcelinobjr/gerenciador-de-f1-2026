/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    try {
      const res = $http.send({
        url: 'https://gerenciador-de-f1-2026-4bb0f.shrd00.internal.goskip.dev/backend/v1/custom-download-mbj-data',
        method: 'GET',
        timeout: 60,
      })
      console.log('[CALL RESULT]:', res.raw ? res.raw.toString() : 'empty')
    } catch (err) {
      console.log('[CALL ERROR]:', err)
    }
  },
  (app) => {},
)
