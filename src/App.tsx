import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { CareerRoute } from '@/components/CareerRoute'
import { LobbyRoute } from '@/components/LobbyRoute'
import Layout from './components/Layout'
import { LobbyLayout } from './components/LobbyLayout'

// Pages
import Index from './pages/Index'
import AuthPage from './pages/Auth'
import TeamPage from './pages/Team'
import TeamsPage from './pages/Teams'
import CarPage from './pages/Car'
import SponsorsPage from './pages/Sponsors'
import RacePage from './pages/RaceSlimWrapper'
import SeasonEndPage from './pages/SeasonEndPage'
import StandingsPage from './pages/Standings'
import CalendarPage from './pages/CalendarPage'
import HistoryPage from './pages/History'

import InfrastructurePage from './pages/InfrastructurePage'
import TeamSelectionPage from './pages/TeamSelection'
import { LobbyPage } from './pages/LobbyPage'
import DriversPage from './pages/DriversPage'
import PaddockPage from './pages/PaddockPage'
import TracksPage from './pages/TracksPage'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* 1. Rota Pública de Autenticação */}
          <Route path="/auth" element={<AuthPage />} />

          {/* 2. Ambiente Lobby / Pré-Jogo (Guarded por LobbyRoute) */}
          <Route element={<LobbyRoute />}>
            <Route element={<LobbyLayout />}>
              <Route path="/lobby" element={<LobbyPage />} />
              <Route path="/selecionar-equipe" element={<LobbyPage />} />
            </Route>
          </Route>

          {/* 3. Ambiente Carreira (Guarded por CareerRoute) */}
          <Route element={<CareerRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/pilotos" element={<DriversPage />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/car" element={<CarPage />} />
              <Route path="/pistas" element={<TracksPage />} />
              <Route path="/pistas/:circuitId" element={<TracksPage />} />
              <Route path="/infraestrutura" element={<InfrastructurePage />} />
              <Route path="/sponsors" element={<SponsorsPage />} />
              <Route path="/race" element={<RacePage />} />
              <Route path="/season-end" element={<SeasonEndPage />} />
              <Route path="/standings" element={<StandingsPage />} />
              <Route path="/paddock" element={<PaddockPage />} />
              <Route path="/historico" element={<HistoryPage />} />
              <Route path="/regulamento" element={<Navigate to="/car?tab=regulamento" replace />} />
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
