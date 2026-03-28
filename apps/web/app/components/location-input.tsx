import { Button } from '@game-finder/ui/components/button'
import { Input } from '@game-finder/ui/components/input'
import { useCallback, useState } from 'react'

export type LocationValue =
  | { mode: 'text'; text: string }
  | { mode: 'geolocation'; lat: number; lng: number }

interface LocationInputProps {
  value: LocationValue
  onChange: (value: LocationValue) => void
  className?: string
  inputClassName?: string
}

export function LocationInput({
  value,
  onChange,
  className,
  inputClassName,
}: LocationInputProps) {
  const [locating, setLocating] = useState(false)

  const handleGeolocate = useCallback(() => {
    if (
      typeof navigator === 'undefined' ||
      !('geolocation' in navigator) ||
      locating
    ) {
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          mode: 'geolocation',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLocating(false)
      },
      () => {
        setLocating(false)
      },
    )
  }, [locating, onChange])

  const displayValue =
    value.mode === 'geolocation' ? 'Current Location' : value.text

  return (
    <div className={className}>
      <div className="flex gap-1.5">
        <Input
          type="text"
          placeholder="Zip, city, or address"
          value={displayValue}
          onChange={(e) => onChange({ mode: 'text', text: e.target.value })}
          className={inputClassName}
          readOnly={value.mode === 'geolocation'}
          onClick={() => {
            if (value.mode === 'geolocation') {
              onChange({ mode: 'text', text: '' })
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 px-2 text-muted-foreground hover:text-primary"
          onClick={handleGeolocate}
          disabled={locating}
          title="Use my location"
        >
          {locating ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              role="img"
              aria-label="Use my location"
            >
              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          )}
        </Button>
      </div>
    </div>
  )
}

export function locationValueToParams(value: LocationValue): {
  zip?: string
  address?: string
  lat?: string
  lng?: string
  locationLabel?: string
} {
  if (value.mode === 'geolocation') {
    return {
      lat: String(value.lat),
      lng: String(value.lng),
      locationLabel: 'Current Location',
    }
  }

  const text = value.text.trim()
  if (/^\d{5}$/.test(text)) {
    return { zip: text }
  }

  if (text) {
    return { address: text }
  }

  return {}
}
