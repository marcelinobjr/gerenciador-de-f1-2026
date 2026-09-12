import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { RouteLoadingScreen } from '@/components/CareerRoute'

/**
 * LobbyRoute: Guard para o ambiente de Pré-Jogo (Lobby / Seleção de Equipe).
 * Permite acesso apenas quando careerPhase === 'lobby'.
 * - 'loading': exibe o gate de loading
 * - 'auth': redireciona para /auth
 * - 'career': redireciona para / (carreira em andamento)
 */
export function LobbyRoute() {
  const { careerPhase } = useAuth()

  if (careerPhase === 'loading') {
    return <RouteLoadingScreen />
  }

  if (careerPhase === 'auth') {
    return <Navigate to="/auth" replace />
  }

  if (careerPhase === 'career') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export default LobbyRoute
