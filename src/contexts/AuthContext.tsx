import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'
import { f1Service } from '@/services/f1Service'
import { TeamModel, SeasonModel } from '@/types/f1'

interface AuthContextType {
  user: RecordModel | null
  team: TeamModel | null
  season: SeasonModel | null
  isLoading: boolean
  refreshTeamAndSeason: () => Promise<void>
  login: (email: string, pass: string) => Promise<void>
  register: (name: string, email: string, pass: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.record)
  const [team, setTeam] = useState<TeamModel | null>(null)
  const [season, setSeason] = useState<SeasonModel | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadUserData = async (currentUserId: string) => {
    try {
      let playerTeam = await f1Service.getPlayerTeam(currentUserId)
      if (!playerTeam) {
        // Fallback: If user has no team (e.g. newly registered), create default team & season & parts & initial sponsor
        const newTeam = await pb.collection('teams').create<TeamModel>({
          name: 'Escuderia Brasil',
          color: '#FF3B30',
          chassis_level: 50,
          aero_level: 50,
          strategy_level: 50,
          budget: 150000000,
          engine_supplier: 'Mercedes',
          user_id: currentUserId,
        })
        playerTeam = newTeam

        // create season
        await pb.collection('seasons').create({
          year: 2026,
          current_round: 1,
          total_rounds: 24,
          team_id: newTeam.id,
        })

        // create 6 parts
        const partNames = [
          'Chassi',
          'Asa dianteira',
          'Asa traseira',
          'Assoalho',
          'Suspensão',
          'Aerodinâmica ativa',
        ]
        for (const pName of partNames) {
          await pb.collection('parts').create({
            name: pName,
            level: 5,
            team_id: newTeam.id,
          })
        }

        // initial sponsor
        await pb.collection('sponsors').create({
          name: 'Banco do Brasil',
          value_per_round: 30000000,
          requirement: 'Sem exigência',
          status: 'ativo',
          rounds_remaining: 24,
          team_id: newTeam.id,
        })

        // initial event
        await pb.collection('events').create({
          message: 'Sua jornada na temporada 2026 começa!',
          type: 'contrato',
          team_id: newTeam.id,
        })

        // assign Bortoleto and Fittipaldi if they have no team
        try {
          const unassigned = await pb.collection('drivers').getFullList({
            filter: 'name = "Gabriel Bortoleto" || name = "Pietro Fittipaldi"',
          })
          for (const d of unassigned) {
            await pb.collection('drivers').update(d.id, { team_id: newTeam.id })
          }
        } catch {
          /* intentionally ignored */
        }
      }

      setTeam(playerTeam)

      if (playerTeam) {
        const playerSeason = await f1Service.getSeasonByTeam(playerTeam.id)
        setSeason(playerSeason)
      }
    } catch (e) {
      console.error('Error loading team and season:', e)
    }
  }

  const refreshTeamAndSeason = async () => {
    if (pb.authStore.record?.id) {
      await loadUserData(pb.authStore.record.id)
    }
  }

  useEffect(() => {
    const unsub = pb.authStore.onChange(async (_token, record) => {
      setUser(record)
      if (record?.id) {
        await loadUserData(record.id)
      } else {
        setTeam(null)
        setSeason(null)
      }
    })

    if (pb.authStore.isValid && pb.authStore.record?.id) {
      loadUserData(pb.authStore.record.id).finally(() => {
        setIsLoading(false)
      })
    } else {
      setIsLoading(false)
    }

    return () => {
      unsub()
    }
  }, [])

  const login = async (email: string, pass: string) => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    setUser(authData.record)
    await loadUserData(authData.record.id)
  }

  const register = async (name: string, email: string, pass: string) => {
    await pb.collection('users').create({
      name,
      email,
      password: pass,
      passwordConfirm: pass,
    })
    await login(email, pass)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setTeam(null)
    setSeason(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        team,
        season,
        isLoading,
        refreshTeamAndSeason,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
