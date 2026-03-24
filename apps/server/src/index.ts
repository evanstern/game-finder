import { serve } from '@hono/node-server'
import { app } from './app.js'

if (!process.env.PORT) {
  throw new Error('Missing required environment variable: PORT')
}
const port = Number.parseInt(process.env.PORT, 10)

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`)
})
