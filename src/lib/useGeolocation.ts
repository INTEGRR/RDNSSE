import { useEffect, useState } from 'react'

export interface GeoState {
  pos: { lat: number; lng: number } | null
  accuracy: number | null
  /** GPS movement heading (degrees), only while moving */
  course: number | null
  error: string | null
}

export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({ pos: null, accuracy: null, course: null, error: null })

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState(s => ({ ...s, error: 'Kein GPS in diesem Browser' }))
      return
    }
    const id = navigator.geolocation.watchPosition(
      p => {
        setState({
          pos: { lat: p.coords.latitude, lng: p.coords.longitude },
          accuracy: p.coords.accuracy,
          course: p.coords.heading != null && !Number.isNaN(p.coords.heading) && (p.coords.speed ?? 0) > 0.5
            ? p.coords.heading
            : null,
          error: null,
        })
      },
      e => {
        setState(s => ({
          ...s,
          error: e.code === e.PERMISSION_DENIED
            ? 'Standort-Zugriff verweigert — bitte in den Einstellungen erlauben'
            : 'Kein GPS-Signal',
        }))
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  return state
}
