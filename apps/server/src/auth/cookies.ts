const COOKIE_NAME = 'session_id'
const MAX_AGE = 60 * 60 * 24 * 7

export function parseCookies(header: string): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(
    header.split(';').map((c) => {
      const [key, ...val] = c.trim().split('=')
      return [key, val.join('=')]
    }),
  )
}

export function getSessionIdFromRequest(req: Request): string | undefined {
  const cookies = parseCookies(req.headers.get('cookie') ?? '')
  return cookies[COOKIE_NAME]
}

export function serializeSessionCookie(sessionId: string): string {
  const secure = process.env.NODE_ENV === 'production'
  return `${COOKIE_NAME}=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`
}

export function serializeClearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
}
