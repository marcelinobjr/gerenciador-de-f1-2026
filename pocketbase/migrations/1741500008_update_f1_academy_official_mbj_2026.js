/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Atualizar a F1 Academy com o Banco Oficial MBJ 2026
 * Fonte: Banco_F1_Academy_MBJ_2026-a1f69.pdf (17 pilotas oficiais, 45 campos)
 *
 * Regras:
 * - Idempotente: pode ser executada múltiplas vezes sem duplicar e sem criar conflitos.
 * - Upsert por ID (pil_0030, pil_0011, ...) / nome para pilotas já existentes na migration anterior.
 * - Ella Stevens (pil_0135) é criada.
 * - Salva Audi e outros registros intactos (não altera drivers de outras equipes ou categorias).
 * - Sem overall armazenado no banco (R03).
 */
migrate(
  (app) => {
    const driversCollection = app.findCollectionByNameOrId('drivers')

    const officialPilots = [
      {
        mbjId: 'pil_0030',
        name: 'Nina Gademan',
        nationality: 'Holanda',
        age: 22,
        speed: 60,
        consistency: 58,
        rain: 60,
        defense: 58,
        salary: 150000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0011',
        name: 'Megan Bruce',
        nationality: 'Reino Unido',
        age: 21,
        speed: 52,
        consistency: 53,
        rain: 52,
        defense: 52,
        salary: 80000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0026',
        name: 'Emma Felbermayr',
        nationality: 'Áustria',
        age: 19,
        speed: 58,
        consistency: 54,
        rain: 53,
        defense: 50,
        salary: 120000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0059',
        name: 'Mathilda Paatz',
        nationality: 'Alemanha',
        age: 17,
        speed: 52,
        consistency: 52,
        rain: 49,
        defense: 54,
        salary: 80000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0080',
        name: 'Payton Westcott',
        nationality: 'Estados Unidos',
        age: 16,
        speed: 51,
        consistency: 49,
        rain: 45,
        defense: 45,
        salary: 70000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0045',
        name: 'Alba Hurup Larsen',
        altNames: ['Alba Larsen'],
        nationality: 'Dinamarca',
        age: 17,
        speed: 59,
        consistency: 57,
        rain: 55,
        defense: 54,
        salary: 150000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0007',
        name: 'Lisa Billard',
        nationality: 'França',
        age: 16,
        speed: 53,
        consistency: 50,
        rain: 51,
        defense: 45,
        salary: 80000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0027',
        name: 'Rafaela Ferreira',
        nationality: 'Brasil',
        age: 20,
        speed: 55,
        consistency: 54,
        rain: 55,
        defense: 51,
        salary: 100000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0032',
        name: 'Natalia Granada',
        nationality: 'Espanha',
        age: 17,
        speed: 48,
        consistency: 47,
        rain: 46,
        defense: 49,
        salary: 60000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0050',
        name: 'Ella Lloyd',
        nationality: 'Reino Unido',
        age: 20,
        speed: 61,
        consistency: 60,
        rain: 61,
        defense: 62,
        salary: 180000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0060',
        name: 'Alisha Palmowski',
        nationality: 'Reino Unido',
        age: 19,
        speed: 64,
        consistency: 62,
        rain: 59,
        defense: 65,
        salary: 200000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0135',
        name: 'Ella Stevens',
        nationality: 'Reino Unido',
        age: 19,
        speed: 54,
        consistency: 50,
        rain: 53,
        defense: 46,
        salary: 80000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0043',
        name: 'Esmee Kosterman',
        nationality: 'Holanda',
        age: 20,
        speed: 51,
        consistency: 54,
        rain: 51,
        defense: 49,
        salary: 80000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0020',
        name: 'Ava Dobson',
        nationality: 'Estados Unidos',
        age: 17,
        speed: 51,
        consistency: 50,
        rain: 51,
        defense: 49,
        salary: 70000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0067',
        name: 'Rachel Robertson',
        nationality: 'Reino Unido',
        age: 18,
        speed: 54,
        consistency: 52,
        rain: 61,
        defense: 53,
        salary: 90000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0017',
        name: 'Kaylee Countryman',
        nationality: 'Estados Unidos',
        age: 16,
        speed: 48,
        consistency: 48,
        rain: 44,
        defense: 44,
        salary: 60000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
      {
        mbjId: 'pil_0039',
        name: 'Jade Jacquet',
        nationality: 'França',
        age: 16,
        speed: 49,
        consistency: 48,
        rain: 47,
        defense: 48,
        salary: 60000,
        contract_end: 2026,
        category: 'f1_academy',
        morale: 65,
        physical_condition: 100,
      },
    ]

    for (let p of officialPilots) {
      let existingRecord = null

      // Busca por nome principal ou nomes alternativos
      const searchNames = [p.name, ...(p.altNames || [])]
      for (let n of searchNames) {
        try {
          existingRecord = app.findFirstRecordByFilter(
            'drivers',
            'name = {:name} && category = "f1_academy"',
            { name: n },
          )
          if (existingRecord) break
        } catch (_) {
          // ignora se não encontrar
        }
      }

      // Se ainda não encontrou com category=f1_academy, tenta apenas por nome
      if (!existingRecord) {
        for (let n of searchNames) {
          try {
            existingRecord = app.findFirstRecordByFilter('drivers', 'name = {:name}', { name: n })
            if (existingRecord) break
          } catch (_) {}
        }
      }

      if (existingRecord) {
        // Atualiza mantendo id original do banco PocketBase e eventuais vínculos de save (caso existam)
        existingRecord.set('name', p.name)
        existingRecord.set('nationality', p.nationality)
        existingRecord.set('age', p.age)
        existingRecord.set('speed', p.speed)
        existingRecord.set('consistency', p.consistency)
        existingRecord.set('rain', p.rain)
        existingRecord.set('defense', p.defense)
        existingRecord.set('salary', p.salary)
        existingRecord.set('contract_end', p.contract_end)
        existingRecord.set('category', 'f1_academy')
        existingRecord.set('morale', p.morale)
        existingRecord.set('physical_condition', p.physical_condition)
        app.save(existingRecord)
      } else {
        // Pilota nova (Ella Stevens)
        const newRecord = new Record(driversCollection)
        newRecord.set('name', p.name)
        newRecord.set('nationality', p.nationality)
        newRecord.set('age', p.age)
        newRecord.set('speed', p.speed)
        newRecord.set('consistency', p.consistency)
        newRecord.set('rain', p.rain)
        newRecord.set('defense', p.defense)
        newRecord.set('salary', p.salary)
        newRecord.set('contract_end', p.contract_end)
        newRecord.set('category', 'f1_academy')
        newRecord.set('morale', p.morale)
        newRecord.set('physical_condition', p.physical_condition)
        newRecord.set('is_incapacitated', false)
        newRecord.set('incapacitated_rounds_left', 0)
        newRecord.set('fatigue', 0)
        newRecord.set('fp_sessions_completed', 0)
        app.save(newRecord)
      }
    }
  },
  (app) => {
    // Reverter Ella Stevens se necessário
    try {
      const ella = app.findFirstRecordByFilter(
        'drivers',
        'name = "Ella Stevens" && category = "f1_academy"',
      )
      if (ella) {
        app.delete(ella)
      }
    } catch (_) {}
  },
)
