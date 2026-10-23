import pb from '@/lib/pocketbase/client'

export async function runTeamProbe() {
  const res = await pb.send('/backend/v1/test-team-create-probe', { method: 'POST' })
  console.log('[PROBE_RESULT]', res)
  return res
}
