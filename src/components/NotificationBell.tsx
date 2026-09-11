import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Bell,
  CheckCheck,
  Radio,
  BadgePercent,
  Wrench,
  Scale,
  Shield,
  HeartPulse,
  Flag,
  Settings,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { F1NotificationModel, F1NotificationType } from '@/types/f1'
import { notificationService } from '@/services/notificationService'
import { notificationGenerator } from '@/services/notificationGenerator'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { f1Service } from '@/services/f1Service'

interface NotificationBellProps {
  currentRound?: number
  userId?: string
}

export function NotificationBell({
  currentRound: propRound,
  userId: propUserId,
}: NotificationBellProps) {
  const { user, team, season } = useAuth()
  const effectiveUserId = propUserId || user?.id
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<F1NotificationModel[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Ocultar sino durante corrida ao vivo na aba Corrida
  // Detecta se a aba é /race e se uma simulação ao vivo está ativa no DOM ou storage
  const [isLiveActive, setIsLiveActive] = useState(false)

  useEffect(() => {
    const checkLiveState = () => {
      if (location.pathname !== '/race') {
        setIsLiveActive(false)
        return
      }
      const liveRunning =
        document.body.getAttribute('data-live-race-running') === 'true' ||
        window.sessionStorage.getItem('f1_live_race_running') === 'true'
      setIsLiveActive(liveRunning)
    }

    checkLiveState()
    const interval = setInterval(checkLiveState, 1000)
    return () => clearInterval(interval)
  }, [location.pathname])

  const loadNotifications = async () => {
    if (!effectiveUserId) return
    const items = await notificationService.getNotifications(effectiveUserId, 30)
    setNotifications(items)
  }

  // Carrega notificações ao montar e quando user mudar
  useEffect(() => {
    loadNotifications()
    const timer = setInterval(loadNotifications, 10000)
    return () => clearInterval(timer)
  }, [effectiveUserId])

  // Realtime updates para coleção de notificações e eventos
  useRealtime('notifications', () => {
    loadNotifications()
  })
  useRealtime('events', () => {
    loadNotifications()
  })

  // Avaliação do estado do jogo (motor, teto FIA, patrocínios, lesões) para gerar notificações sem duplicar
  useEffect(() => {
    if (!effectiveUserId || !team || !season) return

    const evaluateGameState = async () => {
      try {
        const [drivers, sponsors, parts] = await Promise.all([
          f1Service.getTeamDrivers(team.id),
          f1Service.getTeamSponsors(team.id),
          f1Service.getTeamParts(team.id),
        ])

        await notificationGenerator.evaluateRoundEvents({
          userId: effectiveUserId,
          team,
          season,
          drivers,
          sponsors,
          parts,
        })
        await loadNotifications()
      } catch (err) {
        console.warn('Erro ao avaliar notificações automáticas de estado:', err)
      }
    }

    evaluateGameState()
  }, [effectiveUserId, team?.id, season?.current_round])

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Ao abrir o sino: marcar todas como lidas (badge zera) e salvar no banco por usuário
  const handleToggleOpen = async () => {
    const willOpen = !open
    setOpen(willOpen)
    if (willOpen && effectiveUserId) {
      const hasUnread = notifications.some((n) => !n.read)
      if (hasUnread) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        await notificationService.markAllAsRead(effectiveUserId)
      }
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!effectiveUserId) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await notificationService.markAllAsRead(effectiveUserId)
  }

  const handleNotificationClick = async (n: F1NotificationModel) => {
    if (effectiveUserId && !n.read) {
      await notificationService.markAsRead(n.id, effectiveUserId)
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)),
      )
    }
    setOpen(false)
    if (n.link) {
      navigate(n.link)
    }
  }

  // Ocultar sino durante corrida ao vivo na aba Corrida (requisito do prompt)
  if (location.pathname === '/race' && isLiveActive) {
    return null
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const getNotificationIcon = (type: F1NotificationType) => {
    switch (type) {
      case 'radio':
        return <Radio className="w-4 h-4 text-sky-400 shrink-0" />
      case 'patrocinio':
        return <BadgePercent className="w-4 h-4 text-emerald-400 shrink-0" />
      case 'motor':
        return <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
      case 'fia':
        return <Scale className="w-4 h-4 text-red-400 shrink-0" />
      case 'rival':
        return <Shield className="w-4 h-4 text-purple-400 shrink-0" />
      case 'lesao':
        return <HeartPulse className="w-4 h-4 text-rose-400 shrink-0" />
      case 'corrida':
        return <Flag className="w-4 h-4 text-yellow-400 shrink-0" />
      case 'sistema':
      default:
        return <Settings className="w-4 h-4 text-zinc-400 shrink-0" />
    }
  }

  const activeRound = propRound ?? season?.current_round ?? 1

  const getRelativeTimeText = (n: F1NotificationModel) => {
    if (n.round !== undefined) {
      const diff = activeRound - n.round
      if (diff === 0) return 'Rodada atual'
      if (diff === 1) return 'Há 1 rodada'
      if (diff > 1) return `Há ${diff} rodadas`
    }
    if (n.created) {
      const diffMs = Date.now() - new Date(n.created).getTime()
      const diffMin = Math.floor(diffMs / 60000)
      if (diffMin < 2) return 'Agora'
      if (diffMin < 60) return `Há ${diffMin} min`
      const diffHours = Math.floor(diffMin / 60)
      if (diffHours < 24) return `Hoje (${diffHours}h)`
      const diffDays = Math.floor(diffHours / 24)
      return `Há ${diffDays}d`
    }
    return 'Hoje'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão de Sino com Badge de Não Lidas */}
      <button
        type="button"
        onClick={handleToggleOpen}
        className={`relative w-8 h-8 rounded-lg bg-[#0F141F] border transition-colors flex items-center justify-center ${
          open
            ? 'border-[#E10600] text-white'
            : 'border-[#1F2733] text-[#8B95A7] hover:text-white hover:border-[#E10600]/40'
        }`}
        title="Notificações e Avisos"
        aria-label="Abrir notificações"
      >
        <Bell className="w-3.5 h-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#E10600] text-[10px] font-bold text-white shadow-[0_0_8px_#E10600]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown de Notificações: mobile full width, desktop painel elegante */}
      {open && (
        <div className="fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:w-[380px] z-50 bg-[#0B0E14] border border-[#1F2733] rounded-xl shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header do Dropdown */}
          <div className="px-4 py-3 border-b border-[#1F2733] flex items-center justify-between bg-[#0F141F]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#E10600]" />
              <span className="font-bold text-sm text-white">Notificações</span>
              {unreadCount > 0 ? (
                <Badge className="bg-[#E10600] text-white text-[10px] px-1.5 py-0 h-4">
                  {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-[#1F2733] text-[#8B95A7] text-[10px] px-1.5 py-0 h-4"
                >
                  Todas lidas
                </Badge>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-xs h-7 text-[#8B95A7] hover:text-white hover:bg-[#1A2230] flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Marcar todas como lidas</span>
            </Button>
          </div>

          {/* Lista de Notificações com Scroll Interno (máx 30 itens) */}
          <ScrollArea className="max-h-[380px] overflow-y-auto divide-y divide-[#1F2733]/60">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center text-[#8B95A7] text-xs space-y-1">
                <Bell className="w-6 h-6 mx-auto text-[#1F2733] mb-2" />
                <p className="font-medium text-white">Nenhuma notificação no momento</p>
                <p className="text-[11px] text-[#8B95A7]">
                  Eventos de corrida, rádio, patrocínios e motor aparecerão aqui.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.read
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 text-left hover:bg-[#111622] ${
                      isUnread ? 'bg-[#0E1522]' : 'bg-transparent'
                    }`}
                  >
                    <div className="mt-0.5 p-1.5 rounded-lg bg-[#161D2A] border border-[#1F2733]">
                      {getNotificationIcon(n.type)}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h4
                          className={`text-xs font-semibold truncate ${
                            isUnread ? 'text-white font-bold' : 'text-[#BAC4D6]'
                          }`}
                        >
                          {n.title}
                        </h4>
                        <span className="text-[10px] font-mono text-[#6A768A] shrink-0">
                          {getRelativeTimeText(n)}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#8B95A7] leading-relaxed line-clamp-2">
                        {n.message}
                      </p>

                      {n.link && (
                        <div className="pt-0.5 flex items-center gap-1 text-[10px] text-[#00A6FB] hover:underline">
                          <span>Ver detalhes</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>

                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-[#E10600] shrink-0 mt-1.5" />
                    )}
                  </div>
                )
              })
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
