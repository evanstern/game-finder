import Redis from 'ioredis'
import { getRedisConfig } from './env.js'

export function createRedisClient(): Redis {
  const config = getRedisConfig()
  return new Redis({
    host: config.host,
    port: config.port,
  })
}
