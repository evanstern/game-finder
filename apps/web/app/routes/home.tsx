import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { Input } from '@game-finder/ui/components/input'
import { Logo } from '@game-finder/ui/components/logo'
import { Fragment, useState } from 'react'
import { useNavigate, useRouteLoaderData, useSearchParams } from 'react-router'
import {
  LocationInput,
  type LocationValue,
  locationValueToParams,
} from '../components/location-input.js'
import { MapBackground } from '../components/map-background.js'

const POPULAR_TAGS = [
  { label: 'D&D 5e', emoji: '⚔' },
  { label: 'Board Games', emoji: '🎲' },
  { label: 'Warhammer', emoji: '⚔' },
  { label: 'MTG', emoji: '🃏' },
  { label: 'Pathfinder', emoji: '🎲' },
]

const HOW_IT_WORKS = [
  { icon: '🔍', label: 'Search', desc: 'Find games by location & type' },
  { icon: '📜', label: 'Browse', desc: 'Read details & check availability' },
  { icon: '⚔', label: 'Join', desc: 'Contact the host & roll initiative' },
]

function SearchCard() {
  const [location, setLocation] = useState<LocationValue>({
    mode: 'text',
    text: '',
  })
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  function buildLocationParams(): URLSearchParams {
    const params = new URLSearchParams()
    const locParams = locationValueToParams(location)
    for (const [key, value] of Object.entries(locParams)) {
      if (value) params.set(key, value)
    }
    return params
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const locParams = locationValueToParams(location)
    if (!locParams.zip && !locParams.lat && !locParams.address) return

    const params = buildLocationParams()
    if (query) params.set('q', query)
    navigate(`/search?${params.toString()}`)
  }

  function handleTagClick(tag: string) {
    const locParams = locationValueToParams(location)
    if (!locParams.zip && !locParams.lat && !locParams.address) return
    const params = buildLocationParams()
    params.set('q', tag)
    navigate(`/search?${params.toString()}`)
  }

  return (
    <div className="bg-white/[0.04] border border-[rgba(255,191,71,0.15)] rounded-xl p-5 max-w-[420px] mx-auto">
      <form onSubmit={handleSearch} className="flex flex-col gap-2 mb-3">
        <LocationInput
          value={location}
          onChange={setLocation}
          inputClassName="w-full"
        />
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Game type..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm">
            Search
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {POPULAR_TAGS.map((tag) => (
          <Badge
            key={tag.label}
            variant="outline"
            className="cursor-pointer border-primary/20 bg-primary/10 text-primary hover:bg-primary/20"
            onClick={() => handleTagClick(tag.label)}
          >
            {tag.emoji} {tag.label}
          </Badge>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const rootData = useRouteLoaderData('root') as {
    user: { displayName: string } | null
  }
  const user = rootData?.user
  const [searchParams] = useSearchParams()
  const isNewUser = searchParams.get('welcome') === 'new'

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />

      <div className="relative z-10">
        <div className="px-6 pt-12 pb-8 text-center md:pt-20 md:pb-12">
          <div className="hidden md:block lg:hidden mb-4">
            <Logo size="md" />
          </div>
          <div className="hidden lg:block mb-4">
            <Logo size="lg" />
          </div>

          {user ? (
            <>
              <p className="text-xs text-[rgba(255,191,71,0.5)] uppercase tracking-[0.2em] mb-2">
                {isNewUser ? 'Welcome' : 'Welcome back'}, {user.displayName}
              </p>
              <p className="text-muted-foreground text-sm">
                Find your next game night
              </p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm mb-1.5">
                Navigate to tabletop adventures in your area.
              </p>
              <p className="text-xs text-[rgba(255,191,71,0.5)] uppercase tracking-[0.2em]">
                Every game night is a new quest
              </p>
            </>
          )}
        </div>

        <SearchCard />

        <div className="border-t border-[rgba(255,191,71,0.08)] mt-10 pt-8 pb-6 px-6">
          <p className="text-center text-xs text-[rgba(255,191,71,0.5)] uppercase tracking-[0.2em] mb-5">
            How It Works
          </p>
          <div className="flex flex-col md:flex-row gap-4 md:gap-4 justify-center items-center max-w-lg mx-auto">
            {HOW_IT_WORKS.map((step, i) => (
              <Fragment key={step.label}>
                <div className="text-center flex-1">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full border border-[rgba(255,191,71,0.2)] bg-[rgba(255,191,71,0.1)] flex items-center justify-center text-base">
                    {step.icon}
                  </div>
                  <div className="text-foreground text-sm font-semibold mb-0.5">
                    {step.label}
                  </div>
                  <div className="text-[rgba(255,255,255,0.35)] text-xs leading-snug">
                    {step.desc}
                  </div>
                </div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block text-[rgba(255,191,71,0.25)] pb-5">
                    →
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="border-t border-[rgba(255,191,71,0.06)] px-6 py-3.5 flex justify-between items-center">
          <span className="text-[rgba(255,255,255,0.2)] text-[11px]">
            © 2026 gamefinder
          </span>
          <div className="flex gap-3.5">
            <span className="text-[rgba(255,255,255,0.2)] text-[11px] hover:text-[rgba(255,255,255,0.4)] cursor-pointer">
              About
            </span>
            <span className="text-[rgba(255,255,255,0.2)] text-[11px] hover:text-[rgba(255,255,255,0.4)] cursor-pointer">
              Privacy
            </span>
            <span className="text-[rgba(255,255,255,0.2)] text-[11px] hover:text-[rgba(255,255,255,0.4)] cursor-pointer">
              Contact
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
