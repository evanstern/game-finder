import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { healthRoutes } from './routes/health.js'
import { createContext } from './trpc/context.js'
import { appRouter } from './trpc/router.js'

export const app = new Hono()

app.use('/*', cors())

app.route('/', healthRoutes)

app.use('/trpc/*', async (c) => {
  const response = await fetchRequestHandler({
    endpoint: '/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext,
  })
  return response
})
