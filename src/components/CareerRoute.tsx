import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
 * ErrorScreen exibida quando a consulta de carreira falha por rede/servidor.
 * NUNCA redireciona para /setup — mantém tela com botão de retentativa para evitar loop.
 */
export function CareerErrorScreen({
  onRetry,
  errorMsg,
}: {
  onRetry: () => void
  errorMsg?: string | null
}) {
  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F5F7FA] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Não foi possível verificar sua carreira</h2>
      <p className="text-sm text-[#8B95A7] max-w-md mb-6 leading-relaxed">
        {errorMsg ||
          'Houve uma instabilidade na conexão com os servidores. Sua carreira permanece salva.'}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={onRetry}
          className="bg-[#E10600] hover:bg-[#B30500] text-white font-semibold flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </Button>
      </div>
    </div>
  )
}

/**
 * CareerRoute: Guard para o ambiente de Carreira.
 * Permite acesso apenas quando careerPhase === 'career'.
 * - 'loading': exibe o gate de loading
 * - 'auth': redireciona para /auth
 * - 'error': exibe tela de erro com retentativa (NÃO redireciona para /setup)
 * - 'lobby': redireciona para /setup APENAS quando confirmado que NÃO existe equipe ativa
 */
export function CareerRoute() {
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

export default CareerRoute
