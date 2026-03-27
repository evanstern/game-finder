import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined')`.execute(
    db,
  )

  await db.schema
    .createTable('friendship')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('requester_id', 'uuid', (col) =>
      col.notNull().references('users.id'),
    )
    .addColumn('addressee_id', 'uuid', (col) =>
      col.notNull().references('users.id'),
    )
    .addColumn('status', sql`friendship_status`, (col) =>
      col.notNull().defaultTo('pending'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute()

  await db.schema
    .createIndex('uq_friendship_pair')
    .on('friendship')
    .columns(['requester_id', 'addressee_id'])
    .unique()
    .execute()

  await db.schema
    .createIndex('idx_friendship_addressee_id')
    .on('friendship')
    .column('addressee_id')
    .execute()

  await db.schema
    .createIndex('idx_friendship_requester_id')
    .on('friendship')
    .column('requester_id')
    .execute()

  await db.schema
    .createIndex('idx_friendship_status')
    .on('friendship')
    .column('status')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('friendship').execute()
  await sql`DROP TYPE friendship_status`.execute(db)
}
