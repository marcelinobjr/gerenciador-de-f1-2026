/**
 * driverPortraitBackfillService.ts
 *
 * Serviço de boot idempotente para migração e congelamento dos retratos de pilotos procedurais.
 *
 * Regras:
 * 1. Varre pilotos procedurais (origin_type === 'procedural' ou procedurais sem prefixo canônico).
 * 2. Se já possui generatedPortraitProfileId persistido, ignora sem tocar.
 * 3. Se não possui, calcula a foto estável (hash determinístico por seed original/driverId + gênero)
 *    e grava no registro em procedural_data.generatedPortraitProfileId e visualIdentity.
 * 4. Idempotência estrita: 1x = 10x. Execuções repetidas não alteram registros já congelados.
 * 5. Congela e preserva os pilotos existentes do usuário (Camila Carvalho, Sakura Ito, etc.).
 */

import pb from '@/lib/pocketbase/client'
import { assignGeneratedPortraitProfile } from '@/services/driverPortraitAssignmentService'
import { sanitizeDriverProceduralData } from '@/lib/sanitizeDriverProceduralData'

export interface BackfillDriverResult {
  driverId: string
  name: string
  action: 'skipped_already_frozen' | 'frozen' | 'error'
  profileId?: string
  portraitAssetId?: string
  error?: string
}

export interface BackfillReport {
  totalScanned: number
  alreadyFrozen: number
  newlyFrozen: number
  errors: number
  results: BackfillDriverResult[]
}

class DriverPortraitBackfillService {
  private hasRunInSession = false
  private runningPromise: Promise<BackfillReport> | null = null

  /**
   * Executa a rotina de backfill de retratos procedurais no banco.
   * Totalmente idempotente: pode ser chamado várias vezes sem efeitos colaterais.
   */
  public async runBackfill(force = false): Promise<BackfillReport> {
    if (this.hasRunInSession && !force) {
      return {
        totalScanned: 0,
        alreadyFrozen: 0,
        newlyFrozen: 0,
        errors: 0,
        results: [],
      }
    }

    if (this.runningPromise) {
      return this.runningPromise
    }

    this.runningPromise = this.executeBackfill()
    try {
      const report = await this.runningPromise
      this.hasRunInSession = true
      return report
    } finally {
      this.runningPromise = null
    }
  }

  private async executeBackfill(): Promise<BackfillReport> {
    const report: BackfillReport = {
      totalScanned: 0,
      alreadyFrozen: 0,
      newlyFrozen: 0,
      errors: 0,
      results: [],
    }

    try {
      // Busca todos os pilotos com origin_type === 'procedural'
      const records = await pb.collection('drivers').getFullList({
        filter: "origin_type = 'procedural'",
      })

      report.totalScanned = records.length

      for (const record of records) {
        const rawProcData = record.procedural_data || {}
        const existingProfileId =
          rawProcData.generatedPortraitProfileId ||
          rawProcData.visualIdentity?.generatedPortraitProfileId ||
          (rawProcData.visualIdentity?.portraitAssetId &&
          !rawProcData.visualIdentity.portraitAssetId.startsWith('DRV_') &&
          (rawProcData.visualIdentity.portraitAssetId.startsWith('Piloto') ||
            rawProcData.visualIdentity.portraitAssetId.startsWith('GEN_'))
            ? rawProcData.visualIdentity.portraitAssetId
            : null)

        // Se já tem foto congelada, ignora
        if (existingProfileId) {
          report.alreadyFrozen++
          report.results.push({
            driverId: record.id,
            name: record.name,
            action: 'skipped_already_frozen',
            profileId: existingProfileId,
            portraitAssetId: rawProcData.visualIdentity?.portraitAssetId || existingProfileId,
          })
          continue
        }

        // Determinar gênero a partir do registro
        const gender =
          rawProcData.visualIdentity?.gender || rawProcData.gender || record.gender || 'female' // default de fallback feminino se nome/contexto apontar ou masculino documentado

        // Obter semente estável (seed original do driverId ou id do registro)
        const stableSeed =
          rawProcData.driverId || rawProcData.visualIdentity?.visualSeed || record.id || record.name

        // Calcular foto determinística única
        const assigned = assignGeneratedPortraitProfile(gender, stableSeed)

        const updatedProcData = sanitizeDriverProceduralData(rawProcData, {
          ...rawProcData,
          generatedPortraitProfileId: assigned.profileId,
          visualIdentity: {
            ...(rawProcData.visualIdentity || {}),
            portraitAssetId: assigned.portraitAssetId,
            generatedPortraitProfileId: assigned.profileId,
            gender: assigned.gender,
          },
        })

        try {
          await pb.collection('drivers').update(record.id, {
            procedural_data: updatedProcData,
          })

          report.newlyFrozen++
          report.results.push({
            driverId: record.id,
            name: record.name,
            action: 'frozen',
            profileId: assigned.profileId,
            portraitAssetId: assigned.portraitAssetId,
          })
        } catch (err: any) {
          report.errors++
          report.results.push({
            driverId: record.id,
            name: record.name,
            action: 'error',
            error: err?.message || 'Falha ao atualizar registro',
          })
        }
      }
    } catch (fetchErr: any) {
      console.warn(
        'driverPortraitBackfillService: Falha ao carregar pilotos procedurais:',
        fetchErr,
      )
    }

    return report
  }

  /**
   * Congela em memória um objeto de piloto procedural se ainda não possuir portraitProfileId.
   * Útil para testes ou antes de salvar no banco.
   */
  public freezeDriverInMemory<
    T extends { id?: string; name?: string; origin_type?: string; procedural_data?: any },
  >(driver: T): T {
    if (!driver || driver.origin_type !== 'procedural') {
      return driver
    }

    const rawProc = driver.procedural_data || {}
    const existing =
      rawProc.generatedPortraitProfileId ||
      rawProc.visualIdentity?.generatedPortraitProfileId ||
      (rawProc.visualIdentity?.portraitAssetId &&
      !rawProc.visualIdentity.portraitAssetId.startsWith('DRV_') &&
      (rawProc.visualIdentity.portraitAssetId.startsWith('Piloto') ||
        rawProc.visualIdentity.portraitAssetId.startsWith('GEN_'))
        ? rawProc.visualIdentity.portraitAssetId
        : null)

    if (existing) {
      // Idempotente: se já existe, apenas assegura que ambos os campos estão harmonizados
      if (
        !rawProc.generatedPortraitProfileId ||
        !rawProc.visualIdentity?.generatedPortraitProfileId
      ) {
        return {
          ...driver,
          procedural_data: {
            ...rawProc,
            generatedPortraitProfileId: existing,
            visualIdentity: {
              ...(rawProc.visualIdentity || {}),
              portraitAssetId: rawProc.visualIdentity?.portraitAssetId || existing,
              generatedPortraitProfileId: existing,
            },
          },
        }
      }
      return driver
    }

    const gender = rawProc.visualIdentity?.gender || (driver as any).gender
    const seed = rawProc.driverId || driver.id || driver.name || 'proc_seed'
    const assigned = assignGeneratedPortraitProfile(gender, seed)

    const updatedProc = sanitizeDriverProceduralData(rawProc, {
      ...rawProc,
      generatedPortraitProfileId: assigned.profileId,
      visualIdentity: {
        ...(rawProc.visualIdentity || {}),
        portraitAssetId: assigned.portraitAssetId,
        generatedPortraitProfileId: assigned.profileId,
        gender: assigned.gender,
      },
    })

    return {
      ...driver,
      procedural_data: updatedProc,
    }
  }
}

export const driverPortraitBackfillService = new DriverPortraitBackfillService()
