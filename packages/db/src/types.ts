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
  visibility: Generated<'public' | 'private'>
  join_code: string | null
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface GatheringGameTable {
  gathering_id: string
  game_id: string
}

export interface GatheringParticipantTable {
  id: Generated<string>
  gathering_id: string
  user_id: string
  status: 'joined' | 'waitlisted'
  created_at: Generated<Date>
}

export interface FriendshipTable {
  id: Generated<string>
  requester_id: string
  addressee_id: string
  status: Generated<'pending' | 'accepted' | 'declined'>
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

export interface SessionTable {
  id: Generated<string>
  user_id: string
  created_at: Generated<Date>
  expires_at: Date
}

export interface Database {
  users: UsersTable
  game: GameTable
  gathering: GatheringTable
  gathering_game: GatheringGameTable
  gathering_participant: GatheringParticipantTable
  zip_code_location: ZipCodeLocationTable
  friendship: FriendshipTable
  session: SessionTable
}
