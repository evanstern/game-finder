import { getSessionIdFromRequest } from '../auth/cookies.js'
import { getSession } from '../auth/session.js'
import { db } from '../db.js'

export async function createContext({
  req,
  resHeaders,
}: {
  req: Request
  resHeaders: Headers
}) {
  let userId: string | null = null
  let sessionId: string | null = null

  const cookieSessionId = getSessionIdFromRequest(req)
  if (cookieSessionId) {
    const session = await getSession(db, cookieSessionId)
    if (session) {
      userId = session.userId
      sessionId = cookieSessionId
    }
  }

  return { db, userId, sessionId, resHeaders }
}

export type Context = Awaited<ReturnType<typeof createContext>>
