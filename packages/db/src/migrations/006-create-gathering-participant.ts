import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE TYPE gathering_visibility AS ENUM ('public', 'private')`.execute(
    db,
  )
  await sql`CREATE TYPE participant_status AS ENUM ('joined', 'waitlisted')`.execute(
    db,
  )

  await db.schema
    .createTable('gathering_participant')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('gathering_id', 'uuid', (col) =>
      col.notNull().references('gathering.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id'))
    .addColumn('status', sql`participant_status`, (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute()

  await db.schema
    .createIndex('idx_gathering_participant_gathering_id')
    .on('gathering_participant')
    .column('gathering_id')
    .execute()

  await db.schema
    .createIndex('idx_gathering_participant_user_id')
    .on('gathering_participant')
    .column('user_id')
    .execute()

  await db.schema
    .createIndex('uq_gathering_participant')
    .on('gathering_participant')
    .columns(['gathering_id', 'user_id'])
    .unique()
    .execute()

  await db.schema
    .alterTable('gathering')
    .addColumn('visibility', sql`gathering_visibility`, (col) =>
      col.notNull().defaultTo('public'),
    )
    .execute()

  await db.schema
    .alterTable('gathering')
    .addColumn('join_code', 'varchar(8)')
    .execute()

  await db.schema
    .createIndex('uq_gathering_join_code')
    .on('gathering')
    .column('join_code')
    .unique()
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('gathering').dropColumn('join_code').execute()
  await db.schema.alterTable('gathering').dropColumn('visibility').execute()
  await db.schema.dropTable('gathering_participant').execute()
  await sql`DROP TYPE participant_status`.execute(db)
  await sql`DROP TYPE gathering_visibility`.execute(db)
}
