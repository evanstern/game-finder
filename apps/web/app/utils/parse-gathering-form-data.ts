export function parseGatheringFormData(formData: FormData) {
  return {
    title: String(formData.get('title') ?? ''),
    gameIds: formData.getAll('gameIds').map(String),
    zipCode: String(formData.get('zipCode') ?? ''),
    scheduleType: String(formData.get('scheduleType') ?? 'once') as
      | 'once'
      | 'weekly'
      | 'biweekly'
      | 'monthly',
    startsAt: new Date(String(formData.get('startsAt'))).toISOString(),
    endDate: formData.get('endDate')
      ? new Date(String(formData.get('endDate'))).toISOString()
      : null,
    durationMinutes: formData.get('durationMinutes')
      ? Number.parseInt(String(formData.get('durationMinutes')), 10)
      : null,
    maxPlayers: formData.get('maxPlayers')
      ? Number.parseInt(String(formData.get('maxPlayers')), 10)
      : null,
    description: String(formData.get('description') ?? ''),
    visibility: String(formData.get('visibility') ?? 'public') as
      | 'public'
      | 'private',
  }
}
