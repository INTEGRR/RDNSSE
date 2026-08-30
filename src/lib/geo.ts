export interface LatLng {
  lat: number
  lng: number
}

const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180

/** Distance in meters between two coordinates (haversine). */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Initial bearing from a to b, degrees 0..360 (0 = North). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = rad(a.lat)
  const φ2 = rad(b.lat)
  const Δλ = rad(b.lng - a.lng)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

/** Walking time estimate at ~4.8 km/h. */
export function walkMinutes(m: number): number {
  return Math.max(1, Math.round(m / 80))
}

const CARDINALS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW']

export function cardinal(deg: number): string {
  return CARDINALS[Math.round(deg / 45) % 8]
}

/** Smallest signed angle difference a-b in degrees (-180..180). */
export function angleDelta(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180
}
