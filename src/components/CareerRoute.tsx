import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

/**
 * LoadingScreen padrão do F1 Manager 2026 para proteger contra flash de rota ou race conditions.
 */
export function RouteLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F5F7FA] flex flex-col items-center justify-center p-4">
      <Loader2 className="w-10 h-10 text-[#E10600] animate-spin mb-4" />
      <p className="font-mono text-sm text-[#8B95A7] tracking-wider uppercase">
        Carregando APEX GP Manager...
      </p>
    </div>
  )
}

/**
 * CareerRoute: Guard para o ambiente de Carreira.
 * Permite acesso apenas quando careerPhase === 'career'.
 * - 'loading': exibe o gate de loading
 * - 'auth': redireciona para /auth
 * - 'lobby': redireciona para /lobby
 */
export function CareerRoute() {
  const { careerPhase } = useAuth()

  if (careerPhase === 'loading') {
    return <RouteLoadingScreen />
  }

  if (careerPhase === 'auth') {
    return <Navigate to="/auth" replace />
  }

  if (careerPhase === 'lobby') {
    return <Navigate to="/lobby" replace />
  }

  return <Outlet />
}

export default CareerRoute
