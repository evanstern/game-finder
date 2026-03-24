import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import type { Database } from './types.js'
import { getDbConfig } from './env.js'

const { Pool } = pg

export function createDb(): Kysely<Database> {
  const config = getDbConfig()
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        max: 10,
      }),
    }),
  })
}
