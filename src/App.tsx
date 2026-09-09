import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from './components/Layout'

// Pages
import Index from './pages/Index'
import AuthPage from './pages/Auth'
import TeamPage from './pages/Team'
import TeamsPage from './pages/Teams'
import CarPage from './pages/Car'
import SponsorsPage from './pages/Sponsors'
import RacePage from './pages/Race'
import StandingsPage from './pages/Standings'
import CalendarPage from './pages/Calendar'
import TeamSelectionPage from './pages/TeamSelection'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Public Route */}
          <Route path="/auth" element={<AuthPage />} />

          {/* Team Selection Route for authenticated users without a team */}
          <Route path="/selecionar-equipe" element={<TeamSelectionPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/car" element={<CarPage />} />
              <Route path="/sponsors" element={<SponsorsPage />} />
              <Route path="/race" element={<RacePage />} />
              <Route path="/standings" element={<StandingsPage />} />
              <Route path="/calendario" element={<CalendarPage />} />
            </Route>
          </Route>

          {/* Fallback 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
