import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { RouteLoadingScreen } from '@/components/CareerRoute'

/**
 * ProtectedRoute: Mantido por compatibilidade histórica, delegando para CareerRoute.
 * A nova arquitetura utiliza CareerRoute e LobbyRoute como os guards principais.
 */
export function ProtectedRoute() {
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

export default ProtectedRoute
