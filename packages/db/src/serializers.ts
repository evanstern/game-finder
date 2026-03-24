import type { Selectable } from 'kysely'
import type { UsersTable, GameTable, GatheringTable } from './types.js'

export function serializeUser(row: Selectable<UsersTable>) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
  }
}

export function serializeGame(row: Selectable<GameTable>) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function serializeGathering(row: Selectable<GatheringTable>) {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    description: row.description,
    zipCode: row.zip_code,
    scheduleType: row.schedule_type,
    startsAt: row.starts_at,
    endDate: row.end_date,
    durationMinutes: row.duration_minutes,
    maxPlayers: row.max_players,
    status: row.status,
    nextOccurrenceAt: row.next_occurrence_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
