import type { Generated } from 'kysely'

export interface UsersTable {
  id: Generated<string>
  email: string
  password_hash: string
  display_name: string
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface GameTable {
  id: Generated<string>
  name: string
  type: 'board_game' | 'ttrpg' | 'card_game'
  description: string
  min_players: number
  max_players: number
  image_url: string | null
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface GatheringTable {
  id: Generated<string>
  host_id: string
  title: string
  description: string
  zip_code: string
  schedule_type: 'once' | 'weekly' | 'biweekly' | 'monthly'
  starts_at: Date
  end_date: Date | null
  duration_minutes: number | null
  max_players: number | null
  status: Generated<'active' | 'closed'>
  next_occurrence_at: Date | null
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface GatheringGameTable {
  gathering_id: string
  game_id: string
}

export interface Database {
  users: UsersTable
  game: GameTable
  gathering: GatheringTable
  gathering_game: GatheringGameTable
}
