import { Logo } from '@game-finder/ui/components/logo'
import { useQuery } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router'
import { MapBackground } from '../components/map-background.js'
import { useTRPC } from '../trpc/provider.js'

const POPULAR_TAGS = [
  { label: 'D&D 5e', emoji: '⚔' },
  { label: 'Board Games', emoji: '🎲' },
  { label: 'Warhammer', emoji: '⚔' },
  { label: 'MTG', emoji: '🃏' },
  { label: 'Pathfinder', emoji: '🎲' },
]

const MAP_PINS = [
  { label: '12 games', opacity: 0.5, size: 20 },
  { label: '23 games', opacity: 0.8, size: 24 },
  { label: '8 games', opacity: 0.6, size: 20 },
  { label: '5 games', opacity: 0.4, size: 18 },
]

const HOW_IT_WORKS = [
  { icon: '🔍', label: 'Search', desc: 'Find games by zip code & type' },
  { icon: '📜', label: 'Browse', desc: 'Read details & check availability' },
  { icon: '⚔', label: 'Join', desc: 'Contact the host & roll initiative' },
]

function SearchCard() {
  const [zip, setZip] = useState('')
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  function handleSearch() {
    const params = new URLSearchParams()
    if (zip) params.set('zip', zip)
    if (query) params.set('q', query)
    navigate(`/search?${params.toString()}`)
  }

  function handleTagClick(tag: string) {
    setQuery(tag)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div className="bg-white/[0.04] border border-[rgba(255,191,71,0.15)] rounded-xl p-5 max-w-[420px] mx-auto">
      <div className="flex flex-col md:flex-row gap-2 mb-3">
        <input
          type="text"
          placeholder="Zip Code"
          maxLength={5}
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-black/30 border border-[rgba(255,191,71,0.15)] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 w-full md:w-28"
        />
        <input
          type="text"
          placeholder="Game type..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-black/30 border border-[rgba(255,191,71,0.15)] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 flex-1"
        />
        <button
          onClick={handleSearch}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-bold whitespace-nowrap"
        >
          Search
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {POPULAR_TAGS.map((tag) => (
          <button
            key={tag.label}
            onClick={() => handleTagClick(tag.label)}
            className="bg-[rgba(255,191,71,0.1)] border border-[rgba(255,191,71,0.15)] text-primary rounded-full px-2.5 py-0.5 text-xs cursor-pointer"
          >
            {tag.emoji} {tag.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const trpc = useTRPC()
  const { data: user, isLoading } = useQuery(trpc.auth.me.queryOptions())

  if (isLoading) return null

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
                Welcome back, {user.displayName}
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

        <div className="hidden md:flex gap-7 justify-center items-center mt-8">
          {MAP_PINS.map((pin) => (
            <div key={pin.label} className="text-center" style={{ opacity: pin.opacity }}>
              <div style={{ fontSize: pin.size }}>📍</div>
              <div className="text-[rgba(255,255,255,0.3)] text-xs">{pin.label}</div>
            </div>
          ))}
        </div>

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
                  <div className="text-foreground text-sm font-semibold mb-0.5">{step.label}</div>
                  <div className="text-[rgba(255,255,255,0.35)] text-xs leading-snug">{step.desc}</div>
                </div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block text-[rgba(255,191,71,0.25)] pb-5">→</div>
                )}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="border-t border-[rgba(255,191,71,0.06)] px-6 py-3.5 flex justify-between items-center">
          <span className="text-[rgba(255,255,255,0.2)] text-[11px]">© 2026 gamefinder</span>
          <div className="flex gap-3.5">
            <a href="#" className="text-[rgba(255,255,255,0.2)] text-[11px] hover:text-[rgba(255,255,255,0.4)]">About</a>
            <a href="#" className="text-[rgba(255,255,255,0.2)] text-[11px] hover:text-[rgba(255,255,255,0.4)]">Privacy</a>
            <a href="#" className="text-[rgba(255,255,255,0.2)] text-[11px] hover:text-[rgba(255,255,255,0.4)]">Contact</a>
          </div>
        </div>
      </div>
    </div>
  )
}
