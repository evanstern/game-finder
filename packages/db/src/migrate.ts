import path from 'node:path'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FileMigrationProvider, Migrator } from 'kysely'
import { createDb } from './client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function migrateToLatest() {
  const db = createDb()

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  })

  const { error, results } = await migrator.migrateToLatest()

  for (const result of results ?? []) {
    if (result.status === 'Success') {
      console.log(`Migration "${result.migrationName}" executed successfully`)
    } else if (result.status === 'Error') {
      console.error(`Failed to execute migration "${result.migrationName}"`)
    }
  }

  if (error) {
    console.error('Migration failed')
    console.error(error)
    process.exit(1)
  }

  await db.destroy()
}

migrateToLatest()
