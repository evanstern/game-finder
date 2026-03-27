type DateStyleOption = 'medium' | 'short' | 'long'

interface ClientDateProps {
  date: string | Date | null
  fallback?: string
  dateStyle?: DateStyleOption
  showTime?: boolean
  className?: string
}

function formatDateValue(
  date: string | Date | null,
  dateStyle: DateStyleOption,
  showTime: boolean,
): string {
  if (!date) return ''
  const d = new Date(date)
  const datePart = d.toLocaleDateString('en-US', { dateStyle })
  if (!showTime) return datePart
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${datePart} at ${timePart}`
}

export function ClientDate({
  date,
  fallback = 'TBD',
  dateStyle = 'medium',
  showTime = false,
  className,
}: ClientDateProps) {
  const formatted = date ? formatDateValue(date, dateStyle, showTime) : fallback

  return (
    <span suppressHydrationWarning className={className}>
      {formatted}
    </span>
  )
}

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export function formatScheduleLabel(
  scheduleType: string,
  startsAt: string | Date,
): string {
  const d = new Date(startsAt)
  const day = DAYS[d.getDay()]
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  switch (scheduleType) {
    case 'once':
      return `One-time — ${d.toLocaleDateString('en-US')} at ${time}`
    case 'weekly':
      return `Weekly — ${day}s at ${time}`
    case 'biweekly':
      return `Every 2 weeks — ${day}s at ${time}`
    case 'monthly':
      return `Monthly — ${day}s at ${time}`
    default:
      return scheduleType
  }
}

interface ScheduleLabelProps {
  scheduleType: string
  startsAt: string | Date
  className?: string
}

export function ScheduleLabel({
  scheduleType,
  startsAt,
  className,
}: ScheduleLabelProps) {
  return (
    <span suppressHydrationWarning className={className}>
      {formatScheduleLabel(scheduleType, startsAt)}
    </span>
  )
}

export function toDatetimeLocal(date: Date): string {
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function toDateInput(date: Date): string {
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
