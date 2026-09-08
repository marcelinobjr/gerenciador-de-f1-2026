import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] text-[#F5F7FA] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-[#E10600] animate-spin mb-4" />
        <p className="font-mono text-sm text-[#8B95A7] tracking-wider uppercase">
          Carregando telemetria F1 2026...
        </p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return <Outlet />
}
