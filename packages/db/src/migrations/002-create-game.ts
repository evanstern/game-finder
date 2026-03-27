import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE TYPE game_type AS ENUM ('board_game', 'ttrpg', 'card_game')`.execute(
    db,
  )

  await db.schema
    .createTable('game')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('type', sql`game_type`, (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('min_players', 'smallint', (col) => col.notNull())
    .addColumn('max_players', 'smallint', (col) => col.notNull())
    .addColumn('image_url', 'varchar(500)')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute()

  await db.schema
    .createIndex('idx_game_type')
    .on('game')
    .column('type')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('game').execute()
  await sql`DROP TYPE game_type`.execute(db)
}
