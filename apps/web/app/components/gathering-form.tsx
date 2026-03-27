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
import {
  RadioGroup,
  RadioGroupItem,
} from '@game-finder/ui/components/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@game-finder/ui/components/select'
import { useState } from 'react'
import { Form } from 'react-router'
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
  visibility: 'public' | 'private'
}

interface GatheringFormProps {
  initialData?: Partial<GatheringFormData>
  games: Array<{ id: string; name: string }>
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
  games,
  isPending,
  submitLabel,
  errors = {},
}: GatheringFormProps) {
  const [gameIds, setGameIds] = useState<string[]>(initialData?.gameIds ?? [])
  const [scheduleType, setScheduleType] = useState(initialData?.scheduleType ?? 'once')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [visibility, setVisibility] = useState(initialData?.visibility ?? 'public')

  const toggleGame = (gameId: string) => {
    setGameIds((prev) =>
      prev.includes(gameId)
        ? prev.filter((id) => id !== gameId)
        : [...prev, gameId],
    )
  }

  return (
    <Card className="animate-fade-in-up border-border bg-card/80 backdrop-blur-sm py-10">
      <Form method="post">
        <CardHeader className="text-center pb-2">
          <p className="mb-2 text-lg font-bold tracking-[0.25em] uppercase animate-fade-in animate-text-shimmer bg-gradient-to-r from-primary via-amber-200 to-primary bg-clip-text text-transparent">
            {submitLabel === 'Create Gathering' ? 'Summon your party' : 'Revise the scroll'}
          </p>
          <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground">
            {submitLabel === 'Create Gathering' ? 'Create a Gathering' : 'Edit Gathering'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {errors.form && (
            <div className="animate-fade-in rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <p className="text-sm text-destructive-foreground">{errors.form}</p>
            </div>
          )}

          <div className="animate-fade-in-up animation-delay-100 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Title</Label>
              <Input id="title" name="title" defaultValue={initialData?.title ?? ''} placeholder="Friday Board Game Night" required />
              {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Games <span className="text-destructive">*</span> <span className="normal-case tracking-normal font-normal text-muted-foreground/60">— select at least one</span></Label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-background/40 px-4 py-2 min-h-[40px] items-center">
                {games.map((game) => (
                  <Button
                    key={game.id}
                    type="button"
                    variant={gameIds.includes(game.id) ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 px-2.5 text-[11px] ${gameIds.includes(game.id) ? '' : 'text-muted-foreground'}`}
                    onClick={() => toggleGame(game.id)}
                  >
                    {game.name}
                  </Button>
                ))}
                {gameIds.map((id) => (
                  <input key={id} type="hidden" name="gameIds" value={id} />
                ))}
              </div>
              {errors.gameIds && <p className="text-sm text-destructive">{errors.gameIds}</p>}
            </div>
          </div>

          <div className="animate-fade-in-up animation-delay-200 grid grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="zipCode" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Zip Code</Label>
              <Input id="zipCode" name="zipCode" defaultValue={initialData?.zipCode ?? ''} placeholder="90210" required maxLength={5} pattern="\d{5}" />
              {errors.zipCode && <p className="text-sm text-destructive">{errors.zipCode}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Schedule</Label>
              <input type="hidden" name="scheduleType" value={scheduleType} />
              <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as GatheringFormData['scheduleType'])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startsAt" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Date & Time</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={initialData?.startsAt ?? ''} required />
              {errors.startsAt && <p className="text-sm text-destructive">{errors.startsAt}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Visibility</Label>
              <input type="hidden" name="visibility" value={visibility} />
              <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as 'public' | 'private')} className="flex gap-3 pt-1">
                <div className="flex items-center space-x-1.5">
                  <RadioGroupItem value="public" id="visibility-public" />
                  <Label htmlFor="visibility-public" className="text-sm font-normal cursor-pointer">Public</Label>
                </div>
                <div className="flex items-center space-x-1.5">
                  <RadioGroupItem value="private" id="visibility-private" />
                  <Label htmlFor="visibility-private" className="text-sm font-normal cursor-pointer">Private</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="animate-fade-in-up animation-delay-300 grid grid-cols-3 gap-4">
            {scheduleType !== 'once' && (
              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">End Date</Label>
                <Input id="endDate" name="endDate" type="date" defaultValue={initialData?.endDate ?? ''} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="durationMinutes" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Duration (min)</Label>
              <Input id="durationMinutes" name="durationMinutes" type="number" defaultValue={initialData?.durationMinutes ?? ''} placeholder="180" min={1} />
              {errors.durationMinutes && <p className="text-sm text-destructive">{errors.durationMinutes}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxPlayers" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Max Players</Label>
              <Input id="maxPlayers" name="maxPlayers" type="number" defaultValue={initialData?.maxPlayers ?? ''} placeholder="6" min={1} />
              {errors.maxPlayers && <p className="text-sm text-destructive">{errors.maxPlayers}</p>}
            </div>
          </div>

          <div className="animate-fade-in-up animation-delay-300 space-y-1.5">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Description (Markdown)</Label>
            <input type="hidden" name="description" value={description} />
            <MarkdownEditor value={description} onChange={setDescription} placeholder="Describe your gathering..." />
            {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
          </div>
        </CardContent>
        <CardFooter className="justify-center pt-4">
          <Button type="submit" className="px-10" disabled={isPending}>
            {isPending ? 'Saving...' : submitLabel}
          </Button>
        </CardFooter>
      </Form>
    </Card>
  )
}
