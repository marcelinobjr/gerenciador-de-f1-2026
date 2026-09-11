migrate(
  (app) => {
    try {
      const circuitsCol = app.findCollectionByNameOrId('circuits')
      const record = app.findFirstRecordByData('circuits', 'round', 7)
      if (record) {
        record.set('name', 'Grande Prêmio de Madri')
        record.set('circuit_name', 'Circuito Madring, Madrid')
        record.set('country', 'Espanha')
        app.save(record)
      }
    } catch (err) {
      console.log('Error updating round 7 circuit in DB:', err)
    }
  },
  (app) => {
    try {
      const circuitsCol = app.findCollectionByNameOrId('circuits')
      const record = app.findFirstRecordByData('circuits', 'round', 7)
      if (record) {
        record.set('name', 'Grande Prêmio da Emília-Romanha')
        record.set('circuit_name', 'Autodromo Enzo e Dino Ferrari, Imola')
        record.set('country', 'Itália')
        app.save(record)
      }
    } catch (err) {}
  },
)
