import { useEffect, useRef } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

/**
 * Hook for real-time subscriptions to a PocketBase collection.
 * ALWAYS use this hook instead of subscribing inline.
 * Uses the per-listener UnsubscribeFunc so multiple components
 * can safely subscribe to the same collection without conflicts.
 *
 * Generic over the record type: pass your collection's interface as
 * `useRealtime<MyRecord>(...)` to get a typed subscription payload
 * instead of `unknown`.
 */
export function useRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false
    let retryTimeout: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const maxRetries = 3

    const subscribeWithRetry = () => {
      if (cancelled) return

      pb.collection<TRecord>(collectionName)
        .subscribe('*', (e) => {
          callbackRef.current(e)
        })
        .then((fn) => {
          if (cancelled) {
            fn().catch(() => {})
          } else {
            unsubscribeFn = fn
            attempts = 0 // reset attempts on success
          }
        })
        .catch((err) => {
          // Silent retry with backoff on failure (e.g. 400 Invalid realtime client or network glitch)
          if (cancelled) return
          if (attempts < maxRetries) {
            attempts += 1
            const delay = Math.min(1000 * Math.pow(2, attempts - 1), 4000) // 1s, 2s, 4s
            // Clear stale state before retry
            pb.realtime.unsubscribe().catch(() => {})
            retryTimeout = setTimeout(() => {
              subscribeWithRetry()
            }, delay)
          }
        })
    }

    subscribeWithRetry()

    return () => {
      cancelled = true
      if (retryTimeout) {
        clearTimeout(retryTimeout)
      }
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled])
}

export default useRealtime
