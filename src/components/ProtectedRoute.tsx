import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { RouteLoadingScreen, CareerErrorScreen } from '@/components/CareerRoute'

/**
 * ProtectedRoute: Mantido por compatibilidade histórica, delegando para CareerRoute.
 * A nova arquitetura utiliza CareerRoute e LobbyRoute como os guards principais.
 */
export function ProtectedRoute() {
  const { careerPhase, refreshTeamAndSeason, loadError } = useAuth()

  if (careerPhase === 'loading') {
    return <RouteLoadingScreen />
  }

  if (careerPhase === 'auth') {
    return <Navigate to="/auth" replace />
  }

  if (careerPhase === 'error') {
    return <CareerErrorScreen onRetry={refreshTeamAndSeason} errorMsg={loadError} />
  }

  if (careerPhase === 'lobby') {
    return <Navigate to="/setup" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
