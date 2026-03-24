import type { Generated } from 'kysely'

export interface UsersTable {
  id: Generated<string>
  email: string
  password_hash: string
  display_name: string
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface Database {
  users: UsersTable
}
