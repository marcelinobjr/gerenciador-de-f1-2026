migrate(
  (app) => {
    // RESTORE-SEASON-01A: Reset limpo da temporada 31b0p9k5ygw2sc8 (Audi F1 Team nn7kruxy4qlvgwr)
    // Mantém a temporada e o time intactos, mas zera todo o progresso esportivo para recomeçar na Rodada 1 pré-TL1.
    const seasonId = '31b0p9k5ygw2sc8'
    const teamId = 'nn7kruxy4qlvgwr'

    // 1. Resetar progresso na coleção seasons
    app
      .db()
      .newQuery(`
      UPDATE seasons 
      SET current_round = 1,
          last_processed_round = 0,
          is_completed = 0
      WHERE id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 2. Apagar resultados de corrida (race_results)
    app
      .db()
      .newQuery(`
      DELETE FROM race_results 
      WHERE season_id = {:seasonId} OR career_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 3. Apagar journals de aplicação de carreira (canonical_career_apply_journals)
    app
      .db()
      .newQuery(`
      DELETE FROM canonical_career_apply_journals 
      WHERE career_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 4. Apagar recibos de moral de pilotos (canonical_driver_morale_receipts)
    app
      .db()
      .newQuery(`
      DELETE FROM canonical_driver_morale_receipts 
      WHERE career_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 5. Apagar recibos de stats de pilotos (canonical_driver_stats_receipts e canonical_career_driver_stats_receipts)
    app
      .db()
      .newQuery(`
      DELETE FROM canonical_driver_stats_receipts 
      WHERE career_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    app
      .db()
      .newQuery(`
      DELETE FROM canonical_career_driver_stats_receipts 
      WHERE career_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 6. Apagar snapshots de campeonato (championship_snapshots)
    app
      .db()
      .newQuery(`
      DELETE FROM championship_snapshots 
      WHERE career_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 7. Apagar grids finais oficiais de qualificação (canonical_qualifying_final_grids)
    app
      .db()
      .newQuery(`
      DELETE FROM canonical_qualifying_final_grids 
      WHERE career_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 8. Apagar estados de etapas de qualificação (canonical_qualifying_stage_states)
    app
      .db()
      .newQuery(`
      DELETE FROM canonical_qualifying_stage_states 
      WHERE career_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 9. Apagar resultados de etapas de qualificação (canonical_qualifying_stage_results)
    app
      .db()
      .newQuery(`
      DELETE FROM canonical_qualifying_stage_results 
      WHERE career_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 10. Apagar inventários de pneus canônicos gravados (canonical_weekend_tyres)
    app
      .db()
      .newQuery(`
      DELETE FROM canonical_weekend_tyres 
      WHERE career_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 11. Apagar estados de corrida canônicos (canonical_race_states)
    app
      .db()
      .newQuery(`
      DELETE FROM canonical_race_states 
      WHERE career_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 12. Apagar journals de uso de Unidade de Potência (power_unit_usage_journals)
    app
      .db()
      .newQuery(`
      DELETE FROM power_unit_usage_journals 
      WHERE career_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 13. Apagar sessões ativas no motor (race_sessions)
    app
      .db()
      .newQuery(`
      DELETE FROM race_sessions 
      WHERE season_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 14. Apagar setups de sessões e weekend_slot_state gravados no banco (session_setups)
    app
      .db()
      .newQuery(`
      DELETE FROM session_setups 
      WHERE season_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 15. Apagar relatórios de corrida (race_reports)
    app
      .db()
      .newQuery(`
      DELETE FROM race_reports 
      WHERE season_id = {:seasonId}
    `)
      .bind({ seasonId })
      .execute()

    // 16. Restaurar moral e condição física de TODOS os pilotos da temporada para o estado inicial baseline
    // (conforme convenção canônica da Migration 0033: física 100, fadiga 0, moral baseline 50-80)
    try {
      const allDrivers = app.findRecordsByFilter('drivers', '1 = 1', '', 500, 0)
      for (const d of allDrivers) {
        const name = d.getString('name') || ''
        const role = d.getString('role') || ''
        const dTeamId = d.getString('team_id') || ''

        d.set('physical_condition', 100)
        d.set('fatigue', 0)
        d.set('is_incapacitated', false)
        d.set('incapacitated_rounds_left', 0)
        d.set('incapacitated_reason', '')

        let moral = 50
        if (name.includes('Verstappen')) {
          moral = 80
        } else if (name.includes('Bortoleto')) {
          moral = 65
        } else if (dTeamId && role === 'titular') {
          moral = 65
        }

        d.set('morale', moral)
        app.save(d)
      }
    } catch (e) {
      // Log defensivo se houver qualquer desvio
      console.log('[RESTORE-SEASON-01A] Erro ao restaurar pilotos:', e)
    }

    // 17. Atualizar configurações de carreira no time para sprintEnabled: false (sincronização cosmética)
    try {
      const teamRecord = app.findCollectionByNameOrId('teams')
        ? app.findRecordById('teams', teamId)
        : null
      if (teamRecord) {
        const rawSettings = teamRecord.get('career_settings')
        let settings = {}
        if (typeof rawSettings === 'string') {
          try {
            settings = JSON.parse(rawSettings)
          } catch {
            settings = {}
          }
        } else if (rawSettings && typeof rawSettings === 'object') {
          settings = { ...rawSettings }
        }
        settings.sprintEnabled = false
        teamRecord.set('career_settings', settings)
        app.save(teamRecord)
      }
    } catch (e) {
      console.log('[RESTORE-SEASON-01A] Erro ao atualizar career_settings do time:', e)
    }
  },
  (app) => {
    // Reset irreversível consciente solicitado pelo usuário
  },
)
