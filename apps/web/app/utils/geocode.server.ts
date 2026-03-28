export type GeocodeResult = {
  lat: number
  lng: number
  label: string
}

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is required')
  }
  return key
}

export async function geocodeAddress(
  address: string,
): Promise<GeocodeResult | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', address)
  url.searchParams.set('key', getApiKey())

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.status}`)
  }

  const data = (await response.json()) as {
    status: string
    results: Array<{
      geometry: { location: { lat: number; lng: number } }
      formatted_address: string
    }>
  }

  if (data.status === 'ZERO_RESULTS' || data.results.length === 0) {
    return null
  }

  if (data.status !== 'OK') {
    throw new Error(`Geocoding API returned status: ${data.status}`)
  }

  const first = data.results[0]
  if (!first) return null

  return {
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    label: first.formatted_address,
  }
}
