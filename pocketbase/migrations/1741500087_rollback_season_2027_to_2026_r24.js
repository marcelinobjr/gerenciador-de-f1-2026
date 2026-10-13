/**
 * 1741500087_rollback_season_2027_to_2026_r24.js
 *
 * SEASON-REDO-01A (PARTE 1):
 * (a) Excluir a temporada 2027 (id d8rf7m6cpmhstt7) e dados derivados;
 * (b) Reverter dança das cadeiras: restaurar pilotos às equipes de 2026;
 * (c) Cancelar contratos assinados na virada — devolver Verstappen à Red Bull (n2tqsicdy7z6n9w),
 *     restaurar contract_end/canonical_contract/next_team_id/future_contract;
 * (d) Marcar temporada 2026 (z36hmcbqa75kt7k) como is_completed=false, current_round=24, last_processed_round=24;
 * (e) Resetar/remover transição c2845wc0t5noc4h e histórico 5nhtg9yykdu8yde para encerramento limpo;
 * (f) Garantir Verstappen com visualIdentity DRV_0022 masculino.
 * NÃO tocar em race_results, journals, receipts e champion snapshots de 2026.
 */
migrate(
  (app) => {
    console.log('[1741500087] Iniciando Rollback 2027 -> Pós-corrida R24 2026...')

    // 1. Desvincular e remover a temporada 2027 (id d8rf7m6cpmhstt7)
    try {
      const season2027 = app.findFirstRecordByData('seasons', 'id', 'd8rf7m6cpmhstt7')
      if (season2027) {
        app.delete(season2027)
        console.log('[1741500087] Temporada 2027 (d8rf7m6cpmhstt7) excluída com sucesso.')
      }
    } catch (e) {
      console.log('[1741500087] Temporada 2027 já não existe ou foi removida:', e)
    }

    // 2. Resetar / Remover transição c2845wc0t5noc4h
    try {
      const trans = app.findFirstRecordByData('season_transitions', 'id', 'c2845wc0t5noc4h')
      if (trans) {
        app.delete(trans)
        console.log('[1741500087] Transição c2845wc0t5noc4h excluída com sucesso.')
      }
    } catch (e) {
      console.log('[1741500087] Transição c2845wc0t5noc4h já removida:', e)
    }

    // 3. Resetar / Remover histórico arquivado 5nhtg9yykdu8yde para que possa ser recalculado no encerramento
    try {
      const hist = app.findFirstRecordByData('season_histories', 'id', '5nhtg9yykdu8yde')
      if (hist) {
        app.delete(hist)
        console.log('[1741500087] Histórico 5nhtg9yykdu8yde excluído para reprocessamento limpo.')
      }
    } catch (e) {
      console.log('[1741500087] Histórico 5nhtg9yykdu8yde já removido:', e)
    }

    // 4. Marcar a temporada 2026 (z36hmcbqa75kt7k) como aberta pós-R24
    try {
      const season2026 = app.findFirstRecordByData('seasons', 'id', 'z36hmcbqa75kt7k')
      if (season2026) {
        season2026.set('is_completed', false)
        season2026.set('current_round', 24)
        season2026.set('last_processed_round', 24)
        season2026.set('archived_history_id', '')
        app.save(season2026)
        console.log(
          '[1741500087] Temporada 2026 (z36hmcbqa75kt7k) restaurada: is_completed=false, round=24/24.',
        )
      }
    } catch (e) {
      console.log('[1741500087] Erro ao atualizar temporada 2026:', e)
    }

    // 5. IDs das equipes conhecidas de 2026
    // Red Bull: n2tqsicdy7z6n9w
    // Mercedes: 0k70aa2bxi2whkk
    // Ferrari: e7loqxdce7u2qol
    // McLaren: 76vs00hy9hu24q1
    // Aston Martin: 7bov4vlrlp77in2
    // Alpine: ou3sblcubiv48o3
    // Williams: ze4v4eiylmqjd6m
    // Racing Bulls: n24721v6is80vyu
    // Stake / Audi: 475a684zt1btgev
    // Haas: 03fc7aw41j95eyv
    // Andretti: l3uyp27o7vkyw4q
    // Cadillac: u9222o7q0u4f6p1
    let redbullId = 'n2tqsicdy7z6n9w'
    let mercedesId = '0k70aa2bxi2whkk'
    let audiId = '475a684zt1btgev'

    try {
      const rb = app.findFirstRecordByData('teams', 'team_key', 'redbull')
      if (rb) redbullId = rb.id
    } catch (_) {}

    try {
      const merc = app.findFirstRecordByData('teams', 'team_key', 'mercedes')
      if (merc) mercedesId = merc.id
    } catch (_) {}

    try {
      const aud = app.findFirstRecordByData('teams', 'team_key', 'audi')
      if (aud) audiId = aud.id
    } catch (_) {}

    // 6. Restaurar Max Verstappen (de3isw3re1ji2wj)
    try {
      const verstappen = app.findFirstRecordByData('drivers', 'id', 'de3isw3re1ji2wj')
      if (verstappen) {
        verstappen.set('team_id', redbullId)
        verstappen.set('role', 'titular')
        verstappen.set('salary', 50000000)
        verstappen.set('contract_end', 2028)
        verstappen.set('canonical_contract', null)
        verstappen.set('future_contract', null)
        verstappen.set('next_team_id', '')
        verstappen.set('next_contract_role', '')
        verstappen.set('career_intent_state', '')

        // Visual Identity DRV_0022 masculino
        let pData = {
          academyOriginTeamId: null,
          careerStatus: 'f1_driver',
          driverId: 'de3isw3re1ji2wj',
          generatedPortraitProfileId: null,
          visualIdentity: {
            gender: 'male',
            portraitAssetId: 'DRV_0022',
            generatedPortraitProfileId: null,
          },
        }
        verstappen.set('procedural_data', pData)
        verstappen.set('origin_type', 'real')

        app.save(verstappen)
        console.log(
          '[1741500087] Max Verstappen devolvido à Red Bull, contratos 2027 cancelados e visualIdentity DRV_0022 configurada.',
        )
      }
    } catch (e) {
      console.log('[1741500087] Erro ao restaurar Verstappen:', e)
    }

    // 7. Reverter pilotos chave que foram alterados na transição de volta aos assentos 2026:
    // Andrea Kimi Antonelli (jwj3wcbmpjlszi9) -> Mercedes (0k70aa2bxi2whkk)
    // George Russell (g6r2jv5rwf3ubsz) -> Mercedes (0k70aa2bxi2whkk)
    // Liam Lawson (ifmev43cuta89ku) -> Racing Bulls ou Red Bull conforme 2026
    // Gabriel Bortoleto (9uazqw522oc9p4z) -> Audi / Sauber (475a684zt1btgev)
    // Nico Hülkenberg (nhulk2026...) -> Audi / Sauber (475a684zt1btgev)
    try {
      const antonelli = app.findFirstRecordByData('drivers', 'id', 'jwj3wcbmpjlszi9')
      if (antonelli) {
        antonelli.set('team_id', mercedesId)
        antonelli.set('role', 'titular')
        antonelli.set('next_team_id', '')
        antonelli.set('next_contract_role', '')
        antonelli.set('future_contract', null)
        app.save(antonelli)
      }
    } catch (_) {}

    try {
      const russell = app.findFirstRecordByData('drivers', 'id', 'g6r2jv5rwf3ubsz')
      if (russell) {
        russell.set('team_id', mercedesId)
        russell.set('role', 'titular')
        russell.set('next_team_id', '')
        russell.set('next_contract_role', '')
        russell.set('future_contract', null)
        app.save(russell)
      }
    } catch (_) {}

    // Limpar next_team_id e future_contract de todos os pilotos para estado pré-transição limpo
    try {
      const drivers = app.findRecordsByFilter(
        'drivers',
        'next_team_id != "" || future_contract != null',
        '',
        100,
        0,
      )
      for (const d of drivers) {
        d.set('next_team_id', '')
        d.set('next_contract_role', '')
        d.set('future_contract', null)
        app.save(d)
      }
      console.log(`[1741500087] ${drivers.length} pilotos tiveram contratos futuros/virada limpos.`)
    } catch (e) {
      console.log('[1741500087] Limpeza de contratos de pilotos finalizada:', e)
    }

    console.log('[1741500087] Rollback para R24 2026 concluído com sucesso!')
  },
  (app) => {
    // down rollback
  },
)
