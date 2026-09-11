import { useEffect, useRef } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'
import { realtimeService } from '@/services/realtimeService'

/**
 * Hook for real-time subscriptions to a PocketBase collection.
 * ALWAYS use this hook instead of subscribing inline.
 * Delegado ao realtimeService singleton para resiliência contra
 * "Invalid realtime client" (HTTP 400/404), garantindo reconexão e re-inscrição
 * com clientIds vigentes e sem quebra na UI da aplicação.
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

    const unsubscribe = realtimeService.subscribe<TRecord>(
      collectionName,
      (e) => {
        callbackRef.current(e)
      },
      '*',
    )

    return () => {
      unsubscribe()
    }
  }, [collectionName, enabled])
}

export default useRealtime
