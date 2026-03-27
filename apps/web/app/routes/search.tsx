import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { Card, CardContent } from '@game-finder/ui/components/card'
import { Input } from '@game-finder/ui/components/input'
import { Label } from '@game-finder/ui/components/label'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@game-finder/ui/components/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@game-finder/ui/components/select'
import { useState } from 'react'
import { Link, useNavigation, useSearchParams } from 'react-router'
import { ClientDate, SCHEDULE_LABELS } from '../components/client-date.js'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/search.js'

type GameType = 'board_game' | 'ttrpg' | 'card_game'

const GAME_TYPE_LABELS: Record<GameType, string> = {
  board_game: 'Board Games',
  ttrpg: 'TTRPGs',
  card_game: 'Card Games',
}

const RADIUS_OPTIONS = [5, 10, 25, 50]

export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const url = new URL(request.url)
  const zip = url.searchParams.get('zip') ?? ''

  if (!zip) return { results: null }

  const trpc = createServerTRPC(ctx.cookie ?? '')
  const radius = Number(url.searchParams.get('radius')) || 25
  const query = url.searchParams.get('q') ?? ''
  const typesParam = url.searchParams.get('types')
  const gameTypes = typesParam ? typesParam.split(',').filter(Boolean) as GameType[] : undefined
  const sortBy = (url.searchParams.get('sort') ?? 'distance') as 'distance' | 'next_session'
  const page = Number(url.searchParams.get('page')) || 1

  try {
    const results = await trpc.gathering.search.query({
      zipCode: zip,
      radius,
      query: query || undefined,
      gameTypes: gameTypes && gameTypes.length > 0 ? gameTypes : undefined,
      sortBy,
      page,
      pageSize: 20,
    })

    return { results, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed'
    const isInvalidZip = message.toLowerCase().includes('zip') || message.toLowerCase().includes('location')
    return { results: null, error: isInvalidZip ? `Invalid ZIP code "${zip}". Please enter a valid 5-digit US ZIP code.` : message }
  }
}

function GameTypeBadge({ type }: { type: GameType }) {
  const colorMap: Record<GameType, string> = {
    board_game: 'bg-primary/15 text-primary border-primary/20',
    ttrpg: 'bg-teal/15 text-teal border-teal/20',
    card_game: 'bg-plum/15 text-plum border-plum/20',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${colorMap[type]}`}
    >
      {GAME_TYPE_LABELS[type]}
    </span>
  )
}

export default function SearchPage({ loaderData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const [searchParams, setSearchParams] = useSearchParams()

  const urlZip = searchParams.get('zip') ?? ''
  const urlRadius = Number(searchParams.get('radius')) || 25
  const urlQuery = searchParams.get('q') ?? ''
  const urlTypes = searchParams.get('types')?.split(',').filter(Boolean) as
    | GameType[]
    | undefined
  const urlSort = (searchParams.get('sort') ?? 'distance') as
    | 'distance'
    | 'next_session'
  const urlPage = Number(searchParams.get('page')) || 1

  const [zipInput, setZipInput] = useState(urlZip)
  const [radiusInput, setRadiusInput] = useState(urlRadius)
  const [queryInput, setQueryInput] = useState(urlQuery)

  const hasSearched = !!urlZip
  const isLoading = navigation.state === 'loading'
  const data = loaderData.results
  const searchError = loaderData.error

  function updateSearchParams(updates: Record<string, string | undefined>) {
    const newParams = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === '') {
        newParams.delete(key)
      } else {
        newParams.set(key, value)
      }
    }
    setSearchParams(newParams)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!zipInput || !/^\d{5}$/.test(zipInput)) return
    updateSearchParams({
      zip: zipInput,
      radius: String(radiusInput),
      q: queryInput || undefined,
      page: '1',
    })
  }

  function toggleGameType(type: GameType) {
    const current = urlTypes ?? []
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    updateSearchParams({
      types: next.length > 0 ? next.join(',') : undefined,
      page: '1',
    })
  }

  function setSort(sort: 'distance' | 'next_session') {
    updateSearchParams({ sort, page: '1' })
  }

  function goToPage(page: number) {
    updateSearchParams({ page: String(page) })
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />
      <div className="relative z-10 mx-auto max-w-5xl px-6 py-10">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="zip" className="text-xs text-muted-foreground">
              ZIP Code
            </Label>
            <Input
              id="zip"
              type="text"
              placeholder="e.g. 10001"
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              className="w-28"
              maxLength={5}
              pattern="\d{5}"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Radius
            </Label>
            <Select value={String(radiusInput)} onValueChange={(v) => setRadiusInput(Number(v))}>
              <SelectTrigger className="w-28" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RADIUS_OPTIONS.map((r) => (
                  <SelectItem key={r} value={String(r)}>
                    {r} miles
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label
              htmlFor="query"
              className="text-xs text-muted-foreground"
            >
              Keyword (optional)
            </Label>
            <Input
              id="query"
              type="text"
              placeholder="e.g. Catan, D&D..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm">
            Search
          </Button>
        </div>
      </form>

      {searchError && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive-foreground">{searchError}</p>
        </div>
      )}

      {!hasSearched && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-center text-muted-foreground">
            Enter your ZIP code to find tabletop gatherings near you.
          </p>
        </div>
      )}

      {hasSearched && (
        <div className="flex gap-8">
          <aside className="w-48 shrink-0">
            <div className="sticky top-8 space-y-6">
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Game Type
                </h3>
                <div className="flex flex-col gap-1">
                  {(
                    Object.entries(GAME_TYPE_LABELS) as [GameType, string][]
                  ).map(([type, label]) => (
                    <Button
                      key={type}
                      variant={urlTypes?.includes(type) ? 'secondary' : 'ghost'}
                      size="sm"
                      className={urlTypes?.includes(type) ? 'justify-start text-primary' : 'justify-start text-muted-foreground'}
                      onClick={() => toggleGameType(type)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Sort By
                </h3>
                <div className="flex flex-col gap-1">
                  <Button
                    variant={urlSort === 'distance' ? 'secondary' : 'ghost'}
                    size="sm"
                    className={urlSort === 'distance' ? 'justify-start text-primary' : 'justify-start text-muted-foreground'}
                    onClick={() => setSort('distance')}
                  >
                    Distance
                  </Button>
                  <Button
                    variant={urlSort === 'next_session' ? 'secondary' : 'ghost'}
                    size="sm"
                    className={urlSort === 'next_session' ? 'justify-start text-primary' : 'justify-start text-muted-foreground'}
                    onClick={() => setSort('next_session')}
                  >
                    Next Session
                  </Button>
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            {isLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-lg border border-border bg-card/40"
                  />
                ))}
              </div>
            )}

            {data && !isLoading && (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  {data.total} gathering{data.total !== 1 ? 's' : ''} near{' '}
                  {data.searchLocation.city}, {data.searchLocation.state}
                </p>

                {data.gatherings.length === 0 ? (
                  <div className="flex min-h-[30vh] items-center justify-center">
                    <p className="text-center text-muted-foreground">
                      No gatherings found within {urlRadius} miles. Try
                      expanding your search radius.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.gatherings.map((gathering) => (
                      <Link
                        key={gathering.id}
                        to={`/gatherings/${gathering.id}`}
                        className="block"
                      >
                        <Card className="transition-colors hover:border-primary/30">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-display text-sm font-semibold text-foreground">
                                  {gathering.title}
                                </h3>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {SCHEDULE_LABELS[gathering.scheduleType]}{' '}
                                  &middot; Hosted by{' '}
                                  {gathering.hostDisplayName}
                                </p>
                              </div>
                              <Badge
                                variant="secondary"
                                className="shrink-0 font-mono text-xs text-primary"
                              >
                                {gathering.distanceMiles} mi
                              </Badge>
                            </div>

                            {gathering.games.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {[...new Set(gathering.games.map((game) => game.type as GameType))].map((type) => (
                                  <GameTypeBadge
                                    key={type}
                                    type={type}
                                  />
                                ))}
                                {gathering.games.map((game) => (
                                  <span
                                    key={`name-${game.id}`}
                                    className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                                  >
                                    {game.name}
                                  </span>
                                ))}
                              </div>
                            )}

                            {gathering.description && (
                              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                {gathering.description}
                              </p>
                            )}

                            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                              <span>
                                Next: <ClientDate date={gathering.nextOccurrenceAt} dateStyle="medium" />
                              </span>
                              {gathering.maxPlayers && (
                                <span>
                                  Up to {gathering.maxPlayers} players
                                </span>
                              )}
                              <span>{gathering.locationLabel}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}

                {totalPages > 1 && (
                  <Pagination className="mt-6">
                    <PaginationContent>
                      {urlPage > 1 && (
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              goToPage(urlPage - 1)
                            }}
                          />
                        </PaginationItem>
                      )}
                      {Array.from(
                        { length: totalPages },
                        (_, i) => i + 1,
                      ).map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === urlPage}
                            onClick={(e) => {
                              e.preventDefault()
                              goToPage(p)
                            }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      {urlPage < totalPages && (
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              goToPage(urlPage + 1)
                            }}
                          />
                        </PaginationItem>
                      )}
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            )}
          </main>
        </div>
      )}
    </div>
    </div>
  )
}
