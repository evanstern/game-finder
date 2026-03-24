import type { Generated } from 'kysely'

export interface UsersTable {
  id: Generated<string>
  email: string
  password_hash: string
  display_name: string
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface ZipCodeLocationTable {
  zip_code: string
  city: string
  state: string
  latitude: number
  longitude: number
}

export interface Database {
  users: UsersTable
  zip_code_location: ZipCodeLocationTable
}
