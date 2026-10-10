export const ADMIN_EMAILS = ['m.blasques@multi.br.com']

export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
