import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Global handler for unhandled promise rejections related to PocketBase realtime.
 * When SSE connection drops, sleeps or HMR reloads, the server may reply with
 * HTTP 400 "Invalid realtime client." inside pocketbase's internal finalizePendingSubscriptions.
 * We catch this silently, reset stale realtime subscriptions and let the client reconnect cleanly.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason
    const message =
      (typeof reason === 'string' ? reason : '') || reason?.message || reason?.data?.message || ''
    const url = reason?.url || reason?.response?.url || ''
    const status = reason?.status || reason?.response?.status

    const isRealtimeError =
      (status === 400 || !status) &&
      (url.includes('/api/realtime') ||
        message.includes('Invalid realtime client') ||
        message.includes('realtime') ||
        message.includes('EventSource'))

    if (isRealtimeError) {
      // Prevent Vite error overlay from popping up
      event.preventDefault?.()
      // Silently reset the stale realtime client state so a fresh connection can be established
      try {
        pb.realtime.unsubscribe().catch(() => {})
      } catch {
        // ignore
      }
    }
  })
}

export default pb
