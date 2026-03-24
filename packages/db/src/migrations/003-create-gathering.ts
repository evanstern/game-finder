import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE TYPE schedule_type AS ENUM ('once', 'weekly', 'biweekly', 'monthly')`.execute(db)
  await sql`CREATE TYPE gathering_status AS ENUM ('active', 'closed')`.execute(db)

  await db.schema
    .createTable('gathering')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('host_id', 'uuid', (col) =>
      col.notNull().references('users.id'),
    )
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('zip_code', 'varchar(10)', (col) => col.notNull())
    .addColumn('schedule_type', sql`schedule_type`, (col) => col.notNull())
    .addColumn('starts_at', 'timestamptz', (col) => col.notNull())
    .addColumn('end_date', 'date')
    .addColumn('duration_minutes', 'smallint')
    .addColumn('max_players', 'smallint')
    .addColumn('status', sql`gathering_status`, (col) =>
      col.notNull().defaultTo('active'),
    )
    .addColumn('next_occurrence_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute()

  await db.schema.createIndex('idx_gathering_host_id').on('gathering').column('host_id').execute()
  await db.schema.createIndex('idx_gathering_zip_code').on('gathering').column('zip_code').execute()
  await db.schema.createIndex('idx_gathering_next_occurrence_at').on('gathering').column('next_occurrence_at').execute()
  await db.schema.createIndex('idx_gathering_status').on('gathering').column('status').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('gathering').execute()
  await sql`DROP TYPE gathering_status`.execute(db)
  await sql`DROP TYPE schedule_type`.execute(db)
}
