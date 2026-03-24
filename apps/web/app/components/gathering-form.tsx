import { Button } from '@game-finder/ui/components/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@game-finder/ui/components/card'
import { Input } from '@game-finder/ui/components/input'
import { Label } from '@game-finder/ui/components/label'
import { Badge } from '@game-finder/ui/components/badge'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTRPC } from '../trpc/provider.js'
import { MarkdownEditor } from './markdown-editor.js'

interface GatheringFormData {
  title: string
  gameIds: string[]
  zipCode: string
  scheduleType: 'once' | 'weekly' | 'biweekly' | 'monthly'
  startsAt: string
  endDate: string
  durationMinutes: string
  maxPlayers: string
  description: string
}

interface GatheringFormProps {
  initialData?: Partial<GatheringFormData>
  onSubmit: (data: GatheringFormData) => void
  isPending: boolean
  submitLabel: string
  errors?: Record<string, string>
}

const SCHEDULE_OPTIONS = [
  { value: 'once', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
]

export function GatheringForm({
  initialData,
  onSubmit,
  isPending,
  submitLabel,
  errors = {},
}: GatheringFormProps) {
  const trpc = useTRPC()
  const { data: games = [] } = useQuery(trpc.game.list.queryOptions({}))

  const [title, setTitle] = useState(initialData?.title ?? '')
  const [gameIds, setGameIds] = useState<string[]>(initialData?.gameIds ?? [])
  const [zipCode, setZipCode] = useState(initialData?.zipCode ?? '')
  const [scheduleType, setScheduleType] = useState(initialData?.scheduleType ?? 'once')
  const [startsAt, setStartsAt] = useState(initialData?.startsAt ?? '')
  const [endDate, setEndDate] = useState(initialData?.endDate ?? '')
  const [durationMinutes, setDurationMinutes] = useState(initialData?.durationMinutes ?? '')
  const [maxPlayers, setMaxPlayers] = useState(initialData?.maxPlayers ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')

  const toggleGame = (gameId: string) => {
    setGameIds((prev) =>
      prev.includes(gameId)
        ? prev.filter((id) => id !== gameId)
        : [...prev, gameId],
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      title,
      gameIds,
      zipCode,
      scheduleType,
      startsAt,
      endDate,
      durationMinutes,
      maxPlayers,
      description,
    })
  }

  return (
    <Card className="border-border bg-card/80 backdrop-blur-sm">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold tracking-tight text-foreground">
            {submitLabel === 'Create Gathering' ? 'Create a Gathering' : 'Edit Gathering'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {errors.form && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <p className="text-sm text-destructive-foreground">{errors.form}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday Board Game Night" required />
              {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Games</Label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-border p-2 min-h-[40px]">
                {games.map((game) => (
                  <Badge
                    key={game.id}
                    variant={gameIds.includes(game.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleGame(game.id)}
                  >
                    {game.name}
                  </Badge>
                ))}
              </div>
              {errors.gameIds && <p className="text-sm text-destructive">{errors.gameIds}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="zipCode" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Zip Code</Label>
              <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="90210" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scheduleType" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Schedule</Label>
              <select
                id="scheduleType"
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as GatheringFormData['scheduleType'])}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
              >
                {SCHEDULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startsAt" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Date & Time</Label>
              <Input id="startsAt" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {scheduleType !== 'once' && (
              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">End Date</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="durationMinutes" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Duration (min)</Label>
              <Input id="durationMinutes" type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="180" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxPlayers" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Max Players</Label>
              <Input id="maxPlayers" type="number" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} placeholder="6" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Description (Markdown)</Label>
            <MarkdownEditor value={description} onChange={setDescription} placeholder="Describe your gathering..." />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Saving...' : submitLabel}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
