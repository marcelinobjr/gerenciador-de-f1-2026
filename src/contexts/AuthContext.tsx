import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'
import { f1Service } from '@/services/f1Service'
import { TeamModel, SeasonModel } from '@/types/f1'

export type CareerPhase = 'loading' | 'auth' | 'lobby' | 'career'

interface AuthContextType {
  user: RecordModel | null
  team: TeamModel | null
  season: SeasonModel | null
  isLoading: boolean
  careerPhase: CareerPhase
  refreshTeamAndSeason: () => Promise<void>
  resetGame: () => Promise<void>
  login: (email: string, pass: string) => Promise<TeamModel | null>
  register: (name: string, email: string, pass: string) => Promise<TeamModel | null>
  logout: () => void
  ensureValidSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.record)
  const [team, setTeam] = useState<TeamModel | null>(null)
  const [season, setSeason] = useState<SeasonModel | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadUserData = async (currentUserId: string): Promise<TeamModel | null> => {
    let resolvedTeam: TeamModel | null = null
    try {
      resolvedTeam = await f1Service.getPlayerTeam(currentUserId)
      setTeam(resolvedTeam)

      if (resolvedTeam) {
        try {
          const playerSeason = await f1Service.getSeasonByTeam(resolvedTeam.id)
          setSeason(playerSeason)
        } catch (seasonErr) {
          console.warn('[AuthProvider] Falha não impeditiva ao consultar temporada:', seasonErr)
          setSeason(null)
        }
      } else {
        setSeason(null)
      }
    } catch (e) {
      console.error('[AuthProvider] Erro ao carregar dados do usuário:', e)
      setTeam(null)
      setSeason(null)
    }
    return resolvedTeam
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
      // Renovar token preventivamente para manter a sessão válida ao iniciar o app
      pb.collection('users')
        .authRefresh()
        .catch((err) => {
          console.warn('[AuthProvider] authRefresh inicial falhou:', err)
          pb.authStore.clear()
        })
        .finally(() => {
          if (pb.authStore.record?.id) {
            loadUserData(pb.authStore.record.id).finally(() => {
              setIsLoading(false)
            })
          } else {
            setIsLoading(false)
          }
        })
    } else {
      setIsLoading(false)
    }

    return () => {
      unsub()
    }
  }, [])

  // Estado derivado careerPhase de acordo com as regras:
  // - loading enquanto usuário/equipe/temporada ainda estiverem sendo carregados
  // - auth quando não houver usuário autenticado
  // - lobby quando houver usuário autenticado, mas não houver equipe/carreira
  // - career quando houver usuário + equipe válidos
  let careerPhase: CareerPhase = 'loading'
  if (isLoading) {
    careerPhase = 'loading'
  } else if (!user) {
    careerPhase = 'auth'
  } else if (!team) {
    careerPhase = 'lobby'
  } else {
    careerPhase = 'career'
  }

  const login = async (email: string, pass: string): Promise<TeamModel | null> => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    setUser(authData.record)
    setIsLoading(false)
    let teamResult: TeamModel | null = null
    if (authData.record?.id) {
      teamResult = await loadUserData(authData.record.id)
    }
    return teamResult
  }

  const register = async (name: string, email: string, pass: string): Promise<TeamModel | null> => {
    await pb.collection('users').create({
      name,
      email,
      password: pass,
      passwordConfirm: pass,
    })
    return await login(email, pass)
  }

  const resetGame = async () => {
    if (!user?.id) {
      throw new Error('Usuário não autenticado.')
    }
    await f1Service.resetPlayerProgress(user.id)
    setTeam(null)
    setSeason(null)
  }

  const ensureValidSession = async (): Promise<boolean> => {
    if (!pb.authStore.isValid || !pb.authStore.record) {
      logout()
      return false
    }
    try {
      await pb.collection('users').authRefresh()
      return true
    } catch {
      logout()
      return false
    }
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
        careerPhase,
        refreshTeamAndSeason,
        resetGame,
        login,
        register,
        logout,
        ensureValidSession,
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
