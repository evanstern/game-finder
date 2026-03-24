import { Button } from '@game-finder/ui/components/button'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTRPC } from '../trpc/provider.js'

function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-[0.03] blur-[100px]" />
      <div className="absolute inset-0 bg-noise" />
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  delay,
  colorClass,
  borderClass,
}: {
  icon: string
  title: string
  description: string
  delay: string
  colorClass: string
  borderClass: string
}) {
  return (
    <div className={`animate-fade-in-up ${delay} rounded-lg border ${borderClass} bg-card/60 p-6 backdrop-blur-sm transition-colors duration-200 hover:border-primary/20`}>
      <div className="mb-3 text-2xl">{icon}</div>
      <h3 className={`font-display mb-2 text-sm font-semibold tracking-wide ${colorClass}`}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

export default function Home() {
  const trpc = useTRPC()
  const { data: user, isLoading } = useQuery(trpc.auth.me.queryOptions())

  if (isLoading) return null

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <HeroBackground />

      <div className="relative mx-auto max-w-5xl px-6">
        {user ? (
          <div className="flex min-h-[calc(100vh-65px)] flex-col items-center justify-center">
            <div className="animate-fade-in-up text-center">
              <p className="font-display mb-1 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                Welcome back
              </p>
              <h1 className="font-display mb-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {user.displayName}
              </h1>
              <p className="mx-auto max-w-sm text-base leading-relaxed text-muted-foreground">
                Game listings are coming soon. Check back to find tabletop
                games near you.
              </p>
            </div>

            <div className="animate-fade-in-up animation-delay-200 mt-10 rounded-lg border border-accent/20 bg-card/40 px-8 py-5 text-center backdrop-blur-sm">
              <p className="font-display text-[11px] font-semibold tracking-[0.15em] text-accent uppercase">
                Coming soon
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Search by zip code &middot; Browse listings &middot;
                Contact hosts
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex min-h-[65vh] flex-col items-center justify-center pb-16 pt-24 text-center">
              <p className="animate-fade-in-up font-display text-[11px] font-semibold tracking-[0.25em] text-primary uppercase">
                Find your party
              </p>
              <h1 className="animate-fade-in-up animation-delay-100 font-display mt-5 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
                <span className="text-gradient-amber">Your Next</span>
                <br />
                <span className="text-foreground">Adventure Awaits</span>
              </h1>
              <p className="animate-fade-in-up animation-delay-200 mx-auto mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                Discover local tabletop games near you. Board games, D&D,
                RPGs&mdash;find open seats, meet players, and roll initiative.
              </p>
              <div className="animate-fade-in-up animation-delay-300 mt-10 flex gap-4">
                <Button size="lg" asChild>
                  <Link to="/signup">Start Playing</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/login">Log In</Link>
                </Button>
              </div>
            </div>

            <div className="mx-auto max-w-2xl pb-24">
              <p className="animate-fade-in font-display mb-8 text-center text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                How it works
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <FeatureCard
                  icon="&#x1F4CD;"
                  title="Search Locally"
                  description="Enter your zip code to find tabletop games hosted near you."
                  delay="animation-delay-100"
                  colorClass="text-teal"
                  borderClass="border-teal"
                />
                <FeatureCard
                  icon="&#x1F3B2;"
                  title="Browse Games"
                  description="Filter by game type, player count, and experience level."
                  delay="animation-delay-200"
                  colorClass="text-copper"
                  borderClass="border-copper"
                />
                <FeatureCard
                  icon="&#x1F4E8;"
                  title="Join the Table"
                  description="Contact the host and secure your seat at the table."
                  delay="animation-delay-300"
                  colorClass="text-plum"
                  borderClass="border-plum"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
