import type { ScheduleType } from '@game-finder/contracts/gathering'

export function computeNextOccurrence(
  scheduleType: ScheduleType,
  startsAt: Date,
  endDate: Date | null,
): Date | null {
  const now = new Date()

  if (scheduleType === 'once') {
    return startsAt
  }

  if (startsAt.getTime() > now.getTime()) {
    return checkEndDate(startsAt, endDate)
  }

  if (scheduleType === 'monthly') {
    return computeNextMonthly(startsAt, endDate)
  }

  const intervalMs = getIntervalMs(scheduleType)
  const elapsed = now.getTime() - startsAt.getTime()
  const periods = Math.ceil(elapsed / intervalMs)
  const next = new Date(startsAt.getTime() + periods * intervalMs)

  return checkEndDate(next, endDate)
}

function getIntervalMs(scheduleType: ScheduleType): number {
  const week = 7 * 24 * 60 * 60 * 1000
  switch (scheduleType) {
    case 'weekly':
      return week
    case 'biweekly':
      return 2 * week
    default:
      return week
  }
}

function computeNextMonthly(startsAt: Date, endDate: Date | null): Date | null {
  const now = new Date()
  const dayOfMonth = startsAt.getDate()
  const hours = startsAt.getHours()
  const minutes = startsAt.getMinutes()

  let candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    dayOfMonth,
    hours,
    minutes,
    0,
    0,
  )

  if (candidate.getTime() <= now.getTime()) {
    candidate = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      dayOfMonth,
      hours,
      minutes,
      0,
      0,
    )
  }

  return checkEndDate(candidate, endDate)
}

function checkEndDate(date: Date, endDate: Date | null): Date | null {
  if (!endDate) return date
  if (date.getTime() > endDate.getTime()) return null
  return date
}
