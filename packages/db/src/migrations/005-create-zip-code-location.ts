import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('zip_code_location')
    .addColumn('zip_code', 'varchar(5)', (col) => col.primaryKey())
    .addColumn('city', 'varchar(100)', (col) => col.notNull())
    .addColumn('state', 'varchar(2)', (col) => col.notNull())
    .addColumn('latitude', sql`decimal(9,6)`, (col) => col.notNull())
    .addColumn('longitude', sql`decimal(9,6)`, (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('zip_code_location').execute()
}
