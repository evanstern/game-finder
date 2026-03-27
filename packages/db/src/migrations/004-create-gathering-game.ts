import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('gathering_game')
    .addColumn('gathering_id', 'uuid', (col) =>
      col.notNull().references('gathering.id').onDelete('cascade'),
    )
    .addColumn('game_id', 'uuid', (col) => col.notNull().references('game.id'))
    .addPrimaryKeyConstraint('pk_gathering_game', ['gathering_id', 'game_id'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('gathering_game').execute()
}
