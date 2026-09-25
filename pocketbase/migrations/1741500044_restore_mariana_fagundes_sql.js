migrate(
  (app) => {
    // Restauração canônica do registro de Mariana Fagundes (qm6xcgc5mstulg3)
    // BUG-RETRATOS-03B2: Uso de SQL direto UPDATE para contornar qualquer quirk do Goja/app.save
    // Gravando objeto JSON completo e válido, NUNCA array []
    var marianaData = {
      driverId: 'drv_proc_mariana_fagundes',
      displayName: 'M. Fagundes',
      countryFlag: '🇧🇷',
      careerStatus: 'academy',
      currentAcademyTeamId: 'dpvviz06tkzwbih',
      academyOriginTeamId: 'dpvviz06tkzwbih',
      dateOfBirth: '2010-03-16',
      generatedPortraitProfileId: 'Piloto_13',
      visualIdentity: {
        visualIdentityId: 'fictional_pilot_13',
        portraitAssetId: 'GEN_13',
        generatedPortraitProfileId: 'Piloto_13',
        gender: 'female',
        stylePromptSeed: 13,
      },
    }

    var serialized = JSON.stringify(marianaData)

    // Atualização com bind de parâmetros SQL direto
    app
      .db()
      .newQuery(
        'UPDATE drivers SET procedural_data = {:json}, career_status = {:career_status}, academy_origin_team_id = {:academy_team_id}, team_id = {:team_id}, is_academy = 1 WHERE id = {:id} OR name = {:name}',
      )
      .bind({
        json: serialized,
        career_status: 'academy',
        academy_team_id: 'dpvviz06tkzwbih',
        team_id: 'dpvviz06tkzwbih',
        id: 'qm6xcgc5mstulg3',
        name: 'Mariana Fagundes',
      })
      .execute()
  },
  (app) => {
    // Down migration
  },
)
